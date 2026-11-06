using System.Collections.Generic;
using Artemis.Domain.Core;
using UnityEngine;

namespace Artemis.Runtime.UI.Production
{
    /// <summary>
    /// Theme production, quy đổi từ Tailwind sang giá trị Unity dùng được.
    ///
    /// Nguồn: unity-client/Assets/Artemis/Resources/ArtemisUi/uiTheme.json
    /// sinh bởi tools/unity-ui/extract-theme.mjs (đọc thẳng public/index.html).
    ///
    /// Không có bảng nào chép tay: mọi màu, khoảng cách, bo góc, cỡ chữ đều lấy
    /// từ CSS production thật.
    /// </summary>
    public sealed class UiTheme
    {
        public string BodyBackground;
        public string[] FontFamilies = new string[0];

        private readonly Dictionary<string, Color> _colors = new Dictionary<string, Color>();
        private readonly Dictionary<string, Color> _colorsAlpha = new Dictionary<string, Color>();
        private readonly Dictionary<string, float> _spacing = new Dictionary<string, float>();
        private readonly Dictionary<string, float> _fontSize = new Dictionary<string, float>();
        private readonly Dictionary<string, float> _radius = new Dictionary<string, float>();
        private readonly Dictionary<string, Color[]> _gradients = new Dictionary<string, Color[]>();
        private readonly HashSet<string> _custom = new HashSet<string>();

        public static UiTheme Load(string json)
        {
            var root = Json.Parse(json);
            var t = new UiTheme
            {
                BodyBackground = root["bodyBackground"].AsString(""),
            };

            var fonts = root["fonts"]["families"];
            if (fonts.IsArray)
            {
                var list = new List<string>();
                foreach (var f in fonts.Items)
                {
                    // production có: "'Inter', sans-serif", "inherit", "'Baloo 2', 'Inter', sans-serif"
                    // -> lấy tên font đầu tiên, bỏ dấu nháy và phần fallback.
                    var raw = f.AsString("").Trim();
                    var first = raw.Split(',')[0].Trim().Trim('\'', '"');
                    if (first.Length > 0 && !list.Contains(first)) list.Add(first);
                }
                t.FontFamilies = list.ToArray();
            }

            // colors: { "bg-amber-400/60": { hex, alpha } }
            var cols = root["colors"];
            if (cols.IsObject && cols.Members != null)
            {
                foreach (var kv in cols.Members)
                {
                    var hex = kv.Value["hex"].AsString("");
                    if (hex.Length < 6) continue;
                    float a = (float)kv.Value["alpha"].AsNumber(1);
                    var c = HexToColor(hex);
                    t._colors[kv.Key] = c;
                    var ca = c;
                    ca.a = a;
                    t._colorsAlpha[kv.Key] = ca;
                }
            }

            // spacing: { "p-4": { kind, px } }
            var sp = root["spacing"];
            if (sp.IsObject && sp.Members != null)
                foreach (var kv in sp.Members)
                    t._spacing[kv.Key] = (float)kv.Value["px"].AsNumber(0);

            // fontSize: { "text-xs": { size, line } }
            var fs = root["fontSize"];
            if (fs.IsObject && fs.Members != null)
                foreach (var kv in fs.Members)
                    t._fontSize[kv.Key] = (float)kv.Value["size"].AsNumber(14);

            // radius: { "rounded-xl": "12" }
            var rd = root["radius"];
            if (rd.IsObject && rd.Members != null)
                foreach (var kv in rd.Members)
                    t._radius[kv.Key] = (float)kv.Value.AsNumber(0);

            // gradients: { "gold-gradient": { stops: ["fde047", ...] } }
            var gr = root["gradients"];
            if (gr.IsObject && gr.Members != null)
            {
                foreach (var kv in gr.Members)
                {
                    var stops = kv.Value["stops"];
                    if (!stops.IsArray) continue;
                    var arr = new List<Color>();
                    foreach (var s in stops.Items)
                    {
                        var hex = s.AsString("");
                        if (hex.Length >= 6) arr.Add(HexToColor(hex));
                    }
                    if (arr.Count >= 2) t._gradients[kv.Key] = arr.ToArray();
                }
            }

            var cu = root["custom"];
            if (cu.IsArray)
                foreach (var c in cu.Items) t._custom.Add(c.AsString(""));

            return t;
        }

        public static Color HexToColor(string hex)
        {
            var c = Artemis.Domain.Ui.CssColor.ParseRgba(hex);
            return new Color(c[0], c[1], c[2], c[3]);
        }

        // ---------- Truy vấn ----------

        /// <summary>Màu của class Tailwind. Trả false nếu class không phải màu.</summary>
        public bool TryColor(string cls, out Color c) => _colors.TryGetValue(cls, out c);

        public bool TryColorWithAlpha(string cls, out Color c) => _colorsAlpha.TryGetValue(cls, out c);

        public bool HasColor(string cls) => _colors.ContainsKey(cls);

        /// <summary>px của class spacing (p-4 -> 16).</summary>
        public bool TrySpacing(string cls, out float px) => _spacing.TryGetValue(cls, out px);

        public bool TryFontSize(string cls, out float px) => _fontSize.TryGetValue(cls, out px);

        public bool TryRadius(string cls, out float px) => _radius.TryGetValue(cls, out px);

        public bool TryGradient(string cls, out Color[] stops) => _gradients.TryGetValue(cls, out stops);

        public bool IsCustom(string cls) => _custom.Contains(cls);

        public int ColorCount => _colors.Count;
        public int GradientCount => _gradients.Count;
    }
}
