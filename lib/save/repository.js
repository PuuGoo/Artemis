import { buildCanonicalNewAccountSave } from './initialState.js';

// Hợp đồng đọc cho savePolicy. Thêm luật dùng field mới phải cập nhật tại đây
// và test projection, không rải query Mongo vào route hay validator.
const VALIDATION_PROJECTION = Object.freeze({
  revision: 1, ledger: 1,
  'data.gold': 1, 'data.gems': 1, 'data.vipCoins': 1, 'data.vipPasses': 1,
  'data.runes': 1, 'data.runeStones': 1, 'data.runeIntroClaimed': 1,
  'data.runeMythicEnchant': 1, 'data.lifetimeStats': 1, 'data.season': 1,
  'data.gameMode': 1, 'data.modeBest': 1, 'data.guild': 1,
  'data.garden': 1, 'data.plinko': 1,
});

/**
 * Adapter persistence nhận collection từ caller, không tự mở DB hay đọc env.
 * Chỉ đổi lỗi unique-key thành conflict; lỗi hạ tầng phải nổi lên caller.
 */
export function createSaveRepository(saves) {
  return {
    find(playerId) {
      return saves.findOne({ playerId });
    },
    readForValidation(playerId) {
      return saves.findOne({ playerId }, { projection: VALIDATION_PROJECTION });
    },
    readConflict(playerId) {
      return saves.findOne({ playerId }, { projection: { revision: 1, data: 1 } });
    },
    async restoreCanonical(player, playerId) {
      const doc = buildCanonicalNewAccountSave({ playerId, username: player.username });
      try {
        await saves.insertOne(doc);
        return doc;
      } catch (error) {
        // Request khác đã khôi phục trước: không ghi đè lên dữ liệu của họ.
        if (error?.code === 11000) return saves.findOne({ playerId });
        throw error;
      }
    },
    async commit(existing, snapshot) {
      if (existing) {
        const result = await saves.updateOne(
          { playerId: snapshot.playerId, revision: existing.revision === undefined ? { $exists: false } : existing.revision },
          { $set: snapshot },
          { upsert: false },
        );
        return result.matchedCount === 1;
      }
      try {
        // Unique playerId phân xử hai request cùng lưu lần đầu.
        await saves.insertOne({ ...snapshot, createdAt: snapshot.updatedAt });
        return true;
      } catch (error) {
        if (error?.code === 11000) return false;
        throw error;
      }
    },
  };
}
