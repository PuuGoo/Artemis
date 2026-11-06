using System;

namespace Artemis.Domain.Core
{
    /// <summary>
    /// Mô phỏng CHÍNH XÁC các phép làm tròn của JavaScript.
    ///
    /// Lý do tồn tại: <c>Math.round</c> của JS và <c>Math.Round</c> của .NET khác
    /// nhau ở mốc .5. JS làm tròn "nửa lên +∞":
    ///     Math.round(2.5) === 3     Math.round(-2.5) === -2
    /// .NET mặc định là banker's rounding:
    ///     Math.Round(2.5) == 2      Math.Round(-2.5) == -2
    /// Chỉ cần lệch 1 đơn vị ATK là damage lệch, TTK lệch, và "độ khó" đổi —
    /// nên mọi chỗ làm tròn trong domain BẮT BUỘC đi qua lớp này.
    /// </summary>
    public static class JsMath
    {
        /// <summary>
        /// <c>Math.round(x)</c> của JS.
        ///
        /// JS spec: nếu x là +0, -0, +∞, -∞ hoặc NaN thì trả nguyên x; ngược lại
        /// trả số nguyên gần nhất, làm tròn nửa lên +∞.
        ///
        /// Cài đặt bằng <c>Floor(x + 0.5)</c> KHÔNG đủ: với
        /// <c>x = 0.49999999999999994</c>, phép cộng 0.5 làm tròn thành 1.0 trong
        /// double, cho kết quả 1 trong khi JS trả 0. Vì vậy phải xử lý riêng
        /// trường hợp "cộng 0.5 làm nhảy bậc".
        /// </summary>
        public static double Round(double x)
        {
            if (double.IsNaN(x) || double.IsInfinity(x)) return x;
            if (x == 0.0) return x;                    // giữ nguyên dấu của -0

            double floor = Math.Floor(x);
            double diff = x - floor;

            // Đúng mốc .5 (hoặc lớn hơn) -> làm tròn lên.
            if (diff >= 0.5) return floor + 1.0;

            // Bẫy: x rất sát mốc .5 nhưng nhỏ hơn, và Floor(x)+1 vẫn đúng là
            // số nguyên kế tiếp; JS trả về floor.
            return floor;
        }

        /// <summary><c>Math.round(x)</c> trả về <see cref="long"/> — dùng cho HP/ATK/vàng.</summary>
        public static long RoundLong(double x)
        {
            if (double.IsNaN(x)) return 0;
            if (double.IsInfinity(x)) return x > 0 ? long.MaxValue : long.MinValue;
            return (long)Round(x);
        }

        /// <summary><c>Math.round(x)</c> trả về <see cref="int"/>, kẹp trong biên an toàn.</summary>
        public static int RoundInt(double x)
        {
            long v = RoundLong(x);
            if (v > int.MaxValue) return int.MaxValue;
            if (v < int.MinValue) return int.MinValue;
            return (int)v;
        }

        /// <summary>
        /// <c>x.toFixed(digits)</c> của JS, trả về double.
        ///
        /// Trong source game, các biểu thức như
        /// <c>+(weapon.aspd * (1 + …)).toFixed(2)</c> nghĩa là: làm tròn tới 2 chữ
        /// số thập phân, đổi sang chuỗi, rồi ép lại về số. Kết quả là một double
        /// "đã bị cắt". Bỏ bước này sẽ làm ASPD/CRIT lệch vài phần nghìn và tích
        /// luỹ thành lệch nhịp bắn.
        /// </summary>
        public static double ToFixed(double value, int digits)
        {
            if (double.IsNaN(value) || double.IsInfinity(value)) return value;
            if (digits < 0) digits = 0;
            if (digits > 15) digits = 15;

            // .NET "F{n}" dùng MidpointRounding.AwayFromZero cho định dạng số, đúng
            // như toFixed của JS (JS toFixed cũng làm tròn nửa ra xa 0 trên hệ
            // thập phân biểu diễn được).
            string text = value.ToString("F" + digits, System.Globalization.CultureInfo.InvariantCulture);
            return double.Parse(text, System.Globalization.CultureInfo.InvariantCulture);
        }

        /// <summary><c>parseInt(x, 10)</c> của JS: cắt phần thập phân, không ném lỗi.</summary>
        public static int ParseInt(double value)
        {
            if (double.IsNaN(value) || double.IsInfinity(value)) return 0;
            return (int)Math.Truncate(value);
        }

        /// <summary>
        /// <c>Number(v) || fallback</c> — mô phỏng thói quen phòng NaN của source.
        /// NaN, ±∞, undefined đều rơi về <paramref name="fallback"/>.
        /// </summary>
        public static double Or(double value, double fallback)
        {
            if (double.IsNaN(value) || double.IsInfinity(value)) return fallback;
            if (value == 0.0) return fallback;
            return value;
        }

        /// <summary>Kẹp giá trị trong [min, max], không ném lỗi khi min > max.</summary>
        public static double Clamp(double v, double min, double max)
        {
            if (double.IsNaN(v)) return min;
            if (min > max) return min;
            return v < min ? min : (v > max ? max : v);
        }

        /// <summary><c>Math.hypot(x, y)</c> — có bảo vệ tràn số như spec JS.</summary>
        public static double Hypot(double x, double y)
        {
            return Hypot(x, y, 0);
        }

        /// <summary><c>Math.hypot(x, y, z)</c>.</summary>
        public static double Hypot(double x, double y, double z)
        {
            x = Math.Abs(x); y = Math.Abs(y); z = Math.Abs(z);
            double max = Math.Max(x, Math.Max(y, z));
            if (max == 0.0) return 0.0;
            if (double.IsInfinity(max)) return double.PositiveInfinity;
            double nx = x / max, ny = y / max, nz = z / max;
            return max * Math.Sqrt(nx * nx + ny * ny + nz * nz);
        }
    }
}
