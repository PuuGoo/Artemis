// ==================== STUB API UNITY (CHỈ ĐỂ KIỂM TRA BIÊN DỊCH) ====================
// Máy phát triển này KHÔNG có Unity Editor, nên không thể build thật. File này
// khai báo đúng những thành viên UnityEngine mà mã runtime sử dụng, để
// `dotnet build` phát hiện lỗi cú pháp / sai kiểu / thiếu using.
//
// GIỚI HẠN PHẢI NÓI RÕ: stub này KHÔNG chứng minh mã chạy đúng trong Unity.
// Nó chỉ chứng minh mã biên dịch được. Hành vi thật (vật lý, coroutine, UI,
// WebGL) chỉ kiểm chứng được bằng Unity Editor — việc đó bị chặn ở đây.
//
// Stub KHÔNG được đưa vào build Unity: nó nằm ngoài Assets/, trong project
// Artemis.Domain.UnityStub chỉ dùng cho CI.
using System;
using System.Collections;
using System.Collections.Generic;

namespace UnityEngine
{
    public struct Vector2
    {
        public float x, y;
        public Vector2(float x, float y) { this.x = x; this.y = y; }
        public float sqrMagnitude => x * x + y * y;
        public float magnitude => (float)Math.Sqrt(sqrMagnitude);
        public Vector2 normalized { get { float m = magnitude; return m > 0 ? new Vector2(x / m, y / m) : new Vector2(0, 0); } }
        public static Vector2 zero => new Vector2(0, 0);
        public static Vector2 one => new Vector2(1, 1);
        public static Vector2 up => new Vector2(0, 1);
        public static Vector2 down => new Vector2(0, -1);
        public static Vector2 right => new Vector2(1, 0);
        public static Vector2 left => new Vector2(-1, 0);
        public static Vector2 operator +(Vector2 a, Vector2 b) => new Vector2(a.x + b.x, a.y + b.y);
        public static Vector2 operator -(Vector2 a, Vector2 b) => new Vector2(a.x - b.x, a.y - b.y);
        public static Vector2 operator *(Vector2 a, float f) => new Vector2(a.x * f, a.y * f);
        public static implicit operator Vector2(Vector3 v) => new Vector2(v.x, v.y);
        public static implicit operator Vector3(Vector2 v) => new Vector3(v.x, v.y, 0);
    }

    public struct Vector3
    {
        public float x, y, z;
        public Vector3(float x, float y, float z) { this.x = x; this.y = y; this.z = z; }
        public static Vector3 operator +(Vector3 a, Vector3 b) => new Vector3(a.x + b.x, a.y + b.y, a.z + b.z);
    }

    public struct Quaternion
    {
        public static Quaternion Euler(float x, float y, float z) => new Quaternion();
    }

    public struct Color
    {
        public float r, g, b, a;
        public Color(float r, float g, float b) { this.r = r; this.g = g; this.b = b; a = 1f; }
        public Color(float r, float g, float b, float a) { this.r = r; this.g = g; this.b = b; this.a = a; }
        public static Color white => new Color(1, 1, 1, 1);
        public static Color black => new Color(0, 0, 0, 1);
        public static Color red => new Color(1, 0, 0, 1);
    }

    public struct Rect
    {
        public float x, y, width, height;
        public Rect(float x, float y, float w, float h) { this.x = x; this.y = y; width = w; height = h; }
        public float xMin => x;
        public float yMin => y;
        public float xMax => x + width;
        public float yMax => y + height;
        public Vector2 center => new Vector2(x + width / 2, y + height / 2);
        public Vector2 size => new Vector2(width, height);
    }

    public static class Mathf
    {
        public const float Deg2Rad = 0.0174532924f;
        public const float Rad2Deg = 57.29578f;
        public static float Min(float a, float b) => a < b ? a : b;
        public static float Max(float a, float b) => a > b ? a : b;
        public static int Max(int a, int b) => a > b ? a : b;
        public static int Min(int a, int b) => a < b ? a : b;
        public static float Clamp(float v, float lo, float hi) => v < lo ? lo : (v > hi ? hi : v);
        public static float Clamp01(float v) => Clamp(v, 0f, 1f);
        public static float Abs(float v) => Math.Abs(v);
        public static int CeilToInt(float v) => (int)Math.Ceiling(v);
        public static int FloorToInt(float v) => (int)Math.Floor(v);
        public static int RoundToInt(float v) => (int)Math.Round(v);
        public static float MoveTowards(float a, float b, float d) => a < b ? Min(a + d, b) : Max(a - d, b);
        public static float Atan2(float y, float x) => (float)Math.Atan2(y, x);
        public static float Sqrt(float v) => (float)Math.Sqrt(v);
        public static float Pow(float a, float b) => (float)Math.Pow(a, b);
    }

    public class Object
    {
        public string name;
        public static void Destroy(Object o) { }
        public static void DestroyImmediate(Object o) { }
        public static void DontDestroyOnLoad(Object o) { }
        public static T Instantiate<T>(T original) where T : Object => original;
        public static T Instantiate<T>(T original, Transform parent) where T : Object => original;
        public static T FindObjectOfType<T>() where T : Object => null;
        public static T[] FindObjectsOfType<T>() where T : Object => new T[0];
        public static implicit operator bool(Object o) => !ReferenceEquals(o, null);
        public static bool operator ==(Object a, Object b) => ReferenceEquals(a, b);
        public static bool operator !=(Object a, Object b) => !ReferenceEquals(a, b);
        public override bool Equals(object o) => ReferenceEquals(this, o);
        public override int GetHashCode() => base.GetHashCode();
        public int GetInstanceID() => base.GetHashCode();
    }

    public class Component : Object
    {
        public Transform transform { get; } = new Transform();
        public GameObject gameObject { get; } = new GameObject();
        public T GetComponent<T>() where T : class => null;
    }

    public class Behaviour : Component { public bool enabled; }
    public class MonoBehaviour : Behaviour
    {
        public Coroutine StartCoroutine(IEnumerator r) => new Coroutine();
        public void StopCoroutine(Coroutine c) { }
        public static void print(object o) { }
    }
    public class Coroutine { }
    public class Transform : Component
    {
        public Vector3 position;
        public Quaternion rotation;
        public Transform parent;
        public Transform Find(string n) => null;
        public void SetParent(Transform p, bool worldPositionStays) { parent = p; }
    }
    public class GameObject : Object
    {
        public GameObject() { }
        public GameObject(string n) { name = n; }
        public GameObject(string n, params Type[] components) { name = n; }
        public bool activeSelf;
        public Transform transform { get; } = new Transform();
        public void SetActive(bool v) { activeSelf = v; }
        public T AddComponent<T>() where T : Component, new() => new T();
        public T GetComponent<T>() where T : class => null;
        public static GameObject Find(string n) => null;
    }

    public class Rigidbody2D : Component
    {
        public RigidbodyType2D bodyType;
        public bool simulated;
        public Vector2 position;
        public void MovePosition(Vector2 p) { position = p; }
    }

    public enum RigidbodyType2D { Dynamic, Kinematic, Static }

    public class Collider2D : Component { }

    public static class Physics2D
    {
        public static Collider2D OverlapCircle(Vector2 p, float r, int mask) => null;
    }

    public static class Time
    {
        public static float deltaTime => 0.016f;
        public static float realtimeSinceStartup => 0f;
        public static float unscaledDeltaTime => 0.016f;
    }

    public static class Debug
    {
        public static void Log(object o) { Console.WriteLine("[Log] " + o); }
        public static void LogWarning(object o) { Console.WriteLine("[Warn] " + o); }
        public static void LogError(object o) { Console.WriteLine("[Error] " + o); }
    }

    public class WaitForSecondsRealtime : IEnumerator
    {
        public WaitForSecondsRealtime(float seconds) { }
        public object Current => null;
        public bool MoveNext() => true;
        public void Reset() { }
    }

    public class WaitForSeconds : IEnumerator
    {
        public WaitForSeconds(float seconds) { }
        public object Current => null;
        public bool MoveNext() => true;
        public void Reset() { }
    }

    public class TextAsset : Object { public string text; }

    public static class Resources
    {
        public static T Load<T>(string path) where T : Object => null;
    }

    public static class Gizmos
    {
        public static Color color;
        public static void DrawWireCube(Vector3 center, Vector3 size) { }
        public static void DrawWireSphere(Vector3 center, float r) { }
    }

    public static class Application
    {
        public static bool isPlaying => true;
    }

    // ---------- Attributes ----------
    [AttributeUsage(AttributeTargets.Field)] public class SerializeField : Attribute { }
    [AttributeUsage(AttributeTargets.Field)] public class HeaderAttribute : Attribute { public HeaderAttribute(string h) { } }
    [AttributeUsage(AttributeTargets.Field)] public class TooltipAttribute : Attribute { public TooltipAttribute(string t) { } }
    [AttributeUsage(AttributeTargets.Class)] public class RequireComponent : Attribute { public RequireComponent(Type t) { } }
    [AttributeUsage(AttributeTargets.Field)] public class RangeAttribute : Attribute { public RangeAttribute(float a, float b) { } }

    public static class CustomYieldInstruction { }

    public struct LayerMask
    {
        private int _value;
        public static implicit operator int(LayerMask m) => m._value;
        public static implicit operator LayerMask(int v) => new LayerMask { _value = v };
    }
}

namespace UnityEngine.Networking
{
    public class DownloadHandler : IDisposable
    {
        public string text;
        public byte[] data;
        public void Dispose() { }
    }

    public class DownloadHandlerBuffer : DownloadHandler { }

    public class UploadHandler : IDisposable
    {
        public void Dispose() { }
    }

    public class UploadHandlerRaw : UploadHandler
    {
        public UploadHandlerRaw(byte[] body) { }
    }

    public enum UnityWebRequestResult { InProgress, Success, ConnectionError, ProtocolError, DataProcessingError }

    public class UnityWebRequestAsyncOperation : IEnumerator
    {
        public object Current => null;
        public bool MoveNext() => false;
        public void Reset() { }
    }

    public class UnityWebRequest : IDisposable
    {
        public UnityWebRequest(string url, string method) { this.url = url; this.method = method; }
        public string url;
        public string method;
        public DownloadHandler downloadHandler;
        public UploadHandler uploadHandler;
        public long responseCode;
        public string error;
        public Result result;
        public void SetRequestHeader(string name, string value) { }
        public string GetResponseHeader(string name) => null;
        public UnityWebRequestAsyncOperation SendWebRequest() => new UnityWebRequestAsyncOperation();
        public void Dispose() { }

        public enum Result { InProgress, Success, ConnectionError, ProtocolError, DataProcessingError }
    }
}

namespace UnityEngine.UI
{
    public class Image : UnityEngine.Behaviour
    {
        public float fillAmount;
        public UnityEngine.Color color;
        public Type type;
        public FillMethod fillMethod;
        public int fillOrigin;
        public enum Type { Simple, Sliced, Tiled, Filled }
        public enum FillMethod { Horizontal, Vertical, Radial90, Radial180, Radial360 }
    }
    public class Button : UnityEngine.Behaviour
    {
        public bool interactable;
        public ButtonClickedEvent onClick { get; } = new ButtonClickedEvent();
        public class ButtonClickedEvent { public void AddListener(Action a) { } }
    }

    public class Canvas : UnityEngine.Behaviour
    {
        public RenderMode renderMode;
        public int sortingOrder;
    }

    public class CanvasScaler : UnityEngine.Behaviour
    {
        public ScaleMode uiScaleMode;
        public UnityEngine.Vector2 referenceResolution;
        public float matchWidthOrHeight;
        public enum ScaleMode { ConstantPixelSize, ScaleWithScreenSize, ConstantPhysicalSize }
    }

    public class GraphicRaycaster : UnityEngine.Behaviour { }
}

public enum RenderMode { ScreenSpaceOverlay, ScreenSpaceCamera, WorldSpace }

namespace UnityEngine
{
    public class RectTransform : Transform
    {
        public Vector2 anchorMin, anchorMax, pivot, anchoredPosition, sizeDelta, offsetMin, offsetMax;
    }
    public class Sprite : Object { }
    public class Texture2D : Object
    {
        public Texture2D(int w, int h, TextureFormat fmt, bool mip) { }
        public void SetPixel(int x, int y, Color c) { }
        public void Apply() { }
        public byte[] EncodeToPNG() => new byte[0];
    }
    public enum TextureFormat { RGBA32 }
    public enum TextureImporterType { Sprite }
    public enum FilterMode { Point, Bilinear, Trilinear }
    public class SpriteRenderer : Component { public Sprite sprite; public int sortingOrder; }
    public class CircleCollider2D : Collider2D { public bool isTrigger; public float radius; }
}

namespace UnityEditor
{
    public static class AssetDatabase
    {
        public static void SaveAssets() { }
        public static void Refresh() { }
        public static bool IsValidFolder(string p) => false;
        public static string CreateFolder(string parent, string name) => "";
        public static void DeleteAsset(string p) { }
        public static void ImportAsset(string p) { }
        public static T LoadAssetAtPath<T>(string p) where T : UnityEngine.Object => null;
    }
    public class AssetImporter : UnityEngine.Object
    {
        public static AssetImporter GetAtPath(string p) => null;
        public void SaveAndReimport() { }
    }
    public class TextureImporter : AssetImporter
    {
        public UnityEditor.TextureImporterType textureType;
        public float spritePixelsPerUnit;
        public UnityEngine.FilterMode filterMode;
    }
    public enum TextureImporterType { Sprite }
    public static class PrefabUtility
    {
        public static UnityEngine.GameObject SaveAsPrefabAsset(UnityEngine.GameObject go, string path) => go;
    }
    public static class EditorUtility
    {
        public static bool DisplayDialog(string t, string m, string ok) => true;
        public static void SetDirty(UnityEngine.Object o) { }
    }
    public static class EditorApplication { public static bool isPlaying => false; }
    public class MenuItem : System.Attribute { public MenuItem(string path) { } }
}

namespace UnityEditor.SceneManagement
{
    public static class EditorSceneManager
    {
        public static UnityEngine.SceneManagement.Scene GetActiveScene() => new UnityEngine.SceneManagement.Scene();
        public static void MarkSceneDirty(UnityEngine.SceneManagement.Scene s) { }
    }
}

namespace UnityEngine.SceneManagement
{
    public struct Scene { }
}

namespace UnityEngine.InputSystem
{
    public class KeyControl { public bool isPressed; }
    public class Keyboard
    {
        public static Keyboard current => null;
        public KeyControl wKey, aKey, sKey, dKey, upArrowKey, downArrowKey, leftArrowKey, rightArrowKey;
    }
}

namespace TMPro
{
    public enum TextAlignmentOptions { TopLeft, Top, TopRight, Left, Center, Right, BottomLeft, Bottom, BottomRight }

    public class TMP_Text : UnityEngine.Behaviour
    {
        public string text;
        public float fontSize;
        public UnityEngine.Color color;
        public TextAlignmentOptions alignment;
    }

    public class TextMeshProUGUI : TMP_Text { }

    public class TMP_InputField : UnityEngine.Behaviour
    {
        public string text;
        public TMP_Text textComponent;
        public ContentType contentType;
        public LineType lineType;
        public enum ContentType { Standard, Password, IntegerNumber, DecimalNumber, Alphanumeric, Name, EmailAddress }
        public enum LineType { SingleLine, MultiLineNewline, MultiLineSubmit }
    }
}
