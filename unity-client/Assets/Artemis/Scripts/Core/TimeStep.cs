using UnityEngine;

namespace Artemis.Runtime.Core
{
    /// <summary>
    /// Chính sách bước thời gian.
    ///
    /// Bản web chạy <c>updateGame(dt)</c> với dt tính bằng giây thực, và có kẹp để
    /// một frame dài (tab bị ẩn) không làm quái nhảy cóc. Unity trả
    /// <c>Time.deltaTime</c> đã bị chặn bởi Maximum Allowed Timestep, nhưng mặc
    /// định khác web.
    ///
    /// Giữ cùng một chính sách ở đây để nhịp bắn (1/aspd) và tốc độ di chuyển
    /// không lệch giữa hai bản — đây là điều kiện để test ASPD thực tế có ý nghĩa.
    /// </summary>
    public static class TimeStep
    {
        /// <summary>Khớp clamp mặc định của vòng lặp web: không nhận frame dài hơn 1/20s.</summary>
        public const float MaxDelta = 0.05f;

        public static float Delta => Mathf.Min(Time.deltaTime, MaxDelta);
    }
}
