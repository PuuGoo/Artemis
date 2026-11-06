using System.Collections.Generic;
using Artemis.Domain.Core;
using Artemis.Domain.Ui;
using UnityEngine;
using UnityEngine.UI;

namespace Artemis.Runtime.UI.Production
{
    /// <summary>
    /// Dựng Unity UI từ cây production, dùng <see cref="UiLayout"/> (domain, đã test
    /// bằng dotnet) để tính rect TUYỆT ĐỐI, rồi chỉ đặt anchoredPosition/sizeDelta.
    ///
    /// Vì sao không dùng LayoutGroup của Unity: bản trước dùng VerticalLayoutGroup/
    /// HorizontalLayoutGroup và kết quả là mọi thứ dồn góc trên-trái, kích thước 0
    /// (xem docs/unity-migration/UI-PARITY.md). LayoutGroup điều khiển sizeDelta của
    /// con, xung đột với w-/h- cố định, và không mô phỏng được block vs inline của CSS.
    ///
    /// Cách này: Unity chỉ là "bộ vẽ" — toàn bộ số học nằm ở UiLayout, nơi test
    /// kiểm chứng được từng con số mà không cần mở Editor.
    /// </summary>
    public sealed class ProductionUiRenderer
    {
        private readonly UiTheme _theme;
        private readonly UiLayout _layout;
        private readonly Font _font;
        private readonly RectTransform _canvasRt;

        public readonly List<string> Unsupported = new List<string>();
        public int NodesBuilt { get; private set; }
        public int NodesSkipped { get; private set; }

        public ProductionUiRenderer(UiTheme theme, UiLayout layout, Font font, RectTransform canvasRt)
        {
            _theme = theme;
            _layout = layout;
            _font = font;
            _canvasRt = canvasRt;
        }

        public GameObject Render(UiLayout.Box box, Transform parent)
        {
            var go = RenderRecursive(box, parent);
            return go;
        }

        private GameObject RenderRecursive(UiLayout.Box box, Transform parent)
        {
            var node = box.Node;
            if (node == null || node.Tag == "#root" || node.Tag == "body")
            {
                // Node gốc không tạo GameObject; dựng con trực tiếp.
                foreach (var k in box.Kids) RenderRecursive(k, parent);
                return null;
            }

            var go = new GameObject(NameOf(node));
            var rt = go.AddComponent<RectTransform>();
            rt.SetParent(parent, false);

            // Neo góc trên-trái của canvas (0,1); toạ độ layout tính từ gốc trên-trái.
            rt.anchorMin = new Vector2(0f, 1f);
            rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0f, 1f);
            rt.anchoredPosition = new Vector2(box.Rect.X, -box.Rect.Y);
            rt.sizeDelta = new Vector2(Mathf.Max(0f, box.Rect.W), Mathf.Max(0f, box.Rect.H));

            NodesBuilt++;

            ApplyVisual(node, go, rt);
            ApplyText(node, go, rt);

            if (!box.Visible) go.SetActive(false);

            foreach (var k in box.Kids) RenderRecursive(k, rt);
            return go;
        }

        private static string NameOf(UiLayout.UiNodeRef n) =>
            string.IsNullOrEmpty(n.Id) ? n.Tag : n.Id;

        // ---------- Nền, viền, bo góc ----------

        private void ApplyVisual(UiLayout.UiNodeRef node, GameObject go, RectTransform rt)
        {
            Color bg = Color.clear;
            bool hasBg = false;

            // 1. Gradient tự định nghĩa (gold-gradient, epic-gradient, a2-q-*...).
            foreach (var c in node.Cls)
            {
                if (!_theme.TryGradient(c, out var stops) || stops.Length < 2) continue;
                var img0 = go.AddComponent<Image>();
                img0.color = Color.white;
                img0.raycastTarget = false;
                var grad = go.AddComponent<GradientFill>();
                grad.SetColors(stops[0], stops[stops.Length - 1]);
                hasBg = true;
                break;
            }

            // 2. bg-* phẳng.
            if (!hasBg)
            {
                foreach (var c in node.Cls)
                {
                    if (!c.StartsWith("bg-")) continue;
                    if (!_theme.TryColorWithAlpha(c, out var col)) continue;
                    bg = col;
                    hasBg = true;
                    break;
                }
            }

            // 3. bg-gradient-to-b from-x to-y (hỗ trợ cả from-[#hex] / to-[#hex]).
            if (!hasBg)
            {
                Color? from = null, to = null, via = null;
                foreach (var c in node.Cls)
                {
                    if (c.StartsWith("from-") && _theme.TryColorWithAlpha(c, out var f)) from = f;
                    if (c.StartsWith("to-") && _theme.TryColorWithAlpha(c, out var t)) to = t;
                    if (c.StartsWith("via-") && _theme.TryColorWithAlpha(c, out var v)) via = v;
                }
                if (from.HasValue && to.HasValue)
                {
                    var img1 = go.AddComponent<Image>();
                    img1.color = Color.white;
                    img1.raycastTarget = false;
                    var grad = go.AddComponent<GradientFill>();
                    // Có via- thì tô 3 điểm dừng; GradientFill 2x2 không đủ, dùng
                    // trung bình để vẫn ra dải màu đúng họ.
                    if (via.HasValue)
                        grad.SetColors(from.Value, Color.Lerp(via.Value, to.Value, 0.5f));
                    else
                        grad.SetVertical(from.Value, to.Value);
                    hasBg = true;
                }
            }

            // 4. <img src="data:..."> -> sprite thật đã trích ra file.
            if (node.Tag == "img")
            {
                var sprite = LoadImageSprite(node);
                if (sprite != null)
                {
                    var img3 = go.AddComponent<Image>();
                    img3.sprite = sprite;
                    img3.color = Color.white;
                    img3.raycastTarget = false;
                    // Giữ tỉ lệ ảnh thay vì kéo méo.
                    img3.preserveAspect = true;
                }
                else
                {
                    Note("<img> không có sprite (ảnh base64 chưa trích?): " + NameOf(node));
                }
            }

            if (hasBg && go.GetComponent<Image>() == null)
            {
                var img2 = go.AddComponent<Image>();
                img2.color = bg;
                img2.raycastTarget = false;
            }

            // Viền
            float border = 0f;
            Color borderColor = Color.clear;
            foreach (var c in node.Cls)
            {
                if (c == "border") border = Mathf.Max(border, 1f);
                else if (c == "border-2") border = Mathf.Max(border, 2f);
                else if (c == "border-4") border = Mathf.Max(border, 4f);
                else if (c.StartsWith("border-") && _theme.TryColorWithAlpha(c, out var bc)) borderColor = bc;
            }
            if (border > 0f && borderColor.a > 0f)
            {
                var outline = go.AddComponent<Outline>();
                outline.effectColor = borderColor;
                outline.effectDistance = new Vector2(border, -border);
            }

            // Bo góc -> cần sprite 9-slice; Image.Sliced mà không có sprite bo góc
            // thì vẫn là chữ nhật, nên ghi nhận thay vì giả vờ đã bo.
            foreach (var c in node.Cls)
            {
                if (_theme.TryRadius(c, out var r) && r > 0f)
                {
                    Note("bo góc " + r + "px (cần sprite 9-slice): " + NameOf(node));
                    break;
                }
            }

            if (node.HasClass("overflow-hidden") || node.HasClass("overflow-y-auto"))
                go.AddComponent<RectMask2D>();

            if (node.HasClass("backdrop-blur-sm") || node.HasClass("backdrop-blur"))
                Note("backdrop-blur (cần shader riêng): " + NameOf(node));
            if (node.HasClass("shadow-2xl") || node.HasClass("shadow-lg") || node.HasClass("shadow-xl"))
                Note("box-shadow (cần shader/ảnh nền): " + NameOf(node));
        }

        // ---------- Chữ ----------

        private void ApplyText(UiLayout.UiNodeRef node, GameObject go, RectTransform rt)
        {
            if (string.IsNullOrEmpty(node.Text)) return;

            Color col = Color.white;
            foreach (var c in node.Cls)
            {
                if (c.StartsWith("text-") && _theme.TryColorWithAlpha(c, out var cc)) { col = cc; break; }
            }

            float size = 14f;
            foreach (var c in node.Cls)
            {
                if (_theme.TryFontSize(c, out var s)) { size = s; break; }
            }

            // Unity: 1 Graphic / GameObject. Node có nền thì đặt Text ở con.
            GameObject host = go;
            if (go.GetComponent<Image>() != null)
            {
                host = new GameObject("Label");
                var lrt = host.AddComponent<RectTransform>();
                lrt.SetParent(rt, false);
                lrt.anchorMin = Vector2.zero;
                lrt.anchorMax = Vector2.one;
                lrt.offsetMin = Vector2.zero;
                lrt.offsetMax = Vector2.zero;
            }

            var txt = host.AddComponent<Text>();
            if (txt == null)
            {
                NodesSkipped++;
                Note("không thêm được Text: " + NameOf(node));
                return;
            }

            txt.text = node.HasClass("uppercase") ? node.Text.ToUpperInvariant() : node.Text;
            txt.color = col;
            txt.fontSize = Mathf.RoundToInt(size);
            txt.font = _font;
            txt.raycastTarget = false;

            bool bold = node.HasClass("font-black") || node.HasClass("font-bold") ||
                        node.HasClass("font-extrabold") || node.HasClass("font-semibold");
            txt.fontStyle = bold ? FontStyle.Bold : FontStyle.Normal;

            if (node.HasClass("text-center")) txt.alignment = TextAnchor.MiddleCenter;
            else if (node.HasClass("text-right")) txt.alignment = TextAnchor.MiddleRight;
            else txt.alignment = TextAnchor.MiddleLeft;

            txt.horizontalOverflow =
                node.HasClass("truncate") || node.HasClass("whitespace-nowrap")
                    ? HorizontalWrapMode.Overflow
                    : HorizontalWrapMode.Wrap;
            txt.verticalOverflow = VerticalWrapMode.Truncate;
        }

        private void Note(string s)
        {
            if (!Unsupported.Contains(s)) Unsupported.Add(s);
        }

        // ---------- Ảnh ----------

        private readonly Dictionary<string, Sprite> _spriteCache = new Dictionary<string, Sprite>();

        /// <summary>
        /// Nạp sprite cho node &lt;img&gt; từ bản đồ do extract-images.mjs sinh ra.
        ///
        /// Production nhúng ảnh dạng data URI base64; Unity không đọc được, nên
        /// script đó giải mã ra file .jpg/.png trong Resources/ArtemisUi/Images và
        /// ghi uiImages.json (id -> tên file). Ở đây tra theo id của node.
        /// </summary>
        private Sprite LoadImageSprite(UiLayout.UiNodeRef node)
        {
            EnsureImageMap();

            string key = !string.IsNullOrEmpty(node.Id) ? node.Id : "";
            if (key.Length == 0 || !_imageMap.TryGetValue(key, out var fileName)) return null;

            if (_spriteCache.TryGetValue(fileName, out var cached)) return cached;

            // Bỏ phần mở rộng vì Resources.Load không nhận.
            string resPath = "ArtemisUi/Images/" + System.IO.Path.GetFileNameWithoutExtension(fileName);
            var spr = Resources.Load<Sprite>(resPath);
            if (spr == null)
            {
                // Ảnh .jpg import mặc định là Texture, không phải Sprite.
                var tex = Resources.Load<Texture2D>(resPath);
                if (tex != null)
                    spr = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), 100f, 0, SpriteMeshType.FullRect);
            }

            _spriteCache[fileName] = spr;
            return spr;
        }

        private readonly Dictionary<string, string> _imageMap = new Dictionary<string, string>();
        private bool _imageMapLoaded;

        private void EnsureImageMap()
        {
            if (_imageMapLoaded) return;
            _imageMapLoaded = true;

            var asset = Resources.Load<TextAsset>("ArtemisUi/uiImages");
            if (asset == null)
            {
                Note("thiếu uiImages.json — chạy node tools/unity-ui/extract-images.mjs");
                return;
            }

            var json = Json.Parse(asset.text);
            foreach (var im in json["images"].Items)
            {
                string id = im["id"].AsString("");
                string file = im["file"].AsString("");
                if (id.Length > 0 && file.Length > 0) _imageMap[id] = file;
            }
        }
    }
}
