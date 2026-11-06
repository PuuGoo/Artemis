using System;
using System.Collections.Generic;
using UnityEngine;

namespace Artemis.Runtime.Persistence
{
    /// <summary>
    /// Cầu nối giữa Unity (TextAsset) và <c>Artemis.Domain.GameData</c>.
    ///
    /// Dữ liệu tĩnh (18 hero, 42 gear, 72 skill, 46 rune, 46 artifact…) được SINH
    /// tự động từ public/index.html bằng <c>tools/unity-parity/extract-data.mjs</c>
    /// và nằm ở <c>Assets/Artemis/Resources/ArtemisData/*.json</c>. Không có bảng
    /// nào được chép tay, nên không có nguy cơ lệch âm thầm khi web đổi dữ liệu.
    ///
    /// Nếu thiếu bất kỳ file nào, lớp này NÉM LỖI thay vì dùng dữ liệu rỗng: một
    /// game khởi động với 0 hero sẽ hiện màn hình trắng, khó chẩn đoán hơn nhiều
    /// so với một exception nêu rõ tên file.
    /// </summary>
    public static class GameDataProvider
    {
        public const string ResourceFolder = "ArtemisData";

        private static Artemis.Domain.GameData.GameData _instance;
        private static readonly Dictionary<string, string> Cache = new Dictionary<string, string>(StringComparer.Ordinal);

        /// <summary>Dữ liệu đã nạp (nạp một lần, dùng lại).</summary>
        public static Artemis.Domain.GameData.GameData Data
        {
            get
            {
                if (_instance != null) return _instance;
                _instance = Artemis.Domain.GameData.GameData.Load(ReadText);
                return _instance;
            }
        }

        private static string ReadText(string fileName)
        {
            if (Cache.TryGetValue(fileName, out var cached)) return cached;

            string withoutExt = fileName.EndsWith(".json", StringComparison.Ordinal)
                ? fileName.Substring(0, fileName.Length - 5)
                : fileName;

            var asset = Resources.Load<TextAsset>(ResourceFolder + "/" + withoutExt);
            if (asset == null)
            {
                throw new InvalidOperationException(
                    "Thiếu dữ liệu game: Assets/Artemis/Resources/" + ResourceFolder + "/" + fileName + "\n" +
                    "Sinh lại bằng: node tools/unity-parity/extract-data.mjs " +
                    "rồi copy unity-client/ArtemisDomain/Data/*.json vào Resources/" + ResourceFolder + "/.");
            }

            Cache[fileName] = asset.text;
            return asset.text;
        }

        /// <summary>Xoá cache — chỉ dùng trong test.</summary>
        public static void Reset()
        {
            _instance = null;
            Cache.Clear();
        }
    }
}
