using System;
using System.Collections.Generic;
using Artemis.Domain.Core;
using NUnit.Framework;

namespace Artemis.Domain.Tests
{
    /// <summary>
    /// Khoá hành vi làm tròn — nền của mọi test parity khác.
    ///
    /// Giá trị kỳ vọng đọc từ <c>fixtures/jsmath.json</c>, do
    /// <c>tools/unity-parity/gen-jsmath-fixtures.mjs</c> sinh bằng cách gọi
    /// CHÍNH Node.js. Không có số nào ở đây viết theo trí nhớ — kể cả những ca
    /// phản trực giác như <c>(1.005).toFixed(2) === "1.00"</c>.
    /// </summary>
    [TestFixture]
    public class JsMathTests
    {
        private static JsonValue Js => TestContext.Fixture("jsmath.json");

        [Test]
        public void Round_MatchesNodeForEveryCase()
        {
            var cases = Js["round"];
            Assert.That(cases.Count, Is.GreaterThan(10), "phải có nhiều ca kiểm thử");

            var failures = new List<string>();
            foreach (var c in cases.Items)
            {
                double input = c["input"].AsNumber();
                double expected = c["expected"].AsNumber();
                double actual = JsMath.Round(input);
                if (Math.Abs(actual - expected) > 1e-12)
                    failures.Add("Math.round(" + input + ") -> JS " + expected + ", C# " + actual);
            }
            Assert.That(failures, Is.Empty, string.Join("\n", failures));
        }

        [Test]
        public void ToFixed_MatchesNodeForEveryCase()
        {
            var cases = Js["toFixed"];
            Assert.That(cases.Count, Is.GreaterThan(10));

            var failures = new List<string>();
            foreach (var c in cases.Items)
            {
                double value = c["value"].AsNumber();
                int digits = c["digits"].AsInt();
                double expected = c["expected"].AsNumber();
                double actual = JsMath.ToFixed(value, digits);
                if (Math.Abs(actual - expected) > 1e-9)
                    failures.Add("(" + value + ").toFixed(" + digits + ") -> JS " + expected + ", C# " + actual);
            }
            Assert.That(failures, Is.Empty, string.Join("\n", failures));
        }

        [Test]
        public void Hypot_MatchesNode()
        {
            var failures = new List<string>();
            foreach (var c in Js["hypot"].Items)
            {
                var args = c["args"];
                double expected = c["expected"].AsNumber();
                double actual = args.Count == 3
                    ? JsMath.Hypot(args[0].AsNumber(), args[1].AsNumber(), args[2].AsNumber())
                    : JsMath.Hypot(args[0].AsNumber(), args[1].AsNumber());
                if (Math.Abs(actual - expected) > 1e-12)
                    failures.Add("Math.hypot -> JS " + expected + ", C# " + actual);
            }
            Assert.That(failures, Is.Empty, string.Join("\n", failures));
        }

        [Test]
        public void Or_MatchesNode()
        {
            foreach (var c in Js["or"].Items)
            {
                double value = c["value"].AsNumber(double.NaN);
                double fallback = c["fallback"].AsNumber();
                double expected = c["expected"].AsNumber();
                Assert.That(JsMath.Or(value, fallback), Is.EqualTo(expected).Within(1e-12),
                    "Or(" + value + ", " + fallback + ")");
            }
        }

        // ---------- Bất biến phải đúng bất kể fixture ----------

        [Test]
        public void Round_HalfAlwaysGoesUp()
        {
            // JS làm tròn nửa về +∞; .NET Math.Round mặc định là banker's — sai.
            for (int i = -50; i <= 50; i++)
            {
                double half = i + 0.5;
                double expected = Math.Floor(half + 0.5);
                Assert.That(JsMath.Round(half), Is.EqualTo(expected), "half=" + half);
            }
        }

        [Test]
        public void Round_HandlesNonFinite()
        {
            Assert.That(double.IsNaN(JsMath.Round(double.NaN)), Is.True);
            Assert.That(JsMath.Round(double.PositiveInfinity), Is.EqualTo(double.PositiveInfinity));
            Assert.That(JsMath.Round(double.NegativeInfinity), Is.EqualTo(double.NegativeInfinity));
        }

        [Test]
        public void Round_AlmostHalf_DoesNotBump()
        {
            // 0.49999999999999994 + 0.5 === 1.0 trong double: cài đặt ngây thơ
            // Floor(x + 0.5) trả 1, còn JS trả 0.
            Assert.That(JsMath.Round(0.49999999999999994), Is.EqualTo(0.0));
        }

        [Test]
        public void RoundLong_ClampsAtLongRange()
        {
            Assert.That(JsMath.RoundLong(double.PositiveInfinity), Is.EqualTo(long.MaxValue));
            Assert.That(JsMath.RoundLong(double.NegativeInfinity), Is.EqualTo(long.MinValue));
            Assert.That(JsMath.RoundLong(double.NaN), Is.EqualTo(0));
        }

        [Test]
        public void ToFixed_ProtectsStatRounding()
        {
            // Ba ca này là lý do ToFixed tồn tại: nếu ai đó đổi sang Math.Round
            // thì ASPD/CRIT lệch dần và nhịp bắn sai.
            Assert.That(JsMath.ToFixed(1.9 * 1.02, 2), Is.EqualTo(1.94).Within(1e-12));
            Assert.That(JsMath.ToFixed(0.1 + 0.2, 2), Is.EqualTo(0.3).Within(1e-12));
            Assert.That(JsMath.ToFixed(1.005, 2), Is.EqualTo(1.0).Within(1e-12),
                "JS: (1.005).toFixed(2) === '1.00' (1.005 < 1.005 trong binary)");
        }
    }

    [TestFixture]
    public class SeededRandomTests
    {
        [Test]
        public void SameSeed_ProducesSameSequence()
        {
            var a = new SeededRandom(42);
            var b = new SeededRandom(42);
            for (int i = 0; i < 100; i++)
                Assert.That(a.NextDouble(), Is.EqualTo(b.NextDouble()), "bước " + i);
        }

        [Test]
        public void DifferentSeed_Diverges()
        {
            var a = new SeededRandom(1);
            var b = new SeededRandom(2);
            bool anyDifferent = false;
            for (int i = 0; i < 10; i++)
                if (Math.Abs(a.NextDouble() - b.NextDouble()) > 1e-9) anyDifferent = true;
            Assert.That(anyDifferent, Is.True);
        }

        [Test]
        public void Values_AreInUnitInterval()
        {
            var r = new SeededRandom(0);
            for (int i = 0; i < 10000; i++)
            {
                double v = r.NextDouble();
                Assert.That(v, Is.GreaterThanOrEqualTo(0.0).And.LessThan(1.0));
            }
        }

        [Test]
        public void NextInt_RespectsBounds()
        {
            var r = new SeededRandom(7);
            for (int i = 0; i < 1000; i++)
            {
                int v = r.NextInt(3, 9);
                Assert.That(v, Is.GreaterThanOrEqualTo(3).And.LessThan(9));
            }
        }

        [Test]
        public void NextInt_DegenerateRange()
        {
            var r = new SeededRandom(7);
            Assert.That(r.NextInt(5, 5), Is.EqualTo(5));
            Assert.That(r.NextInt(5, 3), Is.EqualTo(5));
        }

        [Test]
        public void Fork_ContinuesFromSameState()
        {
            var r = new SeededRandom(99);
            r.NextDouble();
            var f = r.Fork();
            Assert.That(r.NextDouble(), Is.EqualTo(f.NextDouble()));
        }

        [Test]
        public void ZeroSeed_DoesNotStickAtZero()
        {
            var r = new SeededRandom(0);
            bool anyNonZero = false;
            for (int i = 0; i < 5; i++)
                if (r.NextDouble() > 0) anyNonZero = true;
            Assert.That(anyNonZero, Is.True, "seed 0 phải được thay bằng hằng số khác 0");
        }

        [Test]
        public void ScriptedRandom_ReplaysExactValues()
        {
            var r = new ScriptedRandom(new[] { 0.1, 0.9, 0.5 });
            Assert.That(r.NextDouble(), Is.EqualTo(0.1));
            Assert.That(r.NextDouble(), Is.EqualTo(0.9));
            Assert.That(r.NextDouble(), Is.EqualTo(0.5));
            Assert.That(r.NextDouble(), Is.EqualTo(0.1), "quay vòng cho fixture ngắn");
        }

        [Test]
        public void ConstantRandom_IsFixed()
        {
            var r = new ConstantRandom(0.0);
            for (int i = 0; i < 5; i++) Assert.That(r.NextDouble(), Is.EqualTo(0.0));
        }
    }
}
