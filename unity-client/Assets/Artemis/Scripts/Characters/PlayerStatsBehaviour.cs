using System;
using System.Collections.Generic;
using Artemis.Domain.Combat;
using Artemis.Domain.Core;
using Artemis.Domain.Stats;
using Artemis.Runtime.Core;
using UnityEngine;

namespace Artemis.Runtime.Characters
{
    /// <summary>
    /// Giữ trạng thái sống của người chơi trong lượt và nối vào domain.
    ///
    /// Không tự tính công thức nào: mọi con số đi qua
    /// <see cref="PlayerStatsCalculator"/> (khi dựng) và
    /// <see cref="IncomingDamageCalculator"/> / <see cref="DamageCalculator"/> (khi
    /// chiến đấu). Đây là điều kiện để test parity ở domain có giá trị — nếu
    /// MonoBehaviour tự tính lại, test domain sẽ xanh trong khi game vẫn sai.
    /// </summary>
    public sealed class PlayerStatsBehaviour : MonoBehaviour
    {
        [Header("Chỉ số đã tính (chỉ đọc)")]
        [SerializeField] private long baseAtk;
        [SerializeField] private long baseHp;
        [SerializeField] private double baseAspd;
        [SerializeField] private double baseCrit;
        [SerializeField] private double critDmgMult;
        [SerializeField] private long defFlat;
        [SerializeField] private double dmgReduction;

        public PlayerStats Stats { get; private set; }
        public CombatantState Combat { get; private set; }

        public long Atk => Stats?.BaseAtk ?? 0;
        public long MaxHp => Stats?.BaseHp ?? 0;
        public double Hp => Combat?.Hp ?? 0;
        public double Aspd => Stats?.BaseAspd ?? 1.0;
        public bool IsDead => Combat != null && Combat.Hp <= 0;

        public event Action<double, double> HpChanged;   // (hp, maxHp)
        public event Action Died;

        /// <summary>RNG của lượt — tiêm từ ngoài để test và replay được.</summary>
        public IRandomSource Rng { get; set; } = new SeededRandom(1);

        /// <summary>Trang bị rune hộ vệ (giảm 15% sát thương nhận vào).</summary>
        public bool GuardianRuneEquipped { get; set; }
        /// <summary>Rune Valkyrie (hồi sinh 50% HP, +20% ATK).</summary>
        public bool ValkyrieRuneEquipped { get; set; }

        /// <summary>Dựng lại chỉ số từ save — tương đương lúc vào trận ở bản web.</summary>
        public void ApplyStats(PlayerStats stats, IRandomSource rng = null)
        {
            Stats = stats ?? throw new ArgumentNullException(nameof(stats));
            if (rng != null) Rng = rng;

            baseAtk = stats.BaseAtk;
            baseHp = stats.BaseHp;
            baseAspd = stats.BaseAspd;
            baseCrit = stats.BaseCrit;
            critDmgMult = stats.CritDmgMult;
            defFlat = stats.DefFlat;
            dmgReduction = stats.DmgReduction;

            Combat = new CombatantState
            {
                Hp = stats.BaseHp,
                MaxHp = stats.BaseHp,
                Atk = stats.BaseAtk,
                CritRate = stats.BaseCrit,
                CritDmgMult = stats.CritDmgMult,
                DmgReduction = stats.DmgReduction,
                GearDodge = stats.GearDodge,
                HeroId = stats.HeroId,
            };

            HpChanged?.Invoke(Combat.Hp, Combat.MaxHp);
        }

        /// <summary>Nhận sát thương — đi qua pipeline 9 bước của domain.</summary>
        public IncomingResult TakeDamage(double amount)
        {
            if (Combat == null) return default;

            var r = IncomingDamageCalculator.Resolve(Combat, amount, Rng, GuardianRuneEquipped, ValkyrieRuneEquipped);
            HpChanged?.Invoke(Combat.Hp, Combat.MaxHp);
            if (r.Lethal) Died?.Invoke();
            return r;
        }

        public void Heal(double amount)
        {
            if (Combat == null) return;
            Combat.Hp = Math.Min(Combat.MaxHp, Combat.Hp + Math.Max(0, amount));
            HpChanged?.Invoke(Combat.Hp, Combat.MaxHp);
        }

        public void TickTimers(float dt)
        {
            if (Combat == null) return;
            if (Combat.InvulnTimer > 0) Combat.InvulnTimer -= dt;
            if (Combat.WoundedWarriorTimer > 0) Combat.WoundedWarriorTimer -= dt;
        }

        public void GrantSkill(string skillId, int tier = 1)
        {
            if (Combat == null || string.IsNullOrEmpty(skillId)) return;
            Combat.Skills[skillId] = Mathf.Max(1, tier);
        }

        private void Update()
        {
            TickTimers(TimeStep.Delta);
        }
    }
}
