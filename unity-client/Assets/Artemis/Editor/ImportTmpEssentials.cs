using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace Artemis.EditorTools
{
    /// <summary>
    /// Import "TMP Essential Resources" bằng CLI.
    ///
    /// Vì sao cần: package com.unity.textmeshpro chỉ chứa CODE. Font atlas, TMP
    /// Settings và material mặc định nằm trong một .unitypackage riêng
    /// (Package Resources/TMP Essential Resources.unitypackage) và Unity chỉ
    /// import khi người dùng bấm menu. Thiếu nó thì mọi TextMeshProUGUI render ra
    /// chữ trắng vô hình (không có font asset) — đúng hiện tượng HUD trống.
    ///
    /// Chạy:
    ///   Unity.exe -batchmode -quit -projectPath &lt;proj&gt; \
    ///     -executeMethod Artemis.EditorTools.ImportTmpEssentials.Run
    /// </summary>
    public static class ImportTmpEssentials
    {
        private const string TmpSettingsPath = "Assets/TextMesh Pro/Resources/TMP Settings.asset";

        public static void Run()
        {
            try
            {
                bool ok = Import();
                EditorApplication.Exit(ok ? 0 : 1);
            }
            catch (Exception e)
            {
                Debug.LogError("[ImportTMP] THẤT BẠI: " + e);
                EditorApplication.Exit(1);
            }
        }

        private static bool Import()
        {
            if (File.Exists(TmpSettingsPath))
            {
                Debug.Log("[ImportTMP] Đã có sẵn: " + TmpSettingsPath + " — bỏ qua.");
                return true;
            }

            // Tìm .unitypackage trong package cache (đường dẫn thay đổi theo version).
            string pkg = FindPackage();
            if (pkg == null)
            {
                Debug.LogError("[ImportTMP] Không tìm thấy 'TMP Essential Resources.unitypackage' " +
                               "trong Library/PackageCache. Kiểm tra com.unity.textmeshpro đã cài chưa.");
                return false;
            }

            Debug.Log("[ImportTMP] Giải nén trực tiếp: " + pkg);
            if (!ExtractUnityPackage(pkg))
                return false;

            AssetDatabase.Refresh();
            bool ok = File.Exists(TmpSettingsPath);
            if (ok) Debug.Log("[ImportTMP] OK: " + TmpSettingsPath);
            else Debug.LogError("[ImportTMP] Giải nén xong nhưng vẫn thiếu " + TmpSettingsPath);
            return ok;
        }

        /// <summary>
        /// Giải nén .unitypackage bằng tay.
        ///
        /// KHÔNG dùng <c>AssetDatabase.ImportPackage</c>: hàm đó lên lịch import
        /// bất đồng bộ trên main thread. Trong batchmode mà chờ bằng
        /// Thread.Sleep (như bản đầu của file này) thì main thread bị chặn nên
        /// import không bao giờ chạy — log chỉ ra 32 dòng "Asset Pipeline
        /// Refresh" rồi thoát, Assets/TextMesh Pro vẫn rỗng.
        ///
        /// .unitypackage là tar.gz; mỗi entry có: pathname / asset / asset.meta.
        /// Chép thẳng ra đĩa là đủ, Unity sẽ nhận ở lần Refresh sau.
        /// </summary>
        private static bool ExtractUnityPackage(string pkgPath)
        {
            string tmp = Path.Combine(Path.GetTempPath(), "artemis-tmp-pkg");
            if (Directory.Exists(tmp)) Directory.Delete(tmp, true);
            Directory.CreateDirectory(tmp);

            // tar có sẵn trên Windows 10 1803+.
            var psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "tar",
                Arguments = "-xzf \"" + pkgPath + "\" -C \"" + tmp + "\"",
                UseShellExecute = false,
                RedirectStandardError = true,
                CreateNoWindow = true,
            };
            using (var p = System.Diagnostics.Process.Start(psi))
            {
                p.WaitForExit();
                if (p.ExitCode != 0)
                {
                    Debug.LogError("[ImportTMP] tar lỗi " + p.ExitCode + ": " + p.StandardError.ReadToEnd());
                    return false;
                }
            }

            int copied = 0;
            foreach (var dir in Directory.EnumerateDirectories(tmp))
            {
                var pnFile = Path.Combine(dir, "pathname");
                var assetFile = Path.Combine(dir, "asset");
                if (!File.Exists(pnFile) || !File.Exists(assetFile)) continue;

                var rel = File.ReadAllText(pnFile).Trim().Replace('/', Path.DirectorySeparatorChar);
                var target = Path.Combine(Directory.GetCurrentDirectory(), rel);
                Directory.CreateDirectory(Path.GetDirectoryName(target));
                File.Copy(assetFile, target, true);

                var metaFile = Path.Combine(dir, "asset.meta");
                if (File.Exists(metaFile)) File.Copy(metaFile, target + ".meta", true);
                copied++;
            }

            Directory.Delete(tmp, true);
            Debug.Log("[ImportTMP] Đã chép " + copied + " file.");
            return copied > 0;
        }

        private static string FindPackage()
        {
            var roots = new[]
            {
                Path.Combine(Directory.GetCurrentDirectory(), "Library", "PackageCache"),
                Path.Combine(Directory.GetCurrentDirectory(), "Packages"),
            };

            foreach (var root in roots.Where(Directory.Exists))
            {
                var hit = Directory.EnumerateFiles(root, "*.unitypackage", SearchOption.AllDirectories)
                    .FirstOrDefault(f => f.IndexOf("TMP Essential", StringComparison.OrdinalIgnoreCase) >= 0);
                if (hit != null) return hit;
            }
            return null;
        }
    }
}
