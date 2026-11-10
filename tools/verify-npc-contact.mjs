// Real production HTTP handlers + isolated DB; fixture room clears, not natural combat.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { startFixture } from './verify-campaign-http.mjs';

const scratch = resolve(homedir(), 'AppData/Local/hermes/cache/scratch');
const deferred = () => { let release; const promise = new Promise(r => { release = r; }); return { promise, release }; };
const bounded = promise => Promise.race([promise, new Promise((_, reject) => { const t = setTimeout(() => reject(Error('Real offer PUT did not reach held route')), 12000); t.unref(); })]);

export async function verifyNpcContact() {
  const directory = resolve(scratch, 'npc-contact-evidence');
  await mkdir(directory, { recursive: true });
  const result = { status: 'RUNNING', scope: 'Real loopback HTTP auth/save, isolated memory DB, own Chrome. Production setupRoom/damage/update/render with artificial room jumps and discarded drops; not natural campaign traversal.', checks: [], errors: [] };
  let fixture, browser;
  try {
    fixture = await startFixture();
    result.http = fixture.requests;
    const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || resolve(scratch, 'combat-camera-browser/node_modules/playwright-core/index.mjs')).href);
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-extensions', '--disable-background-networking'] });
    for (const stage of [5, 9, 10]) {
      const check = { stage, kind: stage === 5 ? 'valkyrie' : stage === 9 ? 'angel' : 'devil', assertions: [] };
      result.checks.push(check);
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      page.on('pageerror', error => result.errors.push({ stage, message: error.message }));
      const gate = deferred(), entered = deferred();
      let hold = false, hits = 0;
      const read = async () => { const r = await context.request.get(fixture.origin + '/api/save'); assert.equal(r.status(), 200); return (await r.json()).data.dungeonCheckpoint; };
      const flush = async () => assert.equal(await page.evaluate(() => window.ArtemisCloud.flushCheckpoint()), true, 'real checkpoint flush succeeds');
      try {
        await page.route('**/*', async route => {
          const request = route.request(), url = new URL(request.url());
          if (url.origin !== fixture.origin) return route.abort();
          if (hold && url.pathname === '/api/save' && request.method() === 'PUT') {
            const cp = request.postDataJSON()?.data?.dungeonCheckpoint;
            const pending = stage === 5 ? cp?.runProgression?.pendingOffer?.stageId === stage : cp?.encounters?.pending?.stage === stage;
            if (pending) { hits++; entered.release(); await gate.promise; }
          }
          return route.continue();
        });
        const registration = await context.request.post(fixture.origin + '/api/auth/register', { data: { username: 'npc_' + randomBytes(6).toString('hex'), password: 'fixture-password-only' } });
        assert.equal(registration.status(), 201);
        await page.goto(fixture.origin, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.Archero2FusionAPI && window.ArtemisCloud?.getState().ready);
        await page.evaluate(() => window.Archero2FusionAPI.stopGameLoop());
        await page.locator('#bottomNavBar [data-tab="tabBattle"]').first().click();
        await page.locator('#btnStartGame').evaluate(b => b.click());
        await page.locator('#btnBriefingStart').click();
        await page.waitForSelector('#skillSelectModal:not(.hidden)');
        await page.evaluate(() => window.Archero2FusionAPI.stopGameLoop());
        await page.locator('.skill-choice-card').first().click();
        await flush();
        hold = true;
        check.geometry = await page.evaluate(stage => {
          const a = window.Archero2FusionAPI, g = a.Game;
          a.stopGameLoop(); g.running = true; g.paused = false; a.setupRoom(stage);
          for (const enemy of [...g.enemies]) a.damageEnemy(enemy, enemy.maxHp * 100, true);
          g.drops = [];
          g.player.x = 80; g.player.y = Math.max(240, g.portalRect.y + g.portalRect.h + 230);
          a.updateGame(.001);
          const npc = stage === 5 ? g.valkyrieNpc : g.encounterNpc;
          if (!npc) throw Error('Production room clear did not spawn NPC');
          // Persist the real room-clear/bossDefeated checkpoint before encounter offer.
          window.__campaignHTTP.saveCheckpoint();
          a.renderGame?.();
          return { npc: { x: npc.x, y: npc.y, r: npc.r }, portal: { ...g.portalRect }, cleared: g.roomCleared, enemies: g.enemies.length, playerRadius: g.player.r };
        }, stage);
        const modal = page.locator(stage === 5 ? '#skillSelectModal' : '.campaign-encounter');
        assert.equal(await modal.isVisible(), false, 'distance must not open modal');
        check.assertions.push('No modal from distance');
        const { npc, portal } = check.geometry;
        assert.ok(Math.abs(npc.x - (portal.x + portal.w / 2)) <= 8, 'NPC centered in front of portal');
        assert.ok(Math.abs(npc.y - (portal.y + portal.h + 65)) <= 10, 'NPC reachable 65px below portal bottom');
        check.assertions.push('Portal-front geometry');
        // Valkyrie prepares its offer on room clear, so its actual PUT may already be held.
        // Other encounters first save room-clear; flush it before touch.
        if (stage !== 5) {
          await flush();
          const cleared = await read();
          assert.equal(cleared.boundary, 'cleared');
          assert.equal(cleared.roomCleared, true, 'server derives bossDefeated from real cleared checkpoint');
        }
        const immediate = await page.evaluate(stage => {
          const a = window.Archero2FusionAPI, g = a.Game, n = stage === 5 ? g.valkyrieNpc : g.encounterNpc;
          g.player.x = n.x; g.player.y = n.y;
          a.updateGame(.001);
          const node = document.querySelector(stage === 5 ? '#skillSelectModal' : '.campaign-encounter');
          return { visible: !!node && !node.classList.contains('hidden') && getComputedStyle(node).display !== 'none', paused: g.paused };
        }, stage);
        assert.equal(immediate.visible, true, 'touch popup renders synchronously before network acknowledgement');
        assert.equal(immediate.paused, true, 'popup pauses game on contact');
        await bounded(entered.promise);
        assert.ok(hits > 0, 'actual offer PUT is held, not fake response');
        assert.equal(await modal.isVisible(), true, 'popup remains visible while real offer PUT is held');
        const beforeRelease = await read();
        assert.equal(stage === 5 ? beforeRelease?.runProgression?.pendingOffer?.stageId === stage : beforeRelease?.encounters?.pending?.stage === stage, false, 'held offer not yet persisted');
        check.assertions.push('Immediate popup with actual unacknowledged offer PUT');
        check.mobileScreenshot = resolve(directory, `stage-${stage}-390x844.png`);
        await page.screenshot({ path: check.mobileScreenshot });
        hold = false; gate.release(); await flush();
        const offered = await read();
        assert.equal(stage === 5 ? offered.runProgression.pendingOffer.stageId : offered.encounters.pending.stage, stage, 'real GET confirms offer persisted');
        const card = page.locator(stage === 5 ? '.skill-choice-card' : '.campaign-encounter .encounter-card').first();
        await card.waitFor({ state: 'visible' });
        await page.waitForFunction(selector => !document.querySelector(selector)?.disabled, stage === 5 ? '.skill-choice-card' : '.campaign-encounter .encounter-card');
        check.cardStyle = await card.evaluate(e => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return { clipPath: s.clipPath, borderRadius: s.borderRadius, borderWidth: s.borderTopWidth, backgroundImage: s.backgroundImage, width: r.width, height: r.height }; });
        check.unifiedStyle = check.cardStyle.clipPath.startsWith('polygon(');
        await card.click(); // Actual pointer/actionability path, never evaluate(button.click()).
        await flush();
        await page.waitForFunction(stage => { const g = window.Archero2FusionAPI.Game; return stage === 5 ? !g.skillClaimBusy && g.runProgression.claimedStages.includes(stage) : g.campaignEncounters.receipts.some(r => r.stage === stage); }, stage);
        const saved = await read();
        if (stage === 5) assert.equal(saved.runProgression.claimedStages.filter(s => s === stage).length, 1);
        else {
          assert.equal(saved.encounters.pending, null);
          assert.equal(saved.encounters.receipts.filter(r => r.stage === stage).length, 1);
          assert.equal(saved.encounters.receipts.find(r => r.stage === stage).choice, stage === 9 ? 'maxHp' : 'accept');
        }
        check.assertions.push('Real pointer choice persists exactly once via GET');
        assert.equal(check.unifiedStyle, true, 'choice uses shared levelup polygon-card visual language');
        check.assertions.push('Shared levelup shield-card styling');
        check.status = 'PASS';
      } catch (error) {
        check.status = 'FAIL'; check.error = error.stack;
        check.httpFailures = fixture.requests.filter(r => r.status >= 400);
        check.failureScreenshot = resolve(directory, `stage-${stage}-failure.png`);
        await page.screenshot({ path: check.failureScreenshot }).catch(() => {});
      } finally { hold = false; gate.release(); await context.close(); }
    }
    result.status = result.checks.every(c => c.status === 'PASS') && !result.errors.length ? 'PASS' : 'FAIL';
  } catch (error) { result.status = 'FAIL'; result.error = error.stack; }
  finally {
    await browser?.close(); await fixture?.close();
    const evidence = resolve(directory, 'result.json');
    await writeFile(evidence, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ ...result, evidence }));
    if (result.status !== 'PASS') process.exitCode = 1;
  }
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await verifyNpcContact();
