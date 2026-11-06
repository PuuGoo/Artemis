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
        public static Vector2 up => new Vector2(0, 1);
        public static Vector2 down => new Vector2(0, -1);
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
        public static void DontDestroyOnLoad(Object o) { }
        public static T Instantiate<T>(T original) where T : Object => original;
        public static T Instantiate<T>(T original, Transform parent) where T : Object => original;
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
    public class Transform : Component { public Vector3 position; public Quaternion rotation; }
    public class GameObject : Object
    {
        public GameObject() { }
        public GameObject(string n) { name = n; }
        public bool activeSelf;
        public void SetActive(bool v) { activeSelf = v; }
        public T AddComponent<T>() where T : Component, new() => new T();
        public T GetComponent<T>() where T : class => null;
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
    }
    public class Button : UnityEngine.Behaviour
    {
        public bool interactable;
        public ButtonClickedEvent onClick { get; } = new ButtonClickedEvent();
        public class ButtonClickedEvent { public void AddListener(Action a) { } }
    }
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
    public class TMP_Text : UnityEngine.Behaviour { public string text; }
    public class TMP_InputField : UnityEngine.Behaviour { public string text; }
}
