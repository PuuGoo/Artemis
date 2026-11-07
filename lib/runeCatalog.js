// Rune catalog order matches the user-provided Archero 2 wiki tables.
export const RUNE_IDS = Object.freeze(["echo_scythe", "arrow_of_echoes", "elemental_crit", "elemental_domain", "sword_strike_split", "sword_strike_aerie", "meteor_split", "potion_spring", "pulsing_orb", "orbital_orb", "sprites_awe", "sprite_assist", "life_surge", "rune_valkyrie", "rabbits_foot", "guardian", "lucky_shadow", "intelligence", "devil_pact", "resilience", "sharp_arrow", "dragonflight_sword", "ricocheting_strike", "rune_flame", "rune_frost", "sawblade_circle", "rotating_spd_up", "giant_meteor", "potion_magnet", "sprite_multishot", "sprite_link", "rootguard", "vine_bind", "arrow_rain", "ring_of_agony", "sword_of_time", "star_of_time", "star_of_fury", "flame_poison_touch", "rune_thunder", "ability_circle", "healing_sprite", "melee_sprite", "strike_potion", "plant_summon", "equinox_bloom"]);
export const RUNE_TIERS = Object.freeze(['normal','fine','rare','epic','epic_1','epic_2','legendary','legendary_1','legendary_2','legendary_3','mythic']);
export function runePool(pool, promised) {
  if (!promised) return RUNE_IDS;
  const words = pool==='weapon_meteor' ? /sword|arrow|weapon|meteor|potion|star|scythe/ : pool==='sprite_strike' ? /sprite|strike|dragon|revive|valkyrie|guardian|aerie/ : /flame|frost|thunder|orb|ring|seal|touch|circle|elemental/;
  const picked = RUNE_IDS.filter(id=>words.test(id));
  return picked.length ? picked : RUNE_IDS;
}
export function addRuneDrop(stones, ranks, id, quality) {
  if (!RUNE_IDS.includes(id)) throw new Error('Unknown rune');
  const index=Math.max(0,Math.min(3,Math.floor(Number(quality)||0)));
  const nextStones={...stones};
  const pile={...(nextStones[id]||{})};
  // Legacy rank from the previous release represented one owned stone.
  if (!Object.values(pile).some(v=>Number(v)>0) && Number(ranks[id])>0) {
    pile[RUNE_TIERS[Math.min(10,Math.max(0,Number(ranks[id])-1))]]=1;
  }
  pile[RUNE_TIERS[index]]=(Number(pile[RUNE_TIERS[index]])||0)+1;
  for (let i=0;i<RUNE_TIERS.length-1;i++) {
    const key=RUNE_TIERS[i];
    while ((Number(pile[key])||0)>=3) {
      pile[key]-=3;
      const next=RUNE_TIERS[i+1];
      pile[next]=(Number(pile[next])||0)+1;
    }
  }
  nextStones[id]=pile;
  let rank=0;
  for (let i=RUNE_TIERS.length-1;i>=0;i--) if ((Number(pile[RUNE_TIERS[i]])||0)>0) {rank=i+1;break;}
  return { stones:nextStones, ranks:{...ranks,[id]:rank},rank };
}
