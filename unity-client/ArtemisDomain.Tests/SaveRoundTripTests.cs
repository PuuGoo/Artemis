using System;
using System.Collections.Generic;
using Artemis.Domain.Core;
using Artemis.Domain.Persistence;
using Artemis.Domain.Stats;
using NUnit.Framework;

namespace Artemis.Domain.Tests
{
    /// <summary>
    /// Round-trip save: đọc save (đã qua server) → ghi lại → phải giữ NGUYÊN mọi
    /// field. Nếu lớp này mất một field, lần ghi kế tiếp sẽ xoá nó trên server —
    /// đúng kiểu mất dữ liệu không thể phục hồi.
    ///
    /// Fixture do <c>tools/unity-parity/gen-save-fixtures.mjs</c> sinh: nó chạy
    /// CHÍNH <c>sanitizeSave()</c> của server trên 8 bộ save đại diện, nên đây là
    /// hình dạng dữ liệu thật mà client sẽ nhận.
    /// </summary>
    [TestFixture]
    public class SaveRoundTripTests
    {
        private static IEnumerable<JsonValue> Cases()
        {
            foreach (var c in TestContext.FixtureArray("save-cases.json")) yield return c;
        }

        [Test]
        public void Fixture_CoversKeyScenarios()
        {
            var names = new List<string>();
            foreach (var c in Cases()) names.Add(c["name"].AsString());
            Assert.That(names.Count, Is.GreaterThanOrEqualTo(6));
            Assert.That(names, Does.Contain("new-account"));
            Assert.That(names, Does.Contain("late-game-full"));
            Assert.That(names, Does.Contain("legacy-missing-version-fields"));
            Assert.That(names, Does.Contain("unknown-fields"));
        }

        [Test]
        public void AllServerSaves_AreAcceptedByLoader()
        {
            foreach (var c in Cases())
            {
                string name = c["name"].AsString();
                if (!c["sanitizedOk"].AsBool()) continue;

                string json = Json.Write(c["sanitized"]);
                var result = SaveSerializer.Load(json);
                Assert.That(result.Ok, Is.True, "[" + name + "] " + result.Message);
                Assert.That(result.Data, Is.Not.Null);
                Assert.That(result.Data.IsObject, Is.True, "[" + name + "]");
            }
        }

        [Test]
        public void RoundTrip_PreservesEveryField()
        {
            var failures = new List<string>();

            foreach (var c in Cases())
            {
                string name = c["name"].AsString();
                if (!c["sanitizedOk"].AsBool()) continue;

                var original = c["sanitized"];
                string json = Json.Write(original);

                var loaded = SaveSerializer.Load(json);
                if (!loaded.Ok) { failures.Add("[" + name + "] nạp lỗi: " + loaded.Message); continue; }

                string rewritten = SaveSerializer.Serialize(loaded.Data, out _);
                var reparsed = Json.Parse(rewritten);

                if (!SaveSerializer.ContentEquals(original, reparsed))
                    failures.Add("[" + name + "] nội dung đổi sau round-trip");

                // Và byte-size phải tương đương (không phình do ghi số khác kiểu).
                int before = System.Text.Encoding.UTF8.GetByteCount(json);
                int after = System.Text.Encoding.UTF8.GetByteCount(rewritten);
                if (Math.Abs(before - after) > Math.Max(8, before / 100))
                    failures.Add("[" + name + "] kích thước đổi: " + before + " -> " + after);
            }

            Assert.That(failures, Is.Empty, string.Join("\n", failures));
        }

        [Test]
        public void Numbers_AreWrittenLikeJsonStringify()
        {
            // JSON.stringify(1700000000000) === "1700000000000" (không có ".0", không mũ)
            var o = JsonValue.Object();
            o.Set("epoch", 1762300000000.0);
            o.Set("ratio", 0.5);
            o.Set("whole", 42.0);
            o.Set("big", 1e21);
            string text = Json.Write(o);

            Assert.That(text, Does.Contain("\"epoch\":1762300000000"));
            Assert.That(text, Does.Contain("\"ratio\":0.5"));
            Assert.That(text, Does.Contain("\"whole\":42"));
            Assert.That(text, Does.Not.Contain("\"whole\":42.0"));
        }

        [Test]
        public void Loader_SurvivesMissingVersionFields()
        {
            // Save cũ thiếu 3 field version: phải tự điền, KHÔNG được coi là hỏng —
            // nếu coi là hỏng, người chơi cũ không đăng nhập được.
            var v = SaveSerializer.Load("{\"gold\":500}");
            Assert.That(v.Ok, Is.True);
            Assert.That(v.Data["maxedAllVersion"].AsInt(), Is.EqualTo(1));
            Assert.That(v.Data["artemisHeroVersion"].AsInt(), Is.EqualTo(1));
            Assert.That(v.Data["wikiCharactersVersion"].AsInt(), Is.EqualTo(2));
            Assert.That(v.Data["gold"].AsInt(), Is.EqualTo(500), "không được đụng giá trị gốc");
        }

        [Test]
        public void Loader_RejectsNonObjectAndMalformed()
        {
            Assert.That(SaveSerializer.Load("[1,2,3]").Error, Is.EqualTo(SaveLoadError.NotAnObject));
            Assert.That(SaveSerializer.Load("{ hỏng").Error, Is.EqualTo(SaveLoadError.Malformed));
            Assert.That(SaveSerializer.Load("").Error, Is.EqualTo(SaveLoadError.Malformed));
            Assert.That(SaveSerializer.Load(null).Error, Is.EqualTo(SaveLoadError.Malformed));
        }

        [Test]
        public void Loader_KeepsUnknownFields()
        {
            // Server đã lọc field lạ, nhưng Unity KHÔNG được tự lọc thêm: nếu server
            // thêm field mới, client cũ phải giữ nguyên khi ghi lại, nếu không sẽ
            // xoá dữ liệu mới đó.
            var v = SaveSerializer.Load("{\"gold\":1,\"futureField\":{\"a\":[1,2]}}");
            Assert.That(v.Ok, Is.True);
            Assert.That(v.Data.Has("futureField"), Is.True);
            Assert.That(v.Data["futureField"]["a"].Count, Is.EqualTo(2));
        }

        [Test]
        public void SizeLimit_MatchesServer()
        {
            Assert.That(SaveSerializer.MaxSaveBytes, Is.EqualTo(400 * 1024),
                "phải khớp MAX_SAVE_BYTES của lib/saveSchema.js");

            var small = Json.Parse("{\"gold\":1}");
            Assert.That(SaveSerializer.IsWithinServerLimit(small, out int bytes), Is.True);
            Assert.That(bytes, Is.GreaterThan(0));
        }

        /// <summary>
        /// Đây là test then chốt cho yêu cầu "giữ nguyên tiến trình người chơi":
        /// nạp save đã lưu, tính chỉ số, phải ra đúng như lúc lưu.
        /// </summary>
        [Test]
        public void StatsAreIdenticalAfterSaveRoundTrip()
        {
            var failures = new List<string>();

            foreach (var c in Cases())
            {
                string name = c["name"].AsString();
                if (!c["sanitizedOk"].AsBool()) continue;

                var sanitized = c["sanitized"];

                var before = PlayerStatsCalculator.Compute(TestContext.Data, StatsInput.FromSave(sanitized));

                string json = Json.Write(sanitized);
                var reloaded = SaveSerializer.Load(json);
                Assert.That(reloaded.Ok, Is.True, "[" + name + "]");
                var after = PlayerStatsCalculator.Compute(TestContext.Data, StatsInput.FromSave(reloaded.Data));

                if (before.BaseAtk != after.BaseAtk)
                    failures.Add("[" + name + "] ATK " + before.BaseAtk + " -> " + after.BaseAtk);
                if (before.BaseHp != after.BaseHp)
                    failures.Add("[" + name + "] HP " + before.BaseHp + " -> " + after.BaseHp);
                if (Math.Abs(before.BaseAspd - after.BaseAspd) > 1e-9)
                    failures.Add("[" + name + "] ASPD " + before.BaseAspd + " -> " + after.BaseAspd);
                if (Math.Abs(before.BaseCrit - after.BaseCrit) > 1e-9)
                    failures.Add("[" + name + "] CRIT " + before.BaseCrit + " -> " + after.BaseCrit);
                if (before.DefFlat != after.DefFlat)
                    failures.Add("[" + name + "] DEF " + before.DefFlat + " -> " + after.DefFlat);
            }

            Assert.That(failures, Is.Empty, string.Join("\n", failures));
        }

        /// <summary>
        /// Ghi nhận bằng test lỗi đang có trên production: server lọc mất
        /// artifactStars/equippedRuneSlots. Test này KHÔNG khẳng định lỗi là đúng;
        /// nó khẳng định client biết cách sống chung mà không làm mất thêm dữ liệu.
        /// Xem docs/unity-migration/FINDING-save-drops-artifacts-runes.md
        /// </summary>
        [Test]
        public void KnownIssue_ServerStripsArtifactAndRuneFields()
        {
            int casesWithInputArtifacts = 0;
            int casesWithSanitizedArtifacts = 0;

            foreach (var c in Cases())
            {
                if (!c["sanitizedOk"].AsBool()) continue;
                if (c["input"].Has("artifactStars")) casesWithInputArtifacts++;
                if (c["sanitized"].Has("artifactStars")) casesWithSanitizedArtifacts++;
            }

            Assert.That(casesWithInputArtifacts, Is.GreaterThan(0),
                "phải có ca gửi lên artifactStars");
            Assert.That(casesWithSanitizedArtifacts, Is.EqualTo(0),
                "NẾU test này bắt đầu fail ở đây, nghĩa là lib/saveSchema.js ĐÃ ĐƯỢC SỬA " +
                "(whitelist artifactStars). Khi đó hãy cập nhật FINDING và bật lại Phase 3.");
        }
    }

    [TestFixture]
    public class SavePushPolicyTests
    {
        [Test]
        public void Ok200_IsAccepted()
        {
            var body = Json.Parse("{\"ok\":true,\"revision\":7}");
            var r = SavePushPolicy.Interpret(200, body);
            Assert.That(r.Ok, Is.True);
            Assert.That(r.ServerRevision, Is.EqualTo(7));
        }

        [Test]
        public void Conflict409_IsNeverAutoOverwritten()
        {
            var body = Json.Parse("{\"ok\":false,\"conflict\":true,\"serverRevision\":12,\"error\":\"đã đổi\"}");
            var r = SavePushPolicy.Interpret(409, body);
            Assert.That(r.Ok, Is.False);
            Assert.That(r.Conflict, Is.True);
            Assert.That(r.ServerRevision, Is.EqualTo(12));
            Assert.That(SavePushPolicy.ShouldRetry(409, 0), Is.False,
                "409 không được thử lại tự động — sẽ ghi đè thiết bị khác");
        }

        [Test]
        public void Economy422_CarriesServerDataForRollback()
        {
            var body = Json.Parse(
                "{\"ok\":false,\"code\":\"ECONOMY_GOLD_JUMP\",\"conflict\":true,\"serverRevision\":3," +
                "\"serverData\":{\"gold\":100,\"gems\":5}}");
            var r = SavePushPolicy.Interpret(422, body);
            Assert.That(r.Ok, Is.False);
            Assert.That(r.ErrorCode, Is.EqualTo("ECONOMY_GOLD_JUMP"));
            Assert.That(r.ServerData, Is.Not.Null);
            Assert.That(r.ServerData["gold"].AsInt(), Is.EqualTo(100),
                "phải có bản server để khôi phục, không được gửi lại mù");
            Assert.That(SavePushPolicy.ShouldRetry(422, 0), Is.False);
        }

        [Test]
        public void RateLimit429_IsRetriedWithBackoff()
        {
            Assert.That(SavePushPolicy.ShouldRetry(429, 0), Is.True);
            Assert.That(SavePushPolicy.ShouldRetry(429, 3), Is.False, "tối đa 3 lần");
            Assert.That(SavePushPolicy.RetryDelaySeconds(0), Is.EqualTo(1.0));
            Assert.That(SavePushPolicy.RetryDelaySeconds(1), Is.EqualTo(2.0));
            Assert.That(SavePushPolicy.RetryDelaySeconds(2), Is.EqualTo(4.0));
            Assert.That(SavePushPolicy.RetryDelaySeconds(10), Is.EqualTo(30.0), "chặn trên 30s");
        }

        [Test]
        public void ServerError5xx_IsRetried()
        {
            Assert.That(SavePushPolicy.ShouldRetry(500, 0), Is.True);
            Assert.That(SavePushPolicy.ShouldRetry(503, 1), Is.True);
            Assert.That(SavePushPolicy.ShouldRetry(500, 3), Is.False);
        }

        [Test]
        public void Unauthorized401_IsNotRetried()
        {
            Assert.That(SavePushPolicy.ShouldRetry(401, 0), Is.False,
                "401 phải hiện cổng đăng nhập, không spam");
        }
    }
}
