using System;
using System.Collections.Generic;
using Artemis.Domain.Core;
using Artemis.Domain.Stats;

namespace Artemis.Domain.Combat
{
    /// <summary>Ảnh chụp trạng thái player mà công thức sát thương cần.</summary>
    public sealed class CombatantState
    {
        public double Hp;
        public double MaxHp;
        public double Atk;
        public double CritRate;
        public double CritDmgMult = 1.85;
        public double DmgReduction;
        public double GearDodge;
        public double InvulnTimer;

        /// <summary>Kỹ năng đang có trong lượt: id -> bậc (&gt; 0 = đang bật).</summary>
        public readonly Dictionary<string, int> Skills = new Dictionary<string, int>(StringComparer.Ordinal);

        public string HeroId;

        // ---- Cờ trạng thái tạm thời ----
        public bool AlexNextGuaranteedCrit;
        public double WoundedWarriorTimer;
        public double DarkShieldHp;
        public int SacredShieldStacks;
        public bool RuneValkyrieReviveUsed;
        public bool ReviveSkillUsed;
        public bool MymuOverdrawUsed;

        public bool HasSkill(string id) => id != null && Skills.TryGetValue(id, out int lv) && lv > 0;

        public CombatantState Clone()
        {
            var c = (CombatantState)MemberwiseClone();
            return c;
        }
    }

    /// <summary>Trạng thái quái tối thiểu để tính sát thương.</summary>
    public sealed class EnemyState
    {
        public double Hp;
        public double MaxHp;
        public bool IsBoss;
        public string Type;
        public double Atk;

        // Cờ hiệu ứng đang chịu
        public bool ArtemisMarked;
        public bool CorrosiveVulnerable;

        public bool IsDead => Hp <= 0;
    }

    public struct DamageRequest
    {
        public double RawDamage;
        /// <summary>Sát thương nguyên tố: KHÔNG bao giờ crit, KHÔNG kích hoạt on-hit hero passive.</summary>
        public bool IsElemental;
    }

    public struct DamageResult
    {
        public double FinalDamage;
        public bool IsCrit;
        public double HeroDmgMult;
        public double MarkMult;
        /// <summary>Crit xảy ra và đòn này đã tiêu cờ Alex (nếu có).</summary>
        public bool ConsumedGuaranteedCrit;
    }

    /// <summary>
    /// Bản port của <c>damageEnemy()</c> (public/index.html:27663).
    ///
    /// Chỉ tính PHẦN LÕI: crit roll, hero multiplier, mark multiplier, làm tròn.
    /// Các passive "on-hit" (Oracle combo, Cleo burn, Rolla freeze, Otta execute,
    /// Phynx bleed, Dracoola lifesteal, set passive) được trả về dưới dạng quyết
    /// định riêng để nơi gọi áp dụng — đúng như bản JS, nơi chúng cộng thẳng vào
    /// e.hp SAU finalDmg chứ không nhân vào công thức.
    /// </summary>
    public static class DamageCalculator
    {
        public static DamageResult Resolve(CombatantState player, EnemyState enemy, DamageRequest req, IRandomSource rng)
        {
            if (player == null) throw new ArgumentNullException(nameof(player));
            if (enemy == null) throw new ArgumentNullException(nameof(enemy));
            if (rng == null) throw new ArgumentNullException(nameof(rng));

            var result = new DamageResult();
            if (enemy.Hp <= 0) return result;

            // ---- 1. Crit roll ----
            bool ottaActive = player.HasSkill("otta");
            double enemyHpRatio = enemy.MaxHp > 0 ? enemy.Hp / enemy.MaxHp : 1.0;
            double bonusCritFromHero = (ottaActive && enemyHpRatio > 0.6 ? 0.18 : 0)
                                     + (player.AlexNextGuaranteedCrit ? 1.0 : 0);

            if (player.AlexNextGuaranteedCrit && !req.IsElemental)
            {
                player.AlexNextGuaranteedCrit = false;
                result.ConsumedGuaranteedCrit = true;
            }

            bool isCrit = !req.IsElemental && rng.NextDouble() < (player.CritRate + bonusCritFromHero);
            result.IsCrit = isCrit;

            // ---- 2. Hero damage multiplier ----
            double heroDmgMult = 1.0;
            if (player.HasSkill("helix"))
                heroDmgMult += (1.0 - Math.Max(0, player.Hp / Math.Max(1, player.MaxHp))) * 0.28;
            if (player.HasSkill("dracoola") && player.Hp >= player.MaxHp * 0.95)
                heroDmgMult += 0.40;
            if (player.HasSkill("hou_yi"))
                heroDmgMult += 0.16;
            if (player.HasSkill("wukong"))
                heroDmgMult += 0.14;
            result.HeroDmgMult = heroDmgMult;

            double rawDmg = req.RawDamage * heroDmgMult;

            // ---- 3. Mark / vulnerability multiplier ----
            double markMult = (enemy.ArtemisMarked ? 1.25 : 1.0)
                            * (enemy.CorrosiveVulnerable ? 1.35 : 1.0)
                            * (enemy.IsBoss && player.HasSkill("boss_slayer") ? 1.25 : 1.0)
                            * (player.WoundedWarriorTimer > 0 ? 1.50 : 1.0)
                            * (player.HasSkill("perilous_fervor") && player.Hp < player.MaxHp * 0.5 ? 1.30 : 1.0);
            result.MarkMult = markMult;

            // ---- 4. Artemis marks the target AFTER the multiplier is read ----
            if (player.HeroId == "artemis") enemy.ArtemisMarked = true;

            // ---- 5. Final, rounded like JS ----
            result.FinalDamage = JsMath.Round(rawDmg * (isCrit ? player.CritDmgMult : 1.0) * markMult);
            return result;
        }

        /// <summary>
        /// Áp dụng kết quả lên quái, kèm các quyết định on-hit mà bản JS thực hiện
        /// ngay trong damageEnemy. Trả về các sự kiện để tầng trình bày phát VFX.
        /// </summary>
        public static List<string> Apply(CombatantState player, EnemyState enemy, DamageResult result)
        {
            var events = new List<string>();
            if (enemy.Hp <= 0) return events;

            enemy.Hp -= result.FinalDamage;

            // Otta [Brutality]: crit trên quái không phải boss còn < 30% HP -> trảm sát.
            if (player.HasSkill("otta") && result.IsCrit && !enemy.IsBoss && enemy.Hp > 0
                && enemy.MaxHp > 0 && (enemy.Hp / enemy.MaxHp) < 0.30)
            {
                enemy.Hp = 0;
                events.Add("otta_execute");
            }

            return events;
        }
    }

    public struct IncomingResult
    {
        public double Damage;
        public bool Dodged;
        public bool BlockedBySacredShield;
        public bool AbsorbedByDarkShield;
        public bool Lethal;
        public bool RevivedByValkyrie;
        public bool RevivedBySkill;
        public bool RevivedByMymu;
    }

    /// <summary>
    /// Bản port của <c>hurtPlayer()</c> (public/index.html:29208).
    ///
    /// THỨ TỰ LÀ HỢP ĐỒNG. Mỗi bước giảm trừ làm tròn và kẹp <c>max(1, …)</c>
    /// riêng, nên gộp chúng thành một phép nhân sẽ ra số khác. Đó là lý do mỗi
    /// bước dưới đây giữ nguyên hình dạng.
    /// </summary>
    public static class IncomingDamageCalculator
    {
        public static IncomingResult Resolve(CombatantState player, double incoming, IRandomSource rng,
            bool guardianRuneEquipped, bool valkyrieRuneEquipped = false)
        {
            if (player == null) throw new ArgumentNullException(nameof(player));
            var r = new IncomingResult();
            double dmg = incoming;

            // 1. Bất tử tạm thời
            if (player.InvulnTimer > 0) { r.Damage = 0; return r; }

            // 2. Né đòn.
            // Bản JS: min(0.55, skills.hermes_boots * 0.15 + gearDodge).
            double herm = player.Skills.TryGetValue("hermes_boots", out int hb) ? hb * 0.15 : 0;
            double dodgeChance = Math.Min(0.55, herm + player.GearDodge);

            if (rng.NextDouble() < dodgeChance)
            {
                r.Dodged = true;
                r.Damage = 0;
                player.InvulnTimer = 0.45;
                return r;
            }

            // 3. DEF
            if (player.DmgReduction > 0)
                dmg = Math.Max(1, JsMath.Round(dmg * (1.0 - player.DmgReduction)));

            // 4. Guardian rune -15%
            if (guardianRuneEquipped)
                dmg = Math.Max(1, JsMath.Round(dmg * 0.85));

            // 5. Wukong -18%
            if (player.HasSkill("wukong"))
                dmg = Math.Max(1, JsMath.Round(dmg * 0.82));

            // 6. Alex: đòn kế tiếp chắc chắn crit
            if (player.HasSkill("alex"))
                player.AlexNextGuaranteedCrit = true;

            // 7. Sacred Protection: chặn hoàn toàn 1 đòn
            if (player.SacredShieldStacks > 0)
            {
                player.SacredShieldStacks--;
                player.InvulnTimer = 0.85;
                r.BlockedBySacredShield = true;
                r.Damage = 0;
                return r;
            }

            // 8. Wounded Warrior: +50% ATK 5s khi mất máu
            if (player.HasSkill("wounded_warrior"))
                player.WoundedWarriorTimer = 5.0;

            // 9. Dark Shield hấp thụ trước
            if (player.DarkShieldHp > 0)
            {
                double absorbed = Math.Min(player.DarkShieldHp, dmg);
                player.DarkShieldHp -= absorbed;
                dmg -= absorbed;
                r.AbsorbedByDarkShield = true;
                if (dmg <= 0)
                {
                    player.InvulnTimer = 0.45;
                    r.Damage = 0;
                    return r;
                }
            }

            // 10. Trừ máu, không bao giờ âm
            player.Hp -= dmg;
            if (player.Hp < 0) player.Hp = 0;
            player.InvulnTimer = 0.65;
            r.Damage = dmg;

            if (player.Hp > 0) return r;

            // 11. Chuỗi hồi sinh — đúng thứ tự của bản JS.
            // Rune Valkyrie (isRuneEquipped('rune_valkyrie')) được truyền vào qua
            // tham số riêng vì nó là trạng thái trang bị rune, không phải skill.
            if (valkyrieRuneEquipped && !player.RuneValkyrieReviveUsed)
            {
                player.RuneValkyrieReviveUsed = true;
                player.Hp = JsMath.Round(player.MaxHp * 0.50);
                player.Atk = JsMath.Round(player.Atk * 1.20);
                player.InvulnTimer = 2.2;
                r.RevivedByValkyrie = true;
                r.Lethal = false;
                return r;
            }

            if (player.HasSkill("revive") && !player.ReviveSkillUsed)
            {
                player.ReviveSkillUsed = true;
                player.Hp = player.MaxHp;
                player.InvulnTimer = 2.5;
                r.RevivedBySkill = true;
                r.Lethal = false;
                return r;
            }

            if (player.HasSkill("mymu") && !player.MymuOverdrawUsed)
            {
                player.MymuOverdrawUsed = true;
                player.Hp = JsMath.Round(player.MaxHp * 0.65);
                player.InvulnTimer = 2.0;
                r.RevivedByMymu = true;
                r.Lethal = false;
                return r;
            }

            r.Lethal = true;
            return r;
        }
    }
}
