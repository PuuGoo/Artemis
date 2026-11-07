import { randomInt } from 'node:crypto';
import { getMongoDb, COLLECTIONS } from '../lib/mongo.js';
import { getCurrentPlayer, json, fail } from '../lib/http.js';
import { RUNE_IDS, runeEngravingCost } from '../lib/runeCatalog.js';

export const config = { runtime:'nodejs' };

export async function POST(request) {
  const player = await getCurrentPlayer(request);
  if (!player) return fail('Bạn cần đăng nhập để khắc Ngọc.',401);
  const playerId = String(player._id);
  const body = await request.json().catch(()=>({}));
  const action = body?.action === 'enchant' ? 'enchant' : 'engrave';
  const saves = (await getMongoDb()).collection(COLLECTIONS.saves);
  for (let attempt=0;attempt<3;attempt++) {
    const save = await saves.findOne({ playerId });
    if (!save) return fail('Chưa có tiến trình.',404);
    const data = save.data || {};
    const runes = { ...(data.runes || {}) };
    if (action === 'enchant') {
      if (data.runeMythicEnchant === true) return fail('Phù phép đã được mở.',422);
      if (!RUNE_IDS.some(id=>Number(runes[id])>=6)) return fail('Cần ít nhất một Ngọc Epic +2.',422);
      const items = { ...(data.wikiOtherItems||{}) };
      if ((Number(items.enchantium)||0)<10) return fail('Cần 10 Enchantium để phù phép.',422);
      items.enchantium = Number(items.enchantium)-10;
      const now = new Date();
      const revision = (save.revision||1)+1;
      const result = await saves.updateOne(
        { playerId,revision:save.revision === undefined ? { $exists:false } : save.revision },
        { $set:{ data:{ ...data,wikiOtherItems:items,runeMythicEnchant:true },revision,updatedAt:now } },
      );
      if (result.matchedCount===1) return json({ ok:true,action,revision });
      continue;
    }
    const available = RUNE_IDS.filter(id => Math.max(0,Number(runes[id])||0)<11);
    if (!available.length) return fail('Tất cả Ngọc đã đạt Mythic.',422);
    const owned = available.filter(id => Number(runes[id])>0);
    const ownedCount = RUNE_IDS.filter(id => Number(runes[id])>0).length;
    const cost = runeEngravingCost(data.gearLevel,ownedCount);
    if ((Number(data.gold)||0)<cost) return fail(`Cần ${cost} vàng để khắc Ngọc.`,422);
    const pool = owned.length && randomInt(100)<55 ? owned : available;
    const runeId = pool[randomInt(pool.length)];
    runes[runeId] = Math.min(11,Math.max(0,Math.floor(Number(runes[runeId])||0))+1);
    const now = new Date();
    const revision = (save.revision||1)+1;
    const result = await saves.updateOne(
      { playerId, revision:save.revision === undefined ? { $exists:false } : save.revision },
      { $set:{ data:{ ...data, gold:Number(data.gold)-cost, runes }, revision, updatedAt:now,
        runeEngravingLog:[...(Array.isArray(save.runeEngravingLog)?save.runeEngravingLog:[]),{ at:now,runeId,rank:runes[runeId],cost }].slice(-30) } },
    );
    if (result.matchedCount===1) return json({ ok:true,runeId,rank:runes[runeId],cost,gold:Number(data.gold)-cost,revision });
  }
  return fail('Tiến trình vừa thay đổi. Hãy thử lại.',409);
}
