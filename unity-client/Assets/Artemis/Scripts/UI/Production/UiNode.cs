using System.Collections.Generic;
using Artemis.Domain.Core;

namespace Artemis.Runtime.UI.Production
{
    /// <summary>
    /// Một node trong cây UI trích từ public/index.html.
    ///
    /// Giữ nguyên tên trường khớp với tools/unity-ui/extract-ui.mjs sinh ra, để
    /// không phải map hai lần.
    /// </summary>
    public sealed class UiNode
    {
        public string Tag = "";
        public string Id = "";
        public List<string> Cls = new List<string>();
        public Dictionary<string, string> Attrs = new Dictionary<string, string>();
        public string Text = "";
        public List<UiNode> Kids = new List<UiNode>();

        public bool HasClass(string c) => Cls.Contains(c);

        /// <summary>Node này có phải một "trang" (màn hình/modal/panel) không.</summary>
        public bool IsScreen =>
            !string.IsNullOrEmpty(Id) &&
            (Id.EndsWith("Screen") || Id.EndsWith("Modal") || Id.EndsWith("Panel") ||
             Id.EndsWith("View") || Id.EndsWith("Tab") || Id.EndsWith("SubScreen"));

        public bool IsHidden => HasClass("hidden");

        public static UiNode FromJson(JsonValue v)
        {
            var n = new UiNode
            {
                Tag = v["tag"].AsString(""),
                Id = v["id"].AsString(""),
                Text = v["text"].AsString(""),
            };

            var cls = v["cls"];
            if (cls.IsArray)
                foreach (var c in cls.Items) n.Cls.Add(c.AsString(""));

            var attrs = v["attrs"];
            if (attrs.IsObject && attrs.Members != null)
                foreach (var kv in attrs.Members)
                    n.Attrs[kv.Key] = kv.Value.AsString("");

            var kids = v["kids"];
            if (kids.IsArray)
                foreach (var k in kids.Items) n.Kids.Add(FromJson(k));

            return n;
        }

        /// <summary>Duyệt toàn cây, gọi <paramref name="fn"/> cho mỗi node.</summary>
        public void Walk(System.Action<UiNode> fn)
        {
            fn(this);
            foreach (var k in Kids) k.Walk(fn);
        }

        public UiNode FindById(string id)
        {
            UiNode hit = null;
            Walk(n =>
            {
                if (hit == null && n.Id == id) hit = n;
            });
            return hit;
        }

        public int Count()
        {
            int n = 1;
            foreach (var k in Kids) n += k.Count();
            return n;
        }
    }
}
