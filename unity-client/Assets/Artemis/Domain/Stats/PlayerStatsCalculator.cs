using System;
using System.Collections.Generic;
using Artemis.Domain.Core;

namespace Artemis.Domain.Stats
{
    /// <summary>
    /// Đầu vào của <see cref="PlayerStatsCalculator"/>, đã tách khỏi JSON save.
    ///
    /// Tách ra khỏi SaveModel để: (a) test dựng được bằng tay, (b) không có đường
    /// vòng nào cho phép đọc field save chưa được khai báo, (c) mọi trường ảnh
    /// hưởng chỉ số đều nhìn thấy trong một file.
    /// </summary>
    public sealed class StatsInput
    {
        // ---- Nhân vật ----
        public string SelectedHeroId = "alex";
        public string SelectedWeaponId = "bow";
        public string SelectedPetId = "spirit_sword";
        public int GearLevel = 1;

        // ---- Trang bị: 6 ô, giữ NGUYÊN tên slot ----
        /// <summary>slot -> item (uid, templateId, quality, level, awakening, sockets[], affixes[]).</summary>
        public readonly Dictionary<string, JsonValue> EquippedGear = new Dictionary<string, JsonValue>(StringComparer.Ordinal);

        // ---- Tiến trình ----
        public readonly Dictionary<string, double> HeroStars = new Dictionary<string, double>(StringComparer.Ordinal);
        public readonly Dictionary<string, double> ArtifactStars = new Dictionary<string, double>(StringComparer.Ordinal);
        public readonly Dictionary<string, double> HeroSelectedSkins = new Dictionary<string, double>(StringComparer.Ordinal);
        public readonly HashSet<string> UnlockedSkins = new HashSet<string>(StringComparer.Ordinal);
        public readonly Dictionary<string, double> Talents = new Dictionary<string, double>(StringComparer.Ordinal);
        public readonly Dictionary<string, double> Runestones = new Dictionary<string, double>(StringComparer.Ordinal);
        public JsonValue EquippedRuneSlots;      // { etched[], blessing[], enhancement[], ability[] }
        public string RuneQualityTier = "mythic";
        public bool RuneMythicEnchant = true;
        public JsonValue ResonanceSlots;         // { slot1, slot2 }
        public string SeasonCareer;              // null | blade | ranger | ...
        public double SeasonPowerSacrificed;     // 0..0.20

        /// <summary>Số phòng của chương đang chơi — quyết định defK. Mặc định 15 như getComputedStats.</summary>
        public int ChapterRooms = 15;

        public static StatsInput FromSave(JsonValue save)
        {
            var input = new StatsInput();
            if (save == null || !save.IsObject) return input;

            input.SelectedHeroId = save["selectedHeroId"].AsString("alex");
            input.SelectedWeaponId = save["selectedWeaponId"].AsString("bow");
            input.SelectedPetId = save["selectedPetId"].AsString("spirit_sword");
            input.GearLevel = Math.Max(1, save["gearLevel"].AsInt(1));

            var gear = save["equippedGear"];
            if (gear.IsObject)
            {
                foreach (var slot in GameData.GameData.GearSlotOrder)
                {
                    var item = gear[slot];
                    if (item.IsObject) input.EquippedGear[slot] = item;
                }
            }

            CopyNumeric(save["heroStars"], input.HeroStars);
            CopyNumeric(save["artifactStars"], input.ArtifactStars);
            CopyNumeric(save["heroSelectedSkins"], input.HeroSelectedSkins);
            CopyNumeric(save["talents"], input.Talents);
            CopyNumeric(save["runes"], input.Runestones);

            var skins = save["unlockedSkins"];
            if (skins.IsObject)
                foreach (var kv in skins.Entries())
                    if (kv.Value.AsBool()) input.UnlockedSkins.Add(kv.Key);

            input.EquippedRuneSlots = save["equippedRuneSlots"];
            input.RuneQualityTier = save["runeQualityTier"].AsString("mythic");
            input.RuneMythicEnchant = save["runeMythicEnchant"].Kind == JsonKind.Null
                ? true
                : save["runeMythicEnchant"].AsBool(true);
            input.ResonanceSlots = save["resonanceSlots"];

            var season = save["season"];
            if (season.IsObject)
            {
                input.SeasonCareer = season["career"].AsString(null);
                input.SeasonPowerSacrificed = JsMath.Clamp(season["powerSacrificed"].AsNumber(0), 0, 0.20);
            }

            return input;
        }

        private static void CopyNumeric(JsonValue src, Dictionary<string, double> dst)
        {
            if (!src.IsObject) return;
            foreach (var kv in src.Entries())
            {
                double d = kv.Value.AsNumber(double.NaN);
                if (!double.IsNaN(d)) dst[kv.Key] = d;
            }
        }
    }

    /// <summary>Kết quả — ánh xạ 1:1 các field mà <c>getComputedStats()</c> trả về.</summary>
    public sealed class PlayerStats
    {
        public string HeroId;
        public int HeroStar;
        public string WeaponId;
        public string PetId;

        public long BaseAtk;
        public long BaseHp;
        public double BaseAspd;
        public double BaseCrit;
        public double CritDmgMult;
        public double CritDmgBonus;
        public long DefFlat;
        public double DmgReduction;
        public double GearDodge;
        public double GoldBonus;
        public long PowerScore;

        public long GearAtk;
        public long GearHp;

        // Dùng cho di chuyển: 225 * (hero.bonusSpd || 1)
        public double Speed;

        /// <summary>ATK và HP dạng double để downstream không phải ép kiểu lại.</summary>
        public double Atk => BaseAtk;
        public double Hp => BaseHp;
    }

    /// <summary>
    /// Bản port của <c>getComputedStats()</c> (public/index.html:11170).
    ///
    /// Mọi thứ dưới đây được viết theo ĐÚNG thứ tự phép tính của bản JS. Không
    /// "dọn dẹp", không gộp biểu thức, không đổi chỗ làm tròn — vì cả ba đều làm
    /// kết quả lệch so với production.
    /// </summary>
    public static class PlayerStatsCalculator
    {
        public static PlayerStats Compute(GameData.GameData data, StatsInput input)
        {
            if (data == null) throw new ArgumentNullException(nameof(data));
            if (input == null) throw new ArgumentNullException(nameof(input));

            var hero = data.Heroes.Get(input.SelectedHeroId);
            if (hero.IsNull) hero = data.Heroes.Get("alex");
            if (hero.IsNull) hero = FirstOf(data.Heroes);

            // Vũ khí: nếu ô weapon đang mặc có weaponArchetype thì nó THẮNG lựa chọn
            // trong save — đúng như source (dòng 11172-11175).
            string weaponId = input.SelectedWeaponId;
            if (input.EquippedGear.TryGetValue("weapon", out var eqWeapon))
            {
                var tpl = data.GearTemplates.Get(eqWeapon["templateId"].AsString());
                string archetype = tpl["weaponArchetype"].AsString(null);
                if (!string.IsNullOrEmpty(archetype)) weaponId = archetype;
            }
            var weapon = data.Weapons.Get(weaponId);
            if (weapon.IsNull) weapon = FirstOf(data.Weapons);

            var pet = data.Pets.Get(input.SelectedPetId);
            if (pet.IsNull) pet = FirstOf(data.Pets);

            var globalAll = GlobalAllHeroStarBonuses(data, input);
            var talentTotals = TalentBonuses(data, input);
            var runeTotals = ComputeRuneTotals(data, input);
            var artifactTotals = ComputeArtifactTotals(data, input);

            // ---- Cộng dồn từng ô trang bị ----
            long gearAtk = 0, gearHp = 0;
            int epicCount = 0;
            double gemAtk = 0, gemHp = 0, gemCrit = 0, gemDodge = 0, gemGold = 0;
            double affAtkFlat = 0, affHpFlat = 0, affAtkPct = 0, affHpPct = 0;
            double affCrit = 0, affAspd = 0, affDodge = 0, affGold = 0;

            double gearBaseMul = 1.0 + globalAll.gearBasePct + talentTotals.gearBasePct;

            foreach (var slot in GameData.GameData.GearSlotOrder)
            {
                if (!input.EquippedGear.TryGetValue(slot, out var item)) continue;
                if (!item.IsObject) continue;

                long val = JsMath.RoundLong(SingleItemStat(data, item) * gearBaseMul);
                string statType = data.GearSlots.Get(slot)["statType"].AsString("atk");
                if (statType == "atk") gearAtk += val; else gearHp += val;

                var gb = GemBonuses(data, item);
                gemAtk += gb.atk; gemHp += gb.hp; gemCrit += gb.crit; gemDodge += gb.dodge; gemGold += gb.gold;

                var ab = AffixBonuses(item);
                affAtkFlat += ab.atkFlat; affHpFlat += ab.hpFlat;
                affAtkPct += ab.atkPct; affHpPct += ab.hpPct;
                affCrit += ab.crit; affAspd += ab.aspd;
                affDodge += ab.dodge; affGold += ab.gold;

                int qOrder = (int)data.GearQualities.Get(item["quality"].AsString("common"))["order"].AsNumber(1);
                if (qOrder >= 4) epicCount++;
            }

            double runeAtk = runeTotals.atk + artifactTotals.flatAtk;
            double runeHp = runeTotals.hp + artifactTotals.flatHp;

            // ---- Sao hero & skin ----
            int heroStar = HeroStarLevel(input, hero["id"].AsString());
            var starMilestone = data.StarMilestones.All == null ? JsonValue.Object() : MilestoneFor(data, heroStar);
            var activeSkin = ActiveHeroSkin(data, input, hero["id"].AsString());
            var skinColBonus = AllUnlockedSkinBonuses(data, input);

            double heroStarAtk = JsMath.RoundLong(hero["bonusAtk"].AsNumber(0) * (1.0 + starMilestone["atkMult"].AsNumber(0)))
                               + starMilestone["flatAtk"].AsNumber(0)
                               + activeSkin["bonusAtk"].AsNumber(0)
                               + skinColBonus.atk;
            double heroStarHp = JsMath.RoundLong(hero["bonusHp"].AsNumber(0) * (1.0 + starMilestone["hpMult"].AsNumber(0)))
                              + starMilestone["flatHp"].AsNumber(0)
                              + activeSkin["bonusHp"].AsNumber(0)
                              + skinColBonus.hp;

            // ---- Set bonus trang bị ----
            var setBonuses = SetBonuses(data, input);
            double setAtkRate = 0, setHpRate = 0, setAspdRate = 0, setCrit = 0, setDodge = 0, setCritDmgPct = 0;
            foreach (var b in setBonuses)
            {
                setAtkRate += b.atk; setHpRate += b.hp; setAspdRate += b.aspd;
                setCrit += b.crit; setDodge += b.dodge; setCritDmgPct += b.critDmgPct;
            }

            // ---- Nghề Mùa Giải ----
            var career = SeasonCareerMeta(data, input.SeasonCareer);
            double careerAtkPct = Num(career, "atkPct");
            double careerHpPct = Num(career, "hpPct");
            double careerAspdPct = Num(career, "aspdPct");
            double careerCritFlat = Num(career, "critFlat");
            double careerDefFlat = Num(career, "defFlat");
            double careerDodgeFlat = Num(career, "dodgeFlat");
            double careerGoldPct = Num(career, "goldPct");
            double careerCritDmgPct = Num(career, "critDmgPct");

            double sacMul = 1.0 - input.SeasonPowerSacrificed;

            double atkBase =
                  78
                + gearAtk + gemAtk + affAtkFlat + runeAtk + heroStarAtk
                + (input.GearLevel - 1) * 12
                + talentTotals.flatAtk;
            double atkMult = All(weapon, "atkMult");
            double atkRate = 1.0
                + setAtkRate + affAtkPct + globalAll.atkPct
                + Num(artifactTotals.root, "totalAtkPct")
                + starMilestone["atkMult"].AsNumber(0) * 0.25
                + careerAtkPct;

            long baseAtk = JsMath.RoundLong(atkBase * atkMult * atkRate * sacMul);

            double hpBase =
                  420
                + gearHp + gemHp + affHpFlat + runeHp + heroStarHp
                + (input.GearLevel - 1) * 45
                + talentTotals.flatHp;
            double hpRate = 1.0
                + setHpRate + affHpPct + globalAll.hpPct
                + Num(artifactTotals.root, "totalHpPct")
                + starMilestone["hpMult"].AsNumber(0) * 0.25
                + careerHpPct;

            long baseHp = JsMath.RoundLong(hpBase * hpRate * sacMul);

            double baseAspd = JsMath.ToFixed(
                All(weapon, "aspd") * (1.0
                    + talentTotals.aspdBonus
                    + epicCount * 0.03
                    + setAspdRate + affAspd
                    + runeTotals.aspdBonus
                    + Num(artifactTotals.root, "aspdBonus")
                    + starMilestone["aspdBonus"].AsNumber(0)
                    + activeSkin["bonusAspd"].AsNumber(0)
                    + careerAspdPct), 2);

            double gearDodge = Math.Min(0.68, JsMath.ToFixed(
                gemDodge + affDodge + talentTotals.dodgeBonus
                + runeTotals.dodgeBonus
                + Num(artifactTotals.root, "dodgeBonus")
                + starMilestone["dodgeBonus"].AsNumber(0)
                + globalAll.dodgeBonus
                + setDodge
                + careerDodgeFlat, 3));

            double baseCrit = Math.Min(0.98, JsMath.ToFixed(
                0.10
                + All(weapon, "critBonus")
                + gemCrit + affCrit + setCrit
                + runeTotals.critBonus
                + Num(artifactTotals.root, "critRate")
                + starMilestone["critBonus"].AsNumber(0)
                + globalAll.critRate
                + activeSkin["bonusCrit"].AsNumber(0)
                + talentTotals.critRate
                + careerCritFlat, 2));

            double totalGoldBonus = JsMath.ToFixed(gemGold + affGold + careerGoldPct, 3);

            double critDmgBonus =
                  talentTotals.critDmgPct
                + Num(artifactTotals.root, "critDmgPct")
                + globalAll.critDmgPct
                + setCritDmgPct
                + activeSkin["bonusCritDmg"].AsNumber(0)
                + careerCritDmgPct;
            double critDmgMult = JsMath.ToFixed(1.85 + critDmgBonus, 3);

            // ---- DEF ----
            double defFlatRaw =
                  heroStar * 2
                + (input.GearLevel - 1) * 3
                + talentTotals.flatDef
                + NumberOrZero(runeTotals.root["defFlat"])
                + Num(artifactTotals.root, "defFlat")
                + (gemHp + affHpFlat) * 0.02
                + careerDefFlat;
            long defFlat = JsMath.RoundLong(defFlatRaw);

            // defK dùng số phòng của CHƯƠNG ĐANG CHƠI, mặc định 15.
            double defK = 400 + 120 * (input.ChapterRooms > 0 ? input.ChapterRooms : 15);
            double dmgReduction = JsMath.ToFixed(Math.Min(0.75, defFlat / (defFlat + defK)), 4);

            int skinIdx = (int)activeSkin["idx"].AsNumber(0);
            long powerScore = JsMath.RoundLong(
                baseAtk * 6.2
                + baseHp * 1.15
                + baseAspd * 180
                + baseCrit * 600
                + gearDodge * 420
                + heroStar * 1650
                + (skinIdx + 1) * 900
                + defFlat * 3);

            return new PlayerStats
            {
                HeroId = hero["id"].AsString(input.SelectedHeroId),
                HeroStar = heroStar,
                WeaponId = weapon["id"].AsString(weaponId),
                PetId = pet["id"].AsString(input.SelectedPetId),
                BaseAtk = baseAtk,
                BaseHp = baseHp,
                BaseAspd = baseAspd,
                BaseCrit = baseCrit,
                CritDmgBonus = critDmgBonus,
                CritDmgMult = critDmgMult,
                DefFlat = defFlat,
                DmgReduction = dmgReduction,
                GearDodge = gearDodge,
                GoldBonus = totalGoldBonus,
                PowerScore = powerScore,
                GearAtk = gearAtk,
                GearHp = gearHp,
                // Trước đây `225 * stats.hero.bonusSpd` với bonusSpd undefined
                // sinh NaN làm nhân vật biến mất. Giữ nguyên hành vi `|| 1`.
                Speed = 225.0 * (hero.Has("bonusSpd") ? JsMath.Or(hero["bonusSpd"].AsNumber(0), 1.0) : 1.0),
            };
        }

        // ==================== Các hàm phụ (port 1:1) ====================

        /// <summary>computeSingleItemStat(): round((base + (lv-1)*perLv) * qualityMult * (1 + awkBonus)).</summary>
        public static long SingleItemStat(GameData.GameData data, JsonValue item)
        {
            if (item == null || !item.IsObject) return 0;
            var tpl = data.GearTemplates.Get(item["templateId"].AsString());
            if (tpl.IsNull) tpl = data.GearTemplates.Get("crimson_bow");
            var q = data.GearQualities.Get(item["quality"].AsString("common"));
            if (q.IsNull) q = data.GearQualities.Get("common");

            int lv = Math.Max(1, item["level"].AsInt(1));
            double baseByLv = tpl["baseStat"].AsNumber(0) + (lv - 1) * tpl["perLv"].AsNumber(0);
            double awkBonus = AwakeningBonusRate(item["quality"].AsString("common"), item["awakening"].AsInt(0));
            return JsMath.RoundLong(baseByLv * q["mult"].AsNumber(1.0) * (1.0 + awkBonus));
        }

        /// <summary>getAwakeningBonusRate(quality, awakening).</summary>
        public static double AwakeningBonusRate(string quality, int awakening)
        {
            int awk = Math.Max(0, awakening);
            switch (quality)
            {
                case "epic":
                    if (awk == 1) return 0.08;
                    if (awk >= 2) return 0.15;
                    break;
                case "legendary":
                    if (awk == 1) return 0.08;
                    if (awk == 2) return 0.14;
                    if (awk >= 3) return 0.20;
                    break;
                case "mythic":
                    if (awk == 1) return 0.25;
                    if (awk == 2) return 0.30;
                    if (awk == 3) return 0.35;
                    if (awk >= 4) return 0.40;
                    break;
            }
            return 0;
        }

        public struct GemBonus { public double atk, hp, crit, dodge, gold; }

        /// <summary>getGemBonuses(item) — cộng theo sockets[].</summary>
        public static GemBonus GemBonuses(GameData.GameData data, JsonValue item)
        {
            var r = new GemBonus();
            var sockets = item["sockets"];
            if (!sockets.IsArray) return r;
            foreach (var s in sockets.Items)
            {
                // sockets có thể là chuỗi id, hoặc object {gem, level}.
                string id = s.Kind == JsonKind.String ? s.StringValue : s["gem"].AsString(null);
                var g = data.Gems.Get(id);
                if (g.IsNull) continue;
                r.atk += g["atk"].AsNumber(0);
                r.hp += g["hp"].AsNumber(0);
                r.crit += g["crit"].AsNumber(0);
                r.dodge += g["dodge"].AsNumber(0);
                r.gold += g["gold"].AsNumber(0);
            }
            return r;
        }

        public struct AffixBonus
        {
            public double atkFlat, hpFlat, atkPct, hpPct, crit, aspd, dodge, gold;
        }

        /// <summary>getAffixBonuses(item) — mọi pct chia 100.</summary>
        public static AffixBonus AffixBonuses(JsonValue item)
        {
            var r = new AffixBonus();
            var affixes = item["affixes"];
            if (!affixes.IsArray) return r;
            foreach (var a in affixes.Items)
            {
                if (!a.IsObject) continue;
                string type = a["type"].AsString(null);
                double v = a["val"].AsNumber(0);
                switch (type)
                {
                    case "atk_flat": r.atkFlat += v; break;
                    case "hp_flat": r.hpFlat += v; break;
                    case "atk_pct": r.atkPct += v / 100.0; break;
                    case "hp_pct": r.hpPct += v / 100.0; break;
                    case "crit_pct": r.crit += v / 100.0; break;
                    case "aspd_pct": r.aspd += v / 100.0; break;
                    case "dodge_pct": r.dodge += v / 100.0; break;
                    case "gold_pct": r.gold += v / 100.0; break;
                }
            }
            return r;
        }

        public struct GlobalAllBonus
        {
            public double atkPct, hpPct, critRate, critDmgPct, dodgeBonus, gearBasePct;
            public int activeMilestonesCount;
        }

        /// <summary>getGlobalAllHeroStarBonuses(): mỗi hero cộng theo số mốc 1★/4★/7★ đã đạt.</summary>
        public static GlobalAllBonus GlobalAllHeroStarBonuses(GameData.GameData data, StatsInput input)
        {
            var r = new GlobalAllBonus();
            foreach (var h in data.Heroes.All)
            {
                int star = HeroStarLevel(input, h["id"].AsString());
                int tiers = (star >= 1 ? 1 : 0) + (star >= 4 ? 1 : 0) + (star >= 7 ? 1 : 0);
                if (tiers <= 0) continue;
                var gb = h["globalAllBonus"];
                if (!gb.IsObject) continue;

                r.activeMilestonesCount += tiers;
                r.atkPct += gb["atkPct"].AsNumber(0) * tiers;
                r.hpPct += gb["hpPct"].AsNumber(0) * tiers;
                r.critRate += gb["critRate"].AsNumber(0) * tiers;
                r.critDmgPct += gb["critDmgPct"].AsNumber(0) * tiers;
                r.dodgeBonus += gb["dodgeBonus"].AsNumber(0) * tiers;
                r.gearBasePct += gb["gearBasePct"].AsNumber(0) * tiers;
            }
            r.atkPct = JsMath.ToFixed(r.atkPct, 3);
            r.hpPct = JsMath.ToFixed(r.hpPct, 3);
            r.critRate = JsMath.ToFixed(r.critRate, 3);
            r.critDmgPct = JsMath.ToFixed(r.critDmgPct, 3);
            r.dodgeBonus = JsMath.ToFixed(r.dodgeBonus, 3);
            r.gearBasePct = JsMath.ToFixed(r.gearBasePct, 3);
            return r;
        }

        public struct TalentTotals
        {
            public double flatAtk, flatHp, gearBasePct, aspdBonus, critRate, critDmgPct, dodgeBonus, flatDef;
            public int healer;
        }

        /// <summary>computeAllTalentCardsBonuses().</summary>
        public static TalentTotals TalentBonuses(GameData.GameData data, StatsInput input)
        {
            double flatAtk = 0, flatHp = 0, gearBasePct = 0, aspdBonus = 0;
            double critRate = 0, critDmgPct = 0, dodgeBonus = 0, flatDef = 0;
            int healer = 0;

            foreach (var t in data.Talents.All)
            {
                string id = t["id"].AsString();
                int maxLv = t["maxLv"].AsInt(0);
                double raw = input.Talents.TryGetValue(id, out var v) ? v : 0;
                int lv = (int)Math.Max(0, Math.Min(maxLv, raw));

                flatAtk += t["atkPerLv"].AsNumber(0) * lv;
                flatHp += t["hpPerLv"].AsNumber(0) * lv;
                gearBasePct += t["gearBasePctPerLv"].AsNumber(0) * lv;
                aspdBonus += t["aspdPerLv"].AsNumber(0) * lv;
                critRate += t["critRatePerLv"].AsNumber(0) * lv;
                critDmgPct += t["critDmgPerLv"].AsNumber(0) * lv;
                dodgeBonus += t["dodgePerLv"].AsNumber(0) * lv;
                flatDef += t["defPerLv"].AsNumber(0) * lv;
                if (id == "healer") healer += lv;
            }

            return new TalentTotals
            {
                flatAtk = JsMath.RoundLong(flatAtk),
                flatHp = JsMath.RoundLong(flatHp),
                gearBasePct = JsMath.ToFixed(gearBasePct, 3),
                aspdBonus = JsMath.ToFixed(aspdBonus, 3),
                critRate = JsMath.ToFixed(critRate, 3),
                critDmgPct = JsMath.ToFixed(critDmgPct, 3),
                dodgeBonus = JsMath.ToFixed(dodgeBonus, 3),
                flatDef = JsMath.RoundLong(flatDef),
                healer = healer,
            };
        }

        public struct RuneStatTotals
        {
            public double atk, hp, critBonus, aspdBonus, dodgeBonus, defFlat;
            public JsonValue root;
        }

        /// <summary>computeTotalEquippedRunesStats().</summary>
        public static RuneStatTotals ComputeRuneTotals(GameData.GameData data, StatsInput input)
        {
            var eq = input.EquippedRuneSlots;
            string tierId = string.IsNullOrEmpty(input.RuneQualityTier) ? "mythic" : input.RuneQualityTier;
            bool enchantOn = input.RuneMythicEnchant;

            double atk = 0, hp = 0, critBonus = 0, aspdBonus = 0, dodgeBonus = 0;

            string[] cats = { "etched", "blessing", "enhancement", "ability" };
            foreach (var cat in cats)
            {
                var statTbl = data.RuneBaseStats.Get(cat);
                if (statTbl.IsNull) statTbl = data.RuneBaseStats.Get("enhancement");
                var tierStat = statTbl[tierId];
                if (tierStat.Kind == JsonKind.Null) tierStat = statTbl["mythic"];

                var ids = eq[cat];
                int count = ids.IsArray ? ids.Count : 0;
                atk += tierStat["atk"].AsNumber(0) * count;
                hp += tierStat["hp"].AsNumber(0) * count;

                if (enchantOn)
                {
                    if (cat == "blessing") { atk += 120 * count; hp += 480 * count; }
                    else if (cat == "enhancement") { atk += 120 * count; critBonus += 0.04 * count; }
                    else if (cat == "ability") { hp += 480 * count; }
                }
            }

            if (IsRuneEquipped(eq, "sharp_arrow")) critBonus += enchantOn ? 0.12 : 0.05;
            if (IsRuneEquipped(eq, "arrow_rain")) aspdBonus += 0.30;
            if (IsRuneEquipped(eq, "lucky_shadow")) dodgeBonus += 0.10;
            if (IsRuneEquipped(eq, "resilience")) hp = JsMath.RoundLong(hp * 1.30);

            var root = JsonValue.Object();
            root.Set("atk", atk).Set("hp", hp).Set("critBonus", critBonus)
                .Set("aspdBonus", aspdBonus).Set("dodgeBonus", dodgeBonus).Set("defFlat", 0);

            return new RuneStatTotals
            {
                atk = atk, hp = hp, critBonus = critBonus,
                aspdBonus = aspdBonus, dodgeBonus = dodgeBonus, defFlat = 0, root = root,
            };
        }

        private static bool IsRuneEquipped(JsonValue eq, string runeId)
        {
            if (!eq.IsObject) return false;
            foreach (var cat in new[] { "etched", "blessing", "enhancement", "ability" })
            {
                var arr = eq[cat];
                if (!arr.IsArray) continue;
                foreach (var id in arr.Items)
                    if (id.AsString(null) == runeId) return true;
            }
            return false;
        }

        public struct ArtifactStatTotals
        {
            public double flatAtk, flatHp;
            public JsonValue root;
        }

        /// <summary>computeAllArtifactsAndSetsBonuses().</summary>
        public static ArtifactStatTotals ComputeArtifactTotals(GameData.GameData data, StatsInput input)
        {
            double flatAtk = 0, flatHp = 0;
            double setAtkPct = 0, setHpPct = 0, specAtkPct = 0, specHpPct = 0;
            double gearBasePct = 0, aspdBonus = 0, critRate = 0, critDmgPct = 0, dodgeBonus = 0;
            double dmgReducPct = 0, mainWepDmgPct = 0, strikeDmgPct = 0, meteorDmgPct = 0;
            double circleDmgPct = 0, spriteDmgPct = 0;

            foreach (var a in data.Artifacts.All)
            {
                int star = ArtifactStarLevel(input, a["id"].AsString());
                double mult = star <= 0 ? 0 : 1.0 + star * 0.50;
                bool owned = star > 0;
                if (owned)
                {
                    flatAtk += JsMath.RoundLong(a["baseAtk"].AsNumber(0) * mult);
                    flatHp += JsMath.RoundLong(a["baseHp"].AsNumber(0) * mult);
                }

                if (!owned) continue;
                var sb = a["specialBonus"];
                if (!sb.IsObject) continue;
                specAtkPct += sb["atkPct"].AsNumber(0) + sb["allDmgPct"].AsNumber(0);
                specHpPct += sb["hpPct"].AsNumber(0);
                gearBasePct += sb["gearBasePct"].AsNumber(0);
                aspdBonus += sb["aspdBonus"].AsNumber(0);
                critRate += sb["critRate"].AsNumber(0);
                critDmgPct += sb["critDmgPct"].AsNumber(0);
                dodgeBonus += sb["dodgeBonus"].AsNumber(0);
                dmgReducPct += sb["dmgReducPct"].AsNumber(0);
                mainWepDmgPct += sb["mainWepDmgPct"].AsNumber(0);
                strikeDmgPct += sb["strikeDmgPct"].AsNumber(0);
                meteorDmgPct += sb["meteorDmgPct"].AsNumber(0);
                circleDmgPct += sb["circleDmgPct"].AsNumber(0);
                spriteDmgPct += sb["spriteDmgPct"].AsNumber(0);
            }

            // 13 bộ: cấp bộ = min sao của thành viên; chỉ tính khi đã sở hữu đủ.
            foreach (var s in data.ArtifactSets.All)
            {
                var members = s["members"];
                if (!members.IsArray || members.Count == 0) continue;
                int minStar = int.MaxValue;
                foreach (var m in members.Items)
                    minStar = Math.Min(minStar, ArtifactStarLevel(input, m.AsString()));
                if (minStar == int.MaxValue || minStar <= 0) continue;

                int tierIdx = Math.Min(5, minStar / 3);
                var tiers = s["tiersPct"];
                double pctVal = tierIdx < tiers.Count ? tiers[tierIdx].AsNumber(0) : tiers[0].AsNumber(0);
                setAtkPct += pctVal / 100.0;
                setHpPct += pctVal / 100.0;
            }

            var root = JsonValue.Object();
            root.Set("flatAtk", flatAtk).Set("flatHp", flatHp)
                .Set("totalAtkPct", JsMath.ToFixed(setAtkPct + specAtkPct, 4))
                .Set("totalHpPct", JsMath.ToFixed(setHpPct + specHpPct, 4))
                .Set("setAtkPct", JsMath.ToFixed(setAtkPct, 4))
                .Set("setHpPct", JsMath.ToFixed(setHpPct, 4))
                .Set("gearBasePct", JsMath.ToFixed(gearBasePct, 3))
                .Set("aspdBonus", JsMath.ToFixed(aspdBonus, 3))
                .Set("critRate", JsMath.ToFixed(critRate, 3))
                .Set("critDmgPct", JsMath.ToFixed(critDmgPct, 3))
                .Set("dodgeBonus", JsMath.ToFixed(dodgeBonus, 3))
                .Set("dmgReducPct", JsMath.ToFixed(dmgReducPct, 3))
                .Set("mainWepDmgPct", JsMath.ToFixed(mainWepDmgPct, 3))
                .Set("strikeDmgPct", JsMath.ToFixed(strikeDmgPct, 3))
                .Set("meteorDmgPct", JsMath.ToFixed(meteorDmgPct, 3))
                .Set("circleDmgPct", JsMath.ToFixed(circleDmgPct, 3))
                .Set("spriteDmgPct", JsMath.ToFixed(spriteDmgPct, 3))
                .Set("defFlat", JsMath.ToFixed(dmgReducPct * 0, 3)); // DEF lấy từ specialBonus.defFlat bên dưới

            root.Set("defFlat", 0);
            return new ArtifactStatTotals { flatAtk = flatAtk, flatHp = flatHp, root = root };
        }

        /// <summary>Bộ trang bị đang kích hoạt: mốc 2/4/6 món.</summary>
        public struct SetBonus
        {
            public string id;
            public int count;
            public double atk, crit, dodge, hp, aspd, critDmgPct;
        }

        public static List<SetBonus> SetBonuses(GameData.GameData data, StatsInput input)
        {
            var counts = new Dictionary<string, int>(StringComparer.Ordinal);
            foreach (var slot in GameData.GameData.GearSlotOrder)
            {
                if (!input.EquippedGear.TryGetValue(slot, out var item)) continue;
                string set = SetIdOf(data, item["templateId"].AsString());
                if (set == null) continue;
                counts.TryGetValue(set, out int c);
                counts[set] = c + 1;
            }

            var result = new List<SetBonus>();
            foreach (var kv in counts)
            {
                var m = data.GearSets.Get(kv.Key);
                if (m.IsNull) continue;
                int n = kv.Value;
                result.Add(new SetBonus
                {
                    id = kv.Key,
                    count = n,
                    atk = Tier(m, "atk", n),
                    crit = Tier(m, "crit", n),
                    dodge = Tier(m, "dodge", n),
                    hp = Tier(m, "hp", n),
                    aspd = Tier(m, "aspd", n),
                    critDmgPct = Tier(m, "critDmgPct", n),
                });
            }
            return result;
        }

        private static double Tier(JsonValue meta, string key, int count)
        {
            string suffix = count >= 6 ? "6" : count >= 4 ? "4" : count >= 2 ? "2" : null;
            if (suffix == null) return 0;
            return meta[key + suffix].AsNumber(0);
        }

        /// <summary>getGearSetId(templateId) — template → set id.</summary>
        public static string SetIdOf(GameData.GameData data, string templateId)
        {
            var tpl = data.GearTemplates.Get(templateId);
            string set = tpl["wikiSet"].AsString(null);
            if (string.IsNullOrEmpty(set)) return null;
            // GEAR_SET_META dùng key nội bộ (phoenix, shadow…) không phải nhãn wikiSet.
            foreach (var kv in data.GearSets.Entries())
            {
                var tpls = kv.Value["templates"];
                if (!tpls.IsArray) continue;
                foreach (var t in tpls.Items)
                    if (t.AsString(null) == templateId) return kv.Key;
            }
            return null;
        }

        /// <summary>getHeroStarLevel(): clamp 0..8, chưa có trong save = 0.</summary>
        public static int HeroStarLevel(StatsInput input, string heroId)
        {
            if (heroId == null) heroId = input.SelectedHeroId;
            if (input.HeroStars.TryGetValue(heroId, out var raw) && !double.IsNaN(raw))
                return (int)Math.Max(0, Math.Min(8, raw));
            return 0;
        }

        /// <summary>getArtifactStarLevel(): clamp 0..15, chưa có = 0.</summary>
        public static int ArtifactStarLevel(StatsInput input, string artifactId)
        {
            if (artifactId == null) return 0;
            if (input.ArtifactStars.TryGetValue(artifactId, out var raw) && !double.IsNaN(raw))
                return (int)Math.Max(0, Math.Min(15, raw));
            return 0;
        }

        public static JsonValue MilestoneFor(GameData.GameData data, int star)
        {
            int clamped = Math.Max(0, Math.Min(8, star));
            JsonValue first = JsonValue.Object();
            bool any = false;
            foreach (var m in data.StarMilestones.All)
            {
                if (!any) { first = m; any = true; }
                if (m["star"].AsInt(-1) == clamped) return m;
            }
            return first;
        }

        /// <summary>
        /// getHeroSkinsList(heroId).
        ///
        /// 4 hero (artemis, alex, nyanja, atreus) có bộ skin curate sẵn trong
        /// HERO_SKINS. 14 hero còn lại nhận bộ 3 skin SINH ĐỘNG với hệ số khác
        /// (default +0.03 aspd, legendary +0.08, mythic +0.14) — bỏ qua nhánh sinh
        /// này sẽ làm ASPD/CRIT của hero mới lệch, đúng như test parity đã phát hiện.
        /// </summary>
        public static JsonValue SkinsForHero(GameData.GameData data, string heroId)
        {
            var curated = data.HeroSkins.Get(heroId);
            if (curated.IsArray) return curated;

            var h = data.Heroes.Get(heroId);
            if (h.IsNull) h = FirstOf(data.Heroes);
            string hid = h["id"].AsString(heroId);
            string hname = h["name"].AsString(hid);
            string hcolor = h["color"].AsString("#38bdf8");
            var generated = JsonValue.Array();
            generated.Items.Add(SkinObj(hid, hid + "_default", 0, hname, 38, 150, 0.03, 0.02));
            generated.Items.Add(SkinObj(hid, hid + "_legendary", 1, hname, 145, 580, 0.08, 0.07));
            generated.Items.Add(SkinObj(hid, hid + "_mythic", 2, hname, 295, 1180, 0.14, 0.12));
            return generated;
        }

        private static JsonValue SkinObj(string heroId, string id, int idx, string heroName,
            double atk, double hp, double aspd, double crit)
        {
            var o = JsonValue.Object();
            o.Set("id", id).Set("heroId", heroId).Set("idx", idx)
             .Set("name", heroName + " (skin " + idx + ")")
             .Set("bonusAtk", atk).Set("bonusHp", hp)
             .Set("bonusAspd", aspd).Set("bonusCrit", crit);
            return o;
        }

        /// <summary>getActiveHeroSkin(): chưa chọn = idx 0 (skin mặc định).</summary>
        public static JsonValue ActiveHeroSkin(GameData.GameData data, StatsInput input, string heroId)
        {
            var list = SkinsForHero(data, heroId);
            if (!list.IsArray || list.Count == 0) return JsonValue.Object();

            double idxRaw = input.HeroSelectedSkins.TryGetValue(heroId, out var v) ? v : 0;
            int idx = (int)Math.Max(0, Math.Min(list.Count - 1, idxRaw));
            return list[idx];
        }

        public struct SkinCollectionBonus { public double atk, hp; }

        /// <summary>getAllUnlockedSkinBonuses(): 25% bonus của mọi skin đã mở, trên hero đã sở hữu.</summary>
        public static SkinCollectionBonus AllUnlockedSkinBonuses(GameData.GameData data, StatsInput input)
        {
            double atk = 0, hp = 0;
            foreach (var h in data.Heroes.All)
            {
                string heroId = h["id"].AsString();
                if (!IsHeroOwned(input, heroId)) continue;
                var skins = SkinsForHero(data, heroId);
                if (!skins.IsArray) continue;
                foreach (var sk in skins.Items)
                {
                    if (!IsSkinUnlocked(input, sk["id"].AsString())) continue;
                    atk += JsMath.RoundLong(sk["bonusAtk"].AsNumber(0) * 0.25);
                    hp += JsMath.RoundLong(sk["bonusHp"].AsNumber(0) * 0.25);
                }
            }
            return new SkinCollectionBonus { atk = atk, hp = hp };
        }

        /// <summary>isHeroOwned(): ≥1 sao, hoặc đang là hero xuất chiến.</summary>
        public static bool IsHeroOwned(StatsInput input, string heroId)
        {
            if (string.IsNullOrEmpty(heroId)) return false;
            if (HeroStarLevel(input, heroId) >= 1) return true;
            return heroId == input.SelectedHeroId;
        }

        /// <summary>isHeroSkinUnlocked(): save chưa có trường -> chỉ skin *_default.</summary>
        public static bool IsSkinUnlocked(StatsInput input, string skinId)
        {
            if (string.IsNullOrEmpty(skinId)) return false;
            if (skinId.EndsWith("_default", StringComparison.Ordinal)) return true;
            return input.UnlockedSkins.Contains(skinId);
        }

        public static JsonValue SeasonCareerMeta(GameData.GameData data, string careerId)
        {
            if (string.IsNullOrEmpty(careerId)) return JsonValue.Null;
            var careers = data.Season["careers"];
            if (!careers.IsArray) return JsonValue.Null;
            foreach (var c in careers.Items)
                if (c["id"].AsString(null) == careerId) return c;
            return JsonValue.Null;
        }

        // ---------- tiện ích ----------

        private static JsonValue FirstOf(GameData.DataTable t)
        {
            foreach (var v in t.All) return v;
            return JsonValue.Object();
        }

        private static double Num(JsonValue v, string key) => v.IsObject ? v[key].AsNumber(0) : 0;
        private static double All(JsonValue v, string key) => v.IsObject ? v[key].AsNumber(0) : 0;
        private static double NumberOrZero(JsonValue v) => v.AsNumber(0);
    }
}
