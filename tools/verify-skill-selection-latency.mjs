// Real loopback auth/save handlers and isolated memory DB. No fabricated API responses.
import assert from 'node:assert/strict';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { startFixture } from './verify-campaign-http.mjs';

const scratch = resolve(homedir(), 'AppData/Local/hermes/cache/scratch');
const deferred = () => {
  let resolvePromise;
  const promise = new Promise(resolve => { resolvePromise = resolve; });
  return { promise, resolve: resolvePromise };
};
async function playwrightModule() {
  const candidates = [process.env.PLAYWRIGHT_MODULE,
    resolve(scratch, 'combat-camera-browser/node_modules/playwright-core/index.mjs'),
    resolve(scratch, 'artemis-browser/node_modules/playwright-core/index.mjs')].filter(Boolean);
  for (const candidate of candidates) {
    try { await access(candidate); return import(pathToFileURL(candidate).href); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  throw Error('Playwright not found in current user scratch; set PLAYWRIGHT_MODULE to its index.mjs');
}

export async function verifySkillSelectionLatency() {
  const evidence = resolve(scratch, 'skill-selection-latency-evidence.json');
  const result = { status: 'RUNNING', scope: 'Isolated memory DB, real loopback HTTP auth/save, own headless Chrome only; fixture stage-5 clear, not natural combat', checks: [], errors: [] };
  let fixture, browser;
  const gates = [];
  try {
    fixture = await startFixture();
    result.http = fixture.requests;
    const { chromium } = await playwrightModule();
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-extensions', '--disable-background-networking'] });
    const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => result.errors.push(error.message));
    let offerGate, claimGate, dropClaims = false, droppedClaims = 0;
    function gate() {
      const entered = deferred(), release = deferred();
      const value = { entered, release, hits: 0 };
      gates.push(value);
      return value;
    }
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== fixture.origin) return route.abort();
      if (url.pathname === '/api/save' && request.method() === 'PUT') {
        const cp = request.postDataJSON()?.data?.dungeonCheckpoint;
        if (offerGate && cp?.runProgression?.pendingOffer?.stageId === offerGate.stage && cp.runProgression.choicesUsed === offerGate.choices) {
          const current = offerGate;
          current.hits++;
          current.entered.resolve();
          await current.release.promise;
        }
        if (cp?.runProgression?.choicesUsed === claimGate?.choices) {
          const current = claimGate;
          current.hits++;
          current.entered.resolve();
          await current.release.promise;
        }
        if (dropClaims && cp?.runProgression?.choicesUsed === 2) {
          droppedClaims++;
          return route.abort('internetdisconnected');
        }
      }
      return route.continue();
    });
    const registration = await context.request.post(fixture.origin + '/api/auth/register', { data: { username: 'latency_' + randomBytes(5).toString('hex'), password: 'fixture-password-only' } });
    assert.equal(registration.status(), 201);
    const read = async () => {
      const response = await context.request.get(fixture.origin + '/api/save');
      assert.equal(response.status(), 200);
      return (await response.json()).data.dungeonCheckpoint;
    };
    const state = () => page.evaluate(() => {
      const g = window.Archero2FusionAPI.Game;
      return { paused: g.paused, busy: g.skillClaimBusy, skills: { ...g.player.skills }, progression: g.runProgression, pendingClaimId: g.pendingClaimId, maxHp: g.player.maxHp };
    });
    const flush = async () => assert.equal(await page.evaluate(() => window.ArtemisCloud.flushCheckpoint()), true, 'real checkpoint flush succeeds');
    const bounded = promise => Promise.race([promise, new Promise((_, reject) => { const timer = setTimeout(() => reject(Error('Timed out waiting for delayed real request')), 12000); timer.unref(); })]);
    const waitIdle = () => page.waitForFunction(() => !window.Archero2FusionAPI.Game.skillClaimBusy);
    const assertPaused = async label => {
      assert.equal((await state()).paused, true, label + ': gameplay remains paused');
      assert.equal(await page.locator('#skillSelectModal').isVisible(), true, label + ': modal stays visible');
    };
    async function selectWhileOfferDelayed(stage, choices, trigger, loseClaim = false) {
      offerGate = Object.assign(gate(), { stage, choices });
      await trigger();
      await page.waitForSelector('#skillSelectModal:not(.hidden)');
      await bounded(offerGate.entered.promise);
      const before = await state();
      const card = page.locator('.skill-choice-card').first();
      const skill = await card.getAttribute('data-skill-id');
      // Dispatch actual DOM clicks in one JS task: no await/actionability polling can
      // accidentally let acknowledgement win this race. Double tap + other choice.
      const feedback = await card.evaluate(element => {
        element.click();
        element.click();
        document.querySelectorAll('.skill-choice-card')[1]?.click();
        return { busy: element.dataset.claimBusy, ariaBusy: element.getAttribute('aria-busy'), selected: element.classList.contains('selected') || element.getAttribute('aria-selected') === 'true' || element.getAttribute('aria-pressed') === 'true' };
      });
      // Immediate grant closes the picker synchronously; no intermediate busy card is required.
      const immediate = await state();
      assert.deepEqual(immediate.skills, { ...before.skills, [skill]: (before.skills[skill] || 0) + 1 }, 'skill applies before any offer acknowledgement');
      assert.equal(immediate.paused, false, 'combat resumes immediately');
      assert.equal(await page.locator('#skillSelectModal').isVisible(), false, 'modal closes immediately');
      const savedBefore = await read();
      assert.equal(savedBefore?.runProgression?.choicesUsed || 0, choices, 'server has no early grant');
      claimGate = Object.assign(gate(), { choices: choices + 1 });
      dropClaims = loseClaim;
      offerGate.release.resolve();
      await bounded(claimGate.entered.promise);
      const applied = await state();
      assert.equal(applied.progression.choicesUsed, choices + 1);
      assert.deepEqual(applied.skills, { ...before.skills, [skill]: (before.skills[skill] || 0) + 1 }, 'double tap and alternate choice grant only selected skill once');
      assert.equal((await state()).paused, false, 'claim saves in background without pausing combat');
      assert.equal((await read()).runProgression.choicesUsed, choices, 'real GET still has unclaimed offer while claim PUT is held');
      claimGate.release.resolve();
      if (loseClaim) await page.waitForFunction(() => !!window.ArtemisCloud.getState().lastError);
      else await flush();
      if (!loseClaim) {
        await page.waitForSelector('#skillSelectModal.hidden', { state: 'attached' });
        assert.equal((await state()).paused, false);
        const saved = await read();
        assert.deepEqual(saved.player.skills, applied.skills);
        assert.equal(saved.runProgression.choicesUsed, choices + 1);
        assert.equal(saved.runProgression.claimedStages.filter(value => value === stage).length, 1);
      }
      result.checks.push({ name: `${stage}: skill applied and combat resumed immediately; ordered offer/claim saved in background`, skill, offerRequests: offerGate.hits, claimRequests: claimGate.hits });
      offerGate = null;
      claimGate = null;
      return applied;
    }
    await page.goto(fixture.origin, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.Archero2FusionAPI && window.ArtemisCloud?.getState().ready);
    await page.evaluate(() => window.Archero2FusionAPI.stopGameLoop());
    await page.locator('#bottomNavBar [data-tab="tabBattle"]').first().click();
    // Navigation geometry is outside this regression; invoke the real launch
    // button rather than depending on its overlap with the fixed bottom nav.
    await page.locator('#btnStartGame').evaluate(button => button.click());
    await selectWhileOfferDelayed('start', 0, async () => {
      await page.locator('#btnBriefingStart').click();
      await page.evaluate(() => window.Archero2FusionAPI.stopGameLoop());
    });
    const applied = await selectWhileOfferDelayed(5, 1, async () => {
      await page.evaluate(() => {
        const a = window.Archero2FusionAPI, g = a.Game;
        a.stopGameLoop(); g.running = true; g.paused = false; a.setupRoom(5);
        for (const enemy of [...g.enemies]) a.damageEnemy(enemy, enemy.maxHp * 100, true);
        g.drops = [];
        if (!g.valkyrieNpc) throw Error('Stage 5 fixture clear did not spawn Valkyrie');
        g.player.x = g.valkyrieNpc.x; g.player.y = g.valkyrieNpc.y;
        a.updateGame(.001);
      });
    }, true);
    assert.ok(droppedClaims > 0, 'post-apply claim request actually lost transport');
    assert.equal(await page.locator('#skillSelectModal').isVisible(), false, 'failed background save does not reopen card picker');
    assert.equal((await read()).runProgression.choicesUsed, 1);
    // Retry transport only, never re-run the card grant or its max-HP side effects.
    await context.setOffline(true);
    assert.equal(await page.evaluate(() => window.ArtemisCloud.flushCheckpoint()), false);
    assert.deepEqual((await state()).skills, applied.skills);
    assert.equal((await state()).maxHp, applied.maxHp);
    await context.setOffline(false);
    dropClaims = false;
    await flush();
    await page.waitForSelector('#skillSelectModal.hidden', { state: 'attached' });
    const final = await state(), saved = await read();
    assert.deepEqual(final.skills, applied.skills);
    assert.equal(final.maxHp, applied.maxHp);
    assert.equal(final.progression.choicesUsed, 2);
    assert.deepEqual(final.progression.claimedStages, ['start', 5]);
    assert.deepEqual(saved.player.skills, final.skills);
    assert.deepEqual(saved.runProgression, final.progression);
    assert.equal(final.paused, false);
    result.checks.push({ name: 'offline post-apply claim + offline retry + online retry persist exactly once via real GET', droppedClaims, skills: final.skills });
    assert.deepEqual(result.errors, []);
    result.status = 'PASS';
  } catch (error) {
    result.status = 'FAIL'; result.error = error.stack; process.exitCode = 1;
  } finally {
    for (const gate of gates) gate.release.resolve();
    await browser?.close();
    await fixture?.close();
    await mkdir(dirname(evidence), { recursive: true });
    await writeFile(evidence, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ status: result.status, evidence, checks: result.checks, error: result.error, httpFailures: result.http?.filter(request => request.status >= 400) }));
  }
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await verifySkillSelectionLatency();
