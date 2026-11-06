using System;
using System.Collections.Generic;
using Artemis.Domain.Core;
using Artemis.Domain.Spawning;
using Artemis.Domain.Stats;

namespace Artemis.Runtime.Dungeons
{
    /// <summary>
    /// Trạng thái MỘT lượt chơi — phần được phép xoá khi Retry/Reset.
    ///
    /// Ranh giới này là bất biến của game (docs/DUNGEON_RESET_SPEC.md §2):
    ///   • Thuộc phiên: phòng, quái, đạn, combo, vàng trong lượt, cấp trong lượt
    ///   • Thuộc nhân vật: vàng, đá quý, trang bị, sao hero, talent, rune…
    ///
    /// Ở đây cố ý KHÔNG có field nào của nhân vật. Nhờ vậy không thể vô tình xoá
    /// tiến trình người chơi bằng cách tạo phiên mới — điều từng xảy ra ở bản web
    /// trước khi tách DungeonSession.
    /// </summary>
    public sealed class RunSession
    {
        public bool Active { get; private set; }
        public int SessionId { get; private set; }
        public int ChapterId { get; private set; }
        public int ChapterIdx { get; private set; }
        public int MaxRooms { get; private set; }
        public double EnemyScale { get; private set; }

        public int Room { get; private set; }
        public int Kills { get; private set; }
        public long RunGold { get; private set; }
        public double Xp { get; private set; }
        public int Level { get; private set; }
        public double XpNext { get; private set; }

        /// <summary>Kỹ năng nhặt trong lượt: id -> bậc.</summary>
        public readonly Dictionary<string, int> Skills = new Dictionary<string, int>(StringComparer.Ordinal);

        public bool RoomCleared { get; set; }
        public bool PlayerTookDamageThisRoom { get; set; }
        public string LastDamageSource { get; set; } = "unknown";
        public double LastDamageAmount { get; set; }

        /// <summary>Chỉ số nhân vật đã tính cho lượt này (bản sao, không tham chiếu save).</summary>
        public PlayerStats Stats { get; private set; }

        public int EnemyCount { get; set; }

        private static int _nextId = 1;

        /// <summary>
        /// DungeonSession.begin(): tăng id và dựng phiên mới. Luôn tăng id để phát
        /// hiện được hai phiên chạy song song (lỗi từng làm quái đi gấp đôi tốc độ).
        /// </summary>
        public static RunSession Begin(Artemis.Domain.GameData.GameData data, StatsInput input,
            int chapterId, int chapterIdx, int maxRooms, double enemyScale)
        {
            var session = new RunSession
            {
                Active = true,
                SessionId = _nextId++,
                ChapterId = chapterId,
                ChapterIdx = chapterIdx,
                MaxRooms = Math.Max(1, maxRooms),
                EnemyScale = enemyScale,
                Room = 1,
                Kills = 0,
                RunGold = 0,
                Xp = 0,
                Level = 1,
                XpNext = Artemis.Domain.Progression.XpService.BaseXpNext,
                RoomCleared = false,
            };

            // getComputedStats phụ thuộc số phòng của chương (defK), nên phải set
            // trước khi tính.
            input.ChapterRooms = session.MaxRooms;
            session.Stats = PlayerStatsCalculator.Compute(data, input);
            return session;
        }

        public void End()
        {
            Active = false;
        }

        public bool IsBossRoom => EnemySpawner.IsBossRoom(Room, MaxRooms);

        /// <summary>Sang phòng kế. Không vượt quá MaxRooms — bản web từng hiện "Phòng 15/10".</summary>
        public bool AdvanceRoom()
        {
            if (Room >= MaxRooms) return false;
            Room = Math.Min(MaxRooms, Room + 1);
            RoomCleared = false;
            PlayerTookDamageThisRoom = false;
            EnemyCount = 0;
            return true;
        }

        public void AddKill()
        {
            Kills++;
        }

        public void AddGold(long amount)
        {
            if (amount > 0) RunGold += amount;
        }

        /// <summary>Nhặt XP: dùng đúng <c>if</c> của bản web (1 cấp mỗi lần).</summary>
        public bool AddXp(double amount)
        {
            double xp = Xp;
            int level = Level;
            double xpNext = XpNext;
            int levels = Artemis.Domain.Progression.XpService.ApplyXp(ref xp, ref level, ref xpNext, amount);

            Xp = xp;
            Level = level;
            XpNext = xpNext;
            return levels > 0;
        }

        /// <summary>Dựng danh sách quái của phòng hiện tại.</summary>
        public List<SpawnSpec> SpawnCurrentRoom()
        {
            var list = EnemySpawner.Spawn(ChapterId, Room, MaxRooms, Stats.BaseAtk, Stats.BaseHp);
            EnemyCount = list.Count;
            return list;
        }

        /// <summary>Hồi máu từ talent Healer khi chuyển phòng (chỉ từ phòng 2).</summary>
        public static long HealerHealOnRoomChange(long maxHp, int healerLevel, int room)
        {
            if (room <= 1 || healerLevel <= 0) return 0;
            return JsMath.RoundLong(maxHp * 0.06 * healerLevel);
        }

        /// <summary>Tim hồi máu: 18% nếu hero là alex, còn lại 14%.</summary>
        public static long HeartHealAmount(long maxHp, string heroId)
        {
            return JsMath.RoundLong(maxHp * (heroId == "alex" ? 0.18 : 0.14));
        }
    }
}
