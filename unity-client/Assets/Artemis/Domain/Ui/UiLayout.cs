using System;
using System.Collections.Generic;

namespace Artemis.Domain.Ui
{
    /// <summary>
    /// Layout engine mô phỏng CSS flexbox ở mức đủ dùng cho Artemis.
    ///
    /// Vì sao không dùng LayoutGroup của Unity: production là HTML + Tailwind, bố
    /// cục do CSS flex quyết định (row/column, gap, padding, w-full, flex-1,
    /// justify-between, items-center). LayoutGroup của Unity tính theo cách khác
    /// (nó điều khiển sizeDelta của con, xung đột với kích thước cố định), nên
    /// dựng ra bị dồn góc và kích thước 0 — đúng hiện tượng ảnh chụp đầu tiên.
    ///
    /// Cách này tính ra rect tuyệt đối giống trình duyệt, rồi Unity chỉ việc đặt
    /// anchoredPosition/sizeDelta. Nhờ vậy layout KIỂM TRA ĐƯỢC bằng dotnet test,
    /// không cần mở Unity.
    /// </summary>
    public sealed class UiLayout
    {
        public struct Rect
        {
            public float X, Y, W, H;
            public Rect(float x, float y, float w, float h) { X = x; Y = y; W = w; H = h; }
            public override string ToString() => $"({X:0.#},{Y:0.#} {W:0.#}x{H:0.#})";
        }

        /// <summary>Kết quả layout cho một node.</summary>
        public sealed class Box
        {
            public UiNodeRef Node;
            public Rect Rect;
            public bool Visible = true;
            public List<Box> Kids = new List<Box>();

            public Box Find(string id)
            {
                if (Node.Id == id) return this;
                foreach (var k in Kids)
                {
                    var hit = k.Find(id);
                    if (hit != null) return hit;
                }
                return null;
            }

            public int Count()
            {
                int n = 1;
                foreach (var k in Kids) n += k.Count();
                return n;
            }

            public void Walk(Action<Box> fn)
            {
                fn(this);
                foreach (var k in Kids) k.Walk(fn);
            }

            /// <summary>
            /// Dựng Box rỗng (rect 0) cho node ẩn và TOÀN BỘ cây con của nó.
            ///
            /// Vì sao: modal hidden theo mặc định production (gearDetailModal...)
            /// chứa cả chục node con. Nếu chỉ tạo 1 Box rỗng thì Unity không có
            /// GameObject nào để bật lại khi mở modal.
            /// </summary>
            public static Box HiddenTree(UiNodeRef node)
            {
                var b = new Box { Node = node, Rect = new Rect(0f, 0f, 0f, 0f), Visible = false };
                foreach (var k in node.Kids) b.Kids.Add(HiddenTree(k));
                return b;
            }
        }

        /// <summary>
        /// Tham chiếu node tối giản — để engine không phụ thuộc Artemis.Runtime
        /// (UiNode nằm bên runtime vì có UnityEngine ở chỗ khác).
        /// </summary>
        public sealed class UiNodeRef
        {
            public string Tag = "";
            public string Id = "";
            public string Text = "";
            public List<string> Cls = new List<string>();
            public List<UiNodeRef> Kids = new List<UiNodeRef>();
            public bool HasClass(string c) => Cls.Contains(c);
        }

        // ---------- Kết quả đo chữ ----------

        /// <summary>
        /// Ước lượng bề rộng chữ. Unity không có API đo chữ ngoài runtime, còn
        /// trình duyệt đo bằng font thật. Hệ số 0.55 là trung bình cho font sans
        /// ở cỡ chữ chuẩn; đủ để bố cục không vỡ, và có thể thay bằng đo thật sau.
        /// </summary>
        public static float MeasureTextWidth(string text, float fontSize)
        {
            if (string.IsNullOrEmpty(text)) return 0f;
            float w = 0f;
            foreach (var ch in text)
            {
                // Ký tự hẹp/rộng khác nhau; dấu tiếng Việt chiếm gần như chữ thường.
                if (ch == ' ') w += 0.28f;
                else if (char.IsUpper(ch)) w += 0.62f;
                else if ("iljt.,:;'|!".IndexOf(ch) >= 0) w += 0.30f;
                else if ("mwMW".IndexOf(ch) >= 0) w += 0.82f;
                else w += 0.54f;
            }
            return w * fontSize;
        }

        public static float LineHeight(float fontSize) => fontSize * 1.35f;

        // ---------- Style đã quy đổi ----------

        private sealed class Style
        {
            public bool IsRow, IsCol, Wrap;
            public bool WidthFull, HeightFull, Grow;
            public float? FixedW, FixedH;
            public float PadT, PadB, PadL, PadR;
            public float Gap;
            public float FontSize = 14f;
            public bool Absolute, Inset0;
            public float Top, Left;
            public bool Hidden;
            public bool JustifyBetween, CenterMain, CenterCross, EndMain, EndCross;
            public bool IsText;
            public bool IsBlock;
            public string Text = "";
        }

        private readonly Dictionary<string, float> _spacing;
        private readonly Dictionary<string, float> _fontSize;
        private readonly HashSet<string> _textTags = new HashSet<string>
        {
            "span", "p", "h1", "h2", "h3", "h4", "h5", "h6", "b", "i", "em", "strong", "small", "label", "li", "a",
        };

        /// <summary>Thẻ inline: co theo nội dung. Còn lại là block: rộng hết dòng.</summary>
        private static readonly HashSet<string> InlineTags = new HashSet<string>
        {
            "span", "b", "i", "em", "strong", "small", "label", "a", "code",
        };

        /// <summary>Thẻ thay thế: kích thước do nội dung/asset quyết định.</summary>
        private static readonly HashSet<string> ReplacedTags = new HashSet<string>
        {
            "img", "canvas", "input", "svg",
        };

        public UiLayout(Dictionary<string, float> spacing, Dictionary<string, float> fontSize)
        {
            _spacing = spacing ?? new Dictionary<string, float>();
            _fontSize = fontSize ?? new Dictionary<string, float>();
        }

        private float Sp(List<string> cls, string prefix, float fallback)
        {
            foreach (var c in cls)
            {
                if (!c.StartsWith(prefix)) continue;
                if (_spacing.TryGetValue(c, out var px)) return px;
            }
            return fallback;
        }

        private Style Resolve(UiNodeRef n)
        {
            var s = new Style
            {
                IsRow = n.HasClass("flex") || n.HasClass("inline-flex"),
                IsCol = n.HasClass("flex-col"),
                Wrap = n.HasClass("flex-wrap"),
                WidthFull = n.HasClass("w-full"),
                HeightFull = n.HasClass("h-full"),
                Grow = n.HasClass("flex-1"),
                Hidden = n.HasClass("hidden"),
                Absolute = n.HasClass("absolute") || n.HasClass("fixed"),
                Inset0 = n.HasClass("inset-0"),
                Gap = Sp(n.Cls, "gap-", Sp(n.Cls, "gap-x-", 0f)),
                Top = Sp(n.Cls, "top-", 0f),
                Left = Sp(n.Cls, "left-", 0f),
                JustifyBetween = n.HasClass("justify-between"),
                CenterMain = n.HasClass("justify-center"),
                EndMain = n.HasClass("justify-end"),
                CenterCross = n.HasClass("items-center"),
                EndCross = n.HasClass("items-end"),
                Text = n.Text ?? "",
            };

            float w = Sp(n.Cls, "w-", -1f), h = Sp(n.Cls, "h-", -1f);
            // "w-full"/"h-full" KHÔNG có trong bảng spacing (extractor bỏ giá trị 0),
            // nên phải nhận diện bằng class chứ không dựa vào Sp().
            if (s.WidthFull) s.FixedW = null;
            else if (w >= 0f) s.FixedW = w;
            if (s.HeightFull) s.FixedH = null;
            else if (h >= 0f) s.FixedH = h;

            s.PadT = Sp(n.Cls, "pt-", Sp(n.Cls, "py-", Sp(n.Cls, "p-", 0f)));
            s.PadB = Sp(n.Cls, "pb-", Sp(n.Cls, "py-", Sp(n.Cls, "p-", 0f)));
            s.PadL = Sp(n.Cls, "pl-", Sp(n.Cls, "px-", Sp(n.Cls, "p-", 0f)));
            s.PadR = Sp(n.Cls, "pr-", Sp(n.Cls, "px-", Sp(n.Cls, "p-", 0f)));

            foreach (var c in n.Cls)
                if (_fontSize.TryGetValue(c, out var fs)) { s.FontSize = fs; break; }

            s.IsText = (string.IsNullOrEmpty(n.Tag) || _textTags.Contains(n.Tag) || n.Kids.Count == 0)
                       && !string.IsNullOrEmpty(s.Text);

            // HTML: <div> là block -> rộng hết dòng của cha. <span> là inline -> co
            // theo nội dung. Bỏ qua quy tắc này làm mọi khối co về 0 và dồn góc.
            bool isBlock = !InlineTags.Contains(n.Tag ?? "") && !ReplacedTags.Contains(n.Tag ?? "");
            // flex-1 trong container dọc cũng phải rộng hết dòng (giống block).
            s.IsBlock = (isBlock || s.Grow) && !s.Absolute && !s.Inset0;

            return s;
        }

        // ---------- Đo (bottom-up) ----------

        private void Measure(UiNodeRef n, Style s, out float w, out float h)
        {
            if (s.Hidden) { w = 0f; h = 0f; return; }

            if (s.FixedW.HasValue) w = s.FixedW.Value;
            else if (s.IsText) w = MeasureTextWidth(s.Text, s.FontSize) + 2f;
            else w = 0f;

            if (s.FixedH.HasValue) h = s.FixedH.Value;
            else if (s.IsText) h = LineHeight(s.FontSize);
            else h = 0f;

            float cw = 0f, ch = 0f;   // tổng kích thước nội dung
            int visible = 0;

            foreach (var k in n.Kids)
            {
                var ks = Resolve(k);
                if (ks.Hidden) continue;
                if (ks.Absolute || ks.Inset0) continue;   // không tham gia luồng

                Measure(k, ks, out var kw, out var kh);
                visible++;

                // Mặc định HTML: block xếp dọc. Chỉ flex row mới xếp ngang.
                if (!(s.IsRow && !s.IsCol)) { ch += kh; cw = Math.Max(cw, kw); }
                else if (s.Wrap) { cw += kw; ch = Math.Max(ch, kh); }
                else { cw += kw; ch = Math.Max(ch, kh); }
            }

            if (visible > 1) cw += s.Gap * (visible - 1);
            if (s.IsCol && !s.IsRow && visible > 1) { ch += s.Gap * (visible - 1); cw -= s.Gap * (visible - 1); }

            // Container: cộng padding
            if (!s.IsText)
            {
                cw += s.PadL + s.PadR;
                ch += s.PadT + s.PadB;
                if (!s.FixedW.HasValue) w = Math.Max(w, cw);
                if (!s.FixedH.HasValue) h = Math.Max(h, ch);
            }
        }

        // ---------- Đặt (top-down) ----------

        public Box Compute(UiNodeRef root, float viewportW, float viewportH)
        {
            var rs = Resolve(root);
            var rootBox = new Box
            {
                Node = root,
                Rect = new Rect(0f, 0f, viewportW, viewportH),
            };
            // Node gốc LUÔN phủ viewport — không để Arrange tính lại từ nội dung,
            // nếu không root sẽ co về kích thước nội dung (lỗi từng gặp: mọi thứ
            // dồn góc trên-trái).
            Arrange(root, rs, rootBox, viewportW, viewportH, isRoot: true);
            return rootBox;
        }

        private void Arrange(UiNodeRef n, Style s, Box box, float availW, float availH, bool isRoot = false)
        {
            // Kích thước của chính node
            float w = box.Rect.W;
            float h = box.Rect.H;

            if (!isRoot)
            {
                // inset-0 và flex-1 luôn nhận kích thước của cha.
                if (s.Inset0)
                {
                    w = availW;
                    h = availH;
                }
                else
                {
                    w = s.FixedW ?? (s.WidthFull || s.IsBlock || s.Grow ? availW : box.Rect.W);
                    h = s.FixedH ?? (s.HeightFull ? availH : box.Rect.H);

                    // Không có kích thước cố định -> đo nội dung.
                    if (!s.FixedW.HasValue && !s.WidthFull && !s.IsBlock && !s.Grow)
                    {
                        Measure(n, s, out var mw, out _);
                        w = Math.Max(0f, Math.Min(mw, availW));
                    }
                    if (!s.FixedH.HasValue && !s.HeightFull && !s.Inset0 && !s.Grow)
                    {
                        Measure(n, s, out _, out var mh);
                        h = Math.Max(0f, Math.Min(mh, availH));
                    }
                }
            }

            box.Rect = new Rect(box.Rect.X, box.Rect.Y, w, h);

            float contentX = box.Rect.X + s.PadL;
            float contentY = box.Rect.Y + s.PadT;
            float contentW = Math.Max(0f, w - s.PadL - s.PadR);
            float contentH = Math.Max(0f, h - s.PadT - s.PadB);

            // 1. Node absolute/inset-0 trước (không tham gia luồng)
            foreach (var k in n.Kids)
            {
                var ks = Resolve(k);
                if (ks.Hidden) { box.Kids.Add(Box.HiddenTree(k)); continue; }

                if (ks.Inset0)
                {
                    var kb = new Box { Node = k, Rect = new Rect(box.Rect.X, box.Rect.Y, w, h) };
                    box.Kids.Add(kb);
                    Arrange(k, ks, kb, w, h);
                }
                else if (ks.Absolute)
                {
                    float kw = ks.FixedW ?? 0f, kh = ks.FixedH ?? 0f;
                    if (!ks.FixedW.HasValue || !ks.FixedH.HasValue)
                    {
                        Measure(k, ks, out var mw, out var mh);
                        if (!ks.FixedW.HasValue) kw = mw;
                        if (!ks.FixedH.HasValue) kh = mh;
                    }
                    var kb = new Box { Node = k, Rect = new Rect(box.Rect.X + ks.Left, box.Rect.Y + ks.Top, kw, kh) };
                    box.Kids.Add(kb);
                    Arrange(k, ks, kb, kw, kh);
                }
            }

            // 2. Node trong luồng flex
            var flow = new List<(UiNodeRef node, Style st, float mw, float mh)>();
            foreach (var k in n.Kids)
            {
                var ks = Resolve(k);
                if (ks.Hidden)
                {
                    // Giữ Box cho node ẩn (không chiếm chỗ) để Unity bật lại được.
                    box.Kids.Add(Box.HiddenTree(k));
                    continue;
                }
                if (ks.Absolute || ks.Inset0) continue;
                Measure(k, ks, out var mw, out var mh);
                flow.Add((k, ks, mw, mh));
            }

            if (flow.Count == 0) return;

            // Mặc định của HTML: <div>/<p> là BLOCK -> con xếp DỌC.
            // Chỉ khi có class "flex" (không kèm flex-col) mới là hàng ngang.
            // Bỏ qua điều này làm mọi thứ dồn thành một hàng và tràn lề.
            bool rowDirection = s.IsRow && !s.IsCol;
            bool column = !rowDirection;

            float gapTotal = s.Gap * (flow.Count - 1);

            if (column)
            {
                float used = 0f;
                foreach (var f in flow) used += f.mh;
                float free = contentH - used - gapTotal;

                // flex-1: chia đều phần dư
                int growers = 0;
                foreach (var f in flow) if (f.st.Grow) growers++;

                float y = contentY;
                foreach (var f in flow)
                {
                    // Trong cột: phần tử block (div/p) rộng hết dòng của cha, giống
                    // CSS display:block. Chỉ span/inline mới co theo nội dung.
                    float kw = (f.st.WidthFull || f.st.Grow || f.st.IsBlock)
                        ? contentW
                        : Math.Min(f.mw, contentW);
                    float kh = f.mh;
                    if (f.st.Grow && growers > 0 && free > 0f) kh += free / growers;

                    float x = contentX;
                    if (f.st.CenterCross) x = contentX + (contentW - kw) / 2f;

                    var kb = new Box { Node = f.node, Rect = new Rect(x, y, kw, kh) };
                    box.Kids.Add(kb);
                    Arrange(f.node, f.st, kb, kw, kh);
                    y += kh + s.Gap;
                }
            }
            else
            {
                float used = 0f;
                foreach (var f in flow) used += f.mw;
                float free = contentW - used - gapTotal;

                int growers = 0;
                foreach (var f in flow) if (f.st.Grow) growers++;

                float x = contentX;
                if (s.CenterMain) x = contentX + Math.Max(0f, free) / 2f;
                else if (s.EndMain) x = contentX + Math.Max(0f, free);

                float betweenGap = s.JustifyBetween && flow.Count > 1 && free > 0f
                    ? s.Gap + free / (flow.Count - 1)
                    : s.Gap;

                foreach (var f in flow)
                {
                    float kw = f.mw, kh = f.mh;
                    if (f.st.Grow && growers > 0 && free > 0f) kw += free / growers;
                    if (f.st.WidthFull) kw = contentW;
                    float y = contentY;
                    if (s.CenterCross) y = contentY + (contentH - kh) / 2f;
                    else if (s.EndCross) y = contentY + (contentH - kh);

                    var kb = new Box { Node = f.node, Rect = new Rect(x, y, kw, kh) };
                    box.Kids.Add(kb);
                    Arrange(f.node, f.st, kb, kw, kh);
                    x += kw + betweenGap;
                }
            }
        }
    }
}
