// Offline dependencies for extracted production functions; no browser, env or DB.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html = fs.readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function declaration(name) {
  const start = html.indexOf(`function ${name}(`);
  const end = html.indexOf('\n      }', start);
  assert.ok(start >= 0 && end > start, `Missing production function ${name}`);
  return html.slice(start, end + '\n      }'.length);
}
function arrayDeclaration(name) {
  const start = html.indexOf(`const ${name} = [`);
  const end = html.indexOf('\n      ];', start);
  assert.ok(start >= 0 && end > start, `Missing production catalog ${name}`);
  return html.slice(start, end + '\n      ];'.length);
}
export function loadCampaignDependencies(context, { skills = false } = {}) {
  context.window ||= context;
  for (const file of ['arena-viewport.js', 'enemy-pressure.js', 'boss-attack-patterns.js', 'campaign-encounters.js', 'campaign-config.js', 'campaign-rooms.js', 'campaign-support.js', 'campaign-telemetry.js', 'campaign-skills.js', 'campaign-exp.js', 'campaign-valkyrie.js']) {
    vm.runInContext(fs.readFileSync(new URL('../../public/' + file, import.meta.url), 'utf8'), context, { filename: file });
  }
  for (const name of ['ArtemisArenaViewport', 'ArtemisEnemyPressure', 'BossAttackPatterns', 'ArtemisCampaignEncounters']) {
    context[name] ||= context.window[name];
    context.window[name] = context[name];
  }
  // These checkpoint fixtures have no devil grants or computed-stat engine.
  // Fail closed if a grant enters this seam instead of silently skipping effects.
  context.applyEncounterSkills ||= () => {
    assert.ok(!(context.Game.campaignEncounters?.receipts || []).some(r => r.grant?.skillId),
      'Encounter skill grants require the real skill/stat harness');
  };
  vm.runInContext([arrayDeclaration('GAME_MODES'), declaration('getGameMode'), declaration('usesCampaignTuning')].join('\n'), context);
  if (skills) vm.runInContext(arrayDeclaration('ROGUE_SKILLS'), context);
  return context;
}
