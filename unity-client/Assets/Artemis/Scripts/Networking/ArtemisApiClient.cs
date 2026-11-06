using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using Artemis.Domain.Core;
using Artemis.Domain.Persistence;
using UnityEngine;
using UnityEngine.Networking;

namespace Artemis.Runtime.Networking
{
    /// <summary>Kết quả một lời gọi HTTP.</summary>
    public struct ApiResponse
    {
        public int Status;
        public string RawBody;
        public JsonValue Body;
        public string TransportError;

        public bool HasBody => Body != null && Body.IsObject;
        public bool IsNetworkFailure => !string.IsNullOrEmpty(TransportError);
        public bool IsOk => Status >= 200 && Status < 300;
    }

    /// <summary>
    /// Client của backend Artemis hiện có.
    ///
    /// KHÔNG có endpoint mới, KHÔNG có logic xác thực riêng phía client:
    /// <list type="bullet">
    /// <item>GET  /api/auth/me</item>
    /// <item>POST /api/auth/login</item>
    /// <item>POST /api/auth/register</item>
    /// <item>POST /api/auth/logout</item>
    /// <item>GET  /api/save</item>
    /// <item>PUT  /api/save</item>
    /// </list>
    ///
    /// XÁC THỰC: dùng cookie phiên do server đặt. Trên WebGL chạy CÙNG ORIGIN với
    /// API thì cookie hoạt động như web. Trên Android, UnityWebRequest không đọc
    /// được cookie HttpOnly — đó là lý do Android đang bị CHẶN cho tới khi có
    /// phương án xác thực được phê duyệt (xem docs/unity-migration/SOURCE_AUDIT.md §3).
    ///
    /// Bí mật JWT và chuỗi kết nối MongoDB KHÔNG BAO GIỜ xuất hiện ở client.
    /// </summary>
    public sealed class ArtemisApiClient
    {
        private readonly string _baseUrl;
        private readonly UnityWebRequestCookieJar _cookies;

        public ArtemisApiClient(string baseUrl)
        {
            _baseUrl = (baseUrl ?? string.Empty).TrimEnd('/');
            // Cookie jar chỉ có tác dụng trên nền tảng cho phép (WebGL/Editor).
            // Android phải chờ phương án xác thực riêng.
            _cookies = new UnityWebRequestCookieJar();
        }

        public string BaseUrl => _baseUrl;

        // ==================== AUTH ====================

        public IEnumerator GetMe(Action<ApiResponse> done) =>
            Send("GET", "/api/auth/me", null, done);

        public IEnumerator Login(string username, string password, Action<ApiResponse> done)
        {
            // Cùng giới hạn với cloud.js để thông báo lỗi khớp bản web.
            if (string.IsNullOrEmpty(username) || username.Trim().Length < 3)
            {
                done?.Invoke(FakeLocalError("Tên đăng nhập phải có ít nhất 3 ký tự."));
                yield break;
            }
            if (string.IsNullOrEmpty(password) || password.Length < 8)
            {
                done?.Invoke(FakeLocalError("Mật khẩu phải có ít nhất 8 ký tự."));
                yield break;
            }
            var body = JsonValue.Object().Set("username", username.Trim()).Set("password", password);
            yield return Send("POST", "/api/auth/login", Json.Write(body), done);
        }

        public IEnumerator Register(string username, string password, Action<ApiResponse> done)
        {
            if (string.IsNullOrEmpty(username) || username.Trim().Length < 3)
            {
                done?.Invoke(FakeLocalError("Tên đăng nhập phải có ít nhất 3 ký tự."));
                yield break;
            }
            if (string.IsNullOrEmpty(password) || password.Length < 8)
            {
                done?.Invoke(FakeLocalError("Mật khẩu phải có ít nhất 8 ký tự."));
                yield break;
            }
            var body = JsonValue.Object().Set("username", username.Trim()).Set("password", password);
            yield return Send("POST", "/api/auth/register", Json.Write(body), done);
        }

        public IEnumerator Logout(Action<ApiResponse> done) =>
            Send("POST", "/api/auth/logout", "{}", done);

        // ==================== SAVE ====================

        /// <summary>GET /api/save — trả {hasSave, data, revision, updatedAt}.</summary>
        public IEnumerator GetSave(Action<ApiResponse> done) =>
            Send("GET", "/api/save", null, done);

        /// <summary>
        /// PUT /api/save — gửi kèm revision để server phát hiện xung đột.
        ///
        /// KHÔNG được gọi trước khi GetSave thành công: gửi một save rỗng lên một
        /// tài khoản đã có dữ liệu sẽ ghi đè tiến trình (đúng lý do bản web có cờ
        /// __ARTEMIS_SAVE_READY).
        /// </summary>
        public IEnumerator PutSave(JsonValue data, int revision, Action<ApiResponse> done)
        {
            var payload = JsonValue.Object()
                .Set("data", data ?? JsonValue.Object())
                .Set("revision", revision);
            yield return Send("PUT", "/api/save", Json.Write(payload), done);
        }

        // ==================== Hạ tầng ====================

        private IEnumerator Send(string method, string path, string jsonBody, Action<ApiResponse> done)
        {
            string url = _baseUrl + path;
            using (var req = new UnityWebRequest(url, method))
            {
                req.downloadHandler = new DownloadHandlerBuffer();
                if (!string.IsNullOrEmpty(jsonBody))
                {
                    byte[] bytes = Encoding.UTF8.GetBytes(jsonBody);
                    req.uploadHandler = new UploadHandlerRaw(bytes);
                    req.SetRequestHeader("Content-Type", "application/json");
                }
                req.SetRequestHeader("Accept", "application/json");
                _cookies.ApplyTo(req);

                yield return req.SendWebRequest();

                _cookies.CaptureFrom(req);

                var resp = new ApiResponse
                {
                    Status = (int)req.responseCode,
                    RawBody = req.downloadHandler != null ? req.downloadHandler.text : null,
                };

                if (req.result != UnityWebRequest.Result.Success && req.responseCode == 0)
                {
                    // Lỗi mạng thật (không phải HTTP status).
                    resp.TransportError = req.error;
                    done?.Invoke(resp);
                    yield break;
                }

                resp.Body = string.IsNullOrEmpty(resp.RawBody) ? JsonValue.Object() : Json.TryParse(resp.RawBody);
                if (resp.Body == null) resp.Body = JsonValue.Object();
                done?.Invoke(resp);
            }
        }

        private static ApiResponse FakeLocalError(string message)
        {
            var body = JsonValue.Object().Set("ok", false).Set("error", message);
            return new ApiResponse { Status = 0, Body = body, RawBody = Json.Write(body) };
        }
    }

    /// <summary>
    /// Giữ cookie phiên cho các nền tảng hỗ trợ.
    ///
    /// Chỉ là lớp mỏng: trên WebGL, trình duyệt tự quản cookie nên đây không làm gì
    /// (và không cần làm gì). Trên Editor/Standalone, <c>UnityWebRequest</c> có thể
    /// giữ cookie nếu ta chuyển tiếp chúng.
    ///
    /// Android: cố ý KHÔNG giả lập xác thực ở đây. Xem cảnh báo trong
    /// <see cref="ArtemisApiClient"/>.
    /// </summary>
    public sealed class UnityWebRequestCookieJar
    {
        private readonly Dictionary<string, string> _cookies = new Dictionary<string, string>(StringComparer.Ordinal);

        public void ApplyTo(UnityWebRequest req)
        {
            if (_cookies.Count == 0) return;
            var sb = new StringBuilder();
            foreach (var kv in _cookies)
            {
                if (sb.Length > 0) sb.Append("; ");
                sb.Append(kv.Key).Append('=').Append(kv.Value);
            }
            req.SetRequestHeader("Cookie", sb.ToString());
        }

        public void CaptureFrom(UnityWebRequest req)
        {
            // UnityWebRequest không expose Set-Cookie dễ dùng trên mọi nền tảng;
            // trên WebGL trình duyệt tự xử lý. Giữ hàm này để chỗ gọi không phải
            // rẽ nhánh theo nền tảng, và để sau này cắm logic native vào một chỗ.
            var header = req.GetResponseHeader("Set-Cookie");
            if (string.IsNullOrEmpty(header)) return;

            int semi = header.IndexOf(';');
            string pair = semi >= 0 ? header.Substring(0, semi) : header;
            int eq = pair.IndexOf('=');
            if (eq <= 0) return;
            string name = pair.Substring(0, eq).Trim();
            string value = pair.Substring(eq + 1).Trim();
            if (name.Length == 0) return;
            if (value.Length == 0) _cookies.Remove(name);
            else _cookies[name] = value;
        }

        public void Clear() => _cookies.Clear();
    }
}
