using System;
using Artemis.Domain.Core;

namespace Artemis.Domain.Progression
{
    public struct RunReward
    {
        public long Gold;
        public long Gems;
    }

    /// <summary>
    /// Bản port phần thưởng của <c>finishRun()</c> (public/index.html:31236).
    ///
    /// Chỉ tính con số. Việc cộng vào save, cộng lifetimeStats, mở khoá chương và
    /// gọi API vẫn nằm ở tầng trên — giống bản web, nơi finishRun vừa tính vừa ghi.
    /// </summary>
    public static class RewardService
    {
        /// <summary>Thắng: 350 vàng × chapterId, 40 đá quý × chapterId.</summary>
        public static RunReward Victory(int chapterId)
        {
            return new RunReward
            {
                Gold = 350L * chapterId,
                Gems = 40L * chapterId,
            };
        }

        /// <summary>Thua: room × 20 vàng, floor(room × 2) đá quý.</summary>
        public static RunReward Defeat(int room)
        {
            int r = Math.Max(0, room);
            return new RunReward
            {
                Gold = r * 20L,
                Gems = (long)Math.Floor(r * 2.0),
            };
        }

        public static RunReward For(bool victory, int chapterId, int room)
        {
            return victory ? Victory(chapterId) : Defeat(room);
        }
    }

    /// <summary>
    /// Kinh nghiệm trong lượt: xpNext bắt đầu 80, mỗi cấp × 1.25 rồi làm tròn.
    /// Port của vòng lên cấp trong updateGame (public/index.html:29001).
    /// </summary>
    public static class XpService
    {
        public const double BaseXpNext = 80.0;
        public const double GrowthFactor = 1.25;

        /// <summary>
        /// Áp một lượng XP, trả về 1 nếu vừa lên cấp.
        ///
        /// Bản JS dùng <c>if (p.xp >= p.xpNext)</c> — KHÔNG phải while. Nghĩa là
        /// một lần nhặt XP chỉ lên tối đa MỘT cấp, phần dư ở lại trong <c>xp</c> và
        /// sẽ lên cấp ở lần nhặt kế tiếp. Dùng while ở đây sẽ cho người chơi lên
        /// nhiều cấp cùng lúc và mở nhiều lượt chọn kỹ năng — thay đổi nhịp độ
        /// roguelike. Giữ nguyên <c>if</c>.
        /// </summary>
        public static int ApplyXp(ref double xp, ref int level, ref double xpNext, double amount)
        {
            if (double.IsNaN(amount) || amount <= 0) return 0;
            xp += amount;
            if (xp < xpNext) return 0;

            xp -= xpNext;
            level++;
            xpNext = JsMath.Round(xpNext * GrowthFactor);
            if (xpNext < 1) xpNext = 1;
            return 1;
        }

        /// <summary>Chuỗi xpNext từ cấp 1 — dùng cho test và hiển thị.</summary>
        public static double[] XpNextCurve(int levels)
        {
            var curve = new double[Math.Max(0, levels)];
            double next = BaseXpNext;
            for (int i = 0; i < curve.Length; i++)
            {
                curve[i] = next;
                next = JsMath.Round(next * GrowthFactor);
            }
            return curve;
        }
    }

    /// <summary>
    /// Mở khoá chương: chương N cần thắng chương N-1.
    /// Port của isChapterWon / isChapterLocked / normalizeSelectedChapter.
    /// </summary>
    public static class ChapterService
    {
        /// <summary>
        /// isChapterWon: có ít nhất 1 thắng, HOẶC bestRooms đạt đủ số phòng.
        /// Nguồn thứ hai tồn tại để tài khoản cũ (có kỷ lục nhưng chưa từng ghi
        /// nhận "win") không bị khoá oan.
        /// </summary>
        public static bool IsChapterWon(int chapterId, int wins, int bestRoom, int chapterRooms)
        {
            if (wins > 0) return true;
            return bestRoom >= chapterRooms && chapterRooms > 0;
        }

        /// <summary>isChapterLocked: chương 1 luôn mở; các chương khác cần thắng chương trước.</summary>
        public static bool IsChapterLocked(int chapterId, Func<int, int> winsFor, Func<int, int> bestRoomFor,
            Func<int, int> roomsFor)
        {
            if (chapterId <= 1) return false;
            int prev = chapterId - 1;
            return !IsChapterWon(prev, winsFor(prev), bestRoomFor(prev), roomsFor(prev));
        }

        /// <summary>
        /// normalizeSelectedChapter: nếu chương đang chọn bị khoá thì lùi về chương
        /// mở cao nhất.
        /// </summary>
        public static int NormalizeSelectedChapter(int selectedIdx, int[] chapterIds,
            Func<int, bool> isLocked)
        {
            if (chapterIds == null || chapterIds.Length == 0) return 0;
            if (selectedIdx >= 0 && selectedIdx < chapterIds.Length && !isLocked(chapterIds[selectedIdx]))
                return selectedIdx;

            for (int i = chapterIds.Length - 1; i >= 0; i--)
                if (!isLocked(chapterIds[i])) return i;
            return 0;
        }
    }
}
