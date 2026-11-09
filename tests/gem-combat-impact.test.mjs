import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { loadCampaignDependencies } from './fixtures/campaign-vm.mjs';

// Chạy các hàm stat thật trong VM, không tài khoản/DB/đọc .env.
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function declaration(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  const end = html.indexOf('\n      }', start) + '\n      }'.length;
  return html.slice(start, end);
}

function constant(name) {
  const start = html.indexOf(`      const ${name} = {`);
  assert.ok(start >= 0, name);
  return html.slice(start, html.indexOf('\n      };', start) + '\n      };'.length);
}
function fixture(sockets = [], extra = {}) {
  const zero = () => ({ atkPct: 0, gearBasePct: 0, hpPct: 0, critRate: 0, dodgeBonus: 0,
    flatAtk: 0, flatHp: 0, aspdBonus: 0, critBonus: 0, critDmgPct: 0, atk: 0, hp: 0,
    atkMult: 0, hpMult: 0, flatDef: 0, defFlat: 0, flatAspd: 0 });
  const state = { selectedHeroId: 'fixture', selectedWeaponId: 'bow', selectedPetId: 'pet', gearLevel: 1,
    equippedGear: { weapon: { templateId: 'fixture_bow', quality: 'common', sockets: [...sockets] } }, ...extra };
  const sandbox = {
    SaveState: state, runHeroOverrideId: null,
    HEROES: [{ id: 'fixture', bonusAtk: 0, bonusHp: 0 }],
    WEAPONS: [{ id: 'bow', atkMult: 1, aspd: 2, critBonus: 0 }], PETS: [{ id: 'pet' }],
    GEAR_TEMPLATES: { fixture_bow: { weaponArchetype: 'bow' } },
    GEAR_SLOTS_META: { weapon: { statType: 'atk' } }, GEAR_QUALITIES: { common: { order: 1 } },
    Game: { chapter: { rooms: 15 } }, computeSingleItemStat: () => 0,
    getAffixBonuses: () => ({ atkFlat: 0, hpFlat: 0, atkPct: 0, hpPct: 0, crit: 0, aspd: 0, dodge: 0, gold: 0 }),
    getGlobalAllHeroStarBonuses: zero, computeAllTalentCardsBonuses: zero,
    getActiveResonanceHeroIds: () => [], computeTotalEquippedRunesStats: zero,
    computeAllArtifactsAndSetsBonuses: zero, getHeroStarLevel: () => 0,
    getHeroMilestoneData: zero, getActiveHeroSkin: () => ({ idx: 0, bonusAtk: 0, bonusHp: 0 }),
    getAllUnlockedSkinBonuses: zero, getSetBonuses: () => [], runeHasEffect: () => false,
  };
  const ctx = vm.createContext(sandbox);
  loadCampaignDependencies(ctx);
  for (const source of [constant('GEM_META'), declaration('getGemBonuses'), declaration('getComputedStats'), declaration('getCampaignTuning'), constant('CAMPAIGN_TUNING')]) {
    vm.runInContext(source, ctx, { filename: source.slice(0, 100).split('\n')[0] });
  }
  return { state, stats: () => ctx.getComputedStats(), tuning: () => ctx.getCampaignTuning(1, 1, 15) };
}

test('Ruby/Sapphire thực sự tăng ATK/HP người chơi mà không nâng HP/ATK quái cùng chương', () => {
  const base = fixture(), ruby = fixture(['ruby']), sapphire = fixture(['sapphire']);
  assert.equal(ruby.stats().baseAtk - base.stats().baseAtk, 18);
  assert.equal(sapphire.stats().baseHp - base.stats().baseHp, 90);
  assert.ok(sapphire.stats().defFlat > base.stats().defFlat);
  assert.equal(JSON.stringify(base.tuning()), JSON.stringify(ruby.tuning()));
  assert.equal(JSON.stringify(base.tuning()), JSON.stringify(sapphire.tuning()));
});

test('Amethyst/Emerald/Topaz đi qua đúng stat pipeline, không thành nguyên tố giả', () => {
  const a = fixture().stats();
  const b = fixture(['amethyst', 'emerald', 'topaz']).stats();
  assert.ok(Math.abs((b.baseCrit - a.baseCrit) - .02) < 1e-9);
  assert.ok(Math.abs((b.gearDodge - a.gearDodge) - .02) < 1e-9);
  assert.ok(Math.abs((b.goldBonus - a.goldBonus) - .05) < 1e-9);
  assert.equal(b.baseAtk, a.baseAtk);
  assert.equal(b.baseHp, a.baseHp);
});

test('chỉ ngọc khảm trên trang bị đang mặc có tác dụng, đọc stat không sửa sockets/kho', () => {
  const a = fixture([], { gemInventory: { ruby: 999 }, gearBag: [{ sockets: ['ruby', 'sapphire'] }] });
  const before = JSON.stringify(a.state);
  const baseline = fixture().stats();
  assert.equal(a.stats().baseAtk, baseline.baseAtk);
  assert.equal(a.stats().baseHp, baseline.baseHp);
  assert.equal(JSON.stringify(a.state), before);
  const noGear = fixture([], { equippedGear: {} });
  assert.equal(noGear.stats().baseAtk, baseline.baseAtk);
});
