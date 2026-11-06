namespace Artemis.Domain.Ui
{
    /// <summary>
    /// Quy đổi màu CSS sang RGBA float, không phụ thuộc engine.
    ///
    /// Tách khỏi UiTheme (bên Artemis.Runtime) để test được bằng `dotnet test` mà
    /// không cần UnityEngine. UiTheme.HexToColor gọi lại hàm này.
    /// </summary>
    public static class CssColor
    {
        /// <summary>
        /// Nhận "fde047", "#fde047", "0f172a55" (#RRGGBBAA), "fff" (#RGB).
        /// Trả về mảng [r,g,b,a] trong 0..1. Chuỗi không hợp lệ -> trắng đục.
        /// </summary>
        public static float[] ParseRgba(string hex)
        {
            if (string.IsNullOrEmpty(hex)) return new[] { 1f, 1f, 1f, 1f };
            hex = hex.Trim().TrimStart('#');

            if (hex.Length == 8)
            {
                return new[]
                {
                    ByteAt(hex, 0) / 255f,
                    ByteAt(hex, 2) / 255f,
                    ByteAt(hex, 4) / 255f,
                    ByteAt(hex, 6) / 255f,
                };
            }

            if (hex.Length == 6)
            {
                return new[]
                {
                    ByteAt(hex, 0) / 255f,
                    ByteAt(hex, 2) / 255f,
                    ByteAt(hex, 4) / 255f,
                    1f,
                };
            }

            if (hex.Length == 3)
            {
                // #abc -> #aabbcc
                return new[]
                {
                    ByteAt(hex, 0) * 17f / 255f,
                    ByteAt(hex, 1) * 17f / 255f,
                    ByteAt(hex, 2) * 17f / 255f,
                    1f,
                };
            }

            return new[] { 1f, 1f, 1f, 1f };
        }

        private static int ByteAt(string s, int i)
        {
            int len = s.Length == 3 ? 1 : 2;
            return System.Convert.ToInt32(s.Substring(i, len), 16);
        }
    }
}
