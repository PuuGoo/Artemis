using System;
using System.Collections;
using Artemis.Domain.Core;
using Artemis.Domain.Persistence;
using Artemis.Domain.Stats;
using Artemis.Runtime.Characters;
using Artemis.Runtime.Combat;
using Artemis.Runtime.Dungeons;
using Artemis.Runtime.Enemies;
using Artemis.Runtime.Networking;
using UnityEngine;

namespace Artemis.Runtime.Core
{
    /// <summary>
    /// Điểm vào duy nhất của bản Unity.
    ///
    /// Trình tự BẮT BUỘC (giống hệt bản web, và mỗi bước đều có lý do):
    /// <list type="number">
    /// <item>Nạp dữ liệu tĩnh (sinh từ index.html). Thiếu file thì dừng hẳn —
    ///       chạy tiếp với 0 hero chỉ tạo màn hình trắng khó chẩn đoán.</item>
    /// <item>GET /api/auth/me. Chưa đăng nhập thì hiện cổng.</item>
    /// <item>GET /api/save. <b>Chưa xong bước này thì không được ghi.</b></item>
    /// <item>Tính chỉ số bằng domain, dựng phiên, dựng phòng.</item>
    /// </list>
    ///
    /// Không có bước nào tự ghi save khi chưa qua bước 3 — đó là bảo vệ chống ghi
    /// đè tiến trình người chơi bằng một save rỗng.
    /// </summary>
    public sealed class GameBootstrap : MonoBehaviour
    {
        [Header("Mạng")]
        [Tooltip("Để trống = cùng origin (bắt buộc cho WebGL để cookie phiên hoạt động).")]
        public string ApiBaseUrl = "";

        [Header("Tham chiếu scene")]
        public PlayerController PlayerController;
        public PlayerStatsBehaviour PlayerStats;
        public CombatController Combat;
        public RoomController Room;
        public ProjectilePool PlayerProjectiles;
        public ProjectilePool EnemyProjectiles;
        public UI.CombatHud Hud;
        public UI.AuthScreen Auth;

        [Header("Cấu hình trận")]
        public int StartChapterId = 1;
        public int StartChapterIdx = 0;

        [Header("Gỡ lỗi")]
        [Tooltip("Bỏ qua xác thực và chạy bằng save cục bộ — CHỈ dùng để thử trong Editor.")]
        public bool OfflineTestMode;

        public SaveSyncService SaveSync { get; private set; }
        public ArtemisApiClient Api { get; private set; }
        public RunSession Session { get; private set; }
        public Artemis.Domain.GameData.GameData Data { get; private set; }

        public bool IsReady { get; private set; }
        public string LastError { get; private set; }

        private void Awake()
        {
            CoroutineRunner.EnsureExists();
            Api = new ArtemisApiClient(ApiBaseUrl);
            SaveSync = new SaveSyncService(Api);
        }

        private void Start()
        {
            StartCoroutine(BootRoutine());
        }

        private IEnumerator BootRoutine()
        {
            // ---- 1. Dữ liệu tĩnh ----
            try
            {
                Data = Persistence.GameDataProvider.Data;
            }
            catch (Exception e)
            {
                LastError = e.Message;
                Debug.LogError("[Bootstrap] Không nạp được dữ liệu game.\n" + e.Message);
                yield break;
            }

            if (OfflineTestMode)
            {
                SaveSync.GetType();   // giữ API thống nhất
                yield return StartOfflineRun(JsonValue.Object());
                yield break;
            }

            // ---- 2. Xác thực ----
            bool authenticated = false;
            yield return Api.GetMe(r =>
            {
                authenticated = r.HasBody && r.Body["authenticated"].AsBool(false);
                if (r.IsNetworkFailure)
                    LastError = "Không kết nối được máy chủ: " + r.TransportError;
            });

            if (!authenticated)
            {
                if (Auth != null) Auth.Show(Api, OnAuthenticated);
                else Debug.LogWarning("[Bootstrap] Chưa đăng nhập và không có AuthScreen.");
                yield break;
            }

            // ---- 3. Nạp save (BẮT BUỘC trước khi cho ghi) ----
            bool hadSave = false;
            yield return SaveSync.LoadFromServer(h => hadSave = h);

            if (SaveSync.State == SaveSyncState.Unauthorized)
            {
                if (Auth != null) Auth.Show(Api, OnAuthenticated);
                yield break;
            }
            if (SaveSync.State != SaveSyncState.Idle && SaveSync.State != SaveSyncState.Saved)
            {
                // Không nạp được save: KHÔNG vào trận với dữ liệu trắng, vì mọi lần
                // ghi sau đó sẽ đẩy save rỗng lên tài khoản thật.
                LastError = SaveSync.LastError ?? "Không tải được tiến trình.";
                Debug.LogError("[Bootstrap] " + LastError);
                yield break;
            }

            yield return StartOfflineRun(SaveSync.Current);
        }

        private void OnAuthenticated()
        {
            StartCoroutine(AfterAuthRoutine());
        }

        private IEnumerator AfterAuthRoutine()
        {
            if (Auth != null) Auth.Hide();
            bool hadSave = false;
            yield return SaveSync.LoadFromServer(h => hadSave = h);
            if (SaveSync.State != SaveSyncState.Idle && SaveSync.State != SaveSyncState.Saved) yield break;
            yield return StartOfflineRun(SaveSync.Current);
        }

        /// <summary>
        /// Dựng một trận từ save. Tên giữ là "offline" vì hàm này không đụng mạng —
        /// nó chỉ dựng scene. Dùng cho cả luồng online (sau khi đã nạp save).
        /// </summary>
        private IEnumerator StartOfflineRun(JsonValue save)
        {
            var input = StatsInput.FromSave(save);

            Session = RunSession.Begin(Data, input, StartChapterId, StartChapterIdx, ChapterRooms(StartChapterId), EnemyScale(StartChapterId));

            if (PlayerStats != null)
            {
                PlayerStats.Rng = new SeededRandom((ulong)(Session.SessionId * 2654435761u + 1));
                PlayerStats.ApplyStats(Session.Stats, PlayerStats.Rng);
                PlayerStats.Died += () => Room.FinishRun(false);
            }

            if (Combat != null)
            {
                Combat.Player = PlayerStats;
                Combat.OnFire = FireVolley;
            }

            if (PlayerProjectiles != null)
                PlayerProjectiles.GetComponent<ProjectilePool>();

            if (Room != null)
            {
                Room.Session = Session;
                Room.Player = PlayerStats;
                Room.Combat = Combat;
                Room.PlayerTransform = PlayerController != null ? PlayerController.transform : null;
                Room.RunFinished += OnRunFinished;
                Room.BuildCurrentRoom();
            }

            if (Hud != null)
            {
                Hud.Player = PlayerStats;
                Hud.Session = Session;
                Hud.Room = Room;
            }

            IsReady = true;
            yield return null;
        }

        private void FireVolley(Vector2 origin, Vector2 direction)
        {
            if (PlayerProjectiles == null || Session?.Stats == null) return;

            // Tốc độ đạn: bản web dùng projSpeed * 60 px/giây. Đổi sang world units
            // bằng cách chia 100 để giữ tỉ lệ sân 1280x720.
            double speed = WeaponProjSpeed(Session.Stats.WeaponId) / 100.0;
            PlayerProjectiles.Get(origin, direction, Session.Stats.BaseAtk, (float)speed, isEnemy: false);
        }

        private double WeaponProjSpeed(string weaponId)
        {
            var w = Data.Weapons.Get(weaponId);
            double projSpeed = w.IsNull ? 10.5 : w["projSpeed"].AsNumber(10.5);
            return projSpeed * 60.0;
        }

        private int ChapterRooms(int chapterId)
        {
            var ch = Data.Chapter(chapterId);
            return ch.IsNull ? 15 : ch["rooms"].AsInt(15);
        }

        private double EnemyScale(int chapterId)
        {
            var ch = Data.Chapter(chapterId);
            return ch.IsNull ? 1.0 : ch["enemyScale"].AsNumber(1.0);
        }

        private void OnRunFinished(bool victory)
        {
            // Kết thúc trận: cộng thưởng vào save rồi đẩy lên server (không chờ debounce).
            if (SaveSync == null) return;
            var save = SaveSync.Current ?? JsonValue.Object();

            if (victory)
            {
                save.Set("gold", save["gold"].AsNumber(0) + Session.RunGold);
                var wins = save["winsByChapter"];
                if (!wins.IsObject) { wins = JsonValue.Object(); save.Set("winsByChapter", wins); }
                string key = Session.ChapterId.ToString();
                wins.Set(key, wins[key].AsNumber(0) + 1);
            }
            else
            {
                save.Set("gold", save["gold"].AsNumber(0) + Session.RunGold);
            }

            SaveSync.MarkDirty();
            SaveSync.PushNow(null);
        }

        private void Update()
        {
            if (!IsReady) return;

            // Combat chỉ bắn khi đứng yên (trừ Thor / weapon_enchantment).
            if (Combat != null && PlayerController != null && PlayerStats?.Combat != null)
            {
                bool canFireWhileMoving =
                    PlayerStats.Combat.HasSkill("thor") || PlayerStats.Combat.HasSkill("weapon_enchantment");
                Combat.Tick(TimeStep.Delta, PlayerController.IsMoving, canFireWhileMoving);
            }

            SaveSync?.Tick();
        }
    }
}
