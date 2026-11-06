using System;
using System.Collections.Generic;
using Artemis.Domain.Progression;
using Artemis.Domain.Spawning;
using Artemis.Runtime.Characters;
using Artemis.Runtime.Combat;
using Artemis.Runtime.Enemies;
using UnityEngine;

namespace Artemis.Runtime.Dungeons
{
    /// <summary>
    /// Điều khiển một phòng: sinh quái, theo dõi dọn phòng, tiến phòng, thắng/thua.
    ///
    /// Ranh giới với <see cref="RunSession"/>: session giữ SỐ LIỆU, controller giữ
    /// ĐỐI TƯỢNG Unity. Khi retry, session được dựng lại còn scene được dọn —
    /// không có đường nào để controller vô tình ghi vào dữ liệu nhân vật.
    /// </summary>
    public sealed class RoomController : MonoBehaviour
    {
        [Header("Tham chiếu")]
        public RunSession Session;
        public PlayerStatsBehaviour Player;
        public CombatController Combat;
        public Transform PlayerTransform;
        public EnemyController EnemyPrefab;
        public Transform EnemyParent;

        [Header("Sân (world units)")]
        public Rect PlayArea = new Rect(0.6f, 0.6f, 11.6f, 6.0f);

        public readonly List<EnemyController> Enemies = new List<EnemyController>();

        public event Action<int, int> RoomChanged;          // (room, maxRooms)
        public event Action RoomCleared;
        public event Action<bool> RunFinished;              // victory
        public event Action<RunReward> Rewarded;

        private bool _finished;

        public bool RoomClearedFlag => Session != null && Session.RoomCleared;

        /// <summary>Dựng phòng hiện tại của session.</summary>
        public void BuildCurrentRoom()
        {
            if (Session == null || Player == null) return;

            ClearEnemies();
            _finished = false;

            var specs = Session.SpawnCurrentRoom();
            var rng = new System.Random(Session.SessionId * 7919 + Session.Room);

            foreach (var spec in specs)
            {
                var prefab = EnemyPrefab;
                if (prefab == null)
                {
                    Debug.LogError("[RoomController] Thiếu EnemyPrefab.");
                    return;
                }

                var e = Instantiate(prefab, EnemyParent != null ? EnemyParent : transform);
                e.name = spec.Type + (spec.IsBoss ? " [BOSS]" : "");
                e.Configure(spec);
                e.Target = PlayerTransform;

                // Vị trí: bản web random trong vùng trên của sân. Vị trí là TRÌNH BÀY,
                // không phải hợp đồng parity — nhưng vẫn để seed tất định để test
                // PlayMode ổn định.
                float x = PlayArea.xMin + (float)rng.NextDouble() * PlayArea.width;
                float y = PlayArea.yMin + PlayArea.height * 0.55f + (float)rng.NextDouble() * PlayArea.height * 0.4f;
                e.transform.position = new Vector3(x, y, 0f);

                e.Died += OnEnemyDied;
                e.Attacked += OnEnemyAttacked;
                Enemies.Add(e);
            }

            if (Combat != null) Combat.LiveEnemyCount = Enemies.Count;
            RoomChanged?.Invoke(Session.Room, Session.MaxRooms);
        }

        public void ClearEnemies()
        {
            foreach (var e in Enemies)
            {
                if (e == null) continue;
                e.Died -= OnEnemyDied;
                e.Attacked -= OnEnemyAttacked;
                Destroy(e.gameObject);
            }
            Enemies.Clear();
            if (Combat != null) Combat.LiveEnemyCount = 0;
        }

        private void OnEnemyAttacked(EnemyController enemy, double atk)
        {
            if (Player == null || Player.IsDead) return;
            Session.LastDamageSource = enemy.IsBoss ? "boss" : "enemy";
            var result = Player.TakeDamage(atk);
            Session.LastDamageAmount = result.Damage;
            if (result.Lethal) FinishRun(false);
        }

        private void OnEnemyDied(EnemyController enemy)
        {
            Enemies.Remove(enemy);
            if (Combat != null) Combat.LiveEnemyCount = Enemies.Count;
            Session?.AddKill();

            // Thưởng rơi: bản web cho XP 22 (boss 35), vàng 12 (boss 28).
            // Cộng thẳng để slice chạy được; drop vật phẩm là phase sau.
            long gold = enemy.IsBoss ? 28 : 12;
            Session?.AddGold(gold);

            if (Enemies.Count == 0) OnRoomCleared();
        }

        [Header("Chuyển phòng")]
        [Tooltip("Tự sang phòng kế sau khi dọn sạch (giây). 0 hoặc âm = chờ gọi thủ công.")]
        public float AutoAdvanceDelay = 1.2f;

        private float _clearDelay = -1f;

        private void OnRoomCleared()
        {
            if (_finished) return;
            Session.RoomCleared = true;
            RoomCleared?.Invoke();

            if (Session.Room >= Session.MaxRooms)
            {
                FinishRun(true);
                return;
            }

            if (AutoAdvanceDelay > 0f) _clearDelay = AutoAdvanceDelay;
        }

        private void Update()
        {
            if (_clearDelay < 0f) return;
            _clearDelay -= Time.deltaTime;
            if (_clearDelay > 0f) return;

            _clearDelay = -1f;
            GoToNextRoom();
        }

        /// <summary>Sang phòng kế (gọi từ portal / nút UI).</summary>
        public bool GoToNextRoom()
        {
            if (Session == null || _finished) return false;
            if (!Session.RoomCleared) return false;
            if (!Session.AdvanceRoom()) return false;

            // Hồi máu từ talent Healer khi chuyển phòng.
            int healer = 0;
            long heal = RunSession.HealerHealOnRoomChange(Player.MaxHp, healer, Session.Room);
            if (heal > 0) Player.Heal(heal);

            BuildCurrentRoom();
            return true;
        }

        public void FinishRun(bool victory)
        {
            if (_finished) return;
            _finished = true;
            Session.RoomCleared = victory;

            var reward = RewardService.For(victory, Session.ChapterId, Session.Room);
            Session.AddGold(reward.Gold);

            Rewarded?.Invoke(reward);
            RunFinished?.Invoke(victory);
        }
    }
}
