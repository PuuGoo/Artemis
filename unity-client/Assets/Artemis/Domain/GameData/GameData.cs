using System;
using System.Collections.Generic;
using Artemis.Domain.Core;

namespace Artemis.Domain.GameData
{
    /// <summary>Định nghĩa một field dữ liệu tĩnh; đọc từ Data/*.json (sinh bằng tools/unity-parity/extract-data.mjs).</summary>
    public sealed class DataTable
    {
        private readonly JsonValue _root;
        private readonly Dictionary<string, JsonValue> _byId;

        /// <param name="root">Mảng hoặc object dữ liệu.</param>
        /// <param name="keyField">
        /// Tên field dùng làm khoá khi root là mảng. Mặc định <c>id</c>; một số
        /// bảng dùng khoá khác (starMilestones dùng <c>star</c>).
        /// </param>
        public DataTable(JsonValue root, string keyField = "id")
        {
            _root = root ?? JsonValue.Array();
            _byId = new Dictionary<string, JsonValue>(StringComparer.Ordinal);
            if (_root.IsArray)
            {
                foreach (var item in _root.Items)
                {
                    string key = item[keyField].AsString();
                    if (string.IsNullOrEmpty(key)) key = item["id"].AsString();
                    if (!string.IsNullOrEmpty(key) && !_byId.ContainsKey(key)) _byId[key] = item;
                }
            }
            else if (_root.IsObject)
            {
                foreach (var kv in _root.Entries()) _byId[kv.Key] = kv.Value;
            }
        }

        public JsonValue Root => _root;
        public int Count => _byId.Count;
        public IEnumerable<JsonValue> All => _byId.Values;
        public IEnumerable<KeyValuePair<string, JsonValue>> Entries() => _byId;
        public JsonValue Get(string id) => id != null && _byId.TryGetValue(id, out var v) ? v : JsonValue.Null;
        public bool Has(string id) => id != null && _byId.ContainsKey(id);
    }

    /// <summary>
    /// Toàn bộ dữ liệu tĩnh của game, nạp từ JSON sinh tự động.
    ///
    /// Không có hằng số nào được chép tay ở đây. Nếu web đổi một template trang
    /// bị, chạy lại extract-data.mjs là Unity nhận thay đổi — diff JSON là bằng
    /// chứng duy nhất, không cần đối chiếu 250 mục bằng mắt.
    /// </summary>
    public sealed class GameData
    {
        public DataTable Chapters { get; private set; }
        public DataTable GameModes { get; private set; }
        public DataTable Heroes { get; private set; }
        public DataTable Weapons { get; private set; }
        public DataTable Pets { get; private set; }
        public DataTable Talents { get; private set; }
        public DataTable Skills { get; private set; }
        public DataTable GearQualities { get; private set; }
        public DataTable GearTemplates { get; private set; }
        public DataTable GearSlots { get; private set; }
        public DataTable FusionRecipes { get; private set; }
        public DataTable Gems { get; private set; }
        public DataTable Runes { get; private set; }
        public DataTable RuneBaseStats { get; private set; }
        public DataTable GearSets { get; private set; }
        public DataTable HeroSkins { get; private set; }
        public DataTable AffixPool { get; private set; }
        public DataTable Artifacts { get; private set; }
        public DataTable ArtifactSets { get; private set; }
        public DataTable Bestiary { get; private set; }
        public DataTable StarMilestones { get; private set; }
        public DataTable BeginnerSteps { get; private set; }
        public DataTable Achievements { get; private set; }

        public JsonValue Season { get; private set; }
        public JsonValue Garden { get; private set; }
        public JsonValue Plinko { get; private set; }
        public JsonValue Guild { get; private set; }

        /// <summary>
        /// Nạp từ một hàm đọc file do nền tảng cung cấp — domain không biết
        /// Unity's <c>Resources</c> hay <c>System.IO</c>; nhờ vậy test bằng dotnet
        /// và build Unity dùng cùng một lớp.
        /// </summary>
        public static GameData Load(Func<string, string> readTextFile)
        {
            if (readTextFile == null) throw new ArgumentNullException(nameof(readTextFile));

            JsonValue LoadJson(string name)
            {
                string text = readTextFile(name);
                if (text == null) throw new InvalidOperationException("Thiếu file dữ liệu: " + name);
                var v = Json.TryParse(text);
                if (v == null) throw new InvalidOperationException("JSON hỏng: " + name);
                return v;
            }

            return new GameData
            {
                Chapters = new DataTable(LoadJson("chapters.json")),
                GameModes = new DataTable(LoadJson("gameModes.json")),
                Heroes = new DataTable(LoadJson("heroes.json")),
                Weapons = new DataTable(LoadJson("weapons.json")),
                Pets = new DataTable(LoadJson("pets.json")),
                Talents = new DataTable(LoadJson("talents.json")),
                Skills = new DataTable(LoadJson("skills.json")),
                GearQualities = new DataTable(LoadJson("gearQualities.json")),
                GearTemplates = new DataTable(LoadJson("gearTemplates.json")),
                GearSlots = new DataTable(LoadJson("gearSlots.json")),
                FusionRecipes = new DataTable(LoadJson("fusionRecipes.json")),
                Gems = new DataTable(LoadJson("gems.json")),
                Runes = new DataTable(LoadJson("runes.json")),
                RuneBaseStats = new DataTable(LoadJson("runeBaseStats.json")),
                GearSets = new DataTable(LoadJson("gearSets.json")),
                HeroSkins = new DataTable(LoadJson("heroSkins.json")),
                AffixPool = new DataTable(LoadJson("affixPool.json")),
                Artifacts = new DataTable(LoadJson("artifacts.json")),
                ArtifactSets = new DataTable(LoadJson("artifactSets.json")),
                Bestiary = new DataTable(LoadJson("bestiary.json")),
                StarMilestones = new DataTable(LoadJson("starMilestones.json"), keyField: "star"),
                BeginnerSteps = new DataTable(LoadJson("beginnerJourney.json")),
                Achievements = new DataTable(LoadJson("achievements.json")),
                Season = LoadJson("season.json"),
                Garden = LoadJson("garden.json"),
                Plinko = LoadJson("plinko.json"),
                Guild = LoadJson("guild.json"),
            };
        }

        /// <summary>Thứ tự ô trang bị — quan trọng vì getComputedStats cộng theo thứ tự này.</summary>
        public static readonly string[] GearSlotOrder =
        {
            "weapon", "necklace", "ring", "armor", "helmet", "boots"
        };

        public JsonValue Chapter(int id) => Chapters.Get(id.ToString());

        /// <summary>Chương mặc định khi chưa vào trận — getComputedStats dùng rooms=15 cho defK.</summary>
        public JsonValue DefaultChapter
        {
            get
            {
                var c = Chapter(1);
                return c.IsNull ? JsonValue.Object().Set("rooms", 15) : c;
            }
        }
    }
}
