using System.IO;
using System.Linq;
using NUnit.Framework;
using Artemis.Domain.Core;
using Artemis.Runtime.UI.Production;

namespace Artemis.Domain.Tests
{
    /// <summary>
    /// Kiểm chứng dữ liệu UI trích từ production. Những test này chạy bằng
    /// `dotnet test` (không cần Unity), nên bắt được ngay khi extractor hỏng.
    ///
    /// Không kiểm tra "hình trông có đẹp không" — cái đó phải xem ảnh chụp Unity.
    /// Ở đây chỉ kiểm tra dữ liệu có đúng là của production hay không.
    /// </summary>
    [TestFixture]
    public sealed class ProductionUiDataTests
    {
        private static string UiDir =>
            Path.Combine(TestContext.DataDir, "..", "ArtemisUi");

        private static JsonValue ThemeJson()
        {
            var p = Path.Combine(UiDir, "uiTheme.json");
            Assert.That(File.Exists(p), Is.True, "Thiếu uiTheme.json — chạy node tools/unity-ui/extract-theme.mjs");
            return Json.Parse(File.ReadAllText(p));
        }

        private static UiNode Tree()
        {
            var p = Path.Combine(UiDir, "uiTree.json");
            Assert.That(File.Exists(p), Is.True, "Thiếu uiTree.json — chạy node tools/unity-ui/extract-ui.mjs");
            return UiNode.FromJson(Json.Parse(File.ReadAllText(p)));
        }

        [Test]
        public void Theme_CoDuMauTuProduction()
        {
            var t = ThemeJson();
            int n = t["counts"]["colors"].AsInt(0);
            Assert.That(n, Is.GreaterThan(100),
                "Production dùng >100 màu Tailwind; ít hơn nghĩa là extractor đọc thiếu");
        }

        [Test]
        public void Theme_GoldGradient_DungMauProduction()
        {
            var t = ThemeJson();
            var stops = t["gradients"]["gold-gradient"]["stops"];
            Assert.That(stops.IsArray, Is.True, "gold-gradient phải tồn tại (dùng cho độ hiếm)");

            // Ba màu này đọc trực tiếp từ CSS production.
            var hex = stops.Items.Select(x => x.AsString("")).ToArray();
            Assert.That(hex, Is.EqualTo(new[] { "fde047", "f59e0b", "d97706" }));
        }

        [Test]
        public void Theme_BodyBackground_KhopCss()
        {
            var t = ThemeJson();
            var bg = t["bodyBackground"].AsString("");
            Assert.That(bg, Does.Contain("#1e1b4b"), "màu trên của radial-gradient");
            Assert.That(bg, Does.Contain("#090d16"), "màu dưới của radial-gradient");
        }

        [Test]
        public void Theme_FontInter_CoTrongCss()
        {
            var t = ThemeJson();
            var fonts = string.Join(" ", t["fonts"]["families"].Items.Select(x => x.AsString("")));
            Assert.That(fonts, Does.Contain("Inter"));
        }

        /// <summary>
        /// Bắt lỗi từng gặp: UiTheme.Load ném IndexOutOfRange vì CSS có
        /// font-family "inherit" (không có dấu nháy). Test này chạy được cả khi
        /// không có Unity vì nó kiểm tra dữ liệu thô, còn UiTheme.Load thì không
        /// include vào test project (dùng UnityEngine).
        /// </summary>
        [Test]
        public void Theme_FontFamily_KhongCoChuoiRong()
        {
            var t = ThemeJson();
            var fams = t["fonts"]["families"].Items.Select(x => x.AsString("")).ToArray();
            Assert.That(fams.Length, Is.GreaterThan(0), "phải trích được ít nhất 1 font-family");

            foreach (var f in fams)
            {
                Assert.That(f.Trim(), Is.Not.Empty, "font-family rỗng sẽ làm Unity index lỗi");
            }
        }

        [Test]
        public void Theme_HexToColor_Dung()
        {
            var gv = Artemis.Domain.Ui.CssColor.ParseRgba("fde047");
            Assert.That(gv[0], Is.EqualTo(0xfd / 255f).Within(0.001f));
            Assert.That(gv[1], Is.EqualTo(0xe0 / 255f).Within(0.001f));
            Assert.That(gv[2], Is.EqualTo(0x47 / 255f).Within(0.001f));
            Assert.That(gv[3], Is.EqualTo(1f).Within(0.001f));

            var half = Artemis.Domain.Ui.CssColor.ParseRgba("0f172a55");
            Assert.That(half[3], Is.EqualTo(0x55 / 255f).Within(0.001f));
        }

        [Test]
        public void Tree_CoDuNode()
        {
            var root = Tree();
            int n = root.Count();
            Assert.That(n, Is.GreaterThan(500),
                "Body production có hàng trăm node; ít hơn nghĩa là parser cắt cụt");
        }

        [Test]
        public void Tree_TimDuocModalThat()
        {
            var root = Tree();
            var modal = root.FindById("gearDetailModal");
            Assert.That(modal, Is.Not.Null, "gearDetailModal phải có trong cây");
            Assert.That(modal.IsScreen, Is.True);
            Assert.That(modal.IsHidden, Is.True, "modal này mặc định hidden trong production");
        }

        [Test]
        public void Tree_GiuDuocTextTiengViet()
        {
            var root = Tree();
            var texts = new System.Collections.Generic.List<string>();
            root.Walk(n => { if (!string.IsNullOrEmpty(n.Text)) texts.Add(n.Text); });

            Assert.That(texts.Count, Is.GreaterThan(100));
            Assert.That(texts.Any(t => t.Contains("Cấp")), Is.True,
                "phải giữ nguyên dấu tiếng Việt, không bị mất thành 'Cp'");
        }

        [Test]
        public void Tree_GiuDuocClassTailwind()
        {
            var root = Tree();
            var cls = new System.Collections.Generic.HashSet<string>();
            root.Walk(n => { foreach (var c in n.Cls) cls.Add(c); });

            Assert.That(cls.Count, Is.GreaterThan(300), "production dùng 592 class unique");
            Assert.That(cls.Contains("flex"), Is.True);
            Assert.That(cls.Contains("font-black"), Is.True);
            Assert.That(cls.Contains("rounded-xl"), Is.True);
        }

        [Test]
        public void Tree_IdKhopSoVoiHtml()
        {
            var root = Tree();
            var ids = new System.Collections.Generic.HashSet<string>();
            root.Walk(n => { if (!string.IsNullOrEmpty(n.Id)) ids.Add(n.Id); });

            // HTML tĩnh có 262 id; parser phải bắt được phần lớn.
            Assert.That(ids.Count, Is.GreaterThan(200),
                "chỉ thấy " + ids.Count + " id, nghi parser bỏ sót thẻ");
        }
    }
}
