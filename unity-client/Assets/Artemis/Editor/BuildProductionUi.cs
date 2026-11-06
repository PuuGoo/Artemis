using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;
using Artemis.Domain.Core;
using Artemis.Domain.Ui;
using Artemis.Runtime.UI.Production;

namespace Artemis.EditorTools
{
    /// <summary>
    /// Dựng màn hình UI production trong Unity, dùng layout engine của domain
    /// (đã test bằng dotnet) thay cho LayoutGroup của Unity.
    ///
    /// Menu: Artemis/UI/1. Dựng màn hình production
    /// Batch: -executeMethod Artemis.EditorTools.BuildProductionUi.Run
    /// </summary>
    public static class BuildProductionUi
    {
        private const string ScenePath = "Assets/Artemis/Scenes/UiPreview.unity";

        public static void Run()
        {
            try
            {
                Build();
                EditorApplication.Exit(0);
            }
            catch (System.Exception e)
            {
                Debug.LogError("[BuildProductionUi] THẤT BẠI: " + e);
                EditorApplication.Exit(1);
            }
        }

        [MenuItem("Artemis/UI/1. Dựng màn hình production")]
        public static void Build()
        {
            var themeAsset = Resources.Load<TextAsset>("ArtemisUi/uiTheme");
            var treeAsset = Resources.Load<TextAsset>("ArtemisUi/uiTree");
            var screensAsset = Resources.Load<TextAsset>("ArtemisUi/uiScreens");
            if (themeAsset == null || treeAsset == null)
            {
                throw new System.Exception(
                    "Thiếu ArtemisUi/uiTheme.json hoặc uiTree.json trong Resources. " +
                    "Chạy: node tools/unity-ui/extract-theme.mjs && node tools/unity-ui/extract-ui.mjs");
            }

            var theme = UiTheme.Load(themeAsset.text);
            var themeJson = Json.Parse(themeAsset.text);
            var treeJson = Json.Parse(treeAsset.text);

            // Bảng tra cho layout engine (domain) — lấy từ chính theme production.
            var spacing = new Dictionary<string, float>();
            var fontSizes = new Dictionary<string, float>();
            if (themeJson["spacing"].IsObject && themeJson["spacing"].Members != null)
                foreach (var kv in themeJson["spacing"].Members)
                    spacing[kv.Key] = (float)kv.Value["px"].AsNumber(0);
            if (themeJson["fontSize"].IsObject && themeJson["fontSize"].Members != null)
                foreach (var kv in themeJson["fontSize"].Members)
                    fontSizes[kv.Key] = (float)kv.Value["size"].AsNumber(14);

            var refRoot = ToRef(treeJson);
            var layout = new UiLayout(spacing, fontSizes);

            Debug.Log("[BuildProductionUi] theme: " + theme.ColorCount + " màu, " +
                      theme.GradientCount + " gradient; spacing: " + spacing.Count +
                      "; fontSize: " + fontSizes.Count);

            const float vw = 1280f, vh = 720f;
            var box = layout.Compute(refRoot, vw, vh);
            Debug.Log("[BuildProductionUi] layout: " + box.Count() + " box cho " + vw + "x" + vh);

            // ---- Scene ----
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var camGo = new GameObject("Main Camera");
            var cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = UiTheme.HexToColor("090d16");
            cam.orthographic = true;

            var canvasGo = new GameObject("ProductionCanvas",
                typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;

            var scaler = canvasGo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(vw, vh);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 0.5f;

            // Nền body production: radial-gradient(#1e1b4b -> #090d16).
            var bg = new GameObject("BodyBackground");
            var bgRt = bg.AddComponent<RectTransform>();
            bgRt.SetParent(canvasGo.transform, false);
            bgRt.anchorMin = Vector2.zero;
            bgRt.anchorMax = Vector2.one;
            bgRt.offsetMin = Vector2.zero;
            bgRt.offsetMax = Vector2.zero;
            var bgImg = bg.AddComponent<Image>();
            bgImg.color = Color.white;
            bgImg.raycastTarget = false;
            var bgGrad = bg.AddComponent<GradientFill>();
            bgGrad.SetVertical(UiTheme.HexToColor("1e1b4b"), UiTheme.HexToColor("090d16"));

            // ---- Dựng cây ----
            var renderer = new ProductionUiRenderer(theme, layout, LoadFont(),
                canvasGo.GetComponent<RectTransform>());
            renderer.Render(box, canvasGo.transform);

            // ---- Chỉ bật đúng màn hình production đang hiện ----
            //
            // Production mở ra ở tabEquip; các tab khác có class "hidden". Nếu bật
            // tất cả, màn hình sẽ lộn xộn và KHÔNG giống production (đúng lỗi đã
            // thấy khi so ảnh chụp). Ở đây ép trạng thái theo uiScreens.json.
            if (screensAsset != null)
            {
                var screensJson = Json.Parse(screensAsset.text);
                var defaults = screensJson["defaultState"];
                string openTab = defaults["openTab"].AsString("");

                foreach (var s in defaults["allScreens"].Items)
                {
                    string id = s.AsString("");
                    if (string.IsNullOrEmpty(id) || id == openTab) continue;
                    var go = FindDeep(canvasGo.transform, id);
                    // Chỉ tắt màn hình cấp 1 (tab/modal), không đụng node nội dung
                    // trùng tên nằm sâu bên trong.
                    if (go != null && go.transform.parent == canvasGo.transform) go.SetActive(false);
                }

                Debug.Log("[BuildProductionUi] màn hình mặc định: " + openTab);
            }
            else
            {
                Debug.LogWarning("[BuildProductionUi] Thiếu uiScreens.json — không ép được trạng thái mặc định.");
            }

            Debug.Log("[BuildProductionUi] đã dựng " + renderer.NodesBuilt + " GameObject, " +
                      "bỏ " + renderer.NodesSkipped);
            Debug.Log("[BuildProductionUi] chưa biểu diễn được: " + renderer.Unsupported.Count);
            foreach (var u in renderer.Unsupported) Debug.Log("    - " + u);

            Directory.CreateDirectory(Path.GetDirectoryName(ScenePath));
            EditorSceneManager.MarkSceneDirty(scene);
            bool saved = EditorSceneManager.SaveScene(scene, ScenePath);
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            if (!saved) throw new System.Exception("Không lưu được scene " + ScenePath);
            Debug.Log("[BuildProductionUi] OK: " + ScenePath);
        }

        /// <summary>Tìm GameObject con theo tên (đệ quy, chỉ tìm trong canvas).</summary>
        private static GameObject FindDeep(Transform root, string name)
        {
            for (int i = 0; i < root.childCount; i++)
            {
                var c = root.GetChild(i);
                if (c.name == name) return c.gameObject;
                var hit = FindDeep(c, name);
                if (hit != null) return hit;
            }
            return null;
        }

        /// <summary>
        /// Chuyển JSON cây UI sang kiểu tối giản của domain (UiLayout.UiNodeRef),
        /// để layout engine không phụ thuộc UnityEngine.
        /// </summary>
        private static UiLayout.UiNodeRef ToRef(JsonValue v)
        {
            var n = new UiLayout.UiNodeRef
            {
                Tag = v["tag"].AsString(""),
                Id = v["id"].AsString(""),
                Text = v["text"].AsString(""),
            };
            if (v["cls"].IsArray)
                foreach (var c in v["cls"].Items) n.Cls.Add(c.AsString(""));
            if (v["kids"].IsArray)
                foreach (var k in v["kids"].Items) n.Kids.Add(ToRef(k));
            return n;
        }

        /// <summary>
        /// Font: ưu tiên Inter (font thật của production) nếu đã import.
        ///
        /// Unity 2022 bỏ "Arial.ttf" — phải dùng "LegacyRuntime.ttf".
        /// </summary>
        private static Font LoadFont()
        {
            var inter = Resources.Load<Font>("ArtemisFonts/Inter");
            if (inter != null)
            {
                Debug.Log("[BuildProductionUi] Dùng font production: Inter");
                return inter;
            }

            var f = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            if (f == null)
            {
                Debug.LogError("[BuildProductionUi] Không lấy được LegacyRuntime.ttf — chữ sẽ không hiện.");
                return null;
            }

            Debug.LogWarning(
                "[BuildProductionUi] Dùng LegacyRuntime.ttf thay cho 'Inter' của production. " +
                "Muốn khớp typography: đặt Inter.ttf vào " +
                "Assets/Artemis/Resources/ArtemisFonts/Inter.ttf rồi chạy lại.");
            return f;
        }
    }
}
