import { getMongoDb, COLLECTIONS } from '../mongo.js';
import { getCurrentPlayer, json, fail, readJsonBody } from '../http.js';
import { createSaveRepository } from '../save/repository.js';
import { NEW_ACCOUNT_INIT_VERSION } from '../save/initialState.js';
import { PATROL, initialPatrol, previewPatrol, patrolRewards, planPatrolAction } from './domain.js';

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validState(state) {
  return state?.version === 1 && Number.isSafeInteger(state.startedAt) && state.startedAt >= 0 &&
    Number.isSafeInteger(state.lastClaimAt) && state.lastClaimAt >= state.startedAt &&
    /^\d{4}-\d{2}-\d{2}$/.test(state.day) &&
    Number.isSafeInteger(state.energyUsed) && state.energyUsed >= 0 && state.energyUsed <= PATROL.energyDailyLimit &&
    Number.isSafeInteger(state.adUsed) && state.adUsed >= 0 && state.adUsed <= PATROL.adDailyLimit &&
    Array.isArray(state.receipts) && state.receipts.length <= PATROL.maxReceipts;
}

function response(save, now, extra = {}) {
  const patrol = previewPatrol(save.data, save.ledger.patrol, now);
  patrol.rewards = patrolRewards(patrol.ratesPerHour, patrol.elapsedSeconds);
  patrol.quickRewards = patrolRewards(patrol.ratesPerHour, patrol.quickSeconds);
  return { ok: true, playerId: save.playerId, data: save.data, revision: save.revision, patrol, ...extra };
}

function conflict(save, now) {
  return json({ ...(save?.ledger?.patrol && validState(save.ledger.patrol) ? response(save, now) : {}),
    ok: false, conflict: true, code: 'PATROL_CONFLICT',
    error: 'Tiến trình vừa thay đổi. Hãy đồng bộ rồi thử lại.', serverRevision: save?.revision ?? null }, 409);
}

// Clock injection is only an in-process test seam, never a request parameter.
export function createPatrolHandlers({ clock = () => Date.now() } = {}) {
  async function load(player, now) {
    const playerId = String(player._id);
    const saves = (await getMongoDb()).collection(COLLECTIONS.saves);
    const repo = createSaveRepository(saves);
    let save = await repo.find(playerId);
    if (!save && Number.isInteger(player.initVersion) && player.initVersion >= NEW_ACCOUNT_INIT_VERSION) {
      save = await repo.restoreCanonical(player, playerId);
    }
    if (!save) return { error: fail('Chưa có tiến trình. Hãy tải lại trang.', 404) };
    // One-time server baseline, rather than client-provided timestamps or retroactive accrual.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (save.ledger?.patrol !== undefined) break;
      const revision = save.revision ?? 1;
      const ledger = { ...(save.ledger || {}), patrol: initialPatrol(now) };
      const snapshot = { ledger, revision: revision + 1, updatedAt: new Date(now), playerId };
      if (await repo.commit(save, snapshot)) { save = { ...save, ...snapshot }; break; }
      save = await repo.find(playerId);
      if (!save) return { error: fail('Không tìm thấy tiến trình.', 404) };
    }
    if (!validState(save.ledger?.patrol) || !Number.isSafeInteger(save.revision) || save.revision < 1 || save.revision >= Number.MAX_SAFE_INTEGER) {
      return { error: json({ ok: false, code: 'PATROL_STATE_INVALID', error: 'Dữ liệu tuần tra không hợp lệ. Hãy liên hệ hỗ trợ.' }, 422) };
    }
    return { save, saves };
  }

  async function GET(request) {
    const player = await getCurrentPlayer(request);
    if (!player) return fail('Bạn cần đăng nhập để tuần tra.', 401);
    const now = clock();
    const loaded = await load(player, now);
    return loaded.error || json(response(loaded.save, now));
  }

  async function POST(request) {
    const player = await getCurrentPlayer(request);
    if (!player) return fail('Bạn cần đăng nhập để tuần tra.', 401);
    const parsed = await readJsonBody(request, 2048);
    if (!parsed.ok) return fail(parsed.error, parsed.status);
    const { action, requestId: rawId, revision } = parsed.data;
    if (!['claim', 'quickEnergy', 'quickAd'].includes(action) || typeof rawId !== 'string' ||
        !REQUEST_ID.test(rawId) || !Number.isSafeInteger(revision) || revision < 1) {
      return fail('Yêu cầu tuần tra không hợp lệ.', 400);
    }
    const requestId = rawId.toLowerCase();
    const now = clock(), loaded = await load(player, now);
    if (loaded.error) return loaded.error;
    const { save, saves } = loaded, state = save.ledger.patrol;
    const replayResult = current => {
      const receipt = current?.ledger?.patrol?.receipts?.find(item => item.requestId === requestId);
      if (!receipt) return null;
      if (receipt.action !== action) return json({ ok: false, code: 'REQUEST_ID_REUSED', error: 'Mã giao dịch đã dùng cho thao tác khác.' }, 409);
      return json(response(current, now, { action, replayed: true, rewards: receipt.rewards }));
    };
    const replay = replayResult(save);
    if (replay) return replay;
    if (save.revision !== revision) return conflict(save, now);
    if (action === 'quickAd') return json({ ok: false, code: 'AD_UNAVAILABLE', error: previewPatrol(save.data, state, now).quickAd.reason,
      patrol: previewPatrol(save.data, state, now), revision: save.revision }, 422);
    // Do not evict old request keys and silently make them payable again. A bounded
    // journal fails closed when full; future archival needs a durable dedupe store.
    if (state.receipts.length >= PATROL.maxReceipts) return json({ ok: false, code: 'PATROL_JOURNAL_FULL',
      error: 'Nhật ký tuần tra đã đầy. Hãy liên hệ hỗ trợ.' }, 422);
    let plan;
    try { plan = planPatrolAction(save.data, state, action, now); }
    catch (error) {
      if (error instanceof RangeError) return json({ ok: false, code: 'PATROL_NOT_ELIGIBLE', error: error.message,
        patrol: response(save, now).patrol, revision: save.revision }, 422);
      throw error;
    }
    const receipt = { requestId, action, at: now, rewards: plan.rewards };
    plan.state.receipts.push(receipt);
    const ledger = { ...save.ledger, patrol: plan.state };
    const next = { ...save, data: plan.data, ledger, revision: revision + 1, updatedAt: new Date(now) };
    const committed = await saves.updateOne({ playerId: save.playerId, revision }, { $set: {
      data: next.data, ledger, revision: next.revision, updatedAt: next.updatedAt,
    } });
    if (committed.matchedCount !== 1) {
      const current = await saves.findOne({ playerId: save.playerId });
      return replayResult(current) || conflict(current, now);
    }
    return json(response(next, now, { action, rewards: plan.rewards, replayed: false }));
  }
  return { GET, POST };
}

export const { GET, POST } = createPatrolHandlers();
