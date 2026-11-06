using System;
using System.Collections.Generic;
using System.IO;
using Artemis.Domain.Core;
using Artemis.Domain.GameData;

namespace Artemis.Domain.Tests
{
    /// <summary>
    /// Nạp dữ liệu game + fixture parity từ đĩa.
    ///
    /// Fixture KHÔNG được viết tay: chúng do <c>tools/unity-parity/gen-fixtures.mjs</c>
    /// sinh ra bằng cách chạy chính script game trong một DOM giả. Nhờ vậy test này
    /// so C# với production, không phải so C# với một bản chép công thức.
    /// </summary>
    public static class TestContext
    {
        private static GameData.GameData _data;
        private static readonly Dictionary<string, JsonValue> Cache = new Dictionary<string, JsonValue>();

        /// <summary>Thư mục gốc repo (lên từ bin/Debug/net8.0).</summary>
        public static string RepoRoot
        {
            get
            {
                var dir = new DirectoryInfo(AppContext.BaseDirectory);
                while (dir != null)
                {
                    if (Directory.Exists(Path.Combine(dir.FullName, "tools", "unity-parity"))) return dir.FullName;
                    if (File.Exists(Path.Combine(dir.FullName, "package.json"))) return dir.FullName;
                    dir = dir.Parent;
                }
                throw new DirectoryNotFoundException("Không tìm thấy thư mục gốc repo từ " + AppContext.BaseDirectory);
            }
        }

        public static string DataDir => Path.Combine(RepoRoot, "unity-client", "ArtemisDomain", "Data");
        public static string FixtureDir => Path.Combine(RepoRoot, "tools", "unity-parity", "fixtures");

        public static GameData.GameData Data
        {
            get
            {
                if (_data != null) return _data;
                _data = GameData.GameData.Load(name =>
                {
                    string p = Path.Combine(DataDir, name);
                    return File.Exists(p) ? File.ReadAllText(p) : null;
                });
                return _data;
            }
        }

        public static JsonValue Fixture(string name)
        {
            if (Cache.TryGetValue(name, out var cached)) return cached;
            string p = Path.Combine(FixtureDir, name);
            if (!File.Exists(p))
                throw new FileNotFoundException(
                    "Thiếu fixture " + name + ". Chạy: node tools/unity-parity/gen-fixtures.mjs", p);
            var v = Json.Parse(File.ReadAllText(p));
            Cache[name] = v;
            return v;
        }

        public static JsonValue[] FixtureArray(string name)
        {
            var root = Fixture(name);
            return root.IsArray ? root.Items.ToArray() : Array.Empty<JsonValue>();
        }
    }
}
