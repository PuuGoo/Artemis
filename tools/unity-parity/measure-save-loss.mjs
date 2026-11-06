// Đo tác động thật của việc server LỌC BỎ artifactStars / equippedRuneSlots.
import fs from "node:fs";
import { loadOracle } from "./oracle.mjs";

const { api } = loadOracle();
const S = api.SaveState;

function reset() {
  for (const k of Object.keys(S)) if (typeof S[k] !== "function") delete S[k];
  S.selectedHeroId = "alex"; S.selectedWeaponId = "bow"; S.selectedPetId = "spirit_sword";
  S.gearLevel = 1; S.heroStars = {}; S.artifactStars = {}; S.talents = {}; S.runes = {};
  S.heroSelectedSkins = {}; S.unlockedSkins = {}; S.equippedGear = {}; S.gearBag = [];
  S.maxedAllVersion = 1; S.artemisHeroVersion = 1; S.wikiCharactersVersion = 2;
  S.season = { season: 1, career: null, tokens: 0, boss: null, bossHp: 0, bossMaxHp: 0, bossDefeated: false, powerSacrificed: 0, log: [] };
}

function stats() {
  const s = api.getComputedStats();
  return { atk: s.baseAtk, hp: s.baseHp, crit: s.baseCrit, critDmg: s.critDmgMult, def: s.defFlat, aspd: s.baseAspd };
}

console.log("=== A. artifactStars 15★ toàn bộ 3 thành viên set ===\n");

reset();
const before = stats();
S.artifactStars = { golden_fleece: 15, golden_mask: 15, goldfinger: 15 };
const withArtifacts = stats();
console.log("không có artifact:", JSON.stringify(before));
console.log("có 3 artifact 15★:", JSON.stringify(withArtifacts));
console.log("chênh lệch:        ATK +" + (withArtifacts.atk - before.atk) + ", HP +" + (withArtifacts.hp - before.hp) +
            ", CritDMG +" + (withArtifacts.critDmg - before.critDmg).toFixed(3));

// Mô phỏng server đã lọc: reload save từ document đã sanitize (không có artifactStars)
delete S.artifactStars;
const afterFilter = stats();
console.log("sau khi server lọc: ", JSON.stringify(afterFilter));
console.log("MẤT:               ATK -" + (withArtifacts.atk - afterFilter.atk) + ", HP -" + (withArtifacts.hp - afterFilter.hp));
console.log("Tỉ lệ:             " + (((withArtifacts.atk - afterFilter.atk) / withArtifacts.atk) * 100).toFixed(1) + "% ATK");

console.log("\n=== B. equippedRuneSlots (4 ô etched+enhancement) ===\n");

reset();
const beforeRune = stats();
S.equippedRuneSlots = {
  etched: ["arrow_of_echoes", "sharp_arrow"],
  blessing: ["guardian"],
  enhancement: ["arrow_rain"],
  ability: ["ability_circle"],
};
const withRunes = stats();
console.log("không rune:", JSON.stringify(beforeRune));
console.log("có rune:   ", JSON.stringify(withRunes));

delete S.equippedRuneSlots;
const afterRuneFilter = stats();
console.log("sau lọc:   ", JSON.stringify(afterRuneFilter));
console.log("MẤT:       ATK -" + (withRunes.atk - afterRuneFilter.atk) + ", HP -" + (withRunes.hp - afterRuneFilter.hp) +
            ", ASPD -" + (withRunes.aspd - afterRuneFilter.aspd).toFixed(2) +
            ", CRIT -" + (withRunes.crit - afterRuneFilter.crit).toFixed(2));

console.log("\n=== KẾT LUẬN ===");
console.log("Hai field này ảnh hưởng CHỈ SỐ CHIẾN ĐẤU nhưng nằm ngoài whitelist của");
console.log("lib/saveSchema.js, nên mỗi lần GET /api/save người chơi nhận lại save");
console.log("KHÔNG có chúng -> đầu tư artifact/rune bị mất khi tải lại trang.");
