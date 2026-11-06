using System;
using System.Collections;
using System.Collections.Generic;
using Artemis.Domain.Core;
using Artemis.Domain.Persistence;
using UnityEngine;

namespace Artemis.Runtime.Networking
{
    public enum SaveSyncState
    {
        /// <summary>Chưa nạp save từ server — TUYỆT ĐỐI không được ghi.</summary>
        NotReady,
        Idle,
        Saving,
        Saved,
        Conflict,
        Rejected,
        Unauthorized,
        Offline,
    }

    /// <summary>
    /// Đồng bộ save với server, giữ đúng các bảo vệ của bản web.
    ///
    /// Ba bất biến quan trọng nhất (mỗi cái ứng với một lỗi thật đã từng xảy ra):
    ///
    /// 1. <b>Không ghi trước khi đọc xong.</b> Bản web có cờ
    ///    <c>__ARTEMIS_SAVE_READY</c>; ở đây là <see cref="SaveSyncState.NotReady"/>.
    ///    Thiếu bước này, client gửi save rỗng lên tài khoản đã có dữ liệu.
    ///
    /// 2. <b>409 không tự ghi đè.</b> Revision lệch nghĩa là thiết bị khác vừa lưu.
    ///    Ghi tiếp sẽ xoá tiến trình của họ.
    ///
    /// 3. <b>422 không gửi lại mù.</b> Server trả kèm bản ghi hiện tại; phải nạp nó
    ///    thay vì đẩy lại dữ liệu vừa bị từ chối.
    /// </summary>
    public sealed class SaveSyncService
    {
        private readonly ArtemisApiClient _api;

        public SaveSyncState State { get; private set; } = SaveSyncState.NotReady;
        public int Revision { get; private set; }
        public JsonValue ServerData { get; private set; }
        public string LastError { get; private set; }
        public bool HasSaveOnServer { get; private set; }

        /// <summary>Bản save đang làm việc (đã nạp từ server, hoặc save mới của tài khoản mới).</summary>
        public JsonValue Current { get; private set; }

        /// <summary>Số giây chờ giữa hai lần ghi tự động (bản web debounce 1200ms).</summary>
        public float DebounceSeconds = 1.2f;

        private string _lastPushedSignature = string.Empty;
        private float _pendingSince = -1f;

        public event Action<SaveSyncState> StateChanged;
        public event Action<JsonValue> SaveReloaded;

        public SaveSyncService(ArtemisApiClient api)
        {
            _api = api ?? throw new ArgumentNullException(nameof(api));
        }

        private void SetState(SaveSyncState s)
        {
            if (State == s) return;
            State = s;
            StateChanged?.Invoke(s);
        }

        // ==================== ĐỌC ====================

        /// <summary>
        /// GET /api/save. Phải chạy xong TRƯỚC khi cho phép ghi.
        /// Trả về true nếu tài khoản đã có save.
        /// </summary>
        public IEnumerator LoadFromServer(Action<bool> done)
        {
            SetState(SaveSyncState.NotReady);
            yield return _api.GetSave(resp =>
            {
                if (resp.Status == 401)
                {
                    SetState(SaveSyncState.Unauthorized);
                    done?.Invoke(false);
                    return;
                }
                if (resp.IsNetworkFailure || !resp.HasBody)
                {
                    SetState(SaveSyncState.Offline);
                    LastError = resp.IsNetworkFailure ? resp.TransportError : "Phản hồi rỗng";
                    done?.Invoke(false);
                    return;
                }
                if (!resp.Body["ok"].AsBool(false))
                {
                    SetState(SaveSyncState.Offline);
                    LastError = resp.Body["error"].AsString("Không tải được tiến trình.");
                    done?.Invoke(false);
                    return;
                }

                Revision = resp.Body["revision"].AsInt(0);
                HasSaveOnServer = resp.Body["hasSave"].AsBool(false);

                var data = resp.Body["data"];
                if (HasSaveOnServer && data.IsObject)
                {
                    // Đi qua SaveSerializer để áp migrator (thêm default cho save cũ)
                    // — nhưng KHÔNG thêm field ngoài whitelist của server.
                    var parsed = SaveSerializer.Load(Json.Write(data));
                    Current = parsed.Ok ? parsed.Data : data;
                    ServerData = Current;
                    _lastPushedSignature = Signature(Current);
                }
                else
                {
                    // Tài khoản mới: save khởi tạo, KHÔNG phải bản sao của ai khác.
                    Current = JsonValue.Object();
                    ServerData = null;
                    _lastPushedSignature = string.Empty;
                }

                SetState(SaveSyncState.Idle);
                done?.Invoke(HasSaveOnServer);
            });
        }

        // ==================== GHI ====================

        /// <summary>
        /// Đánh dấu có thay đổi. Lần ghi thật diễn ra sau <see cref="DebounceSeconds"/>
        /// — gọi hàm này bao nhiêu lần cũng được, giống <c>SaveState.save()</c> của web.
        /// </summary>
        public void MarkDirty()
        {
            if (State == SaveSyncState.NotReady) return;   // bảo vệ #1
            _pendingSince = Time.realtimeSinceStartup;
        }

        public void Tick()
        {
            if (_pendingSince < 0) return;
            if (Time.realtimeSinceStartup - _pendingSince < DebounceSeconds) return;
            _pendingSince = -1f;
            PushNow(null);
        }

        /// <summary>Ghi ngay (bỏ qua debounce) — dùng khi kết thúc trận, khi rời tab.</summary>
        public void PushNow(Action<SaveSyncState> done)
        {
            CoroutineRunner.Run(PushRoutine(done));
        }

        private IEnumerator PushRoutine(Action<SaveSyncState> done)
        {
            // Bảo vệ #1: chưa nạp xong thì không ghi.
            if (State == SaveSyncState.NotReady)
            {
                Debug.LogWarning("[SaveSync] Từ chối ghi: chưa nạp save từ server.");
                done?.Invoke(State);
                yield break;
            }
            if (State == SaveSyncState.Unauthorized)
            {
                done?.Invoke(State);
                yield break;
            }

            var payload = Current ?? JsonValue.Object();

            // Không có gì đổi thì không gọi mạng (bản web dùng hash).
            string sig = Signature(payload);
            if (sig == _lastPushedSignature && State == SaveSyncState.Saved)
            {
                done?.Invoke(State);
                yield break;
            }

            if (!SaveSerializer.IsWithinServerLimit(payload, out int bytes))
            {
                LastError = "Tiến trình quá lớn (" + bytes + " byte).";
                SetState(SaveSyncState.Rejected);
                done?.Invoke(State);
                yield break;
            }

            SetState(SaveSyncState.Saving);

            for (int attempt = 0; ; attempt++)
            {
                ApiResponse captured = default;
                bool got = false;
                yield return _api.PutSave(payload, Revision, r => { captured = r; got = true; });

                if (!got)
                {
                    SetState(SaveSyncState.Offline);
                    done?.Invoke(State);
                    yield break;
                }

                // Lỗi mạng: có thể thử lại.
                if (captured.IsNetworkFailure)
                {
                    if (attempt < 2)
                    {
                        yield return new WaitForSecondsRealtime((float)SavePushPolicy.RetryDelaySeconds(attempt));
                        continue;
                    }
                    LastError = captured.TransportError;
                    SetState(SaveSyncState.Offline);
                    done?.Invoke(State);
                    yield break;
                }

                var decision = SavePushPolicy.Interpret(captured.Status, captured.Body);

                if (decision.Ok)
                {
                    Revision = decision.ServerRevision;
                    _lastPushedSignature = sig;
                    HasSaveOnServer = true;
                    LastError = null;
                    SetState(SaveSyncState.Saved);
                    done?.Invoke(State);
                    yield break;
                }

                // ---- 401: phiên hết hạn. KHÔNG xoá save cục bộ. ----
                if (captured.Status == 401)
                {
                    LastError = "Phiên đăng nhập đã hết hạn.";
                    SetState(SaveSyncState.Unauthorized);
                    done?.Invoke(State);
                    yield break;
                }

                // ---- 409: xung đột. KHÔNG ghi đè. ----
                if (decision.Conflict && captured.Status == 409)
                {
                    Revision = decision.ServerRevision;
                    LastError = "Tiến trình đã thay đổi ở thiết bị khác.";
                    SetState(SaveSyncState.Conflict);
                    done?.Invoke(State);
                    yield break;
                }

                // ---- 422: server từ chối (kinh tế / mùa giải). Nạp lại bản server. ----
                if (captured.Status == 422)
                {
                    if (decision.ServerData != null)
                    {
                        Current = decision.ServerData;
                        ServerData = decision.ServerData;
                        Revision = decision.ServerRevision;
                        _lastPushedSignature = Signature(Current);
                        SaveReloaded?.Invoke(Current);
                    }
                    LastError = decision.ErrorMessage ?? "Tiến trình không hợp lệ, chưa được lưu.";
                    SetState(SaveSyncState.Rejected);
                    done?.Invoke(State);
                    yield break;
                }

                // ---- 429 / 5xx: thử lại có backoff. ----
                if (SavePushPolicy.ShouldRetry(captured.Status, attempt))
                {
                    yield return new WaitForSecondsRealtime((float)SavePushPolicy.RetryDelaySeconds(attempt));
                    continue;
                }

                LastError = decision.ErrorMessage ?? ("Lưu thất bại (HTTP " + captured.Status + ").");
                SetState(SaveSyncState.Offline);
                done?.Invoke(State);
                yield break;
            }
        }

        /// <summary>
        /// Người chơi chọn "tải lại từ máy chủ" sau xung đột.
        /// </summary>
        public IEnumerator ReloadFromServer(Action<bool> done)
        {
            _pendingSince = -1f;
            yield return LoadFromServer(done);
        }

        private static string Signature(JsonValue v)
        {
            // Băm nội dung để so "có đổi không" — không cần mật mã, chỉ cần ổn định.
            string text = Json.Write(v);
            unchecked
            {
                uint h = 5381;
                foreach (char c in text) h = (h << 5) + h + c;
                return h.ToString("X8") + ":" + text.Length;
            }
        }
    }

    /// <summary>
    /// Chạy coroutine từ nơi không phải MonoBehaviour (service thuần).
    /// Được GameBootstrap tạo và giữ sống suốt phiên.
    /// </summary>
    public sealed class CoroutineRunner : MonoBehaviour
    {
        private static CoroutineRunner _instance;

        public static void EnsureExists()
        {
            if (_instance != null) return;
            var go = new GameObject("[Artemis.CoroutineRunner]");
            _instance = go.AddComponent<CoroutineRunner>();
            DontDestroyOnLoad(go);
        }

        public static void Run(IEnumerator routine)
        {
            EnsureExists();
            _instance.StartCoroutine(routine);
        }

        private void Awake()
        {
            if (_instance != null && _instance != this)
            {
                Destroy(gameObject);
                return;
            }
            _instance = this;
            DontDestroyOnLoad(gameObject);
        }
    }
}
