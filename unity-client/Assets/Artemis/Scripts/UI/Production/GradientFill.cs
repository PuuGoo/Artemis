using UnityEngine;
using UnityEngine.UI;

namespace Artemis.Runtime.UI.Production
{
    /// <summary>
    /// Tô nền bằng gradient 2 màu chéo — dùng cho các class như gold-gradient,
    /// epic-gradient, bg-gradient-to-b from-slate-900 to-slate-950.
    ///
    /// Vì sao cần component riêng: Unity <see cref="Image"/> chỉ tô một màu phẳng.
    /// Gradient trong production là đặc trưng nhận diện mạnh nhất (gold gắn với độ
    /// hiếm, slate tối gắn với panel), nên bỏ qua sẽ làm UI lệch hẳn.
    ///
    /// Cách làm: sinh một Texture2D 2×2 với 4 góc màu, cho Image dùng Sprite tạo
    /// từ đó, kéo giãn toàn ô. Rẻ và không cần shader.
    /// </summary>
    [RequireComponent(typeof(Image))]
    public sealed class GradientFill : MonoBehaviour
    {
        public Color TopLeft = Color.white;
        public Color TopRight = Color.white;
        public Color BottomLeft = Color.white;
        public Color BottomRight = Color.white;

        [Tooltip("Bật để tự cập nhật khi đổi màu trong Inspector (chậm hơn).")]
        public bool LiveUpdate;

        private Image _image;
        private Sprite _sprite;
        private Color _lastHash;

        private void Awake() => Apply();

        private void OnValidate()
        {
            if (LiveUpdate) Apply();
        }

        public void SetVertical(Color top, Color bottom)
        {
            TopLeft = TopRight = top;
            BottomLeft = BottomRight = bottom;
            Apply();
        }

        public void SetColors(Color a, Color b)
        {
            TopLeft = a;
            BottomRight = b;
            TopRight = Color.Lerp(a, b, 0.5f);
            BottomLeft = Color.Lerp(a, b, 0.5f);
            Apply();
        }

        public void Apply()
        {
            if (_image == null) _image = GetComponent<Image>();

            // 2x2, point filter, không wrap: rẻ và đúng cho gradient phẳng.
            var tex = new Texture2D(2, 2, TextureFormat.RGBA32, false)
            {
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp,
            };

            // Texture2D gốc toạ độ (0,0) ở dưới-trái.
            tex.SetPixel(0, 0, BottomLeft);
            tex.SetPixel(1, 0, BottomRight);
            tex.SetPixel(0, 1, TopLeft);
            tex.SetPixel(1, 1, TopRight);
            tex.Apply(false, false);

            var rect = new Rect(0f, 0f, 2f, 2f);
            if (_sprite != null)
            {
                if (Application.isPlaying) Destroy(_sprite.texture);
                else DestroyImmediate(_sprite.texture);
                if (Application.isPlaying) Destroy(_sprite);
                else DestroyImmediate(_sprite);
            }

            _sprite = Sprite.Create(tex, rect, new Vector2(0.5f, 0.5f), 100f, 0,
                SpriteMeshType.FullRect);
            _image.sprite = _sprite;
            _image.type = Image.Type.Simple;
            _image.color = Color.white;
        }

        private void OnDestroy()
        {
            if (_sprite == null) return;
            if (_sprite.texture != null) Destroy(_sprite.texture);
            Destroy(_sprite);
        }
    }
}
