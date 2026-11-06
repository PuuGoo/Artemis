using System;

namespace Artemis.Domain.Core
{
    /// <summary>
    /// Nguồn ngẫu nhiên có thể inject.
    ///
    /// Vì sao không dùng <c>UnityEngine.Random</c> hay <c>System.Random</c> trực tiếp:
    /// mọi thứ trong combat (crit, drop, chọn kỹ năng, roll phụ tố) đều phụ thuộc
    /// RNG. Muốn CHỨNG MINH parity với bản JS thì hai bên phải tiêu thụ **cùng một
    /// dãy số**. Do đó domain chỉ biết interface này; game truyền
    /// <see cref="SeededRandom"/>, test truyền cùng seed cho cả hai phía.
    /// </summary>
    public interface IRandomSource
    {
        /// <summary>Trả về số thực trong [0, 1) — tương đương <c>Math.random()</c>.</summary>
        double NextDouble();

        /// <summary>Trả về số nguyên trong [minInclusive, maxExclusive).</summary>
        int NextInt(int minInclusive, int maxExclusive);

        /// <summary>Nhân bản trạng thái — cần để replay một chuỗi sự kiện.</summary>
        IRandomSource Fork();
    }

    /// <summary>
    /// RNG tất định: cùng seed → cùng dãy, trên mọi nền tảng và mọi phiên bản .NET.
    ///
    /// Dùng xorshift64★ (Marsaglia). Không phải CSPRNG và **không được dùng cho
    /// bảo mật** — chỉ dùng cho gameplay. Nó được chọn vì:
    ///   • Tất định tuyệt đối giữa .NET, Mono (Unity) và IL2CPP.
    ///   • 64-bit nên không bị chu kỳ ngắn như LCG 32-bit.
    ///   • Không phụ thuộc <c>System.Random</c> (thuật toán đổi theo runtime — sẽ
    ///     làm test parity vỡ khi Unity nâng cấp).
    /// </summary>
    public sealed class SeededRandom : IRandomSource
    {
        private ulong _state;

        public SeededRandom(ulong seed)
        {
            // xorshift không được có state 0.
            _state = seed == 0UL ? 0x9E3779B97F4A7C15UL : seed;
        }

        public ulong State => _state;

        private ulong NextUInt64()
        {
            ulong x = _state;
            x ^= x >> 12;
            x ^= x << 25;
            x ^= x >> 27;
            _state = x;
            return x * 0x2545F4914F6CDD1DUL;
        }

        public double NextDouble()
        {
            // 53 bit mantissa như double: chia cho 2^53 để được [0,1).
            ulong v = NextUInt64() >> 11;
            return v / 9007199254740992.0;
        }

        public int NextInt(int minInclusive, int maxExclusive)
        {
            if (maxExclusive <= minInclusive) return minInclusive;
            long range = (long)maxExclusive - minInclusive;
            return (int)(minInclusive + (long)(NextDouble() * range));
        }

        public IRandomSource Fork() => new SeededRandom(_state);

        /// <summary>
        /// Dãy số kỳ vọng cho một seed — dùng làm "hợp đồng" trong test giữa
        /// JS và C#. Xem <c>tools/unity-parity/gen-rng-fixtures.mjs</c>.
        /// </summary>
        public static double[] Sequence(ulong seed, int count)
        {
            var r = new SeededRandom(seed);
            var outv = new double[count];
            for (int i = 0; i < count; i++) outv[i] = r.NextDouble();
            return outv;
        }
    }

    /// <summary>RNG luôn trả cùng một giá trị — dùng cho test biên (luôn crit / không bao giờ crit).</summary>
    public sealed class ConstantRandom : IRandomSource
    {
        private readonly double _value;
        public ConstantRandom(double value) { _value = value; }
        public double NextDouble() => _value;
        public int NextInt(int minInclusive, int maxExclusive) => minInclusive;
        public IRandomSource Fork() => new ConstantRandom(_value);
    }

    /// <summary>RNG phát lại một dãy cho trước — dùng khi fixture lấy từ JS.</summary>
    public sealed class ScriptedRandom : IRandomSource
    {
        private readonly double[] _values;
        private int _i;

        public ScriptedRandom(double[] values)
        {
            _values = values ?? Array.Empty<double>();
        }

        public double NextDouble()
        {
            if (_values.Length == 0) return 0.5;
            double v = _values[_i % _values.Length];
            _i++;
            return v;
        }

        public int NextInt(int minInclusive, int maxExclusive)
        {
            if (maxExclusive <= minInclusive) return minInclusive;
            return minInclusive + (int)(NextDouble() * (maxExclusive - minInclusive));
        }

        public IRandomSource Fork() => new ScriptedRandom(_values, _i);

        private ScriptedRandom(double[] values, int index)
        {
            _values = values ?? Array.Empty<double>();
            _i = index;
        }
    }
}
