using System;
using System.Collections.Generic;
using Artemis.Domain.Core;

namespace Artemis.Domain.Spawning
{
    /// <summary>Một quái/boss sẽ được sinh ra trong phòng.</summary>
    public sealed class SpawnSpec
    {
        public bool IsBoss;
        public string Type;
        public double Hp;
        public double MaxHp;
        public double Atk;
        public double Speed;
        public double Radius;
        public string Name;
    }

    /// <summary>
    /// Sinh quái/boss cho một phòng — port của đoạn cân bằng trong
    /// <c>setupRoom()</c> (public/index.html:27030-27200).
    ///
    /// Hai thước đo khác nhau, và việc giữ đúng chúng là điều kiện để độ khó
    /// không đổi:
    ///   • HP quái/boss neo theo ATK người chơi  -> TTK ổn định
    ///   • ATK quái/boss neo theo MaxHP người chơi -> số đòn chịu được ổn định
    /// </summary>
    public static class EnemySpawner
    {
        // ---- Hằng số của công thức, đọc nguyên từ source ----
        private const double RoomMulStep = 0.13;
        private const double MobHitsBase = 1.4;
        private const double MobHitsDepth = 1.0;
        private const double MobAtkHitsStart = 16.0;
        private const double MobAtkHitsDepth = 10.0;

        /// <summary>isBossRoom(room, maxRooms): bội số 5 hoặc phòng cuối; mode bossOnly thì mọi phòng.</summary>
        public static bool IsBossRoom(int room, int maxRooms, bool modeBossOnly = false)
        {
            if (modeBossOnly) return true;
            int max = maxRooms > 0 ? maxRooms : 1;
            return (room % 5 == 0) || (room == max);
        }

        /// <summary>
        /// setupRoom(): scale = chapter.enemyScale * (1 + (room-1)*0.13).
        /// Lưu ý: roomMul này CHỈ áp cho HP quái thường. HP boss dùng
        /// hitsToKill trực tiếp (xem <see cref="BossHp"/>) — nhân thêm roomMul
        /// sẽ biến trùm cuối thành bức tường 53 giây.
        /// </summary>
        public static double Scale(double chapterEnemyScale, int room)
        {
            return chapterEnemyScale * (1.0 + (room - 1) * RoomMulStep);
        }

        /// <summary>depth = min(1, (room-1)/max(1, maxRooms-1)).</summary>
        public static double Depth(int room, int maxRooms)
        {
            return Math.Min(1.0, (room - 1) / (double)Math.Max(1, maxRooms - 1));
        }

        /// <summary>Số quái thường: min(8, 3 + floor(room/2)).</summary>
        public static int EnemyCount(int room)
        {
            return Math.Min(8, 3 + (int)Math.Floor(room / 2.0));
        }

        /// <summary>atkMul theo loại quái.</summary>
        public static double TypeAtkMul(string type)
        {
            switch (type)
            {
                case "obsidian_brute": return 1.28;
                case "eclipse_oracle": return 1.16;
                case "rift_stalker": return 1.04;
                case "sky_sentinel": return 1.25;
                case "cloud_wisp": return 0.96;
                case "dragon_whelp": return 1.08;
                case "plant_turret": return 1.23;
                case "skeleton_mage": return 1.12;
                default: return 1.0;
            }
        }

        /// <summary>
        /// Hệ số HP của quái — TÁI HIỆN MỘT LỖI ƯU TIÊN TOÁN TỬ CÓ THẬT trong
        /// public/index.html:
        ///
        /// <code>
        /// const atkMul = t === 'obsidian_brute' ? 1.28 : ( t === 'eclipse_oracle' ? 1.16 : ... ) * baseHits;
        /// </code>
        ///
        /// Vì <c>?:</c> có độ ưu tiên THẤP hơn <c>*</c>, <c>* baseHits</c> chỉ áp
        /// cho nhánh thứ hai trở đi. Kết quả: riêng <c>obsidian_brute</c> dùng
        /// atkMul trần 1.28, KHÔNG nhân baseHits (1.4→2.4), nên quái này yếu hơn
        /// khoảng 30% so với ý đồ.
        ///
        /// Đây là hành vi đang chạy trên production. Sửa nó ở Unity sẽ làm quái
        /// Chương 5 khó lên đột ngột — trái yêu cầu "không đổi cân bằng". Ghi lại
        /// để đội game quyết định có vá ở bản web hay không (xem
        /// docs/unity-migration/SOURCE_AUDIT.md §7 cạm bẫy #14).
        /// </summary>
        public static double MobHpMultiplier(string type, double baseHits)
        {
            double raw = TypeAtkMul(type);
            return type == "obsidian_brute" ? raw : raw * baseHits;
        }

        /// <summary>Tốc độ di chuyển theo loại quái.</summary>
        public static double TypeSpeed(string type)
        {
            switch (type)
            {
                case "plant_turret": return 0;
                case "obsidian_brute": return 38;
                case "sky_sentinel": return 48;
                case "eclipse_oracle": return 55;
                case "dragon_whelp": return 88;
                case "cloud_wisp": return 92;
                case "rift_stalker": return 102;
                case "bat": return 115;
                default: return 64; // slime, goblin, skeleton_mage
            }
        }

        /// <summary>Bán kính va chạm theo loại quái.</summary>
        public static double TypeRadius(string type)
        {
            switch (type)
            {
                case "bat": return 13;
                case "cloud_wisp": return 14;
                case "rift_stalker": return 14;
                case "sky_sentinel": return 19;
                case "obsidian_brute": return 19;
                default: return 16;
            }
        }

        /// <summary>Danh sách loại quái của chương (thứ tự quan trọng — chọn theo modulo).</summary>
        public static string[] TypesForChapter(int chapterId)
        {
            if (chapterId == 5) return new[] { "rift_stalker", "eclipse_oracle", "obsidian_brute" };
            if (chapterId == 4) return new[] { "dragon_whelp", "cloud_wisp", "sky_sentinel" };
            return new[] { "slime", "goblin", "skeleton_mage", "plant_turret", "bat" };
        }

        /// <summary>
        /// Quái thứ <paramref name="index"/> trong phòng: TẤT ĐỊNH theo
        /// (room + index) % types.length — không dùng random, đúng như bản web.
        /// Dùng random ở đây sẽ làm "cùng một phòng" khác nhau giữa hai client.
        /// </summary>
        public static string TypeForIndex(string[] types, int room, int index)
        {
            if (types == null || types.Length == 0) return "slime";
            return types[((room + index) % types.Length + types.Length) % types.Length];
        }

        /// <summary>HP quái = max(1, round(playerAtk * atkMul * baseHits * scale)).</summary>
        public static double MobHp(double playerAtk, string type, double chapterEnemyScale, int room, int maxRooms)
        {
            double scale = Scale(chapterEnemyScale, room);
            double depth = Depth(room, maxRooms);
            double baseHits = MobHitsBase + depth * MobHitsDepth;
            double atkMul = MobHpMultiplier(type, baseHits);
            return Math.Max(1, JsMath.Round(playerAtk * atkMul * scale));
        }

        /// <summary>
        /// ATK quái = max(1, round(playerMaxHp / (16 - depth*10) / max(1, sqrt(count/3)))).
        /// Chia theo sqrt(count) để phòng đông không one-shot, nhưng đường cong
        /// vẫn khó dần.
        /// </summary>
        public static double MobAtk(double playerMaxHp, double depth, int count)
        {
            double denom = MobAtkHitsStart - depth * MobAtkHitsDepth;
            double divisor = Math.Max(1.0, Math.Sqrt(count / 3.0));
            return Math.Max(1, JsMath.Round(playerMaxHp / denom / divisor));
        }

        // ---- Boss ----

        /// <summary>Loại trùm theo chương và phòng.</summary>
        public static string BossType(int chapterId, int room)
        {
            if (chapterId == 5) return "eclipse_sovereign";
            if (chapterId == 4) return "elder_dragon";
            if (room == 5) return "golem";
            if (room == 10) return "queen";
            return "demon_king";
        }

        public static string BossDisplayName(string type)
        {
            switch (type)
            {
                case "golem": return "🔥 TRÙM: GOLEM DUNG NHAM";
                case "queen": return "🕷️ TRÙM: NỮ HOÀNG NHỆN ĐỘC";
                case "demon_king": return "👑 ĐẠI MA VƯƠNG ATREUS";
                case "elder_dragon": return "🐉 TRÙM: CỔ LONG THIÊN KHÔNG";
                case "eclipse_sovereign": return "🌑 TRÙM CUỐI: BẠO CHÚA NHẬT THỰC";
                default: return "👑 TRÙM";
            }
        }

        /// <summary>hitsToKill theo SỐ PHÒNG: 24 (p5) / 30 (p10) / 40 (còn lại).</summary>
        public static int BossHitsToKill(int room)
        {
            if (room == 5) return 24;
            if (room == 10) return 30;
            return 40;
        }

        /// <summary>Số đòn trùm giết người chơi: 9 (p5) / 7 (p10) / 5 (còn lại).</summary>
        public static int BossHitsToDie(int room)
        {
            if (room == 5) return 9;
            if (room == 10) return 7;
            return 5;
        }

        /// <summary>HP boss = round(playerAtk * hitsToKill * chapterMul * (demon_king ? 1.15 : 1)).</summary>
        public static double BossHp(double playerAtk, int chapterId, int room)
        {
            string type = BossType(chapterId, room);
            double chapterMul = ChapterEnemyScale(chapterId);
            int hits = BossHitsToKill(room);
            double demonMult = type == "demon_king" ? 1.15 : 1.0;
            return JsMath.Round(playerAtk * hits * chapterMul * demonMult);
        }

        /// <summary>ATK boss = max(1, round(playerMaxHp / hitsToDie)).</summary>
        public static double BossAtk(double playerMaxHp, int room)
        {
            return Math.Max(1, JsMath.Round(playerMaxHp / BossHitsToDie(room)));
        }

        public static double BossSpeed(string type) => type == "eclipse_sovereign" ? 76 : 68;
        public static double BossRadius => 34;

        /// <summary>enemyScale theo chapter id — đồng bộ với chapters.json.</summary>
        public static double ChapterEnemyScale(int chapterId)
        {
            switch (chapterId)
            {
                case 1: return 1.00;
                case 2: return 1.45;
                case 3: return 2.00;
                case 4: return 2.35;
                case 5: return 2.62;
                default: return 1.00;
            }
        }

        /// <summary>
        /// Sinh toàn bộ phòng. Vị trí không nằm ở đây (web dùng random vị trí, và
        /// vị trí là trình bày) — chỉ loại, số lượng và chỉ số là hợp đồng.
        /// </summary>
        public static List<SpawnSpec> Spawn(int chapterId, int room, int maxRooms,
            double playerAtk, double playerMaxHp, bool modeBossOnly = false)
        {
            var result = new List<SpawnSpec>();
            if (IsBossRoom(room, maxRooms, modeBossOnly))
            {
                string type = BossType(chapterId, room);
                double hp = BossHp(playerAtk, chapterId, room);
                result.Add(new SpawnSpec
                {
                    IsBoss = true,
                    Type = type,
                    Name = BossDisplayName(type),
                    Hp = hp,
                    MaxHp = hp,
                    Atk = BossAtk(playerMaxHp, room),
                    Speed = BossSpeed(type),
                    Radius = BossRadius,
                });
                return result;
            }

            string[] types = TypesForChapter(chapterId);
            int count = EnemyCount(room);
            double scale = Scale(ChapterEnemyScale(chapterId), room);
            double depth = Depth(room, maxRooms);
            double baseHits = MobHitsBase + depth * MobHitsDepth;

            double perEnemyAtk = Math.Max(1, JsMath.Round(
                playerMaxHp / (MobAtkHitsStart - depth * MobAtkHitsDepth) / Math.Max(1.0, Math.Sqrt(count / 3.0))));

            for (int i = 0; i < count; i++)
            {
                string type = TypeForIndex(types, room, i);
                double atkMul = MobHpMultiplier(type, baseHits);
                double hp = Math.Max(1, JsMath.Round(playerAtk * atkMul * scale));
                result.Add(new SpawnSpec
                {
                    IsBoss = false,
                    Type = type,
                    Hp = hp,
                    MaxHp = hp,
                    Atk = perEnemyAtk,
                    Speed = TypeSpeed(type),
                    Radius = TypeRadius(type),
                });
            }
            return result;
        }
    }
}
