using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Artemis.EditorTools
{
    /// <summary>
    /// Build WebGL bằng CLI, không cần mở giao diện.
    ///
    /// Chạy:
    ///   Unity.exe -batchmode -nographics -quit -projectPath &lt;proj&gt; \
    ///     -executeMethod Artemis.EditorTools.BuildWebGL.Run \
    ///     -logFile &lt;log&gt;
    ///
    /// Exit code 0 = build thành công, 1 = thất bại.
    /// </summary>
    public static class BuildWebGL
    {
        private const string ScenePath = "Assets/Artemis/Scenes/Bootstrap.unity";
        private const string OutputDir = "Builds/WebGL";

        public static void Run()
        {
            try
            {
                Build();
                EditorApplication.Exit(0);
            }
            catch (Exception e)
            {
                Debug.LogError("[BuildWebGL] THẤT BẠI: " + e);
                EditorApplication.Exit(1);
            }
        }

        private static void Build()
        {
            // WebGL template "Minimal" — không có khung Unity to đùng, để nhúng
            // được vào trang web sẵn có.
            //
            // LƯU Ý: "Minimal" là template BUILT-IN của Unity (nằm trong
            // Editor/Data/PlaybackEngines/WebGLSupport/BuildTools/WebGLTemplates).
            // Prefix "PROJECT:" chỉ dùng cho template tự tạo trong
            // Assets/WebGLTemplates/ — dùng "PROJECT:Minimal" sẽ lỗi
            // "Invalid WebGL template path".
            PlayerSettings.WebGL.template = "APPLICATION:Minimal";
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
            PlayerSettings.WebGL.decompressionFallback = true;
            PlayerSettings.SetManagedStrippingLevel(
                UnityEditor.Build.NamedBuildTarget.WebGL, ManagedStrippingLevel.Medium);
            PlayerSettings.runInBackground = true;

            var outAbs = Path.GetFullPath(OutputDir);
            if (Directory.Exists(outAbs)) Directory.Delete(outAbs, true);
            Directory.CreateDirectory(outAbs);

            var opts = new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = outAbs,
                target = BuildTarget.WebGL,
                targetGroup = BuildTargetGroup.WebGL,
                options = BuildOptions.None,
            };

            Debug.Log("[BuildWebGL] Bắt đầu build -> " + outAbs);
            var report = BuildPipeline.BuildPlayer(opts);
            var s = report.summary;

            Debug.Log("[BuildWebGL] Kết quả: " + s.result +
                      " | lỗi: " + s.totalErrors +
                      " | cảnh báo: " + s.totalWarnings +
                      " | dung lượng: " + (s.totalSize / 1024 / 1024) + " MB" +
                      " | thời gian: " + s.totalTime);

            if (s.result != BuildResult.Succeeded)
                throw new Exception("BuildPlayer trả về " + s.result);

            // Xác nhận file thật sự có trên đĩa, không tin mỗi report.
            var index = Path.Combine(outAbs, "index.html");
            if (!File.Exists(index))
                throw new Exception("Build báo thành công nhưng thiếu " + index);

            Debug.Log("[BuildWebGL] OK: " + index);
        }
    }
}
