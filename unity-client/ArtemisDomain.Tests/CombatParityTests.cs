using System;
using System.Collections.Generic;
using Artemis.Domain.Combat;
using Artemis.Domain.Core;
using Artemis.Domain.Progression;
using Artemis.Domain.Spawning;
using NUnit.Framework;

namespace Artemis.Domain.Tests
{
    /// <summary>
    /// Parity của công thức sát thương và sinh quái/boss, đối chiếu với
    /// <c>fixtures/damage-cases.json</c> và <c>fixtures/room-cases.json</c>.
    /// </summary>
    [TestFixture]
    public class CombatParityTests
    {
        // ==================== damageEnemy ====================

        [Test]
        public void DamageEnemy_MatchesJavascript()
        {
            var failures = new List<string>();
            int compared = 0;

            foreach (var c in TestContext.FixtureArray("damage-cases.json"))
            {
                string label = c["label"].AsString("?");
                double raw = c["raw"].AsNumber();
                bool elemental = c["isElemental"].AsBool();
                bool isCrit = c["isCrit"].AsBool();
                double expected = c["expected"].AsNumber();
                double critMult = c.Has("critDmgMult") ? c["critDmgMult"].AsNumber() : 1.85;

                var player = new CombatantState
                {
                    Atk = 1000,
                    Hp = 5000,
                    MaxHp = 5000,
                    CritRate = isCrit ? 1.0 : 0.0,
                    CritDmgMult = critMult,
                    HeroId = "alex",
                };
                var enemy = new EnemyState { Hp = 1_000_000, MaxHp = 1_000_000, Type = "slime" };

                // RNG ép về 0 (luôn crit nếu critRate>0) hoặc 0.99 (không crit).
                var rng = new ConstantRandom(isCrit ? 0.0 : 0.99);
                var result = DamageCalculator.Resolve(player, enemy, new DamageRequest
                {
                    RawDamage = raw,
                    IsElemental = elemental,
                }, rng);

                compared++;
                if (Math.Abs(result.FinalDamage - expected) > 1e-9)
                    failures.Add("[" + label + "] JS=" + expected + " C#=" + result.FinalDamage);
            }

            Assert.That(compared, Is.GreaterThan(5));
            Assert.That(failures, Is.Empty, string.Join("\n", failures));
        }

        [Test]
        public void Elemental_NeverCrits()
        {
            var player = new CombatantState { CritRate = 1.0, CritDmgMult = 3.0, Hp = 100, MaxHp = 100 };
            var enemy = new EnemyState { Hp = 1000, MaxHp = 1000 };
            var r = DamageCalculator.Resolve(player, enemy,
                new DamageRequest { RawDamage = 100, IsElemental = true }, new ConstantRandom(0.0));

            Assert.That(r.IsCrit, Is.False);
            Assert.That(r.FinalDamage, Is.EqualTo(100));
        }

        [Test]
        public void GuaranteedCrit_IsConsumedOnce()
        {
            var player = new CombatantState
            {
                CritRate = 0.0, CritDmgMult = 2.0, Hp = 100, MaxHp = 100,
                AlexNextGuaranteedCrit = true,
            };
            var enemy = new EnemyState { Hp = 10000, MaxHp = 10000 };
            var rng = new ConstantRandom(0.99);   // sẽ không crit nếu không có cờ

            var first = DamageCalculator.Resolve(player, enemy, new DamageRequest { RawDamage = 100 }, rng);
            Assert.That(first.IsCrit, Is.True, "cờ crit bảo đảm phải thắng roll");
            Assert.That(first.ConsumedGuaranteedCrit, Is.True);
            Assert.That(first.FinalDamage, Is.EqualTo(200));

            var second = DamageCalculator.Resolve(player, enemy, new DamageRequest { RawDamage = 100 }, rng);
            Assert.That(second.IsCrit, Is.False, "cờ đã bị tiêu, lượt sau roll bình thường");
            Assert.That(second.FinalDamage, Is.EqualTo(100));
        }

        [Test]
        public void Otta_BonusCritAppliesAbove60PercentHp()
        {
            var player = new CombatantState { CritRate = 0.0, CritDmgMult = 2.0, Hp = 100, MaxHp = 100 };
            player.Skills["otta"] = 1;

            var healthy = new EnemyState { Hp = 900, MaxHp = 1000 };   // 90% HP
            var wounded = new EnemyState { Hp = 500, MaxHp = 1000 };   // 50% HP

            // roll 0.15: < 0.18 nên crit khi quái còn >60% HP
            var rngHealthy = new ConstantRandom(0.15);
            Assert.That(DamageCalculator.Resolve(player, healthy, new DamageRequest { RawDamage = 10 }, rngHealthy).IsCrit,
                Is.True, "Otta +0.18 crit khi quái >60% HP");

            var rngWounded = new ConstantRandom(0.15);
            Assert.That(DamageCalculator.Resolve(player, wounded, new DamageRequest { RawDamage = 10 }, rngWounded).IsCrit,
                Is.False, "dưới 60% HP thì không còn bonus");
        }

        [Test]
        public void Helix_ScalesWithMissingHp()
        {
            var player = new CombatantState { CritRate = 0, Hp = 1000, MaxHp = 1000 };
            player.Skills["helix"] = 1;
            var enemy = new EnemyState { Hp = 1e9, MaxHp = 1e9 };

            var full = DamageCalculator.Resolve(player, enemy, new DamageRequest { RawDamage = 100 }, new ConstantRandom(0.99));
            Assert.That(full.FinalDamage, Is.EqualTo(100), "đầy máu: không có bonus");

            player.Hp = 0;
            var nearDeath = DamageCalculator.Resolve(player, enemy, new DamageRequest { RawDamage = 100 }, new ConstantRandom(0.99));
            Assert.That(nearDeath.FinalDamage, Is.EqualTo(128), "mất hết máu: +28%");
        }

        [Test]
        public void MarkMultipliers_StackMultiplicatively()
        {
            var player = new CombatantState { CritRate = 0, Hp = 100, MaxHp = 100 };
            var enemy = new EnemyState { Hp = 1e9, MaxHp = 1e9, ArtemisMarked = true, CorrosiveVulnerable = true };

            var r = DamageCalculator.Resolve(player, enemy, new DamageRequest { RawDamage = 100 }, new ConstantRandom(0.99));
            // 100 * 1.25 * 1.35 = 168.75 -> round 169
            Assert.That(r.FinalDamage, Is.EqualTo(169));
        }

        [Test]
        public void BossSlayer_OnlyOnBoss()
        {
            var player = new CombatantState { CritRate = 0, Hp = 100, MaxHp = 100 };
            player.Skills["boss_slayer"] = 1;

            var normal = DamageCalculator.Resolve(player, new EnemyState { Hp = 1e9, MaxHp = 1e9, IsBoss = false },
                new DamageRequest { RawDamage = 100 }, new ConstantRandom(0.99));
            Assert.That(normal.FinalDamage, Is.EqualTo(100));

            var boss = DamageCalculator.Resolve(player, new EnemyState { Hp = 1e9, MaxHp = 1e9, IsBoss = true },
                new DamageRequest { RawDamage = 100 }, new ConstantRandom(0.99));
            Assert.That(boss.FinalDamage, Is.EqualTo(125));
        }

        [Test]
        public void Artemis_MarksAfterMultiplier()
        {
            // Quan trọng: đánh dấu được ĐẶT SAU khi đọc markMult, nên đòn đầu tiên
            // không được hưởng +25%.
            var player = new CombatantState { CritRate = 0, Hp = 100, MaxHp = 100, HeroId = "artemis" };
            var enemy = new EnemyState { Hp = 1e9, MaxHp = 1e9 };
            var rng = new ConstantRandom(0.99);

            var first = DamageCalculator.Resolve(player, enemy, new DamageRequest { RawDamage = 100 }, rng);
            Assert.That(first.FinalDamage, Is.EqualTo(100), "đòn đầu không có bonus");
            Assert.That(enemy.ArtemisMarked, Is.True, "nhưng quái đã bị đánh dấu");

            var second = DamageCalculator.Resolve(player, enemy, new DamageRequest { RawDamage = 100 }, rng);
            Assert.That(second.FinalDamage, Is.EqualTo(125), "đòn sau hưởng +25%");
        }

        // ==================== hurtPlayer ====================

        [Test]
        public void Invulnerable_IgnoresDamage()
        {
            var p = new CombatantState { Hp = 100, MaxHp = 100, InvulnTimer = 0.3 };
            var r = IncomingDamageCalculator.Resolve(p, 50, new ConstantRandom(0.99), false);
            Assert.That(r.Damage, Is.EqualTo(0));
            Assert.That(p.Hp, Is.EqualTo(100));
        }

        [Test]
        public void Dodge_OnlyRollsOnceAndGrantsInvuln()
        {
            var p = new CombatantState { Hp = 100, MaxHp = 100, GearDodge = 0.5 };
            var r = IncomingDamageCalculator.Resolve(p, 50, new ConstantRandom(0.4), false);
            Assert.That(r.Dodged, Is.True);
            Assert.That(p.Hp, Is.EqualTo(100));
            Assert.That(p.InvulnTimer, Is.EqualTo(0.45));
        }

        [Test]
        public void DodgeChance_CapsAt055()
        {
            // hermes_boots bậc 10 => 1.5, + gearDodge 0.6 => phải kẹp 0.55
            var p = new CombatantState { Hp = 100, MaxHp = 100, GearDodge = 0.60 };
            p.Skills["hermes_boots"] = 10;
            // roll 0.56 > 0.55 => KHÔNG né (nếu không kẹp thì 0.56 < 2.1 sẽ né)
            var r = IncomingDamageCalculator.Resolve(p, 10, new ConstantRandom(0.56), false);
            Assert.That(r.Dodged, Is.False, "dodge phải bị chặn ở 0.55");
        }

        [Test]
        public void ReductionSteps_RoundIndividually()
        {
            // Đây là lý do KHÔNG được gộp các phép giảm thành một phép nhân.
            var p = new CombatantState { Hp = 1000, MaxHp = 1000, DmgReduction = 0.5 };
            p.Skills["wukong"] = 1;

            // dmg 7: DEF -> max(1, round(7*0.5)) = 4 ; guardian(skip) ; wukong -> max(1, round(4*0.82)) = 3
            var r = IncomingDamageCalculator.Resolve(p, 7, new ConstantRandom(0.99), guardianRuneEquipped: false);
            Assert.That(r.Damage, Is.EqualTo(3));

            // Gộp lại sẽ là round(7 * 0.5 * 0.82) = round(2.87) = 3 — trùng ở ca này,
            // nhưng công thức gộp cho các ca khác sẽ lệch; test dưới đây chỉ ra ca lệch.
            var p2 = new CombatantState { Hp = 1000, MaxHp = 1000, DmgReduction = 0.5 };
            p2.Skills["wukong"] = 1;
            var r2 = IncomingDamageCalculator.Resolve(p2, 3, new ConstantRandom(0.99), guardianRuneEquipped: true);
            // max(1, round(3*0.5))=2 ; guardian: max(1, round(2*0.85))=2 ; wukong: max(1, round(2*0.82))=2
            Assert.That(r2.Damage, Is.EqualTo(2), "mỗi bước giữ sàn 1 nên không bao giờ về 0");
        }

        [Test]
        public void NeverZero_WhenDamagePositive()
        {
            var p = new CombatantState { Hp = 1000, MaxHp = 1000, DmgReduction = 0.75 };
            p.Skills["wukong"] = 1;
            for (int dmg = 1; dmg <= 20; dmg++)
            {
                var fresh = new CombatantState { Hp = 1000, MaxHp = 1000, DmgReduction = 0.75 };
                fresh.Skills["wukong"] = 1;
                var r = IncomingDamageCalculator.Resolve(fresh, dmg, new ConstantRandom(0.99), true);
                Assert.That(r.Damage, Is.GreaterThanOrEqualTo(1),
                    "sát thương " + dmg + " sau mọi giảm trừ vẫn phải >= 1");
            }
        }

        [Test]
        public void SacredShield_BlocksCompletelyAndConsumesStack()
        {
            var p = new CombatantState { Hp = 500, MaxHp = 500, SacredShieldStacks = 2 };
            var r = IncomingDamageCalculator.Resolve(p, 9999, new ConstantRandom(0.99), false);
            Assert.That(r.BlockedBySacredShield, Is.True);
            Assert.That(p.Hp, Is.EqualTo(500));
            Assert.That(p.SacredShieldStacks, Is.EqualTo(1));
        }

        [Test]
        public void DarkShield_AbsorbsFirst()
        {
            var p = new CombatantState { Hp = 500, MaxHp = 500, DarkShieldHp = 100 };
            var r = IncomingDamageCalculator.Resolve(p, 60, new ConstantRandom(0.99), false);
            Assert.That(r.AbsorbedByDarkShield, Is.True);
            Assert.That(p.Hp, Is.EqualTo(500), "khiên hấp thụ hết, máu không đổi");
            Assert.That(p.DarkShieldHp, Is.EqualTo(40));

            // JS: sau khi hấp thụ, invulnTimer = 0.45 nhưng CHỈ khi dmg <= 0.
            // Đòn 100 vào khiên còn 40 -> còn 60 vào máu. Phải xoá invuln vì
            // bước 1 (invulnTimer > 0) sẽ chặn đòn này.
            p.InvulnTimer = 0;
            var r2 = IncomingDamageCalculator.Resolve(p, 100, new ConstantRandom(0.99), false);
            Assert.That(p.DarkShieldHp, Is.EqualTo(0));
            Assert.That(p.Hp, Is.EqualTo(440), "phần vượt khiên mới vào máu");
        }

        [Test]
        public void HpNeverGoesNegative()
        {
            var p = new CombatantState { Hp = 10, MaxHp = 100 };
            IncomingDamageCalculator.Resolve(p, 9999, new ConstantRandom(0.99), false);
            Assert.That(p.Hp, Is.EqualTo(0));
        }

        [Test]
        public void Revive_ChainOrder_ValkyrieBeforeSkillBeforeMymu()
        {
            var p = new CombatantState { Hp = 10, MaxHp = 1000, Atk = 100 };
            p.Skills["revive"] = 1;
            p.Skills["mymu"] = 1;

            var r = IncomingDamageCalculator.Resolve(p, 9999, new ConstantRandom(0.99),
                guardianRuneEquipped: false, valkyrieRuneEquipped: true);

            Assert.That(r.RevivedByValkyrie, Is.True, "rune Valkyrie phải chạy trước");
            Assert.That(p.Hp, Is.EqualTo(500), "hồi 50% maxHp");
            Assert.That(p.Atk, Is.EqualTo(120), "+20% ATK");
            Assert.That(r.Lethal, Is.False);
        }

        [Test]
        public void Revive_OnlyOncePerRun()
        {
            var p = new CombatantState { Hp = 10, MaxHp = 1000 };
            p.Skills["revive"] = 1;

            var first = IncomingDamageCalculator.Resolve(p, 9999, new ConstantRandom(0.99), false);
            Assert.That(first.RevivedBySkill, Is.True);

            p.InvulnTimer = 0;   // cho đòn kế tiếp đi qua
            var second = IncomingDamageCalculator.Resolve(p, 9999, new ConstantRandom(0.99), false);
            Assert.That(second.Lethal, Is.True, "lần chết thứ hai thì chết thật");
        }
    }

    [TestFixture]
    public class SpawnParityTests
    {
        [Test]
        public void AllRoomsInAllChapters_MatchJavascript()
        {
            var failures = new List<string>();
            int compared = 0, rooms = 0;

            foreach (var c in TestContext.FixtureArray("room-cases.json"))
            {
                int chapterId = c["chapterId"].AsInt();
                int room = c["room"].AsInt();
                int maxRooms = c["maxRooms"].AsInt();
                double playerAtk = c["playerAtk"].AsNumber();
                double playerMaxHp = c["playerMaxHp"].AsNumber();
                bool expectedBoss = c["isBossRoom"].AsBool();

                bool actualBoss = EnemySpawner.IsBossRoom(room, maxRooms);
                if (actualBoss != expectedBoss)
                    failures.Add($"C{chapterId} P{room}: isBossRoom JS={expectedBoss} C#={actualBoss}");

                var expected = c["enemies"];
                var actual = EnemySpawner.Spawn(chapterId, room, maxRooms, playerAtk, playerMaxHp);

                rooms++;
                if (actual.Count != expected.Count)
                {
                    failures.Add($"C{chapterId} P{room}: số quái JS={expected.Count} C#={actual.Count}");
                    continue;
                }

                for (int i = 0; i < actual.Count; i++)
                {
                    var e = expected[i];
                    var a = actual[i];
                    compared++;

                    if (e["isBoss"].AsBool() != a.IsBoss)
                        failures.Add($"C{chapterId} P{room} #{i}: isBoss JS={e["isBoss"].AsBool()} C#={a.IsBoss}");
                    if (e["type"].AsString() != a.Type)
                        failures.Add($"C{chapterId} P{room} #{i}: type JS={e["type"].AsString()} C#={a.Type}");
                    if (Math.Abs(e["hp"].AsNumber() - a.Hp) > 1e-9)
                        failures.Add($"C{chapterId} P{room} #{i}: hp JS={e["hp"].AsNumber()} C#={a.Hp}");
                    if (Math.Abs(e["atk"].AsNumber() - a.Atk) > 1e-9)
                        failures.Add($"C{chapterId} P{room} #{i}: atk JS={e["atk"].AsNumber()} C#={a.Atk}");
                    if (Math.Abs(e["speed"].AsNumber() - a.Speed) > 1e-9)
                        failures.Add($"C{chapterId} P{room} #{i}: speed JS={e["speed"].AsNumber()} C#={a.Speed}");
                    if (Math.Abs(e["r"].AsNumber() - a.Radius) > 1e-9)
                        failures.Add($"C{chapterId} P{room} #{i}: r JS={e["r"].AsNumber()} C#={a.Radius}");
                }
            }

            Assert.That(rooms, Is.GreaterThanOrEqualTo(60), "phải phủ 5 chương");
            Assert.That(compared, Is.GreaterThan(100));
            Assert.That(failures, Is.Empty,
                "Sai lệch so với setupRoom() của bản web:\n" + string.Join("\n", failures));
        }

        [Test]
        public void BossRooms_Ch1AndCh3()
        {
            // Ch.1 (15 phòng) có trùm ở 5, 10, 15.
            var ch1 = new List<int>();
            for (int r = 1; r <= 15; r++) if (EnemySpawner.IsBossRoom(r, 15)) ch1.Add(r);
            Assert.That(ch1, Is.EqualTo(new[] { 5, 10, 15 }));

            // Ch.3 (10 phòng) chỉ có trùm ở 5 và 10.
            var ch3 = new List<int>();
            for (int r = 1; r <= 10; r++) if (EnemySpawner.IsBossRoom(r, 10)) ch3.Add(r);
            Assert.That(ch3, Is.EqualTo(new[] { 5, 10 }));
        }

        [Test]
        public void BossOnlyMode_EveryRoomIsBoss()
        {
            for (int r = 1; r <= 6; r++)
                Assert.That(EnemySpawner.IsBossRoom(r, 10, modeBossOnly: true), Is.True);
        }

        [Test]
        public void EnemyCount_FollowsFormula()
        {
            Assert.That(EnemySpawner.EnemyCount(1), Is.EqualTo(3));
            Assert.That(EnemySpawner.EnemyCount(2), Is.EqualTo(4));
            Assert.That(EnemySpawner.EnemyCount(9), Is.EqualTo(7));
            Assert.That(EnemySpawner.EnemyCount(10), Is.EqualTo(8));
            Assert.That(EnemySpawner.EnemyCount(50), Is.EqualTo(8), "chặn trên 8");
        }

        [Test]
        public void EnemyTypes_AreDeterministic()
        {
            var types = EnemySpawner.TypesForChapter(1);
            // (room + i) % len — cùng đầu vào phải luôn cùng đầu ra.
            for (int i = 0; i < 10; i++)
            {
                var a = EnemySpawner.TypeForIndex(types, 7, i);
                var b = EnemySpawner.TypeForIndex(types, 7, i);
                Assert.That(a, Is.EqualTo(b));
            }
            Assert.That(EnemySpawner.TypeForIndex(types, 1, 0), Is.EqualTo("goblin"));
            Assert.That(EnemySpawner.TypeForIndex(types, 1, 1), Is.EqualTo("skeleton_mage"));
        }

        [Test]
        public void BossHp_IgnoresRoomMultiplier()
        {
            // Hợp đồng quan trọng: HP boss KHÔNG nhân roomMul. Nếu ai đó "sửa"
            // điều này, trùm cuối thành bức tường vài chục giây.
            double atk = 10000;
            double hp5 = EnemySpawner.BossHp(atk, 1, 5);      // golem
            Assert.That(hp5, Is.EqualTo(atk * 24 * 1.00), "phòng 5: 24 hit, không roomMul");

            // Phòng cuối chương 1 là demon_king nên có thêm ×1.15 — nhưng vẫn
            // KHÔNG có roomMul (nếu có, sẽ là ×2.56 nữa).
            double hp15 = EnemySpawner.BossHp(atk, 1, 15);
            Assert.That(hp15, Is.EqualTo(atk * 40 * 1.00 * 1.15).Within(1e-6), "phòng 15: 40 hit ×1.15 demon king");

            // So sánh: nếu roomMul bị nhân nhầm, phòng 15 sẽ ≈ ×2.56 lớn hơn.
            Assert.That(hp15 / hp5, Is.LessThan(2.0),
                "tỉ lệ phải ~1.92 (40*1.15 / 24); nếu >2.5 là đã nhân roomMul");
        }

        [Test]
        public void BossHp_DemonKingHas115Multiplier()
        {
            double atk = 10000;
            // demon_king chỉ xuất hiện ở phòng cuối của chương 1-3 (không phải room 10,
            // vì room 10 luôn là queen).
            Assert.That(EnemySpawner.BossType(1, 15), Is.EqualTo("demon_king"));
            double demon = EnemySpawner.BossHp(atk, 1, 15);
            Assert.That(demon, Is.EqualTo(atk * 40 * 1.00 * 1.15).Within(1e-6));

            // Queen ở phòng 10 không có hệ số đó.
            Assert.That(EnemySpawner.BossType(1, 10), Is.EqualTo("queen"));
            Assert.That(EnemySpawner.BossHp(atk, 1, 10), Is.EqualTo(atk * 30 * 1.00));
        }

        [Test]
        public void BossAtk_IsHitsToDie()
        {
            Assert.That(EnemySpawner.BossAtk(90000, 5), Is.EqualTo(10000), "/9");
            Assert.That(EnemySpawner.BossAtk(70000, 10), Is.EqualTo(10000), "/7");
            Assert.That(EnemySpawner.BossAtk(50000, 15), Is.EqualTo(10000), "/5");
        }

        [Test]
        public void BossType_ByChapter()
        {
            Assert.That(EnemySpawner.BossType(1, 5), Is.EqualTo("golem"));
            Assert.That(EnemySpawner.BossType(1, 10), Is.EqualTo("queen"));
            Assert.That(EnemySpawner.BossType(1, 15), Is.EqualTo("demon_king"));
            Assert.That(EnemySpawner.BossType(4, 5), Is.EqualTo("elder_dragon"));
            Assert.That(EnemySpawner.BossType(5, 10), Is.EqualTo("eclipse_sovereign"));
        }

        [Test]
        public void Scaling_IsMonotonicPerRoom()
        {
            // Quái phải khó dần trong cùng chương. So theo HP TRUNG BÌNH của phòng,
            // không theo từng index: loại quái xoay vòng theo (room+i)%n nên
            // index 0 ở hai phòng khác nhau có thể là loại khác nhau.
            double atk = 10000, maxHp = 50000;
            double prevAvg = 0;
            for (int room = 1; room <= 14; room++)
            {
                if (EnemySpawner.IsBossRoom(room, 15)) { prevAvg = 0; continue; }
                var spawns = EnemySpawner.Spawn(1, room, 15, atk, maxHp);
                double avg = 0;
                foreach (var s in spawns) avg += s.Hp;
                avg /= spawns.Count;

                if (prevAvg > 0)
                    Assert.That(avg, Is.GreaterThanOrEqualTo(prevAvg), "HP trung bình phòng " + room);
                prevAvg = avg;
            }
        }
    }

    [TestFixture]
    public class ProgressionTests
    {
        [Test]
        public void Rewards_MatchJavascript()
        {
            var failures = new List<string>();
            int n = 0;
            foreach (var c in TestContext.FixtureArray("reward-cases.json"))
            {
                int chapterId = c["chapterId"].AsInt();
                bool victory = c["victory"].AsBool();
                int room = c["room"].AsInt();
                long expGold = c["expectedGold"].AsLongSafe();
                long expGems = c["expectedGems"].AsLongSafe();

                var r = RewardService.For(victory, chapterId, room);
                n++;
                if (r.Gold != expGold) failures.Add($"C{chapterId} room{room} win={victory} gold: JS={expGold} C#={r.Gold}");
                if (r.Gems != expGems) failures.Add($"C{chapterId} room{room} win={victory} gems: JS={expGems} C#={r.Gems}");
            }
            Assert.That(n, Is.GreaterThan(10));
            Assert.That(failures, Is.Empty, string.Join("\n", failures));
        }

        [Test]
        public void Victory_GoldAndGemsScaleWithChapter()
        {
            Assert.That(RewardService.Victory(1).Gold, Is.EqualTo(350));
            Assert.That(RewardService.Victory(1).Gems, Is.EqualTo(40));
            Assert.That(RewardService.Victory(5).Gold, Is.EqualTo(1750));
            Assert.That(RewardService.Victory(5).Gems, Is.EqualTo(200));
        }

        [Test]
        public void Defeat_RewardsRoomProgress()
        {
            Assert.That(RewardService.Defeat(12).Gold, Is.EqualTo(240));
            Assert.That(RewardService.Defeat(12).Gems, Is.EqualTo(24));
        }

        [Test]
        public void Xp_LevelsOncePerPickup_LikeJsIf()
        {
            double xp = 0, xpNext = 80;
            int level = 1;

            // Một lần nhặt 200 XP với xpNext 80: JS chỉ lên 1 cấp, dư 120 trong xp.
            int gained = XpService.ApplyXp(ref xp, ref level, ref xpNext, 200);
            Assert.That(gained, Is.EqualTo(1), "chỉ 1 cấp mỗi lần nhặt (dùng if, không while)");
            Assert.That(level, Is.EqualTo(2));
            Assert.That(xp, Is.EqualTo(120), "phần dư nằm lại trong xp");
            Assert.That(xpNext, Is.EqualTo(100), "80 * 1.25");

            // Lần nhặt kế tiếp mới lên cấp tiếp.
            gained = XpService.ApplyXp(ref xp, ref level, ref xpNext, 0.0001);
            Assert.That(gained, Is.EqualTo(1));
            Assert.That(level, Is.EqualTo(3));
        }

        [Test]
        public void Xp_BelowThreshold_DoesNothing()
        {
            double xp = 10, xpNext = 80;
            int level = 1;
            Assert.That(XpService.ApplyXp(ref xp, ref level, ref xpNext, 5), Is.EqualTo(0));
            Assert.That(xp, Is.EqualTo(15));
            Assert.That(level, Is.EqualTo(1));
            Assert.That(xpNext, Is.EqualTo(80));
        }

        [Test]
        public void XpCurve_GrowsGeometrically()
        {
            var curve = XpService.XpNextCurve(6);
            Assert.That(curve, Is.EqualTo(new double[] { 80, 100, 125, 156, 195, 244 }),
                "80 -> *1.25 làm tròn: 100, 125, 156, 195, 244");
        }

        [Test]
        public void ChapterWon_ByWinsOrByBestRoom()
        {
            Assert.That(ChapterService.IsChapterWon(1, wins: 1, bestRoom: 1, chapterRooms: 15), Is.True);
            Assert.That(ChapterService.IsChapterWon(1, wins: 0, bestRoom: 15, chapterRooms: 15), Is.True,
                "tài khoản cũ có kỷ lục đủ phòng nhưng chưa ghi 'win' vẫn tính là phá đảo");
            Assert.That(ChapterService.IsChapterWon(1, wins: 0, bestRoom: 14, chapterRooms: 15), Is.False);
        }

        [Test]
        public void ChapterLocking_RequiresPreviousWin()
        {
            int[] rooms = { 0, 15, 12, 10, 15, 15 };
            Func<int, int> wins = id => 0;
            Func<int, int> best = id => 0;
            Func<int, int> rms = id => rooms[id];

            Assert.That(ChapterService.IsChapterLocked(1, wins, best, rms), Is.False, "chương 1 luôn mở");
            Assert.That(ChapterService.IsChapterLocked(2, wins, best, rms), Is.True);

            Func<int, int> wins1 = id => id == 1 ? 1 : 0;
            Assert.That(ChapterService.IsChapterLocked(2, wins1, best, rms), Is.False);
            Assert.That(ChapterService.IsChapterLocked(3, wins1, best, rms), Is.True, "cần thắng chương 2");
        }

        [Test]
        public void NormalizeSelectedChapter_FallsBackToHighestUnlocked()
        {
            int[] ids = { 1, 2, 3 };
            // Chọn chương 3 khi chỉ mở tới chương 1 -> lùi về index 0.
            int idx = ChapterService.NormalizeSelectedChapter(2, ids, id => id > 1);
            Assert.That(idx, Is.EqualTo(0));

            // Chọn hợp lệ thì giữ nguyên.
            idx = ChapterService.NormalizeSelectedChapter(1, ids, id => id > 2);
            Assert.That(idx, Is.EqualTo(1));
        }
    }
}
