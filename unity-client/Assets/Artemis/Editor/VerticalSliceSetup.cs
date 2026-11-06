using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using Artemis.Runtime.Core;
using Artemis.Runtime.Characters;
using Artemis.Runtime.Combat;
using Artemis.Runtime.Dungeons;
using Artemis.Runtime.Enemies;
using Artemis.Runtime.UI;
using Object = UnityEngine.Object;
using TextureImporterType = UnityEditor.TextureImporterType;

namespace Artemis.EditorTools
{
    /// <summary>
    /// Dựng vertical slice bằng MỘT menu item, thay vì 20 thao tác kéo thả.
    ///
    /// Vì sao có script này: máy phát triển không có Unity Editor nên phần nối
    /// scene chưa từng được làm. Kéo thả bằng tay thì không tái lập được, không
    /// review được trong diff, và mỗi lần tạo lại project là làm lại từ đầu.
    /// Script này biến việc đó thành một bước chạy lại được và có kiểm chứng.
    ///
    /// Nó chỉ tạo asset trong Assets/Artemis/ và gán tham chiếu — không sửa mã,
    /// không đụng public/, api/, lib/.
    /// </summary>
    public static class VerticalSliceSetup
    {
        private const string PrefabDir = "Assets/Artemis/Prefabs";
        private const string GeneratedDir = "Assets/Artemis/Generated";

        [MenuItem("Artemis/1. Dựng Vertical Slice (prefab + HUD + tham chiếu)")]
        public static void SetupAll()
        {
            if (EditorApplication.isPlaying)
            {
                EditorUtility.DisplayDialog("Artemis", "Dừng Play mode trước khi dựng.", "OK");
                return;
            }

            EnsureFolder("Assets/Artemis");
            EnsureFolder(PrefabDir);
            EnsureFolder(GeneratedDir);

            var sprites = CreatePlaceholderSprites();
            var projectilePrefab = CreateProjectilePrefab(sprites.projectile);
            var enemyPrefab = CreateEnemyPrefab(sprites.enemy);

            WireScene(projectilePrefab, enemyPrefab);

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            EditorUtility.DisplayDialog(
                "Artemis",
                "Xong.\n\n" +
                "Đã tạo:\n" +
                "  • " + PrefabDir + "/Projectile.prefab\n" +
                "  • " + PrefabDir + "/Enemy.prefab\n" +
                "  • Hai pool đạn trong scene\n" +
                "  • Canvas HUD + panel đăng nhập\n" +
                "  • Gán toàn bộ tham chiếu vào GameBootstrap\n\n" +
                "Bước tiếp: bấm Play.",
                "OK");
        }

        [MenuItem("Artemis/2. Kiểm tra tham chiếu scene")]
        public static void ValidateScene()
        {
            var boot = Object.FindObjectOfType<GameBootstrap>();
            if (boot == null)
            {
                EditorUtility.DisplayDialog("Artemis", "Không thấy GameBootstrap trong scene đang mở.", "OK");
                return;
            }

            var problems = new System.Collections.Generic.List<string>();
            if (boot.PlayerController == null) problems.Add("PlayerController");
            if (boot.PlayerStats == null) problems.Add("PlayerStats");
            if (boot.Combat == null) problems.Add("Combat");
            if (boot.Room == null) problems.Add("Room");
            if (boot.PlayerProjectiles == null) problems.Add("PlayerProjectiles");
            if (boot.Hud == null) problems.Add("Hud");
            if (boot.Auth == null) problems.Add("Auth");

            if (boot.Room != null)
            {
                if (boot.Room.EnemyPrefab == null) problems.Add("Room.EnemyPrefab");
                if (boot.Room.PlayerTransform == null) problems.Add("Room.PlayerTransform");
            }

            string msg = problems.Count == 0
                ? "Mọi tham chiếu đã gán. Sẵn sàng bấm Play."
                : "Còn thiếu:\n  • " + string.Join("\n  • ", problems);
            EditorUtility.DisplayDialog("Artemis", msg, "OK");
        }

        // ==================== Sprite giữ chỗ ====================

        private struct Sprites
        {
            public Sprite projectile;
            public Sprite enemy;
            public Sprite player;
        }

        /// <summary>
        /// Sinh sprite tròn đơn sắc. Đây là đồ hoạ GIỮ CHỖ có chủ đích — mục tiêu
        /// của Phase 1 là chứng minh gameplay chạy, không phải trình bày. Ghi rõ
        /// trong docs để không ai nhầm là art cuối.
        /// </summary>
        private static Sprites CreatePlaceholderSprites()
        {
            return new Sprites
            {
                projectile = MakeCircleSprite("proj", 16, new Color(0.98f, 0.85f, 0.3f)),
                enemy = MakeCircleSprite("enemy", 32, new Color(0.72f, 0.29f, 0.29f)),
                player = MakeCircleSprite("player", 32, new Color(0.2f, 0.74f, 1f)),
            };
        }

        private static Sprite MakeCircleSprite(string name, int size, Color color)
        {
            string path = GeneratedDir + "/" + name + ".png";
            if (File.Exists(path))
            {
                var existing = AssetDatabase.LoadAssetAtPath<Sprite>(path);
                if (existing != null) return existing;
            }

            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
            float r = size * 0.5f;
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float dx = x - r + 0.5f;
                    float dy = y - r + 0.5f;
                    float d = Mathf.Sqrt(dx * dx + dy * dy);
                    // Viền mềm 1px để sprite tròn không bị răng cưa.
                    float a = Mathf.Clamp01(r - d);
                    tex.SetPixel(x, y, new Color(color.r, color.g, color.b, a));
                }
            }
            tex.Apply();

            File.WriteAllBytes(path, tex.EncodeToPNG());
            Object.DestroyImmediate(tex);
            AssetDatabase.ImportAsset(path);

            var importer = (TextureImporter)AssetImporter.GetAtPath(path);
            importer.textureType = TextureImporterType.Sprite;
            importer.spritePixelsPerUnit = 100f;
            importer.filterMode = FilterMode.Bilinear;
            importer.SaveAndReimport();

            return AssetDatabase.LoadAssetAtPath<Sprite>(path);
        }

        // ==================== Prefab ====================

        private static GameObject CreateProjectilePrefab(Sprite sprite)
        {
            string path = PrefabDir + "/Projectile.prefab";
            AssetDatabase.DeleteAsset(path);

            var go = new GameObject("Projectile");
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = sprite;
            sr.sortingOrder = 20;

            var col = go.AddComponent<CircleCollider2D>();
            col.isTrigger = true;
            col.radius = 0.065f;

            var rb = go.AddComponent<Rigidbody2D>();
            rb.bodyType = RigidbodyType2D.Kinematic;
            rb.simulated = true;

            go.AddComponent<Projectile>();

            var prefab = PrefabUtility.SaveAsPrefabAsset(go, path);
            Object.DestroyImmediate(go);
            return prefab;
        }

        private static GameObject CreateEnemyPrefab(Sprite sprite)
        {
            string path = PrefabDir + "/Enemy.prefab";
            AssetDatabase.DeleteAsset(path);

            var go = new GameObject("Enemy");
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = sprite;
            sr.sortingOrder = 5;

            var col = go.AddComponent<CircleCollider2D>();
            col.isTrigger = true;
            col.radius = 0.16f;

            var rb = go.AddComponent<Rigidbody2D>();
            rb.bodyType = RigidbodyType2D.Kinematic;

            go.AddComponent<EnemyController>();

            var prefab = PrefabUtility.SaveAsPrefabAsset(go, path);
            Object.DestroyImmediate(go);
            return prefab;
        }

        // ==================== Nối scene ====================

        /// <summary>
        /// Bỏ các component thừa do scene viết tay (Bootstrap.unity) gắn nhầm:
        /// GameBootstrap từng mang thêm RoomController/CombatController/
        /// PlayerStatsBehaviour/CombatHud/AuthScreen mà không có GameObject chủ
        /// tương ứng, khiến <c>FindObjectOfType</c> tìm thấy trước khi bản đúng
        /// được tạo. Dọn ở đây để chạy lại nhiều lần vẫn ra cùng kết quả.
        /// </summary>
        private static void CleanStrayComponents(GameBootstrap boot)
        {
            var go = boot.gameObject;

            // Các component này chỉ có nghĩa khi gắn đúng chủ (Player / Canvas).
            RemoveIfPresent<Artemis.Runtime.Dungeons.RoomController>(
                go, "RoomController", "RoomController");
            RemoveIfPresent<Artemis.Runtime.Combat.CombatController>(
                go, "CombatController", "Player");
            RemoveIfPresent<Artemis.Runtime.Characters.PlayerStatsBehaviour>(
                go, "PlayerStatsBehaviour", "Player");
            RemoveIfPresent<CombatHud>(go, "CombatHud (thiếu Canvas)", "HUD");
            RemoveIfPresent<AuthScreen>(go, "AuthScreen (thiếu Canvas)", "AuthCanvas");
        }

        private static void RemoveIfPresent<T>(GameObject host, string label, string properHostName)
            where T : Component
        {
            var comp = host.GetComponent<T>();
            if (comp == null) return;

            Debug.LogWarning("[VerticalSlice] Bỏ " + label + " gắn nhầm trên '" + host.name +
                             "' (phải nằm trên '" + properHostName + "')");
            Object.DestroyImmediate(comp);
        }

        private static void WireScene(GameObject projectilePrefab, GameObject enemyPrefab)
        {
            var boot = Object.FindObjectOfType<GameBootstrap>();
            if (boot == null)
            {
                var bootGo = new GameObject("GameBootstrap");
                boot = bootGo.AddComponent<GameBootstrap>();
            }

            CleanStrayComponents(boot);

            // ---- Player ----
            var playerGo = GameObject.Find("Player");
            if (playerGo == null)
            {
                playerGo = new GameObject("Player");
                playerGo.transform.position = new Vector3(6.4f, 1.2f, 0f);
                var sr = playerGo.AddComponent<SpriteRenderer>();
                sr.sortingOrder = 10;
                var rb = playerGo.AddComponent<Rigidbody2D>();
                rb.bodyType = RigidbodyType2D.Kinematic;
            }
            var playerSprite = AssetDatabase.LoadAssetAtPath<Sprite>(GeneratedDir + "/player.png");
            if (playerSprite != null)
            {
                var sr = playerGo.GetComponent<SpriteRenderer>();
                if (sr != null) sr.sprite = playerSprite;
            }

            var pc = playerGo.GetComponent<PlayerController>();
            if (pc == null) pc = playerGo.AddComponent<PlayerController>();
            var ps = playerGo.GetComponent<PlayerStatsBehaviour>();
            if (ps == null) ps = playerGo.AddComponent<PlayerStatsBehaviour>();
            var cc = playerGo.GetComponent<CombatController>();
            if (cc == null) cc = playerGo.AddComponent<CombatController>();

            // ---- Pools ----
            var poolRoot = GameObject.Find("Pools");
            if (poolRoot == null) poolRoot = new GameObject("Pools");

            var playerPool = GetOrCreatePool(poolRoot.transform, "PlayerProjectilePool", projectilePrefab);
            var enemyPool = GetOrCreatePool(poolRoot.transform, "EnemyProjectilePool", projectilePrefab);

            // ---- Room ----
            var roomGo = GameObject.Find("RoomController");
            if (roomGo == null) roomGo = new GameObject("RoomController");
            var room = roomGo.GetComponent<RoomController>();
            if (room == null) room = roomGo.AddComponent<RoomController>();

            var enemyParent = GameObject.Find("Enemies");
            if (enemyParent == null) enemyParent = new GameObject("Enemies");

            room.EnemyPrefab = enemyPrefab != null ? enemyPrefab.GetComponent<EnemyController>() : null;
            room.EnemyParent = enemyParent.transform;
            room.PlayerTransform = playerGo.transform;
            room.Player = ps;
            room.Combat = cc;

            // ---- HUD ----
            var hud = BuildHud();

            // ---- Auth ----
            var auth = BuildAuthPanel();

            // ---- Gán vào bootstrap ----
            boot.PlayerController = pc;
            boot.PlayerStats = ps;
            boot.Combat = cc;
            boot.Room = room;
            boot.PlayerProjectiles = playerPool;
            boot.EnemyProjectiles = enemyPool;
            boot.Hud = hud;
            boot.Auth = auth;

            EditorUtility.SetDirty(pc);
            EditorUtility.SetDirty(ps);
            EditorUtility.SetDirty(cc);
            EditorUtility.SetDirty(room);
            EditorUtility.SetDirty(boot);
            if (hud != null) EditorUtility.SetDirty(hud);
            if (auth != null) EditorUtility.SetDirty(auth);

            EditorSceneManager.MarkSceneDirty(EditorSceneManager.GetActiveScene());
        }

        private static ProjectilePool GetOrCreatePool(Transform parent, string name, GameObject prefab)
        {
            var t = parent.Find(name);
            GameObject go = t != null ? t.gameObject : new GameObject(name);
            go.transform.SetParent(parent, false);

            var pool = go.GetComponent<ProjectilePool>();
            if (pool == null) pool = go.AddComponent<ProjectilePool>();
            pool.Prefab = prefab;
            pool.PrewarmCount = 64;
            pool.MaxSize = 512;
            return pool;
        }

        // ==================== HUD ====================

        private static CombatHud BuildHud()
        {
            var existing = Object.FindObjectOfType<CombatHud>();
            if (existing != null && existing.GetComponent<Canvas>() != null) return existing;
            if (existing != null)
            {
                // CombatHud mồ côi (scene viết tay gắn component nhưng không có Canvas):
                // bỏ đi rồi dựng lại cho đúng, nếu giữ sẽ ra HUD rỗng không có text.
                Debug.LogWarning("[VerticalSlice] Bỏ CombatHud không có Canvas: " +
                                 existing.gameObject.name);
                Object.DestroyImmediate(existing);
            }

            var canvasGo = new GameObject("HUD", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;

            var scaler = canvasGo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1280f, 720f);
            // Match 0.5 để chịu được cả 16:9 desktop và 4:3/19.5:9 mobile.
            scaler.matchWidthOrHeight = 0.5f;

            var hud = canvasGo.AddComponent<CombatHud>();

            // --- Cụm góc trên trái: phòng / quái / cấp / XP / vàng ---
            hud.RoomText = MakeText(canvasGo.transform, "RoomText", new Vector2(16, -14), "Phòng 1 / 15", 22);
            hud.EnemyCountText = MakeText(canvasGo.transform, "EnemyCountText", new Vector2(16, -44), "Quái: 0", 18);
            hud.LevelText = MakeText(canvasGo.transform, "LevelText", new Vector2(16, -70), "Cấp 1", 18);
            hud.XpText = MakeText(canvasGo.transform, "XpText", new Vector2(16, -96), "0 / 80 EXP", 16);
            hud.GoldText = MakeText(canvasGo.transform, "GoldText", new Vector2(16, -122), "0", 18);
            hud.XpFill = MakeBar(canvasGo.transform, "XpBar", new Vector2(16, -148), new Vector2(220, 6), new Color(0.98f, 0.75f, 0.14f));

            // --- Thanh máu dưới trái ---
            var hpBg = MakeBar(canvasGo.transform, "HpGhost", new Vector2(16, 40), new Vector2(300, 18), new Color(0.5f, 0.1f, 0.1f, 0.7f));
            hud.HpGhost = hpBg;
            hud.HpFill = MakeBar(canvasGo.transform, "HpFill", new Vector2(16, 40), new Vector2(300, 18), new Color(0.13f, 0.77f, 0.37f));
            hud.HpText = MakeText(canvasGo.transform, "HpText", new Vector2(16, 62), "0 / 0", 18);
            hud.HpPercent = MakeText(canvasGo.transform, "HpPercent", new Vector2(230, 62), "100%", 16);

            // --- Panel trùm, ẩn mặc định ---
            var bossRoot = new GameObject("BossPanel", typeof(RectTransform));
            bossRoot.transform.SetParent(canvasGo.transform, false);
            var brt = bossRoot.GetComponent<RectTransform>();
            brt.anchorMin = new Vector2(0.5f, 1f);
            brt.anchorMax = new Vector2(0.5f, 1f);
            brt.pivot = new Vector2(0.5f, 1f);
            brt.anchoredPosition = new Vector2(0f, -20f);
            brt.sizeDelta = new Vector2(520f, 64f);

            hud.BossPanel = bossRoot;
            hud.BossName = MakeText(bossRoot.transform, "BossName", new Vector2(0, 0), "TRÙM", 22);
            hud.BossHpText = MakeText(bossRoot.transform, "BossHpText", new Vector2(0, -28), "0 / 0", 16);
            hud.BossHpFill = MakeBar(bossRoot.transform, "BossHpFill", new Vector2(0, -50), new Vector2(500, 10), new Color(0.88f, 0.11f, 0.28f));
            bossRoot.SetActive(false);

            return hud;
        }

        private static TMP_Text MakeText(Transform parent, string name, Vector2 anchoredPos, string text, float size)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);

            var rt = go.GetComponent<RectTransform>();
            rt.anchorMin = new Vector2(0f, 1f);
            rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0f, 1f);
            rt.anchoredPosition = anchoredPos;
            rt.sizeDelta = new Vector2(400f, size + 8f);

            var t = go.AddComponent<TextMeshProUGUI>();
            t.text = text;
            t.fontSize = size;
            t.color = Color.white;
            t.alignment = TextAlignmentOptions.TopLeft;
            return t;
        }

        private static Image MakeBar(Transform parent, string name, Vector2 anchoredPos, Vector2 size, Color color)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);

            var rt = go.GetComponent<RectTransform>();
            rt.anchorMin = new Vector2(0f, 0f);
            rt.anchorMax = new Vector2(0f, 0f);
            rt.pivot = new Vector2(0f, 0f);
            rt.anchoredPosition = anchoredPos;
            rt.sizeDelta = size;

            var img = go.AddComponent<Image>();
            img.color = color;
            img.type = Image.Type.Filled;
            img.fillMethod = Image.FillMethod.Horizontal;
            img.fillOrigin = 0;
            img.fillAmount = 1f;
            return img;
        }

        // ==================== Auth panel ====================

        private static AuthScreen BuildAuthPanel()
        {
            var existing = Object.FindObjectOfType<AuthScreen>();
            if (existing != null && existing.GetComponent<Canvas>() != null) return existing;
            if (existing != null)
            {
                Debug.LogWarning("[VerticalSlice] Bỏ AuthScreen không có Canvas: " +
                                 existing.gameObject.name);
                Object.DestroyImmediate(existing);
            }

            var canvasGo = new GameObject("AuthCanvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 100;

            var scaler = canvasGo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1280f, 720f);
            scaler.matchWidthOrHeight = 0.5f;

            var auth = canvasGo.AddComponent<AuthScreen>();

            // Panel nền che toàn màn hình.
            var panel = new GameObject("Panel", typeof(RectTransform), typeof(Image));
            panel.transform.SetParent(canvasGo.transform, false);
            var prt = panel.GetComponent<RectTransform>();
            prt.anchorMin = Vector2.zero;
            prt.anchorMax = Vector2.one;
            prt.offsetMin = Vector2.zero;
            prt.offsetMax = Vector2.zero;
            panel.GetComponent<Image>().color = new Color(0.02f, 0.03f, 0.06f, 0.98f);
            auth.Panel = panel;

            auth.UsernameField = MakeInput(panel.transform, "UsernameField", new Vector2(0, 90), "Tên đăng nhập");
            auth.PasswordField = MakeInput(panel.transform, "PasswordField", new Vector2(0, 30), "Mật khẩu", password: true);

            auth.LoginButton = MakeButton(panel.transform, "LoginButton", new Vector2(0, -40), "Đăng nhập");
            auth.SwitchModeButton = MakeButton(panel.transform, "SwitchModeButton", new Vector2(0, -100), "Chưa có tài khoản? Đăng ký");

            auth.SubmitLabel = MakeText(panel.transform, "SubmitLabel", new Vector2(0, 0), "Đăng nhập", 18);
            auth.SwitchModeLabel = MakeText(panel.transform, "SwitchModeLabel", new Vector2(0, 0), "", 16);
            auth.ErrorText = MakeText(panel.transform, "ErrorText", new Vector2(0, -170), "", 16);
            auth.ErrorText.alignment = TextAlignmentOptions.Center;

            auth.Panel.SetActive(false);
            return auth;
        }

        private static TMP_InputField MakeInput(Transform parent, string name, Vector2 anchoredPos, string placeholder, bool password = false)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image));
            go.transform.SetParent(parent, false);

            var rt = go.GetComponent<RectTransform>();
            rt.anchorMin = new Vector2(0.5f, 0.5f);
            rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = anchoredPos;
            rt.sizeDelta = new Vector2(360f, 46f);

            go.GetComponent<Image>().color = new Color(0.05f, 0.07f, 0.12f, 1f);

            var textGo = new GameObject("Text", typeof(RectTransform));
            textGo.transform.SetParent(go.transform, false);
            var trt = textGo.GetComponent<RectTransform>();
            trt.anchorMin = Vector2.zero;
            trt.anchorMax = Vector2.one;
            trt.offsetMin = new Vector2(10f, 6f);
            trt.offsetMax = new Vector2(-10f, -6f);

            var txt = textGo.AddComponent<TextMeshProUGUI>();
            txt.fontSize = 18f;
            txt.color = Color.white;

            var input = go.AddComponent<TMP_InputField>();
            input.textComponent = txt;
            input.contentType = password ? TMP_InputField.ContentType.Password : TMP_InputField.ContentType.Standard;
            input.lineType = TMP_InputField.LineType.SingleLine;
            return input;
        }

        private static Button MakeButton(Transform parent, string name, Vector2 anchoredPos, string label)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(Button));
            go.transform.SetParent(parent, false);

            var rt = go.GetComponent<RectTransform>();
            rt.anchorMin = new Vector2(0.5f, 0.5f);
            rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = anchoredPos;
            rt.sizeDelta = new Vector2(360f, 46f);

            go.GetComponent<Image>().color = new Color(0.96f, 0.62f, 0.04f, 1f);

            var textGo = new GameObject("Label", typeof(RectTransform));
            textGo.transform.SetParent(go.transform, false);
            var trt = textGo.GetComponent<RectTransform>();
            trt.anchorMin = Vector2.zero;
            trt.anchorMax = Vector2.one;
            trt.offsetMin = Vector2.zero;
            trt.offsetMax = Vector2.zero;

            var txt = textGo.AddComponent<TextMeshProUGUI>();
            txt.text = label;
            txt.fontSize = 18f;
            txt.alignment = TextAlignmentOptions.Center;
            txt.color = new Color(0.11f, 0.1f, 0.09f);

            return go.GetComponent<Button>();
        }

        // ==================== Tiện ích ====================

        private static void EnsureFolder(string path)
        {
            if (AssetDatabase.IsValidFolder(path)) return;
            string parent = Path.GetDirectoryName(path).Replace('\\', '/');
            string leaf = Path.GetFileName(path);
            if (!AssetDatabase.IsValidFolder(parent)) EnsureFolder(parent);
            AssetDatabase.CreateFolder(parent, leaf);
        }
    }
}
