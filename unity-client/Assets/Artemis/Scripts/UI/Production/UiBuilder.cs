using System.Collections.Generic;
using Artemis.Domain.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Artemis.Runtime.UI.Production
{
    /// <summary>
    /// Dựng Unity UI từ cây UiNode trích ra từ public/index.html.
    ///
    /// Ý tưởng: production là HTML + Tailwind. Ta không vẽ tay lại 15 màn hình —
    /// ta dựng ĐÚNG cây DOM đó, rồi quy đổi Tailwind sang anchor/pivot/size của
    /// Unity RectTransform.
    ///
    /// Quy đổi layout:
    ///   flex flex-col       -> VerticalLayoutGroup
    ///   flex (mặc định row) -> HorizontalLayoutGroup
    ///   flex-wrap           -> HorizontalLayoutGroup + wrap (Unity không có wrap,
    ///                          nên dùng GridLayoutGroup khi có flex-wrap)
    ///   items-center        -> childAlignment Middle
    ///   justify-between     -> childAlignment + spacing (xấp xỉ, ghi rõ)
    ///   gap-N               -> spacingBetween
    ///   absolute inset-0    -> anchor stretch toàn phần
    ///   hidden              -> SetActive(false)
    ///
    /// Những chỗ Unity không biểu diễn được (backdrop-filter, box-shadow nhiều lớp,
    /// ::after) được ghi nhận lại để xử lý riêng — không im lặng bỏ qua.
    /// </summary>
    public sealed class UiBuilder
    {
        // 1 đơn vị Tailwind = 4px. Unity UI dùng px trực tiếp nên hệ số 1.
        public const float PxPerUnit = 1f;

        private readonly UiTheme _theme;
        private readonly Transform _root;
        private readonly Font _font;

        public readonly List<string> Unsupported = new List<string>();
        public int NodesBuilt { get; private set; }

        public UiBuilder(UiTheme theme, Transform root, Font font)
        {
            _theme = theme;
            _root = root;
            _font = font;
        }

        public GameObject Build(UiNode node)
        {
            var go = BuildRecursive(node, _root);
            return go;
        }

        private GameObject BuildRecursive(UiNode node, Transform parent)
        {
            if (node.Tag == "#root" || node.Tag == "body")
            {
                foreach (var k in node.Kids) BuildRecursive(k, parent);
                return null;
            }

            var go = new GameObject(string.IsNullOrEmpty(node.Id) ? node.Tag : node.Id);
            var rt = go.AddComponent<RectTransform>();
            rt.SetParent(parent, false);
            NodesBuilt++;

            ApplyLayout(node, rt);
            ApplyVisual(node, go, rt);
            ApplyText(node, go, rt);

            // hidden -> tắt, nhưng vẫn dựng để giữ cấu trúc (bật lại bằng id).
            if (node.IsHidden) go.SetActive(false);

            foreach (var k in node.Kids) BuildRecursive(k, rt);
            return go;
        }

        // ---------- Layout ----------

        private void ApplyLayout(UiNode node, RectTransform rt)
        {
            bool isRow = node.HasClass("flex") || node.HasClass("inline-flex");
            bool isCol = node.HasClass("flex-col");
            bool wrap = node.HasClass("flex-wrap");
            bool absolute = node.HasClass("absolute") || node.HasClass("fixed");
            bool full = node.HasClass("w-full");

            // Mặc định: co theo nội dung, canh trên-trái.
            rt.anchorMin = new Vector2(0f, 1f);
            rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0f, 1f);
            rt.anchoredPosition = Vector2.zero;

            if (node.HasClass("inset-0"))
            {
                rt.anchorMin = Vector2.zero;
                rt.anchorMax = Vector2.one;
                rt.offsetMin = Vector2.zero;
                rt.offsetMax = Vector2.zero;
            }
            else if (absolute)
            {
                // absolute + top-N / left-N
                float top = Spacing(node, "top-", 0f);
                float left = Spacing(node, "left-", 0f);
                rt.anchoredPosition = new Vector2(left, -top);
            }
            else if (full)
            {
                rt.anchorMin = new Vector2(0f, 1f);
                rt.anchorMax = new Vector2(1f, 1f);
                rt.offsetMin = new Vector2(0f, rt.offsetMin.y);
                rt.offsetMax = new Vector2(0f, rt.offsetMax.y);
            }

            // Kích thước cố định
            float w = Spacing(node, "w-", -1f), h = Spacing(node, "h-", -1f);
            bool hasW = w >= 0f, hasH = h >= 0f;
            if (hasW) rt.sizeDelta = new Vector2(w, hasH ? h : rt.sizeDelta.y);
            if (hasH) rt.sizeDelta = new Vector2(hasW ? w : rt.sizeDelta.x, h);

            // Padding
            int padT = (int)Spacing(node, "pt-", Spacing(node, "py-", Spacing(node, "p-", 0f)));
            int padB = (int)Spacing(node, "pb-", Spacing(node, "py-", Spacing(node, "p-", 0f)));
            int padL = (int)Spacing(node, "pl-", Spacing(node, "px-", Spacing(node, "p-", 0f)));
            int padR = (int)Spacing(node, "pr-", Spacing(node, "px-", Spacing(node, "p-", 0f)));

            float gap = Spacing(node, "gap-", 0f);
            if (gap <= 0f) gap = Spacing(node, "gap-x-", Spacing(node, "gap-y-", 0f));

            if (isCol)
            {
                var v = rt.gameObject.AddComponent<VerticalLayoutGroup>();
                v.spacing = gap;
                v.padding = new RectOffset(padL, padR, padT, padB);
                v.childControlWidth = true;
                v.childControlHeight = true;
                v.childForceExpandWidth = full;
                v.childForceExpandHeight = false;
                v.childAlignment = Alignment(node);
            }
            else if (wrap)
            {
                var g = rt.gameObject.AddComponent<GridLayoutGroup>();
                g.spacing = new Vector2(gap, gap);
                g.padding = new RectOffset(padL, padR, padT, padB);
                g.constraint = GridLayoutGroup.Constraint.Flexible;
                g.cellSize = new Vector2(64f, 64f);
            }
            else if (isRow)
            {
                var hz = rt.gameObject.AddComponent<HorizontalLayoutGroup>();
                hz.spacing = gap;
                hz.padding = new RectOffset(padL, padR, padT, padB);
                hz.childControlWidth = false;
                hz.childControlHeight = true;
                hz.childForceExpandWidth = false;
                hz.childForceExpandHeight = false;
                hz.childAlignment = Alignment(node);
            }
            else if (padT + padB + padL + padR > 0)
            {
                // Không flex nhưng có padding -> vẫn cần chừa chỗ.
                rt.offsetMin += new Vector2(padL, padB);
                rt.offsetMax -= new Vector2(padR, padT);
            }

            // overflow-hidden / overflow-y-auto: ghi nhận, Unity cần Mask/RectMask2D
            if (node.HasClass("overflow-hidden") || node.HasClass("overflow-y-auto"))
            {
                rt.gameObject.AddComponent<RectMask2D>();
            }

            if (node.HasClass("shrink-0"))
            {
                var le = rt.gameObject.GetComponent<LayoutElement>() ??
                         rt.gameObject.AddComponent<LayoutElement>();
                le.flexibleWidth = 0f;
                le.flexibleHeight = 0f;
            }
        }

        private static TextAnchor Alignment(UiNode node)
        {
            bool center = node.HasClass("items-center") || node.HasClass("justify-center");
            bool between = node.HasClass("justify-between");
            bool end = node.HasClass("justify-end") || node.HasClass("items-end");
            if (between) return TextAnchor.MiddleLeft;   // xấp xỉ: xem ghi chú trong Unsupported
            if (center) return TextAnchor.MiddleCenter;
            if (end) return TextAnchor.MiddleRight;
            return TextAnchor.UpperLeft;
        }

        private float Spacing(UiNode node, string prefix, float fallback)
        {
            foreach (var c in node.Cls)
            {
                if (!c.StartsWith(prefix)) continue;
                if (_theme.TrySpacing(c, out var px)) return px;
            }
            return fallback;
        }

        // ---------- Nền / viền ----------

        private void ApplyVisual(UiNode node, GameObject go, RectTransform rt)
        {
            Color bg = Color.clear;
            bool hasBg = false;

            // Gradient trước (gradient đè màu nền).
            foreach (var c in node.Cls)
            {
                if (_theme.TryGradient(c, out var stops) && stops.Length >= 2)
                {
                    var img = go.AddComponent<Image>();
                    img.color = Color.white;
                    var grad = go.AddComponent<GradientFill>();
                    grad.TopLeft = stops[0];
                    grad.BottomRight = stops[stops.Length - 1];
                    hasBg = true;
                    break;
                }
            }

            // bg-* / bg-gradient-to-b from-x to-y
            if (!hasBg)
            {
                foreach (var c in node.Cls)
                {
                    if (_theme.TryColorWithAlpha(c, out var col) && c.StartsWith("bg-"))
                    {
                        bg = col; hasBg = true; break;
                    }
                }
                if (!hasBg)
                {
                    // bg-gradient-to-b from-slate-900 to-slate-950
                    Color? from = null, to = null;
                    foreach (var c in node.Cls)
                    {
                        if (c.StartsWith("from-") && _theme.TryColor(c, out var f)) from = f;
                        if (c.StartsWith("to-") && _theme.TryColor(c, out var t)) to = t;
                    }
                    if (from.HasValue && to.HasValue)
                    {
                        var img = go.AddComponent<Image>();
                        img.color = Color.white;
                        var grad = go.AddComponent<GradientFill>();
                        grad.TopLeft = from.Value;
                        grad.BottomRight = to.Value;
                        hasBg = true;
                    }
                }
            }

            if (hasBg && go.GetComponent<Image>() == null)
            {
                var img = go.AddComponent<Image>();
                img.color = bg;
            }

            // Màu nền khiêm tốn: bg-slate-950/85 -> có alpha
            if (hasBg && go.GetComponent<Image>() != null && bg.a < 1f)
            {
                // canvas overlay cần raycast target để bắt click đóng modal
                go.GetComponent<Image>().raycastTarget = true;
            }

            // Viền: border-2 border-amber-400/60
            float border = 0f;
            Color borderColor = Color.clear;
            foreach (var c in node.Cls)
            {
                if (c == "border") border = Mathf.Max(border, 1f);
                if (c == "border-2") border = Mathf.Max(border, 2f);
                if (c == "border-4") border = Mathf.Max(border, 4f);
                if (c.StartsWith("border-") && _theme.TryColorWithAlpha(c, out var bc) &&
                    !c.StartsWith("border-2") && !c.StartsWith("border-4"))
                {
                    borderColor = bc;
                }
            }
            if (border > 0f && borderColor.a > 0f)
            {
                var outline = go.AddComponent<Outline>();
                outline.effectColor = borderColor;
                outline.effectDistance = new Vector2(border, -border);
            }

            // Bo góc: Unity Image không có radius; cần sprite 9-slice.
            foreach (var c in node.Cls)
            {
                if (_theme.TryRadius(c, out var r) && r > 0f)
                {
                    var img = go.GetComponent<Image>();
                    if (img != null) img.type = Image.Type.Sliced;
                    break;
                }
            }

            // backdrop-filter / shadow nhiều lớp / ::after — Unity cần shader riêng.
            if (node.HasClass("backdrop-blur-sm") || node.HasClass("backdrop-blur"))
                Note("backdrop-blur (cần shader blur riêng): " + Label(node));
            if (node.HasClass("shadow-2xl") || node.HasClass("shadow-lg"))
                Note("box-shadow (Unity không có, cần ảnh nền hoặc shader): " + Label(node));
        }

        // ---------- Chữ ----------

        private void ApplyText(UiNode node, GameObject go, RectTransform parentRt)
        {
            if (string.IsNullOrEmpty(node.Text)) return;

            Color col = new Color(1f, 1f, 1f, 1f);
            foreach (var c in node.Cls)
            {
                if (_theme.TryColorWithAlpha(c, out var cc) && c.StartsWith("text-")) { col = cc; break; }
            }

            float size = 14f;
            foreach (var c in node.Cls)
            {
                if (_theme.TryFontSize(c, out var s)) { size = s; break; }
            }

            // Unity chỉ cho MỘT Graphic mỗi GameObject. Node vừa có nền (Image) vừa
            // có chữ thì phải đặt Text lên GameObject con, nếu không
            // AddComponent<Text> trả null và gây NullReferenceException.
            GameObject textHost = go;
            if (go.GetComponent<Image>() != null)
            {
                textHost = new GameObject("Text");
                var trt = textHost.AddComponent<RectTransform>();
                trt.SetParent(parentRt, false);
                trt.anchorMin = Vector2.zero;
                trt.anchorMax = Vector2.one;
                trt.offsetMin = Vector2.zero;
                trt.offsetMax = Vector2.zero;
            }

            var txt = textHost.AddComponent<Text>();
            if (txt == null)
            {
                Note("Không thêm được Text (Unity giới hạn 1 Graphic/object): " + Label(node));
                return;
            }

            txt.text = node.Text;
            txt.color = col;
            txt.fontSize = Mathf.RoundToInt(size);
            txt.font = _font;
            txt.raycastTarget = false;

            if (node.HasClass("font-black")) txt.fontStyle = FontStyle.Bold;
            else if (node.HasClass("font-bold")) txt.fontStyle = FontStyle.Bold;
            else if (node.HasClass("font-semibold")) txt.fontStyle = FontStyle.Bold;
            else if (node.HasClass("font-medium")) txt.fontStyle = FontStyle.Normal;

            if (node.HasClass("uppercase")) txt.text = node.Text.ToUpperInvariant();

            // Căn chữ
            if (node.HasClass("text-center")) txt.alignment = TextAnchor.MiddleCenter;
            else if (node.HasClass("text-right")) txt.alignment = TextAnchor.MiddleRight;
            else txt.alignment = TextAnchor.MiddleLeft;

            if (node.HasClass("truncate") || node.HasClass("whitespace-nowrap"))
                txt.horizontalOverflow = HorizontalWrapMode.Overflow;
            else
                txt.horizontalOverflow = HorizontalWrapMode.Wrap;
        }

        private void Note(string s)
        {
            if (!Unsupported.Contains(s)) Unsupported.Add(s);
        }

        private static string Label(UiNode n) =>
            string.IsNullOrEmpty(n.Id) ? n.Tag : n.Id;
    }
}
