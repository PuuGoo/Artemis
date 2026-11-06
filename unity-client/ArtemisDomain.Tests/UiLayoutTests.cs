using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;
using Artemis.Domain.Core;
using Artemis.Domain.Ui;

namespace Artemis.Domain.Tests
{
    /// <summary>
    /// Kiểm chứng layout engine mô phỏng CSS flexbox.
    ///
    /// Đây là phần quyết định UI có đúng hay không: nếu layout sai thì scene
    /// Unity sẽ dồn góc / kích thước 0 dù dữ liệu đúng. Test chạy bằng dotnet nên
    /// bắt được lỗi mà không cần mở Unity.
    /// </summary>
    [TestFixture]
    public sealed class UiLayoutTests
    {
        private static UiLayout MakeLayout()
        {
            var spacing = new Dictionary<string, float>
            {
                ["p-4"] = 16f, ["p-2"] = 8f,
                ["px-4"] = 16f, ["px-2"] = 8f,
                ["py-2"] = 8f, ["py-1"] = 4f,
                ["gap-2"] = 8f, ["gap-4"] = 16f,
                ["w-full"] = 0f,
                ["w-16"] = 64f, ["h-16"] = 64f,
                ["w-8"] = 32f, ["h-8"] = 32f,
            };
            var fontSize = new Dictionary<string, float>
            {
                ["text-xs"] = 12f, ["text-sm"] = 14f, ["text-base"] = 16f, ["text-lg"] = 18f,
            };
            return new UiLayout(spacing, fontSize);
        }

        private static UiLayout.UiNodeRef Node(string tag, string id, params string[] cls)
        {
            var n = new UiLayout.UiNodeRef { Tag = tag, Id = id };
            n.Cls.AddRange(cls);
            return n;
        }

        // ---------- Test cơ bản ----------

        [Test]
        public void Root_PhuKinViewport()
        {
            var root = Node("#root", "");
            var box = MakeLayout().Compute(root, 1280, 720);

            Assert.That(box.Rect.W, Is.EqualTo(1280f));
            Assert.That(box.Rect.H, Is.EqualTo(720f));
        }

        [Test]
        public void FixedSize_DungPx()
        {
            var root = Node("#root", "");
            var child = Node("div", "card", "w-16", "h-16");
            root.Kids.Add(child);

            var box = MakeLayout().Compute(root, 1280, 720);
            var c = box.Find("card");

            Assert.That(c, Is.Not.Null);
            Assert.That(c.Rect.W, Is.EqualTo(64f), "w-16 = 4rem = 64px");
            Assert.That(c.Rect.H, Is.EqualTo(64f), "h-16 = 64px");
        }

        [Test]
        public void Column_XepDocCoGap()
        {
            var root = Node("#root", "");
            var col = Node("div", "col", "flex", "flex-col", "gap-2");
            col.Kids.Add(Node("div", "a", "h-16"));
            col.Kids.Add(Node("div", "b", "h-16"));
            col.Kids.Add(Node("div", "c", "h-16"));
            root.Kids.Add(col);

            var box = MakeLayout().Compute(root, 1280, 720);

            var a = box.Find("a");
            var b = box.Find("b");
            var c = box.Find("c");

            Assert.That(a.Rect.Y, Is.EqualTo(0f), "phần tử đầu ở đỉnh");
            Assert.That(b.Rect.Y, Is.EqualTo(64f + 8f), "cách 64 + gap 8");
            Assert.That(c.Rect.Y, Is.EqualTo(2 * (64f + 8f)));
        }

        [Test]
        public void Row_XepNgangCoGap()
        {
            var root = Node("#root", "");
            var row = Node("div", "row", "flex", "gap-2");
            row.Kids.Add(Node("div", "a", "w-16", "h-16"));
            row.Kids.Add(Node("div", "b", "w-16", "h-16"));
            root.Kids.Add(row);

            var box = MakeLayout().Compute(root, 1280, 720);

            Assert.That(box.Find("a").Rect.X, Is.EqualTo(0f));
            Assert.That(box.Find("b").Rect.X, Is.EqualTo(64f + 8f));
        }

        [Test]
        public void Padding_DayNoiDungVao()
        {
            var root = Node("#root", "");
            var padded = Node("div", "pad", "flex", "flex-col", "p-4");
            padded.Kids.Add(Node("div", "inner", "w-16", "h-16"));
            root.Kids.Add(padded);

            var box = MakeLayout().Compute(root, 1280, 720);
            var inner = box.Find("inner");

            Assert.That(inner.Rect.X, Is.EqualTo(16f), "p-4 -> padding 16px");
            Assert.That(inner.Rect.Y, Is.EqualTo(16f));
        }

        [Test]
        public void Padding_KhongLamTranViewport()
        {
            var root = Node("#root", "");
            var padded = Node("div", "pad", "flex", "flex-col", "p-4");
            for (int i = 0; i < 5; i++)
                padded.Kids.Add(Node("div", "item" + i, "w-full", "h-16"));
            root.Kids.Add(padded);

            var box = MakeLayout().Compute(root, 320, 720);

            padded = null;
            // padded w-full: con phải rộng = 320 - 32 = 288
            var item = box.Find("item0");
            Assert.That(item.Rect.W, Is.EqualTo(288f), "w-full trừ padding 2 bên");
            Assert.That(item.Rect.X, Is.EqualTo(16f), "không tràn lề trái");
            Assert.That(item.Rect.X + item.Rect.W, Is.LessThanOrEqualTo(320f), "không tràn lề phải");
        }

        [Test]
        public void WFull_ChiemHetChieuNgang()
        {
            var root = Node("#root", "");
            var bar = Node("div", "bar", "w-full", "h-8");
            root.Kids.Add(bar);

            var box = MakeLayout().Compute(root, 1280, 720);
            Assert.That(box.Find("bar").Rect.W, Is.EqualTo(1280f));
        }

        [Test]
        public void Inset0_PhuToanBoCha()
        {
            var root = Node("#root", "");
            var wrap = Node("div", "wrap", "w-16", "h-16");
            wrap.Kids.Add(Node("div", "overlay", "absolute", "inset-0"));
            root.Kids.Add(wrap);

            var box = MakeLayout().Compute(root, 1280, 720);
            var ov = box.Find("overlay");

            Assert.That(ov.Rect.W, Is.EqualTo(64f), "inset-0 phủ kín cha");
            Assert.That(ov.Rect.H, Is.EqualTo(64f));
        }

        [Test]
        public void Hidden_KhongChiemCho()
        {
            var root = Node("#root", "");
            var col = Node("div", "col", "flex", "flex-col", "gap-2");
            col.Kids.Add(Node("div", "a", "h-16"));
            var hid = Node("div", "b", "h-16", "hidden");
            hid.Kids.Add(Node("div", "insideHidden", "h-16"));
            col.Kids.Add(hid);
            col.Kids.Add(Node("div", "c", "h-16"));
            root.Kids.Add(col);

            var box = MakeLayout().Compute(root, 1280, 720);

            // c phải ngay sau a, không bị b chiếm chỗ
            Assert.That(box.Find("c").Rect.Y, Is.EqualTo(64f + 8f),
                "phần tử hidden không được chiếm chỗ trong luồng");
        }

        [Test]
        public void JustifyBetween_DayHaiDau()
        {
            var root = Node("#root", "");
            var row = Node("div", "row", "flex", "justify-between", "h-8");
            row.Kids.Add(Node("div", "left", "w-16", "h-8"));
            row.Kids.Add(Node("div", "right", "w-16", "h-8"));
            root.Kids.Add(row);

            var box = MakeLayout().Compute(root, 1280, 720);
            var right = box.Find("right");

            Assert.That(right.Rect.X, Is.EqualTo(1280f - 64f), "phần tử cuối dạt mép phải");
        }

        [Test]
        public void CenterCross_CanhGiuaDocTrucCheo()
        {
            var root = Node("#root", "");
            var row = Node("div", "row", "flex", "items-center", "h-16");
            row.Kids.Add(Node("div", "small", "w-16", "h-8"));
            root.Kids.Add(row);

            var box = MakeLayout().Compute(root, 1280, 720);
            var small = box.Find("small");

            // h-16 = 64, h-8 = 32 -> căn giữa: y = (64-32)/2 = 16
            Assert.That(small.Rect.Y, Is.EqualTo(16f));
        }

        [Test]
        public void FlexGrow_ChiaPhanDu()
        {
            var root = Node("#root", "");
            var row = Node("div", "row", "flex", "h-16");
            row.Kids.Add(Node("div", "fixed", "w-16", "h-16"));
            row.Kids.Add(Node("div", "grow", "flex-1", "h-16"));
            root.Kids.Add(row);

            var box = MakeLayout().Compute(root, 1280, 720);
            var grow = box.Find("grow");

            Assert.That(grow.Rect.W, Is.EqualTo(1280f - 64f), "flex-1 nhận hết phần còn lại");
        }

        [Test]
        public void KhongCoAmKichThuoc()
        {
            var root = Node("#root", "");
            var cramped = Node("div", "cramped", "flex", "flex-col", "p-4");
            cramped.Kids.Add(Node("div", "big", "w-16", "h-16"));
            root.Kids.Add(cramped);

            // Viewport rất nhỏ - không được ra số âm
            var box = MakeLayout().Compute(root, 20, 20);

            box.Walk_AssertNoNegative();
            Assert.That(box.Find("big").Rect.W, Is.GreaterThanOrEqualTo(0f));
            Assert.That(box.Find("big").Rect.H, Is.GreaterThanOrEqualTo(0f));
        }

        [Test]
        public void DoChu_TiengViet_KhongVo()
        {
            float w = UiLayout.MeasureTextWidth("Cấp cường hóa", 14f);
            Assert.That(w, Is.GreaterThan(50f), "chuỗi 13 ký tự phải rộng hơn 50px");
            Assert.That(w, Is.LessThan(300f), "nhưng không được phình vô lý");
        }

        // ---------- Test trên dữ liệu production thật ----------

        [Test]
        public void ProductionTree_LayoutKhongVo()
        {
            var p = Path.Combine(TestContext.DataDir, "..", "ArtemisUi", "uiTree.json");
            if (!File.Exists(p)) Assert.Ignore("chưa chạy extract-ui.mjs");

            var themeP = Path.Combine(TestContext.DataDir, "..", "ArtemisUi", "uiTheme.json");
            var theme = Json.Parse(File.ReadAllText(themeP));

            var spacing = new Dictionary<string, float>();
            var fs = new Dictionary<string, float>();
            if (theme["spacing"].IsObject)
                foreach (var kv in theme["spacing"].Members) spacing[kv.Key] = (float)kv.Value["px"].AsNumber(0);
            if (theme["fontSize"].IsObject)
                foreach (var kv in theme["fontSize"].Members) fs[kv.Key] = (float)kv.Value["size"].AsNumber(14);

            var json = Json.Parse(File.ReadAllText(p));
            var refRoot = ToRef(json);

            var layout = new UiLayout(spacing, fs);
            var box = layout.Compute(refRoot, 1280, 720);

            Assert.That(box.Count(), Is.GreaterThan(600));

            // Không node nào được có kích thước âm hoặc tràn xa viewport.
            int bad = 0;
            box.Walk(n =>
            {
                if (n.Rect.W < 0f || n.Rect.H < 0f) bad++;
                if (n.Rect.X < -2000f || n.Rect.Y < -2000f) bad++;
            });
            Assert.That(bad, Is.EqualTo(0), bad + " node có kích thước/toạ độ vô lý");
        }

        private static UiLayout.UiNodeRef ToRef(JsonValue v)
        {
            var n = new UiLayout.UiNodeRef
            {
                Tag = v["tag"].AsString(""),
                Id = v["id"].AsString(""),
                Text = v["text"].AsString(""),
            };
            if (v["cls"].IsArray)
                foreach (var c in v["cls"].Items) n.Cls.Add(c.AsString(""));
            if (v["kids"].IsArray)
                foreach (var k in v["kids"].Items) n.Kids.Add(ToRef(k));
            return n;
        }
    }

    internal static class BoxAssert
    {
        public static void Walk_AssertNoNegative(this UiLayout.Box box)
        {
            box.Walk(b =>
            {
                NUnit.Framework.Assert.That(b.Rect.W, NUnit.Framework.Is.GreaterThanOrEqualTo(0f),
                    "node " + (b.Node?.Id ?? "") + " có width âm: " + b.Rect.W);
                NUnit.Framework.Assert.That(b.Rect.H, NUnit.Framework.Is.GreaterThanOrEqualTo(0f),
                    "node " + (b.Node?.Id ?? "") + " có height âm: " + b.Rect.H);
            });
        }
    }
}
