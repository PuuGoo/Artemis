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
  for (const file of ['campaign-config.js', 'campaign-skills.js', 'campaign-exp.js', 'campaign-valkyrie.js']) {
    vm.runInContext(fs.readFileSync(new URL('../../public/' + file, import.meta.url), 'utf8'), context, { filename: file });
  }
  vm.runInContext([arrayDeclaration('GAME_MODES'), declaration('getGameMode'), declaration('usesCampaignTuning')].join('\n'), context);
  if (skills) vm.runInContext(arrayDeclaration('ROGUE_SKILLS'), context);
  return context;
}
