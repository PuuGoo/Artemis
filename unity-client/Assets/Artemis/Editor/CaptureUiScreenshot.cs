using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;

namespace Artemis.EditorTools
{
    /// <summary>
    /// Chụp ảnh scene UI ra PNG để so sánh với production.
    ///
    /// Batchmode không render được UI (không có GPU/swapchain), nên hàm này phải
    /// chạy trong Editor có đồ hoạ thật — hoặc dùng RenderTexture + ReadPixels,
    /// cách sau vẫn cần graphics device nên cũng không chạy được với -nographics.
    ///
    /// Menu: Artemis/UI/2. Chụp ảnh so sánh
    /// </summary>
    public static class CaptureUiScreenshot
    {
        private const string ScenePath = "Assets/Artemis/Scenes/UiPreview.unity";
        private const string OutPath = "DocsCaptures/ui-preview.png";

        [MenuItem("Artemis/UI/2. Chụp ảnh so sánh")]
        public static void Capture()
        {
            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);

            var canvas = Object.FindObjectOfType<Canvas>();
            if (canvas == null)
            {
                Debug.LogError("[CaptureUi] Không thấy Canvas trong scene.");
                return;
            }

            const int w = 1280, h = 720;
            var rt = new RenderTexture(w, h, 24, RenderTextureFormat.ARGB32);
            rt.Create();

            var cam = Object.FindObjectOfType<Camera>();
            if (cam == null)
            {
                var go = new GameObject("CaptureCamera");
                cam = go.AddComponent<Camera>();
            }
            cam.targetTexture = rt;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.035f, 0.05f, 0.086f, 1f);
            cam.orthographic = true;

            // Canvas Screen Space Overlay không render vào camera target, nên đổi
            // tạm sang Screen Space Camera trỏ vào camera chụp.
            var prevMode = canvas.renderMode;
            var prevCam = canvas.worldCamera;
            canvas.renderMode = RenderMode.ScreenSpaceCamera;
            canvas.worldCamera = cam;
            canvas.planeDistance = 1f;

            Canvas.ForceUpdateCanvases();
            cam.Render();

            RenderTexture.active = rt;
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, false);
            tex.ReadPixels(new Rect(0, 0, w, h), 0, 0);
            tex.Apply();

            var png = tex.EncodeToPNG();

            // Trả lại trạng thái cũ để không làm hỏng scene.
            canvas.renderMode = prevMode;
            canvas.worldCamera = prevCam;
            cam.targetTexture = null;
            RenderTexture.active = null;
            rt.Release();

            var dir = Path.Combine(Directory.GetCurrentDirectory(), "DocsCaptures");
            Directory.CreateDirectory(dir);
            var abs = Path.Combine(dir, "ui-preview.png");
            File.WriteAllBytes(abs, png);

            Debug.Log("[CaptureUi] Đã lưu: " + abs + " (" + png.Length + " bytes)");
        }

        /// <summary>Entry cho batchmode — sẽ báo rõ nếu môi trường không render được.</summary>
        public static void Run()
        {
            try
            {
                Capture();
                EditorApplication.Exit(0);
            }
            catch (System.Exception e)
            {
                Debug.LogError("[CaptureUi] THẤT BẠI: " + e);
                EditorApplication.Exit(1);
            }
        }
    }
}
