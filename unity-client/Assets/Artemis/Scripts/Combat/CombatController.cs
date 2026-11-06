using System;
using System.Collections.Generic;
using Artemis.Domain.Core;
using Artemis.Domain.Stats;
using Artemis.Runtime.Characters;
using UnityEngine;

namespace Artemis.Runtime.Combat
{
    /// <summary>
    /// Cơ chế "dừng để bắn" — linh hồn của Archero, và là thứ dễ bị làm sai nhất
    /// khi port sang engine khác.
    ///
    /// Bản web (updateGame, dòng 28312):
    /// <code>
    /// attackCooldown -= dt;
    /// if (attackCooldown &lt;= 0 &amp;&amp; enemies.length &gt; 0) {
    ///   fireVolley();
    ///   attackCooldown = 1 / (aspd * lokiBoost * alexBoost * helixBoost);
    /// }
    /// </code>
    /// Nhánh này CHỈ chạy khi người chơi ĐỨNG YÊN. Chỉ Thor (và
    /// <c>weapon_enchantment</c>) mới bắn được khi đang chạy, ở một nhánh riêng.
    ///
    /// Ở đây tách phần quyết định (pure, test được) khỏi phần sinh đạn (Unity).
    /// </summary>
    public sealed class CombatController : MonoBehaviour
    {
        [Header("Tham chiếu")]
        public PlayerStatsBehaviour Player;

        /// <summary>Đạn được sinh ở đây (do WeaponController cài vào).</summary>
        public Action<Vector2, Vector2> OnFire;   // (origin, direction)

        [Header("Trạng thái (chỉ đọc)")]
        [SerializeField] private float attackCooldown;

        public double LastCooldownUsed { get; private set; }
        public int ShotsFired { get; private set; }

        /// <summary>Số quái còn sống — do RoomController cập nhật.</summary>
        public int LiveEnemyCount { get; set; }

        /// <summary>Hướng ngắm hiện tại (về phía quái gần nhất, hoặc hướng mặt).</summary>
        public Vector2 AimDirection { get; set; } = Vector2.up;

        private void Awake()
        {
            if (Player == null) Player = GetComponent<PlayerStatsBehaviour>();
        }

        /// <summary>
        /// Tính cooldown cho lần bắn kế tiếp, kèm các booster tạm thời.
        /// Tách riêng để test so được với công thức JS mà không cần chạy frame.
        /// </summary>
        public static double ComputeCooldown(double aspd, bool lokiFocus, bool alexCritAspd, bool helixLowHp)
        {
            if (aspd <= 0) aspd = 1.0;
            double lokiBoost = lokiFocus ? 1.30 : 1.0;
            double alexBoost = alexCritAspd ? 1.15 : 1.0;
            double helixBoost = helixLowHp ? 1.25 : 1.0;
            return 1.0 / (aspd * lokiBoost * alexBoost * helixBoost);
        }

        /// <summary>
        /// Một bước logic. Trả về true nếu vừa bắn.
        ///
        /// <paramref name="isMoving"/> KHÔNG bắn nếu true — trừ khi hero bắn được
        /// khi di chuyển (Thor / weapon_enchantment), khi đó dùng cùng nhịp.
        /// </summary>
        public bool Tick(float dt, bool isMoving, bool canFireWhileMoving)
        {
            if (Player == null || Player.Combat == null) return false;

            double aspd = Player.Aspd;
            var combat = Player.Combat;

            double lokiFocus = combat.HasSkill("loki") ? 1.0 : 0.0;
            bool alexCritAspd = combat.HasSkill("alex");
            bool helixLowHp = combat.HasSkill("helix") && combat.Hp < combat.MaxHp * 0.5;

            bool shouldTick = !isMoving || canFireWhileMoving;
            if (!shouldTick)
            {
                // Đứng yên mới tích cooldown; đang chạy mà không có Thor thì không bắn.
                // Bản web: nhánh di chuyển KHÔNG trừ cooldown (trừ khi Thor).
                return false;
            }

            attackCooldown -= dt;
            if (attackCooldown > 0) return false;
            if (LiveEnemyCount <= 0) return false;

            double cd = ComputeCooldown(aspd, lokiFocus > 0, alexCritAspd, helixLowHp);
            LastCooldownUsed = cd;
            attackCooldown = (float)cd;

            ShotsFired++;
            Vector2 dir = AimDirection.sqrMagnitude > 0.0001f ? AimDirection.normalized : Vector2.up;
            OnFire?.Invoke(transform.position, dir);
            return true;
        }

        public void ResetCooldown(float value = 0.25f)
        {
            attackCooldown = value;
        }

        public float CooldownRemaining => attackCooldown;
    }
}
