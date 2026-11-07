// Nhánh bắn production tại b23f55c, giữ để kiểm parity mà không phụ thuộc git history/shallow CI.
// Không dùng fixture này trong game; nguồn: public/index.html → updateGame → Ranged Attacks.
export function originalBossAttack(e, p, spawnEnemyBullet) {
  const ang = Math.atan2(p.y - e.y, p.x - e.x);
  if (e.isBoss) {
    if (e.type.startsWith('zodiac_')) {
      const rage = e.hp / Math.max(1, e.maxHp) < .45;
      const sign = e.zodiacIndex || 0;
      e.phaseTimer = (e.phaseTimer + 1) % 3;
      if (e.phaseTimer === 0) {
        const n = rage ? 18 : 14;
        for (let k = 0; k < n; k++) if (k !== 0 && k !== n - 1) {
          spawnEnemyBullet(e.x, e.y, ang + (k + sign * .27) * Math.PI * 2 / n, rage ? 260 : 220, e.atk, 6);
        }
      } else if (e.phaseTimer === 1) {
        for (const k of [-3, -2, -1, 1, 2, 3]) spawnEnemyBullet(e.x, e.y, ang + k * (.16 + sign % 3 * .03), rage ? 305 : 265, e.atk, 6);
      } else {
        for (let k = -2; k <= 2; k++) {
          spawnEnemyBullet(e.x - 24, e.y, ang + k * .16 + sign * .035, 285, e.atk, 6);
          spawnEnemyBullet(e.x + 24, e.y, ang - k * .16 - sign * .035, 285, e.atk, 6);
        }
      }
      e.attackTimer = rage ? 1.05 : 1.5;
    } else if (e.type === 'mycelium_queen') {
      const enraged = e.hp / Math.max(1, e.maxHp) < 0.45;
      e.phaseTimer = (e.phaseTimer + 1) % 3;
      if (e.phaseTimer === 0) {
        const count = enraged ? 18 : 14;
        for (let k = 0; k < count; k++) {
          const a = ang + k * Math.PI * 2 / count;
          if (k !== 0 && k !== 1 && k !== count - 1) spawnEnemyBullet(e.x, e.y, a, enraged ? 250 : 205, e.atk, 7);
        }
      } else if (e.phaseTimer === 1) {
        for (const k of [-3, -2, -1, 1, 2, 3]) spawnEnemyBullet(e.x, e.y, ang + k * 0.19, enraged ? 290 : 245, e.atk, 6);
      } else {
        for (const offset of [-0.35, -0.18, 0.18, 0.35]) {
          spawnEnemyBullet(e.x - 24, e.y, ang + offset, 265, e.atk, 6);
          spawnEnemyBullet(e.x + 24, e.y, ang - offset, 265, e.atk, 6);
        }
      }
      e.attackTimer = enraged ? 1.0 : 1.45;
    } else if (e.type === 'eclipse_sovereign') {
      const enraged = e.hp / Math.max(1, e.maxHp) < 0.5;
      e.phaseTimer = (e.phaseTimer + 1) % 3;
      if (e.phaseTimer === 0) {
        const total = enraged ? 20 : 16;
        for (let k = 0; k < total; k++) spawnEnemyBullet(e.x, e.y, ang + (k * Math.PI * 2) / total, enraged ? 248 : 218, e.atk, 7);
      } else if (e.phaseTimer === 1) {
        const spread = enraged ? 4 : 3;
        for (let k = -spread; k <= spread; k++) spawnEnemyBullet(e.x, e.y, ang + k * (enraged ? 0.145 : 0.18), enraged ? 305 : 270, e.atk, 7);
      } else {
        for (let k = 0; k < 8; k++) spawnEnemyBullet(e.x, e.y, (k * Math.PI) / 4 + (enraged ? Math.PI / 8 : 0), enraged ? 285 : 235, e.atk, 8);
        if (enraged) for (const offset of [-0.12, 0.12]) spawnEnemyBullet(e.x, e.y, ang + offset, 330, e.atk, 6);
      }
      e.attackTimer = enraged ? 1.12 : 1.52;
    } else if (e.type === 'elder_dragon') {
      e.phaseTimer = (e.phaseTimer + 1) % 3;
      if (e.phaseTimer === 0) {
        for (let k = 0; k < 12; k++) {
          const a = ang + (k * Math.PI * 2) / 12;
          spawnEnemyBullet(e.x, e.y, a, 205, e.atk, 7);
        }
      } else if (e.phaseTimer === 1) {
        for (let k = -2; k <= 2; k++) spawnEnemyBullet(e.x, e.y, ang + k * 0.19, 255, e.atk, 7);
      } else {
        for (const offset of [-0.13, 0, 0.13]) spawnEnemyBullet(e.x, e.y, ang + offset, 320, e.atk, 8);
      }
      e.attackTimer = 1.55;
    } else {
      e.phaseTimer = (e.phaseTimer + 1) % 3;
      if (e.phaseTimer === 0) {
        for (let k = 0; k < 8; k++) spawnEnemyBullet(e.x, e.y, ang + (k * Math.PI * 2) / 8, 210, e.atk, 7);
      } else if (e.phaseTimer === 1) {
        for (let k = -1; k <= 1; k++) spawnEnemyBullet(e.x, e.y, ang + k * 0.24, 260, e.atk, 7);
      } else spawnEnemyBullet(e.x, e.y, ang, 310, e.atk, 8);
      e.attackTimer = 1.45;
    }
  }
}
