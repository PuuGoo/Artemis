import test from "node:test";
import assert from "node:assert/strict";
import { validateSeasonDelta } from "../lib/economy.js";

const emptySeason = () => ({
  season: 1, career: null, tokens: 0, boss: null,
  bossHp: 0, bossMaxHp: 0, bossDefeated: false,
  powerSacrificed: 0, log: [],
});
const save = (season) => ({ season: { ...emptySeason(), ...season } });

test("new save may select a career and recruit a full-health boss, but cannot mint tokens", () => {
  assert.equal(validateSeasonDelta(null, save({ career: "blade" })).ok, true);
  assert.equal(validateSeasonDelta(null, save({
    career: "blade", boss: "ironhide", bossHp: 5000, bossMaxHp: 5000,
  })).ok, true);
  assert.equal(validateSeasonDelta(null, save({ tokens: 120 })).code, "SEASON_INITIAL_REWARD");
  assert.equal(validateSeasonDelta(null, save({
    boss: "ironhide", bossHp: 0, bossMaxHp: 5000, bossDefeated: true, tokens: 120,
  })).code, "SEASON_INITIAL_REWARD");
});

test("only valid 2% sacrifice steps may grant 60 tokens each", () => {
  const prev = save({ powerSacrificed: 0.04, tokens: 120 });
  assert.equal(validateSeasonDelta(prev, save({
    powerSacrificed: 0.06, tokens: 180,
  })).ok, true);
  assert.equal(validateSeasonDelta(prev, save({
    powerSacrificed: 0.05, tokens: 150,
  })).code, "SEASON_SACRIFICE_INVALID");
  assert.equal(validateSeasonDelta(prev, save({
    powerSacrificed: 0.06, tokens: 999999,
  })).code, "SEASON_TOKEN_UNEARNED");
  assert.equal(validateSeasonDelta(prev, save({
    powerSacrificed: 0.02, tokens: 120,
  })).code, "SEASON_SACRIFICE_REWIND");
});

test("tokens cannot increase without a stored season reward transition", () => {
  const prev = save({ career: "blade", tokens: 80 });
  assert.equal(validateSeasonDelta(prev, save({
    career: "blade", tokens: 81,
  })).code, "SEASON_TOKEN_UNEARNED");
  assert.equal(validateSeasonDelta(prev, save({
    career: "blade", tokens: 0,
  })).ok, true);
});

test("boss reward requires the same stored boss to transition alive -> defeated", () => {
  const prev = save({
    career: "blade", tokens: 20, boss: "reflector",
    bossHp: 1000, bossMaxHp: 1000, bossDefeated: false,
  });
  assert.equal(validateSeasonDelta(prev, save({
    ...prev.season, bossHp: 0, bossDefeated: true, tokens: 140,
  })).ok, true);
  assert.equal(validateSeasonDelta(prev, save({
    ...prev.season, bossHp: 0, bossDefeated: true, tokens: 999,
  })).code, "SEASON_TOKEN_UNEARNED");
  assert.equal(validateSeasonDelta(prev, save({
    ...prev.season, boss: "ironhide", bossHp: 0, bossMaxHp: 1000, bossDefeated: true, tokens: 140,
  })).code, "SEASON_BOSS_SWITCH_ACTIVE");
  assert.equal(validateSeasonDelta(save({
    ...prev.season, bossHp: 0, bossDefeated: true, tokens: 140,
  }), save({
    ...prev.season, bossHp: 0, bossDefeated: true, tokens: 260,
  })).code, "SEASON_TOKEN_UNEARNED");
});

test("boss cannot be replaced while active, resized or resurrected", () => {
  const active = save({
    boss: "ironhide", bossHp: 700, bossMaxHp: 1000, bossDefeated: false,
  });
  assert.equal(validateSeasonDelta(active, save({
    boss: "reflector", bossHp: 2000, bossMaxHp: 2000,
  })).code, "SEASON_BOSS_SWITCH_ACTIVE");
  assert.equal(validateSeasonDelta(active, save({
    boss: "ironhide", bossHp: 700, bossMaxHp: 2000,
  })).code, "SEASON_BOSS_MAX_HP_CHANGED");
  const defeated = save({
    boss: "ironhide", bossHp: 0, bossMaxHp: 1000, bossDefeated: true,
  });
  assert.equal(validateSeasonDelta(defeated, save({
    boss: "ironhide", bossHp: 1000, bossMaxHp: 1000, bossDefeated: false,
  })).code, "SEASON_BOSS_RESURRECTED");
  assert.equal(validateSeasonDelta(defeated, save({
    boss: "reflector", bossHp: 2000, bossMaxHp: 2000, bossDefeated: false,
  })).ok, true);
});

test("changing an existing career costs at least 50 tokens", () => {
  const prev = save({ career: "blade", tokens: 100 });
  assert.equal(validateSeasonDelta(prev, save({
    career: "mage", tokens: 99,
  })).code, "SEASON_TOKEN_UNEARNED");
  assert.equal(validateSeasonDelta(prev, save({
    career: "mage", tokens: 50,
  })).ok, true);
  assert.equal(validateSeasonDelta(prev, save({
    career: "blade", powerSacrificed: 0.02, tokens: 160,
  })).ok, true);
  assert.equal(validateSeasonDelta(prev, save({
    career: null, tokens: 100,
  })).code, "SEASON_CAREER_REMOVED");
});
