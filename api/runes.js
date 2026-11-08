import { randomInt } from 'node:crypto';
import { getMongoDb, COLLECTIONS } from '../lib/mongo.js';
import { getCurrentPlayer, json, fail } from '../lib/http.js';
import { RUNE_IDS, runePool, addRuneDrop, mergeRuneStones } from '../lib/runeCatalog.js';

export const config = { runtime:'nodejs' };

function draw(pool) {
  // Every exploration yields a stone. Promised ruins improve the rare/epic odds.
  const roll=randomInt(1000);
  return roll < (pool.promised?30:10) ? 3 : roll < (pool.promised?150:50) ? 2 : roll < (pool.promised?500:240) ? 1 : 0;
}

export async function POST(request) {
  const player = await getCurrentPlayer(request);
  if (!player) return fail('Bạn cần đăng nhập để sử dụng Ngọc.',401);
  const body=await request.json().catch(()=>({}));
  const action=body?.action;
  if (!['explore','enchant','merge'].includes(action)) return fail('Thao tác Ngọc không hợp lệ.',400);
  if (['merge','enchant'].includes(action) && (!Number.isSafeInteger(body.revision) || body.revision < 1)) {
    return fail('Phiên bản tiến trình không hợp lệ. Hãy tải lại.',400);
  }
  const count=Number(body?.count||1);
  if (action==='explore' && ![1,5,10].includes(count)) return fail('Số lượt đào không hợp lệ.',400);
  const playerId=String(player._id);
  const saves=(await getMongoDb()).collection(COLLECTIONS.saves);
  for (let attempt=0;attempt<3;attempt++) {
    const save=await saves.findOne({playerId});
    if (!save) return fail('Chưa có tiến trình.',404);
    const data=save.data||{}, runes={...(data.runes||{})}, stones={...(data.runeStones||{})};
    const items={...(data.wikiOtherItems||{})};
    const now=new Date(), revision=(save.revision||1)+1;
    if (action === 'merge') {
      if (body.revision !== save.revision) return fail('Tiến trình vừa thay đổi. Hãy đồng bộ lại trước khi ghép.',409);
      let merged;
      try { merged = mergeRuneStones(stones, runes, body.runeId, body.tier); }
      catch (error) { return fail(error.message,422); }
      const next = { ...data, runes: merged.ranks, runeStones: merged.stones };
      const log = [...(Array.isArray(save.runeMergeLog) ? save.runeMergeLog : []),
        { at: now, runeId: body.runeId, tier: body.tier, nextTier: merged.nextTier, consumed: 3 }].slice(-30);
      const result = await saves.updateOne({ playerId, revision: save.revision },
        { $set: { data: next, revision, updatedAt: now, runeMergeLog: log } });
      if (result.matchedCount === 1) return json({ ok: true, action, runeId: body.runeId,
        tier: body.tier, nextTier: merged.nextTier, rank: merged.rank, revision });
      return fail('Tiến trình vừa thay đổi. Hãy đồng bộ lại trước khi ghép.',409);
    }
    if (action==='enchant') {
      if (body.revision !== save.revision) return fail('Tiến trình vừa thay đổi. Hãy đồng bộ lại.',409);
      const id=body.runeId;
      if (!RUNE_IDS.includes(id) || RUNE_IDS.indexOf(id)<13) return fail('Ngọc này không có phù phép.',422);
      if (!(Number(runes[id])>=6)) return fail('Ngọc được chọn phải đạt Epic +2.',422);
      const runeEnchantments={...(data.runeEnchantments||{})};
      const level=Number(runeEnchantments[id])||0;
      if (level>=6) return fail('Phù phép viên ngọc đã đạt Thần Thoại.',422);
      if ((Number(items.enchantium)||0)<10) return fail('Cần 10 Enchantium để phù phép.',422);
      items.enchantium=Number(items.enchantium)-10;
      runeEnchantments[id]=level+1;
      const result=await saves.updateOne({playerId,revision:save.revision},{$set:{data:{...data,wikiOtherItems:items,runeEnchantments},revision,updatedAt:now}});
      if(result.matchedCount===1)return json({ok:true,action,runeId:id,level:level+1,cost:10,revision});
      return fail('Tiến trình vừa thay đổi. Hãy đồng bộ lại.',409);
    }
    const promised=body.promised===true, key=promised?'promised_relic_shovel':'shovel';
    const freeIntro=!promised && count===1 && data.runeIntroClaimed!==true;
    const paidCount=freeIntro?0:count;
    const shovels=Math.max(0,Number(items[key])||0), missing=Math.max(0,paidCount-shovels);
    const gemCost=missing*(promised?250:120);
    if ((Number(data.gems)||0)<gemCost) return fail(`Cần ${count} xẻng hoặc ${gemCost} đá quý.`,422);
    items[key]=Math.max(0,shovels-paidCount);
    const pool=runePool(String(body.pool||''),promised);
    const drops=[];
    let collection=stones, ranks=runes;
    for(let i=0;i<count;i++) {
      let picked=pool[randomInt(pool.length)];
      // Revive is rarer than the other Blessing runes.
      if(picked==='rune_valkyrie' && randomInt(2)===0) picked=pool[randomInt(pool.length)];
      const quality=draw({promised});
      const award=addRuneDrop(collection,ranks,picked,quality);
      collection=award.stones;ranks=award.ranks;
      drops.push({runeId:picked,quality,rank:award.rank});
    }
    items.enchantium=(Number(items.enchantium)||0)+count*(promised?8:4);
    const runeRuinsState={...(data.runeRuinsState||{})};
    const tileIdx=Number(body.tileIdx);
    if(Number.isInteger(tileIdx) && tileIdx>=0 && tileIdx<9) {
      const revealed=Array.isArray(runeRuinsState.gridRevealed)?[...runeRuinsState.gridRevealed]:Array(9).fill(false);
      revealed[tileIdx]=true;
      runeRuinsState.gridRevealed=revealed.every(Boolean)?Array(9).fill(false):revealed;
    }
    runeRuinsState.lastDigLog=`⛏️ Đào ${count} lượt: ${drops.slice(0,3).map(drop=>`${drop.runeId} (${drop.rank}/11)`).join(' • ')}${drops.length>3?` và ${drops.length-3} viên khác`:''}. Nhận ${count*(promised?8:4)} Enchantium.`;
    const wikiEventsState={...(data.wikiEventsState||{})};
    const boardCell=Number(body.boardCell);
    if(Number.isInteger(boardCell) && boardCell>=0 && boardCell<9 && wikiEventsState.runeRuinsBoard) {
      const board={...wikiEventsState.runeRuinsBoard};
      const revealed=Array.isArray(board.revealed)?[...board.revealed]:Array(9).fill(false);
      revealed[boardCell]=true;
      board.revealed=revealed;
      board.finished=revealed.every(Boolean);
      board.lastRewardSummary=`Đã khai quật ${revealed.filter(Boolean).length}/9 ô. Ngọc và Enchantium đã chuyển vào kho.`;
      wikiEventsState.runeRuinsBoard=board;
    }
    const next={...data,gems:Number(data.gems)-gemCost,wikiOtherItems:items,runeRuinsState,wikiEventsState,runes:ranks,runeStones:collection,runeIntroClaimed:data.runeIntroClaimed===true||freeIntro};
    const log=[...(Array.isArray(save.runeExplorationLog)?save.runeExplorationLog:[]),{at:now,count,promised,gemCost,drops}].slice(-30);
    const result=await saves.updateOne({playerId,revision:save.revision===undefined?{$exists:false}:save.revision},{$set:{data:next,revision,updatedAt:now,runeExplorationLog:log}});
    if(result.matchedCount===1)return json({ok:true,action,count,promised,gemCost,freeIntro,drops,revision});
  }
  return fail('Tiến trình vừa thay đổi. Hãy thử lại.',409);
}
