using System.IO;
using UnityEditor;
using UnityEngine;

namespace Artemis.EditorTools
{
    /// <summary>
    /// Ép toàn bộ ảnh trích từ production thành Sprite để UI dùng được.
    ///
    /// Vì sao cần: ảnh .jpg import mặc định là Texture (không dùng được cho Image).
    /// Production nhúng ảnh dạng data URI nên chưa từng có .meta; script này đặt
    /// textureType = Sprite, spriteMode = Single, rồi reimport.
    ///
    /// Chạy: -executeMethod Artemis.EditorTools.ImportUiSprites.Run
    /// </summary>
    public static class ImportUiSprites
    {
        private const string Dir = "Assets/Artemis/Resources/ArtemisUi/Images";

        public static void Run()
        {
            try
            {
                int n = Apply();
                Debug.Log("[ImportUiSprites] OK: " + n + " ảnh");
                EditorApplication.Exit(0);
            }
            catch (System.Exception e)
            {
                Debug.LogError("[ImportUiSprites] THẤT BẠI: " + e);
                EditorApplication.Exit(1);
            }
        }

        [MenuItem("Artemis/UI/0. Import ảnh production thành Sprite")]
        public static void Menu() => Apply();

        private static int Apply()
        {
            if (!Directory.Exists(Dir))
            {
                Debug.LogWarning("[ImportUiSprites] Không thấy thư mục " + Dir +
                                 " — chạy node tools/unity-ui/extract-images.mjs trước.");
                return 0;
            }

            var files = Directory.GetFiles(Dir, "*.*", SearchOption.TopDirectoryOnly);
            int changed = 0;

            foreach (var abs in files)
            {
                var ext = Path.GetExtension(abs).ToLowerInvariant();
                if (ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".webp") continue;

                // Thư mục cố định, nên đường dẫn asset suy ra trực tiếp.
                var assetPath = Dir + "/" + Path.GetFileName(abs);

                var importer = AssetImporter.GetAtPath(assetPath) as TextureImporter;
                if (importer == null)
                {
                    // Chưa có meta -> import lần đầu rồi lấy lại.
                    AssetDatabase.ImportAsset(assetPath, ImportAssetOptions.ForceUpdate);
                    importer = AssetImporter.GetAtPath(assetPath) as TextureImporter;
                }
                if (importer == null)
                {
                    Debug.LogWarning("[ImportUiSprites] Không lấy được importer: " + assetPath);
                    continue;
                }

                importer.textureType = TextureImporterType.Sprite;
                importer.spriteImportMode = SpriteImportMode.Single;
                importer.mipmapEnabled = false;
                importer.alphaIsTransparency = true;
                // UI không cần nén mất dữ liệu; giữ chất lượng để khớp production.
                importer.textureCompression = TextureImporterCompression.Uncompressed;

                importer.SaveAndReimport();
                changed++;
                Debug.Log("[ImportUiSprites] " + assetPath + " -> Sprite");
            }

            AssetDatabase.Refresh();
            return changed;
        }
    }
}
