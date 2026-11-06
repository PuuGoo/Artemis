using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Artemis.EditorTools
{
    /// <summary>
    /// Chạy vertical slice setup ở chế độ batchmode: mở scene, gọi
    /// <see cref="VerticalSliceSetup.SetupAll"/>, lưu scene, thoát.
    ///
    /// Vì sao cần entry point riêng: <c>VerticalSliceSetup</c> được thiết kế cho
    /// người dùng bấm menu (có hộp thoại). Batchmode không có ai bấm OK, nên hộp
    /// thoại sẽ treo. Hàm này gọi phần logic thuần và bỏ phần UI.
    ///
    /// Chạy:
    ///   Unity.exe -batchmode -quit -projectPath &lt;proj&gt; \
    ///     -executeMethod Artemis.EditorTools.BatchSetup.Run
    /// </summary>
    public static class BatchSetup
    {
        public const string ScenePath = "Assets/Artemis/Scenes/Bootstrap.unity";

        /// <summary>Entry point cho -executeMethod.</summary>
        public static void Run()
        {
            try
            {
                Setup();
                EditorApplication.Exit(0);
            }
            catch (System.Exception e)
            {
                Debug.LogError("[BatchSetup] THẤT BẠI: " + e);
                EditorApplication.Exit(1);
            }
        }

        private static void Setup()
        {
            // Mở scene trước, nếu không GameObject được tạo sẽ nằm ở scene rỗng.
            var scene = EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
            if (!scene.IsValid())
                throw new System.Exception("Không mở được scene: " + ScenePath);

            Debug.Log("[BatchSetup] Đã mở scene: " + scene.name);

            VerticalSliceSetup.SetupAll();

            EditorSceneManager.MarkSceneDirty(scene);
            bool saved = EditorSceneManager.SaveScene(scene, ScenePath);
            Debug.Log("[BatchSetup] Lưu scene: " + saved);

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            Verify();
        }

        /// <summary>Kiểm tra lại sau khi dựng — nếu thiếu thì log rõ, không báo thành công giả.</summary>
        private static void Verify()
        {
            int problems = 0;

            void Check(string what, Object obj)
            {
                if (obj == null) { Debug.LogError("[BatchSetup] THIẾU: " + what); problems++; }
                else Debug.Log("[BatchSetup] OK: " + what);
            }

            Check("Prefabs/Projectile.prefab",
                AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Artemis/Prefabs/Projectile.prefab"));
            Check("Prefabs/Enemy.prefab",
                AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Artemis/Prefabs/Enemy.prefab"));

            var boot = Object.FindObjectOfType<Artemis.Runtime.Core.GameBootstrap>();
            Check("GameBootstrap", boot);
            if (boot != null)
            {
                Check("GameBootstrap.PlayerController", boot.PlayerController);
                Check("GameBootstrap.PlayerStats", boot.PlayerStats);
                Check("GameBootstrap.Combat", boot.Combat);
                Check("GameBootstrap.Room", boot.Room);
                Check("GameBootstrap.PlayerProjectiles", boot.PlayerProjectiles);
                Check("GameBootstrap.Hud", boot.Hud);
                Check("GameBootstrap.Auth", boot.Auth);
            }

            var room = Object.FindObjectOfType<Artemis.Runtime.Dungeons.RoomController>();
            Check("RoomController", room);
            if (room != null) Check("RoomController.EnemyPrefab", room.EnemyPrefab);

            if (problems > 0)
                throw new System.Exception("Còn " + problems + " tham chiếu thiếu.");
        }
    }
}
