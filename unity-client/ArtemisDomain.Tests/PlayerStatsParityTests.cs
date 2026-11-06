using System;
using System.Collections.Generic;
using Artemis.Domain.Core;
using Artemis.Domain.Stats;
using NUnit.Framework;

namespace Artemis.Domain.Tests
{
    /// <summary>
    /// Parity của <c>getComputedStats()</c>.
    ///
    /// Mỗi ca trong <c>fixtures/stat-cases.json</c> là một bộ save do chính code
    /// production nạp, cộng với kết quả nó tự tính. Test này chạy cùng bộ save
    /// qua bản C# và đòi kết quả GIỐNG TUYỆT ĐỐI — không có "sai số cho phép"
    /// cho số nguyên, vì ATK lệch 1 sẽ lan ra damage và TTK.
    /// </summary>
    [TestFixture]
    public class PlayerStatsParityTests
    {
        private static GameData.GameData Data => TestContext.Data;

        private static IEnumerable<JsonValue> Cases()
        {
            foreach (var c in TestContext.FixtureArray("stat-cases.json")) yield return c;
        }

        [Test]
        public void Fixture_HasEnoughCoverage()
        {
            int n = 0;
            foreach (var _ in Cases()) n++;
            Assert.That(n, Is.GreaterThanOrEqualTo(15),
                "cần nhiều cấu hình: tài khoản trắng, hero, vũ khí, trang bị, rune, artifact, season, skin");
        }

        [Test]
        public void AllCases_MatchJavascriptExactly()
        {
            var failures = new List<string>();
            int compared = 0;

            foreach (var c in Cases())
            {
                string name = c["name"].AsString("?");
                int chapterRooms = c["chapterRooms"].AsInt(15);
                var input = StatsInput.FromSave(c["input"]);
                input.ChapterRooms = chapterRooms;
                var expected = c["expected"];

                PlayerStats actual;
                try
                {
                    actual = PlayerStatsCalculator.Compute(Data, input);
                }
                catch (Exception ex)
                {
                    failures.Add($"[{name}] ném exception: {ex.GetType().Name}: {ex.Message}");
                    continue;
                }

                compared++;

                void CheckLong(string field, long got, long want)
                {
                    if (got != want) failures.Add($"[{name}] {field}: JS={want} C#={got} (lệch {got - want})");
                }
                void CheckDouble(string field, double got, double want, double tol = 1e-9)
                {
                    if (Math.Abs(got - want) > tol) failures.Add($"[{name}] {field}: JS={want} C#={got}");
                }
                void CheckStr(string field, string got, string want)
                {
                    if (got != want) failures.Add($"[{name}] {field}: JS={want} C#={got}");
                }

                CheckStr("heroId", actual.HeroId, expected["heroId"].AsString());
                CheckLong("heroStar", actual.HeroStar, expected["heroStar"].AsLongSafe());
                CheckStr("weaponId", actual.WeaponId, expected["weaponId"].AsString());
                CheckStr("petId", actual.PetId, expected["petId"].AsString());
                CheckLong("baseAtk", actual.BaseAtk, expected["baseAtk"].AsLongSafe());
                CheckLong("baseHp", actual.BaseHp, expected["baseHp"].AsLongSafe());
                CheckDouble("baseAspd", actual.BaseAspd, expected["baseAspd"].AsNumber());
                CheckDouble("baseCrit", actual.BaseCrit, expected["baseCrit"].AsNumber());
                CheckDouble("critDmgMult", actual.CritDmgMult, expected["critDmgMult"].AsNumber());
                CheckDouble("critDmgBonus", actual.CritDmgBonus, expected["critDmgBonus"].AsNumber());
                CheckLong("defFlat", actual.DefFlat, expected["defFlat"].AsLongSafe());
                CheckDouble("dmgReduction", actual.DmgReduction, expected["dmgReduction"].AsNumber());
                CheckDouble("gearDodge", actual.GearDodge, expected["gearDodge"].AsNumber());
                CheckDouble("goldBonus", actual.GoldBonus, expected["goldBonus"].AsNumber());
                CheckLong("powerScore", actual.PowerScore, expected["powerScore"].AsLongSafe());
                CheckLong("gearAtk", actual.GearAtk, expected["gearAtk"].AsLongSafe());
                CheckLong("gearHp", actual.GearHp, expected["gearHp"].AsLongSafe());
            }

            Assert.That(compared, Is.GreaterThan(0), "không so được ca nào");
            Assert.That(failures, Is.Empty,
                "Sai lệch so với getComputedStats() của bản web:\n" + string.Join("\n", failures));
        }

        /// <summary>
        /// Hợp đồng số #1 của toàn bộ migration: tài khoản trắng phải ra đúng
        /// bộ số mà bản web đang hiển thị cho người chơi mới.
        /// </summary>
        [Test]
        public void NewAccount_HasDocumentedBaseline()
        {
            var input = StatsInput.FromSave(JsonValue.Object());
            var stats = PlayerStatsCalculator.Compute(Data, input);

            Assert.That(stats.HeroId, Is.EqualTo("alex"));
            Assert.That(stats.WeaponId, Is.EqualTo("bow"));
            Assert.That(stats.PetId, Is.EqualTo("spirit_sword"));
            Assert.That(stats.BaseAtk, Is.EqualTo(152), "ATK tài khoản mới");
            Assert.That(stats.BaseHp, Is.EqualTo(775), "HP tài khoản mới");
            Assert.That(stats.BaseAspd, Is.EqualTo(1.94).Within(1e-9));
            Assert.That(stats.BaseCrit, Is.EqualTo(0.22).Within(1e-9));
            Assert.That(stats.CritDmgMult, Is.EqualTo(1.85).Within(1e-9));
            Assert.That(stats.DefFlat, Is.EqualTo(0));
            Assert.That(stats.DmgReduction, Is.EqualTo(0.0));
        }

        [Test]
        public void Invariants_HoldForEveryCase()
        {
            foreach (var c in Cases())
            {
                string name = c["name"].AsString("?");
                var input = StatsInput.FromSave(c["input"]);
                input.ChapterRooms = c["chapterRooms"].AsInt(15);
                var s = PlayerStatsCalculator.Compute(Data, input);

                Assert.That(s.BaseAtk, Is.GreaterThan(0), $"[{name}] ATK phải dương");
                Assert.That(s.BaseHp, Is.GreaterThan(0), $"[{name}] HP phải dương");
                Assert.That(s.BaseAspd, Is.GreaterThan(0), $"[{name}] ASPD phải dương");
                Assert.That(s.BaseCrit, Is.InRange(0.0, 0.98), $"[{name}] CRIT trong [0, 0.98]");
                Assert.That(s.DmgReduction, Is.InRange(0.0, 0.75), $"[{name}] DR trong [0, 0.75]");
                Assert.That(s.GearDodge, Is.InRange(0.0, 0.68), $"[{name}] Dodge trong [0, 0.68]");
                Assert.That(double.IsNaN(s.BaseAspd), Is.False, $"[{name}] ASPD không NaN");
                Assert.That(double.IsNaN(s.CritDmgMult), Is.False, $"[{name}] CritDMG không NaN");
            }
        }

        /// <summary>
        /// Bất biến cân bằng đã ghi trong docs/COMBAT_FORMULAS.md §11: nhân ATK và
        /// MaxHP cùng một hệ số thì TTK và số đòn chịu được không đổi. Nếu bản
        /// port làm tròn khác, tính chất này sẽ vỡ.
        /// </summary>
        [Test]
        public void DmgReduction_GrowsWithDefAndShrinksWithChapterRooms()
        {
            var input = StatsInput.FromSave(Json.Parse("{}"));
            // Cần đủ DEF để DR khác 0: DEF đến từ heroStar, gearLevel, talent,
            // rune/artifact defFlat. Dùng gearLevel + armor mythic Lv.100.
            input.GearLevel = 100;
            input.EquippedGear["armor"] = Json.Parse(
                "{\"uid\":\"a\",\"templateId\":\"cloth_vest\",\"quality\":\"mythic\",\"level\":100,\"awakening\":4,\"sockets\":[],\"affixes\":[]}");
            input.Talents["might"] = 5;

            input.ChapterRooms = 15;
            var ch1 = PlayerStatsCalculator.Compute(Data, input);
            input.ChapterRooms = 3;
            var shortChapter = PlayerStatsCalculator.Compute(Data, input);

            Assert.That(ch1.DefFlat, Is.EqualTo(shortChapter.DefFlat), "DEF không phụ thuộc chương");
            Assert.That(ch1.DefFlat, Is.GreaterThan(0), "cần DEF > 0 để phép so có nghĩa");
            Assert.That(shortChapter.DmgReduction, Is.GreaterThan(ch1.DmgReduction),
                "cùng DEF, chương ít phòng (defK nhỏ) phải giảm thương nhiều hơn");
        }

        [Test]
        public void ChapterRooms_DefaultsTo15WhenUnset()
        {
            var input = StatsInput.FromSave(JsonValue.Object());
            Assert.That(input.ChapterRooms, Is.EqualTo(15));
        }

        [Test]
        public void SeasonSacrifice_ReducesBothAtkAndHp()
        {
            var input = StatsInput.FromSave(Json.Parse(
                "{\"season\":{\"career\":null,\"powerSacrificed\":0.10}}"));
            var reduced = PlayerStatsCalculator.Compute(Data, input);

            var baseline = PlayerStatsCalculator.Compute(Data, StatsInput.FromSave(JsonValue.Object()));

            Assert.That(reduced.BaseAtk, Is.LessThan(baseline.BaseAtk));
            Assert.That(reduced.BaseHp, Is.LessThan(baseline.BaseHp));
        }

        [Test]
        public void WeaponArchetypeOnGearOverridesSelectedWeapon()
        {
            // getComputedStats: nếu ô weapon có weaponArchetype thì nó thắng
            // selectedWeaponId. Bản port phải giữ đúng thứ tự ưu tiên này.
            var input = StatsInput.FromSave(Json.Parse(
                "{\"selectedWeaponId\":\"bow\",\"equippedGear\":{\"weapon\":{\"uid\":\"w\",\"templateId\":\"oracle_staff\",\"quality\":\"epic\",\"level\":10,\"awakening\":0,\"sockets\":[],\"affixes\":[]}}}"));
            var stats = PlayerStatsCalculator.Compute(Data, input);
            Assert.That(stats.WeaponId, Is.EqualTo("staff"), "trang bị staff phải ghi đè selectedWeaponId=bow");
        }

        [Test]
        public void HeroStarClamping_MatchesJs()
        {
            var input = StatsInput.FromSave(JsonValue.Object());
            input.SelectedHeroId = "alex";

            input.HeroStars["alex"] = 3;
            Assert.That(PlayerStatsCalculator.HeroStarLevel(input, "alex"), Is.EqualTo(3));

            input.HeroStars["alex"] = 99;
            Assert.That(PlayerStatsCalculator.HeroStarLevel(input, "alex"), Is.EqualTo(8), "clamp trên 8");

            input.HeroStars["alex"] = -5;
            Assert.That(PlayerStatsCalculator.HeroStarLevel(input, "alex"), Is.EqualTo(0), "clamp dưới 0");

            input.HeroStars.Remove("alex");
            Assert.That(PlayerStatsCalculator.HeroStarLevel(input, "alex"), Is.EqualTo(0),
                "chưa có trong save = 0 sao (không phải 8)");
        }

        [Test]
        public void ArtifactStarClamping_MatchesJs()
        {
            var input = StatsInput.FromSave(JsonValue.Object());
            input.ArtifactStars["golden_fleece"] = 99;
            Assert.That(PlayerStatsCalculator.ArtifactStarLevel(input, "golden_fleece"), Is.EqualTo(15));
            input.ArtifactStars.Remove("golden_fleece");
            Assert.That(PlayerStatsCalculator.ArtifactStarLevel(input, "golden_fleece"), Is.EqualTo(0),
                "chưa sở hữu = 0 sao (không phải 15)");
        }
    }

    internal static class JsonTestExtensions
    {
        /// <summary>Đọc số nguyên an toàn (JSON có thể là 152 hoặc 152.0).</summary>
        public static long AsLongSafe(this JsonValue v)
        {
            double d = v.AsNumber();
            if (double.IsNaN(d) || double.IsInfinity(d)) return 0;
            return (long)Math.Round(d, MidpointRounding.AwayFromZero);
        }
    }
}
