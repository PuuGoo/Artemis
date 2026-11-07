// Stable IDs shared by the server purchase endpoint and rune board.
export const RUNE_IDS = Object.freeze(["echo_scythe", "arrow_of_echoes", "elemental_crit", "elemental_domain", "sword_strike_split", "sword_strike_aerie", "meteor_split", "potion_spring", "pulsing_orb", "orbital_orb", "sprites_awe", "sprite_assist", "life_surge", "rune_valkyrie", "rabbits_foot", "guardian", "lucky_shadow", "intelligence", "devil_pact", "resilience", "sharp_arrow", "dragonflight_sword", "ricocheting_strike", "rune_flame", "rune_frost", "sawblade_circle", "rotating_spd_up", "giant_meteor", "potion_magnet", "sprite_multishot", "sprite_link", "rootguard", "vine_bind", "arrow_rain", "ring_of_agony", "sword_of_time", "star_of_time", "star_of_fury", "flame_poison_touch", "rune_thunder", "ability_circle", "healing_sprite", "melee_sprite", "strike_potion", "plant_summon", "equinox_bloom"]);
export function runeEngravingCost(gearLevel, ownedCount) {
  const level = Math.max(1, Math.min(100, Math.floor(Number(gearLevel)||1)));
  const owned = Math.max(0, Math.min(506, Math.floor(Number(ownedCount)||0)));
  return Math.min(4500, 300 + (level-1)*35 + Math.floor(owned/10)*80);
}
