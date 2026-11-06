// Regression test: season must survive cloud-save sanitization without trusting client IDs.
import { sanitizeSave } from "../lib/saveSchema.js";

let pass = 0, fail = 0;
function check(name, ok, extra = "") {
  if (ok) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? " — " + extra : "")); }
}

const valid = sanitizeSave({
  season: {
    season: 2,
    career: "guardian",
    tokens: 240,
    boss: "reflector",
    bossHp: 0,
    bossMaxHp: 13000,
    bossDefeated: true,
    powerSacrificed: 0.2,
    log: [
      { t: 1760000000000, text: "Chọn nghề: Hộ Vệ." },
      { t: 1760000001000, text: "Hạ Kính Phản Chiếu." },
    ],
  },
});
check("valid season accepted", valid.ok);
check("season progress survives sanitizer", valid.data?.season?.season === 2);
check("career ID survives", valid.data?.season?.career === "guardian");
check("tokens survive", valid.data?.season?.tokens === 240);
check("boss progress survives", valid.data?.season?.boss === "reflector" && valid.data?.season?.bossHp === 0);
check("defeated flag survives when boss HP is zero", valid.data?.season?.bossDefeated === true);
check("sacrifice reaches but cannot exceed 20%", valid.data?.season?.powerSacrificed === 0.2);
check("event log survives", valid.data?.season?.log?.length === 2);

const dirty = sanitizeSave({
  season: {
    season: 999,
    career: "admin",
    tokens: 9e15,
    boss: "godmode",
    bossHp: 900,
    bossMaxHp: 100,
    bossDefeated: true,
    powerSacrificed: 0.8,
    log: Array.from({ length: 55 }, (_, i) => ({ t: -1, text: "x".repeat(300) + i })),
  },
});
check("unknown career rejected", dirty.data?.season?.career === null);
check("unknown boss rejected", dirty.data?.season?.boss === null);
check("season number bounded", dirty.data?.season?.season === 100);
check("season tokens bounded", dirty.data?.season?.tokens === 1e9);
check("boss HP cannot exceed max HP", dirty.data?.season?.bossHp === 100);
check("defeated flag cannot be forged while boss has HP", dirty.data?.season?.bossDefeated === false);
check("sacrifice capped at 20%", dirty.data?.season?.powerSacrificed === 0.2);
check("event log capped at 40 entries", dirty.data?.season?.log?.length === 40);
check("event log text length bounded", dirty.data?.season?.log?.every((entry) => entry.text.length <= 160));
check("event log timestamp clamped", dirty.data?.season?.log?.every((entry) => entry.t === 0));

const empty = sanitizeSave({ season: null });
check("missing season becomes safe default", empty.data?.season?.season === 1 && empty.data?.season?.tokens === 0);

console.log(`\n================ ${pass} PASS / ${fail} FAIL ================\n`);
process.exit(fail > 0 ? 1 : 0);
