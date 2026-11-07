/* Dữ liệu tham chiếu; sinh bằng tools/import-skill-art.py. */
globalThis.SkillArtData = {
  "sources": {
    "wiki": {
      "url": "https://archero-2.game-vault.net/wiki/Skills",
      "revision": 1858,
      "sha256": "6d745aab339123006703f233ac53b80c526f589e52d60d79f69ec142fbd51b54"
    },
    "editorial": {
      "url": "https://mobi.gg/en/tips/archero-2-skill-tier-list/",
      "sha256": "03f2cdc2044d3f9be6de2874df8b70119165f10faaccdc830e09dcc11ba0863d",
      "note": "S–F là xếp hạng biên tập, không phải độ hiếm. Giữ nguyên mô tả; không suy ra số từ ↑."
    }
  },
  "wiki": [
    {
      "name": "Warrior's Soul",
      "rarity": "legend",
      "description": "Warrior's Soul ATK PWR ↑↑↑↑",
      "effects": "Increases your Attack Power by 30%."
    },
    {
      "name": "Power Trio",
      "rarity": "legend",
      "description": "Power Trio Max HP ↑↑↑, ATK SPD ↑↑↑, ATK PWR ↑↑↑",
      "effects": "Increases your Attack Power by 15%, your Attack Speed by 20%, and your Max HP by 20%,"
    },
    {
      "name": "Multishot",
      "rarity": "legend",
      "description": "Multishot Multishot +1 projectile",
      "effects": "Multishot launches a second volley of main weapon projectiles at the cost of 8 frames added to the attack cycle duration."
    },
    {
      "name": "Corrosive Field",
      "rarity": "legend",
      "description": "Corrosive Field Nearby monsters take damage and become vulnerable",
      "effects": "Nearby monsters become vulnerable and receive 35% more damage. The area around you also deals 0.5x Attack Power as damage per hit, hitting at 0.3-second intervals."
    },
    {
      "name": "Energy Beam",
      "rarity": "legend",
      "description": "Energy Beam Charge up to release a powerful penetrating laser",
      "effects": "Charge up to release a powerful beam that deals 0.7x Attack Power as damage per hit ( 4 hits per beam ), and dealing Bow explosion (when it procs) and Lightning/Fire damage from their respective main weapon skills on 1st and 3rd hit. Applies a 0.6x Attack Speed multiplier . Can be enhanced by Charged Arrow to deal 0.85x Attack Power as damage per hit. Can enhance Energy Rings ."
    },
    {
      "name": "Soul of Strength",
      "rarity": "legend",
      "description": "Soul of Strength Max HP ↑↑↑↑",
      "effects": "Increases your Max HP by 40%"
    },
    {
      "name": "Sacred Protection",
      "rarity": "legend",
      "description": "Sacred Protection Gain SHLD that blocks 1 hit per wave",
      "effects": "You gain a Shield that blocks 1 hit per wave (1 hit every 30 seconds for timed chapters and Abyssal, Max 4 stacks ) ."
    },
    {
      "name": "Sprite King",
      "rarity": "legend",
      "description": "Sprite King Receive a powerful Sprite king",
      "effects": "Receive Sprite King companion that shoots beams dealing 0.6x Attack Power as damage per hit ( 4 hits per beam ), beams have tracking ."
    },
    {
      "name": "Super Meteor",
      "rarity": "legend",
      "description": "Super Meteor Meteors continuously fall, releasing large shockwaves",
      "effects": "Casts a random element meteor every 4 seconds. All meteors are now dealing 1.25x Attack Power as damage per hit, on initial drop, if the meteor falls further away, it deals less damage. It then explodes a large area, dealing 1x Attack Power as damage to everyone in range."
    },
    {
      "name": "Beam Strike",
      "rarity": "legend",
      "description": "Beam Strike Summon a flying sword that fires lasers periodically",
      "effects": "Summon 1 Strike every 2.5 seconds that shoots beams dealing 0.5x Attack Power as damage per hit ( 4 hits per beam ). All other Strikes are now shooting beams as well."
    },
    {
      "name": "Circle Web",
      "rarity": "legend",
      "description": "Circle Web All rotating orbs form a web",
      "effects": "All your circling orbs connect to form a web , each hit of the web deals 0.2x Attack Power as damage. (Note: Damage scaling for this ability is currently bugged.)"
    },
    {
      "name": "ATK Increase",
      "rarity": "epic",
      "description": "ATK Increase ATK PWR ↑↑↑",
      "effects": "Increases your Attack Power by 25% ."
    },
    {
      "name": "Giant's Strength",
      "rarity": "epic",
      "description": "Giant's Strength Max HP ↑↑↑, ATK PWR ↑↑↑, MOV SPD ↓↓, Size ↑↑",
      "effects": "Increases your Attack Power by 20%, your Max HP by 25% , decreases your Movement Speed , and increases your Size ."
    },
    {
      "name": "Weapon Enchantment",
      "rarity": "epic",
      "description": "Weapon Enchantment Your weapon detaches and will automatically attack enemies, ATK PWR ↓↓↓, Attack Speed ↓↓↓",
      "effects": "Your weapon detaches and automatically attacks enemies . Reduces your Attack Power by 30% . Reduces your Attack Speed."
    },
    {
      "name": "Soul of Swiftness",
      "rarity": "epic",
      "description": "Soul of Swiftness ATK SPD ↑↑↑↑, MOV SPD ↑↑↑↑",
      "effects": "Increases your Attack Speed by 25% , greatly increases your Movement Speed"
    },
    {
      "name": "Tracking Eye",
      "rarity": "epic",
      "description": "Tracking Eye Projectiles can track enemies (Best with Staff)",
      "effects": "Your projectiles gain the ability to track enemies . Reduces DMG dealt by 10% (doesn't affect Sprites or elemental damage). Reduces main weapon and Strike projectile speed by 50 %."
    },
    {
      "name": "Diagonal Arrow",
      "rarity": "epic",
      "description": "Diagonal Arrow Add 2 Projectiles that shoot diagonally",
      "effects": "Adds 2 projectiles that shoot diagonally from your character."
    },
    {
      "name": "Energy Ring",
      "rarity": "epic",
      "description": "Energy Ring Charge up to release a powerful energy ring",
      "effects": "Charge up to release a powerful energy ring that deals 0.7x Attack Power as damage per hit and can hit up to 11 times. Deals Bow explosion (when it procs) and Lightning/Fire damage from their respective main weapon skills on every hit. Applies a 0.6x Attack Speed multiplier. Can be enhanced by: Energy Beam to double the hit rate leaving damage per hit the same, deals Bow explosion/Lightning/Fire damage only on odd hits (1st, 3rd, 5th etc). Charged Arrow to increase projectile speed and damage per hit to 1.1x Attack Power , deals Bow explosion/Lightning/Fire damage on every hit. Energy Beam AND Charged Arrow to double the hit rate , increase projectile speed and deal 0.65x Attack Power as damage per hit, deals Bow explosion/Lightning/Fire damage only on odd hits."
    },
    {
      "name": "Wall-Piercing Arrow",
      "rarity": "epic",
      "description": "Wall-Piercing Arrow Projectiles can pass through obstacles",
      "effects": "Your main weapon projectiles gain the ability to pass through obstacles . This ability only appears in levels with walls."
    },
    {
      "name": "Wind Blessing",
      "rarity": "epic",
      "description": "Wind Blessing MOV SPD ↑, Size ↓↓, Chance of dodging",
      "effects": "Increases your Movement Speed , decreases your Size , and grants a chance to Dodge incoming attacks."
    },
    {
      "name": "Water Walker",
      "rarity": "epic",
      "description": "Water Walker Can walk on water, MOV SPD ↑↑",
      "effects": "Increases your Movement Speed and grants you the ability to walk on water. This ability only appears in levels with water obstacles."
    },
    {
      "name": "Slow Field",
      "rarity": "epic",
      "description": "Slow Field Slow down nearby Projectiles and monsters",
      "effects": "Creates a field that slows down nearby projectiles and monsters."
    },
    {
      "name": "Revive",
      "rarity": "epic",
      "description": "Revive Revive once with full HP upon death",
      "effects": "Upon death, you revive once with full HP , restoring 100% of your HP . Only available through Devil and Valkyrie."
    },
    {
      "name": "Super Blaze",
      "rarity": "epic",
      "description": "Super Blaze Flame effects greatly enhanced (Fire Effect)",
      "effects": "Increases Fire damage by 150% doubles the Burn tick rate to 10 ticks per second."
    },
    {
      "name": "Super Bolt",
      "rarity": "epic",
      "description": "Super Bolt Lightning effects greatly enhanced (Lightning Effect)",
      "effects": "Increases Lightning damage by 50% . Effect can now hit up to 8 targets within 12m* radius . Can be applied twice per beam . (Note: Not guaranteed to hit initial target if the number of enemies in affected area exceeds 8.) *: Ring of Agony has 7m radius"
    },
    {
      "name": "Super Venom",
      "rarity": "epic",
      "description": "Super Venom Poison effects greatly enhanced (Poison Effect)",
      "effects": "Increases Venom damage by 200% , chance to trigger an additional +400% damage proc ."
    },
    {
      "name": "Super Freeze",
      "rarity": "epic",
      "description": "Super Freeze Freeze effects greatly enhanced (Ice Effect)",
      "effects": "Increases Freeze on-hit damage to 3x Attack Power and deals 1x Attack Power as damage after Freeze expires, increases Freeze duration to 2.1s"
    },
    {
      "name": "Laser Sprite",
      "rarity": "epic",
      "description": "Laser Sprite Receive a Laser Sprite",
      "effects": "Receive a Laser Sprite companion that shoots beams dealing 0.5x Attack Power as damage per hit ( 4 hits per beam )"
    },
    {
      "name": "Sprite Frenzy",
      "rarity": "epic",
      "description": "Sprite Frenzy All sprite ATK PWR and ATK SPD greatly enhanced",
      "effects": "Increases Sprite base damage by 50% , including elemental damage coming from them, greatly increases Sprite Attack Speed."
    },
    {
      "name": "Meteor Pursuit",
      "rarity": "epic",
      "description": "Meteor Pursuit Chance of casting a meteor when attacking",
      "effects": "You gain a chance to cast a meteor when you attack. Each meteor deals 1.25x Attack Power as damage per hit and will always be a random element ."
    },
    {
      "name": "Chain Meteors",
      "rarity": "epic",
      "description": "Chain Meteors Doubles the chance of casting",
      "effects": "Gives a chance to cast 2 meteors instead of 1 ."
    },
    {
      "name": "Beam Circle",
      "rarity": "epic",
      "description": "Beam Circle Get 2 circling Laser Orbs",
      "effects": "Receive 2 circling Laser Orbs . These Orbs deal 1.25x Attack Power as damage per hit and regularly shoot a laser that deals 1x Attack Power as damage."
    },
    {
      "name": "Super Circle",
      "rarity": "epic",
      "description": "Super Circle Receives 4 powerful neutral non-elemental balls",
      "effects": "Receive 4 circling Non-elemental Orbs . Each orb deals 1.25x Attack Power as damage per hit."
    },
    {
      "name": "Magic Strike",
      "rarity": "epic",
      "description": "Magic Strike Flying swords can inherit the element of the main weapon",
      "effects": "Your Strikes gain the ability to inherit the element of your main weapon , allowing them to apply Blaze, Venom, Freeze, Bolt, Lightwing, or Bow explosion effects if you have those."
    },
    {
      "name": "Strike Boost",
      "rarity": "epic",
      "description": "Strike Boost Strike ATK ↑↑↑↑",
      "effects": "Increase Strike base damage by 50% ."
    },
    {
      "name": "Twin Strike",
      "rarity": "epic",
      "description": "Twin Strike Doubles the number of flying swords summoned",
      "effects": "Doubles the number of Strikes summoned by your abilities."
    },
    {
      "name": "Underworld Warrior",
      "rarity": "rare",
      "description": "Underworld Warrior ATK PWR ↑↑, Demon guaranteed to appear after defeating a boss",
      "effects": "Increases your Attack Power by 10% . After defeating a boss, a Demon is guaranteed to appear ."
    },
    {
      "name": "Demon Slayer",
      "rarity": "rare",
      "description": "Demon Slayer Increases ATK PWR for a period of time after killing monsters",
      "effects": "Increases your Attack Power by 10% after killing a monster, stacks up to a maximum of +50% Attack Power. Lasts 3 seconds"
    },
    {
      "name": "Warrior's Heart",
      "rarity": "rare",
      "description": "Warrior's Heart Picking up hearts has a chance to boost ATK PWR",
      "effects": "Picking up hearts has a chance to increase your Attack Power by 5% per proc, stacks up to a maximum of +50% Attack Power ."
    },
    {
      "name": "Stand Strong",
      "rarity": "rare",
      "description": "Stand Strong Standing still longer increases ATK SPD and DMG",
      "effects": "The more you attack without moving, the higher your Attack Speed and Attack Power become. Gain one stack of +5% Attack Power per attack up to 9 stacks , reaching a maximum of +45% Attack Power. Gain one stack of +15% Attack Speed per attack up to 10 stacks, reaching a maximum of +150% Attack Speed."
    },
    {
      "name": "Short-Range Strike",
      "rarity": "rare",
      "description": "Short-Range Strike ATK Range ↓↓, ATK Power ↑↑↑, ATK SPD ↑↑↑",
      "effects": "Increases your Attack Power by 20% and your Attack Speed by 100% , reduces your Attack Range to 7m ."
    },
    {
      "name": "Perilous Fervor",
      "rarity": "rare",
      "description": "Perilous Fervor When HP is below 50%, ATK PWR ↑↑↑↑, ATK SPD ↑↑↑↑",
      "effects": "When your HP is below 50% , increases your Attack Power by 30% and your Attack Speed by 30% ."
    },
    {
      "name": "Lightwing Arrow",
      "rarity": "rare",
      "description": "Lightwing Arrow Projectiles have a chance to sprout wings and deal major DMG to monsters",
      "effects": "Your main weapon projectiles gain a chance to sprout wings and deal 100% more DMG (if DMG was reduced to 80% by Swift Arrow, total DMG will be 180%, if it was increased by Boss Slayer to 125%, the total will be 225%, etc). Doesn't affect elemental or Bow explosion damage. Can affect Strikes (only with Magic Strike skill)."
    },
    {
      "name": "Swift Arrow",
      "rarity": "rare",
      "description": "Swift Arrow ATK SPD ↑↑↑↑↑, ATK PWR ↓↓↓, Bullet Size ↓↓↓, Some dispersion",
      "effects": "Increases your Attack Speed by 100% , reduces DMG dealt by 20% ( doesn't affect Sprites or elemental damage), decreases Projectile Size , and causes some dispersion ."
    },
    {
      "name": "Fairy of the Wind",
      "rarity": "rare",
      "description": "Fairy of the Wind ATK SPD ↑, MOV SPD ↑↑",
      "effects": "Increases your Attack Speed by 10% and Movement Speed by 10% ."
    },
    {
      "name": "Front Arrow",
      "rarity": "rare",
      "description": "Front Arrow Front shooting arrows +1",
      "effects": "Adds 1 forward-firing arrow to your attacks. Reduces Main weapon DMG by 15% for each copy of the skill (doesn't affect elemental or Bow explosion damage)"
    },
    {
      "name": "Charged Arrow",
      "rarity": "rare",
      "description": "Charged Arrow Charge to launch a giant arrow",
      "effects": "Charge up to launch a giant arrow that deals 2x Attack Power as damage and can pierce enemies and obstacles . Applies a 0.7x Attack Speed multiplier . Can enhance Energy Beam and Energy Ring ."
    },
    {
      "name": "Piercing Arrow",
      "rarity": "rare",
      "description": "Piercing Arrow Projectiles can penetrate enemies",
      "effects": "Your main weapon projectiles gain the ability to penetrate through enemies . (Note: This ability is less effective with Staff weapons.)"
    },
    {
      "name": "Split Shot",
      "rarity": "rare",
      "description": "Split Shot Projectiles can split",
      "effects": "Your forward-firing projectiles gain the ability to split into 3 smaller ones , with each split projectile dealing 0.33x initial damage (elemental and Bow explosion effects deal full damage)."
    },
    {
      "name": "Ricochet Arrow",
      "rarity": "rare",
      "description": "Ricochet Arrow Projectiles can bounce between monsters +1 bounce",
      "effects": "Your projectiles can bounce between monsters , gaining +1 bounce for each copy of the skill. Each ricochet hit deals 60% of initial damage (elemental and Bow explosion effects deal full damage). Beam projectiles deal full damage, but for every Ricochet Arrow taken that many first targets will only receive damage from 3 of the 4 beam hits (Tracking Eye fixes this and makes it work like Bounce Arrow skill instead)."
    },
    {
      "name": "Lucky Band-Aid",
      "rarity": "rare",
      "description": "Lucky Band-Aid Luck ↑↑, Deals DMG to all enemies on-screen and clears enemy Projectiles after",
      "effects": "Increases your Luck . Deals 2x Attack Power as damage to most enemies on-screen and clears enemy projectiles ; however, it has a blindspot in very close proximity."
    },
    {
      "name": "Lucky Cracker",
      "rarity": "rare",
      "description": "Lucky Cracker Luck Value ↑↑↑, Dodge Rate ↑↑",
      "effects": "Increases your Luck and your Dodge Rate ."
    },
    {
      "name": "Cloudfooted",
      "rarity": "rare",
      "description": "Cloudfooted Continuously unleash gusts to push back and damage enemies, MOV SPD ↑↑↑",
      "effects": "Unleash gusts to push back and damage enemies every 3 seconds . Each hit deals 0.1x Attack Power as damage (up to 15 hits ). Your Movement Speed is also significantly increased ."
    },
    {
      "name": "Lucky Heart",
      "rarity": "rare",
      "description": "Lucky Heart Picking up hearts has a chance to increase Max HP",
      "effects": "Picking up hearts has a chance to increase your Max HP by 3% per proc , stacks up to a maximum of +30% Max HP ."
    },
    {
      "name": "Fountain of Life",
      "rarity": "rare",
      "description": "Fountain of Life Max HP ↑↑, Fully heal on pickup",
      "effects": "Increases your Max HP by 15% . Upon pickup, you are fully healed ."
    },
    {
      "name": "Heart of Vitality",
      "rarity": "rare",
      "description": "Heart of Vitality HP ↑↑, Red heart recovery ↑↑",
      "effects": "Increases your Max HP by 15% . Red heart recovery is enhanced, with hearts restoring 32.5% of your base HP instead of 25% ."
    },
    {
      "name": "Angelic Shelter",
      "rarity": "rare",
      "description": "Angelic Shelter Max HP ↑, Brief invincibility after injury",
      "effects": "Increases your Max HP by 15% . You gain invincibility for 2 seconds after taking damage."
    },
    {
      "name": "Invincibility Potion",
      "rarity": "rare",
      "description": "Invincibility Potion Pick up Invincibility Potion, become briefly invincible",
      "effects": "Upon pickup, you gain invincibility for 2 seconds ."
    },
    {
      "name": "Abundant Potions",
      "rarity": "rare",
      "description": "Abundant Potions More Potions",
      "effects": "Increases the quantity of potions that appear."
    },
    {
      "name": "Blaze",
      "rarity": "rare",
      "description": "Blaze Projectiles ignite monsters (Fire Effect)",
      "effects": "Deals Fire damage ( 0.2x Attack Power ) for each arrow that hit the enemy and applies Burn effect. After a small delay target with Burn starts taking 5 Fire damage ticks per second, lasting for 3 seconds . On-hit effect can be applied twice per beam . Only 1 burn effect can be active per target, Fire on-hits reapply the burn effect."
    },
    {
      "name": "Bolt",
      "rarity": "rare",
      "description": "Bolt Projectiles shock monsters (Lightning Effect)",
      "effects": "Deals Lightning damage ( 0.3x Attack Power ) for each arrow that hit the enemy to up to 4 targets within 6m* radius from point of impact. This effect can be applied twice per beam . (Note: Not guaranteed to hit initial target if the number of enemies in affected area exceeds 4.) *: Ring of Agony has 7m radius"
    },
    {
      "name": "Venom",
      "rarity": "rare",
      "description": "Venom Projectiles poison monsters (Poison Effect)",
      "effects": "On hit, deals Venom damage (0.5x Attack Power) and poisons enemies.The poisoned target then takes 1 Venom damage tick per second indefinitely . There is a cooldown between on-hit damage on the same target of approximately 0.4 seconds ."
    },
    {
      "name": "Freeze",
      "rarity": "rare",
      "description": "Freeze Projectiles freeze monsters (Ice Effect)",
      "effects": "On hit, Freezes enemies for 1.5 seconds , dealing 1x Attack Power as damage upon application. There is a 10 second cooldown between successive freezes on the same target."
    },
    {
      "name": "Bomb Sprite",
      "rarity": "rare",
      "description": "Bomb Sprite Receive a Bomb Sprite",
      "effects": "Receive a Bomb Sprite companion that deals 0.4x Attack Power as damage per hit and fires up to 5 hits per volley ."
    },
    {
      "name": "Sprite Boost",
      "rarity": "rare",
      "description": "Sprite Boost Sprite ATK PWR ↑↑↑↑",
      "effects": "Increases Sprite base damage by 40%, including elemental damage coming from them."
    },
    {
      "name": "Circle Boost",
      "rarity": "rare",
      "description": "Circle Boost Circle DMG ↑↑↑",
      "effects": "Increases DMG dealt by circling orbs by 50% , (doesn't affect elemental damage, or laser damage from Beam Circle)"
    },
    {
      "name": "Blitz Strike",
      "rarity": "rare",
      "description": "Blitz Strike Summon 5 Strike swords per wave",
      "effects": "Summon 5 Strikes per wave dealing 0.75x Attack Power as damage each (5 Strikes every 10 seconds for timed chapters and Seal/Monster Invasion)."
    },
    {
      "name": "Instant Strike",
      "rarity": "rare",
      "description": "Instant Strike Summon 1 Strike sword per second",
      "effects": "Summon 1 Strike dealing 0.75x Attack Power as damage every 1.5 seconds (yes, we triple checked)"
    },
    {
      "name": "Warrior's Breath",
      "rarity": "common",
      "description": "Warrior's Breath ATK PWR ↑",
      "effects": "Increases your Attack Power by 10%"
    },
    {
      "name": "Fairy's Breath",
      "rarity": "common",
      "description": "Fairy's Breath ATK SPD ↑",
      "effects": "Increases your Attack Speed by 10%"
    },
    {
      "name": "Breath of Wind",
      "rarity": "common",
      "description": "Breath of Wind MOV SPD ↑",
      "effects": "Increases your Movement Speed by 10%"
    },
    {
      "name": "Strength Blood",
      "rarity": "common",
      "description": "Strength Blood Max HP ↑",
      "effects": "Increases your Max HP by 10%"
    },
    {
      "name": "Restore HP",
      "rarity": "common",
      "description": "Restore HP Random amount of healing",
      "effects": "Heals for a random amount of HP ."
    },
    {
      "name": "Wounded Warrior",
      "rarity": "common",
      "description": "Wounded Warrior Greatly increases ATK PWR when damaged, lasts 5s",
      "effects": "Increases your Attack Power by 50% when you lose HP (shield HP doesn't count). Lasts 5 seconds ."
    },
    {
      "name": "Boss Slayer",
      "rarity": "common",
      "description": "Boss Slayer DMG dealt to bosses ↑↑↑, Fully heal before boss battles",
      "effects": "Increases DMG dealt to bosses by 25% (doesn't affect elemental damage). You are fully healed before boss battles."
    },
    {
      "name": "Long-Range Power",
      "rarity": "common",
      "description": "Long-Range Power Your projectiles deal higher DMG when fired from a further distance",
      "effects": "Increases DMG dealt by main weapon ( not to be confused with Main weapon DMG category ) by 1% to 40% depending on distance projectile traveled (doesn't affect elemental or Bow explosion damage). Damage increase scales linearly and reaches maximum power at 14m* distance *: Ring of Agony has 7m radius"
    },
    {
      "name": "Frenzy Potion",
      "rarity": "common",
      "description": "Frenzy Potion Pick up Frenzy Potion, Attack SPD ↑↑↑, CRIT Rate ↑↑↑ for a duration",
      "effects": "Upon pickup, increases Attack Speed by 50% and greatly increases Critical Rate, effect lasts 5 seconds ."
    },
    {
      "name": "Bounce Arrow",
      "rarity": "common",
      "description": "Bounce Arrow Projectiles can bounce off walls",
      "effects": "Your projectiles gain the ability to bounce off walls , gaining +1 wall bounce for each copy of the skill."
    },
    {
      "name": "Rear Arrow",
      "rarity": "common",
      "description": "Rear Arrow Backward shooting arrows +1",
      "effects": "Adds 1 backward-firing arrow to your attacks."
    },
    {
      "name": "Fiery Path",
      "rarity": "common",
      "description": "Fiery Path Your character leaves a trail of flames where they walk",
      "effects": "Your character leaves a trail of flames where they walk. The flames deal 1x Attack Power of non-elemental damage as long as enemies stand on them and apply the Burn effect ."
    },
    {
      "name": "Perilous Recovery",
      "rarity": "common",
      "description": "Perilous Recovery When HP is below 30%, slowly regain HP back to 30%",
      "effects": "When your HP is below 30% , you slowly regain HP back to 30% , restoring 5% of your Max HP per tick ."
    },
    {
      "name": "Demon Recovery",
      "rarity": "common",
      "description": "Demon Recovery Chance to heal when killing monsters",
      "effects": "You gain a chance to heal when killing monsters, restoring 5% of your Max HP per proc ."
    },
    {
      "name": "Flame Sprite",
      "rarity": "common",
      "description": "Flame Sprite Receive a Flame Sprite (Fire Effect)",
      "effects": "Receive a Flame Sprite companion that deals 0.4x Attack Power as damage and applies the Blaze effect per hit."
    },
    {
      "name": "Lightning Sprite",
      "rarity": "common",
      "description": "Lightning Sprite Receive a Lightning Sprite",
      "effects": "Receive a Lightning Sprite companion that deals 0.5x Attack Power as damage and applies the Bolt effect per hit."
    },
    {
      "name": "Venom Sprite",
      "rarity": "common",
      "description": "Venom Sprite Receive a Venom Sprite (Poison Effect)",
      "effects": "Receive a Venom Sprite companion that deals 0.4x Attack Power as damage and applies the Venom effect per hit."
    },
    {
      "name": "Ice Spike Sprite",
      "rarity": "common",
      "description": "Ice Spike Sprite Receive a Ice Spike Sprite (Ice Effect)",
      "effects": "Receive an Ice Spike Sprite companion that deals 0.5x Attack Power as damage and applies the Freeze effect per hit."
    },
    {
      "name": "Demonslayer Meteor",
      "rarity": "common",
      "description": "Demonslayer Meteor Cast a meteor upon killing monsters",
      "effects": "You cast a meteor upon killing monsters. Each meteor deals 1.25x Attack Power as damage per hit and will always be a random element ."
    },
    {
      "name": "Blaze Meteor Potion",
      "rarity": "common",
      "description": "Blaze Meteor Potion Cast Flame Meteor when picking up a Flame Meteor Potion (Flame Effect)",
      "effects": "Upon pickup, casts a Flame Meteor . Each meteor deals 1.25x Attack Power as damage and applies the Blaze effect."
    },
    {
      "name": "Bolt Meteor Potion",
      "rarity": "common",
      "description": "Bolt Meteor Potion Cast Lightning Meteor (Lightning Effect)",
      "effects": "Upon pickup, casts a Lightning Meteor . Each meteor deals 1.25x Attack Power as damage and applies Bolt effect."
    },
    {
      "name": "Toxic Meteor Potion",
      "rarity": "common",
      "description": "Toxic Meteor Potion Cast Venom Meteor when picking up a Venom Meteor Potion (Poison Efect)",
      "effects": "Upon pickup, casts a Venom Meteor . Each meteor deals 1.25x Attack Power as damage and applies the Venom effect."
    },
    {
      "name": "Frost Meteor Potion",
      "rarity": "common",
      "description": "Frost Meteor Potion Cast Frost Meteor when picking up any Frost Meteor Potion (Ice Effect)",
      "effects": "Upon pickup, casts a Frost Meteor . Each meteor deals 1.25x Attack Power as damage and applies the Freeze effect."
    },
    {
      "name": "Fire Circle",
      "rarity": "common",
      "description": "Fire Circle Get 2 circling Fire orbs",
      "effects": "Receive 2 circling Fire orbs that deal 1.25x Attack Power as damage per hit and apply the Blaze effect ."
    },
    {
      "name": "Bolt Circle",
      "rarity": "common",
      "description": "Bolt Circle Receive 2 Rotating Lightningballs",
      "effects": "Receive 2 circling Lightning orbs that deal 1.25x Attack Power as damage per hit and apply the Bolt effect ."
    },
    {
      "name": "Poison Circle",
      "rarity": "common",
      "description": "Poison Circle Receive 2 circling Poison orbs",
      "effects": "Receive 2 circling Poison orbs that deal 1.25x Attack Power as damage per hit and apply the Venom effect ."
    },
    {
      "name": "Ice Circle",
      "rarity": "common",
      "description": "Ice Circle Get 2 circling Ice orbs",
      "effects": "Receive 2 circling Ice orbs that deal 1.25x Attack Power as damage per hit and apply the Freeze effect ."
    },
    {
      "name": "Vampiric Circle",
      "rarity": "common",
      "description": "Vampiric Circle Receive 2 Rotating Vampballs",
      "effects": "Receive 2 circling Vampiric orbs that deal 1.25x Attack Power as damage per hit and heal 2% of your Max HP per hit."
    },
    {
      "name": "Assault Strike",
      "rarity": "common",
      "description": "Assault Strike Chance to trigger Strike when attacking",
      "effects": "You gain a chance to summon a Strike dealing 0.75x Attack Power as damage when attacking."
    },
    {
      "name": "Blade Potion",
      "rarity": "common",
      "description": "Blade Potion Randomly generate flying sword potions",
      "effects": "Upon pickup, summon 5 Strikes dealing 0.75x Attack Power as damage each. Extra copies of the skill reduce the average time it takes for a new potion to appear after the previous one was picked up."
    },
    {
      "name": "Pursuit Strike",
      "rarity": "common",
      "description": "Pursuit Strike Trigger Strike upon slaying monsters",
      "effects": "Summon a Strike dealing 0.75x Attack Power as damage upon slaying monsters."
    },
    {
      "name": "Riposte Strike",
      "rarity": "common",
      "description": "Riposte Strike Summon Flying swords to counter attack when injured",
      "effects": "Summon 5 Strikes dealing 0.75x Attack Power as damage each, to counter-attack enemies when you lose HP (shield HP doesn't count)"
    }
  ],
  "editorial": [
    {
      "name": "Power Trio",
      "tier": "S",
      "effect": "Max HP ↑↑↑, Attack Speed ↑↑↑, ATQ PWR ↑↑↑"
    },
    {
      "name": "Tracking Eye",
      "tier": "S",
      "effect": "Projectiles can track enemies"
    },
    {
      "name": "Wind Blessing",
      "tier": "S",
      "effect": "Attack speed ↑, Size ↓↓, Dodge chance"
    },
    {
      "name": "Freeze",
      "tier": "S",
      "effect": "Projectiles freeze enemies"
    },
    {
      "name": "Sprite King",
      "tier": "A",
      "effect": "Grants a Sprite King"
    },
    {
      "name": "Rapid Fire",
      "tier": "A",
      "effect": "Multiple shots + 1 projectile"
    },
    {
      "name": "Sacred Protection",
      "tier": "A",
      "effect": "Blocks one shot per wave"
    },
    {
      "name": "Soul of Strength",
      "tier": "A",
      "effect": "Max HP ↑↑↑↑"
    },
    {
      "name": "Warriors Soul",
      "tier": "A",
      "effect": "ATQ PWR ↑↑↑↑"
    },
    {
      "name": "Beam Circle",
      "tier": "A",
      "effect": "Grants 2 laser orbs"
    },
    {
      "name": "Soul of Swiftness",
      "tier": "A",
      "effect": "Attack speed ↑↑↑↑, Movement speed ↑↑↑↑"
    },
    {
      "name": "Revive",
      "tier": "A",
      "effect": "Restores life to the dead"
    },
    {
      "name": "Laser Sprite",
      "tier": "A",
      "effect": "Grants a laser sprite"
    },
    {
      "name": "Frenzy Sprite",
      "tier": "A",
      "effect": "Improved sprite speed and attacks"
    },
    {
      "name": "ATK Increase",
      "tier": "A",
      "effect": "ATQ PWR ↑↑↑"
    },
    {
      "name": "Perilous Fervor",
      "tier": "A",
      "effect": "ATQ PWR ↑↑↑↑,Attack speed ↑↑↑↑ when life is < 50%"
    },
    {
      "name": "Demon Slayer",
      "tier": "A",
      "effect": "Increases ATQ PWR for a period of time after killing enemies"
    },
    {
      "name": "Ricocheting Arrow",
      "tier": "A",
      "effect": "Projectiles can bounce between enemies"
    },
    {
      "name": "Front Arrow",
      "tier": "A",
      "effect": "+1 arrow"
    },
    {
      "name": "Bolt",
      "tier": "A",
      "effect": "Projectiles shock monsters"
    },
    {
      "name": "Long-Range Power",
      "tier": "A",
      "effect": "+ long-range damage"
    },
    {
      "name": "Ice Spike Sprite",
      "tier": "A",
      "effect": "Grants a spike sprite"
    },
    {
      "name": "Energy Beam",
      "tier": "B",
      "effect": "Charges to release a powerful laser"
    },
    {
      "name": "Super Meteor",
      "tier": "B",
      "effect": "Drops meteors and generates AoE"
    },
    {
      "name": "Flying Sword Beam",
      "tier": "B",
      "effect": "Summons a sword that shoots lasers periodically"
    },
    {
      "name": "Super Blaze",
      "tier": "B",
      "effect": "Improves flame effects"
    },
    {
      "name": "Super Rotating Balls",
      "tier": "B",
      "effect": "Grants 4 non-elemental balls"
    },
    {
      "name": "Slow Field",
      "tier": "B",
      "effect": "Slows down projectiles and monsters"
    },
    {
      "name": "Super Venom",
      "tier": "B",
      "effect": "Improved poison effects"
    },
    {
      "name": "Enchanted Swords",
      "tier": "B",
      "effect": "Flying swords gain the main weapon element"
    },
    {
      "name": "Diagonal Arrows",
      "tier": "B",
      "effect": "Adds 2 diagonal arrows"
    },
    {
      "name": "Super Freeze",
      "tier": "B",
      "effect": "Improved freezing effects"
    },
    {
      "name": "Weapon Enchantment",
      "tier": "B",
      "effect": "Weapon automatically attacks monsters (ATQ PWR ↓↓↓, Attack Speed ↓↓)"
    },
    {
      "name": "Lucky Cracker",
      "tier": "B",
      "effect": "Chance ↑↑↑, Dodge ↑↑"
    },
    {
      "name": "Lightwing Arrow",
      "tier": "B",
      "effect": "Projectiles have a chance to have wings and deal more damage to enemies"
    },
    {
      "name": "Abundant Potion",
      "tier": "B",
      "effect": "Grants more potions"
    },
    {
      "name": "Cloud Footed",
      "tier": "B",
      "effect": "Creates bursts to repel waves of monsters. Attack speed ↑↑↑"
    },
    {
      "name": "Split Shot",
      "tier": "B",
      "effect": "Projectiles can split"
    },
    {
      "name": "Stand Strong",
      "tier": "B",
      "effect": "Increases attack speed and damage when the player stands still"
    },
    {
      "name": "Lucky Band-Aid",
      "tier": "B",
      "effect": "Chance ↑↑, deals damage to all enemies on screen"
    },
    {
      "name": "Sprite Boost",
      "tier": "B",
      "effect": "Sprite damage ↑↑↑↑"
    },
    {
      "name": "Blaze",
      "tier": "B",
      "effect": "Projectiles set monsters on fire"
    },
    {
      "name": "Venom",
      "tier": "B",
      "effect": "Projectiles poison monsters"
    },
    {
      "name": "Frenzy Potion",
      "tier": "B",
      "effect": "Attack speed ↑↑↑, Critical rate ↑↑↑ over a limited duration"
    },
    {
      "name": "Bounce Arrow",
      "tier": "B",
      "effect": "Projectiles bounce off walls"
    },
    {
      "name": "Venom Sprite",
      "tier": "B",
      "effect": "Grants a poison sprite"
    },
    {
      "name": "Flame Sprite",
      "tier": "B",
      "effect": "Grants a flame sprite"
    },
    {
      "name": "Lightning Sprite",
      "tier": "B",
      "effect": "Grants a lightning sprite"
    },
    {
      "name": "Blade Potion",
      "tier": "B",
      "effect": "Randomly generates healing swords"
    },
    {
      "name": "Assault Strike",
      "tier": "B",
      "effect": "Gives a strike chance when attacking monsters"
    },
    {
      "name": "Corrosive Field",
      "tier": "C",
      "effect": "Nearby enemies take damage and are vulnerable"
    },
    {
      "name": "Rapid Fire Meteors",
      "tier": "C",
      "effect": "Increases the chance of generating meteors"
    },
    {
      "name": "Wall-Piercing Arrow",
      "tier": "C",
      "effect": "Projectiles can pass through obstacles"
    },
    {
      "name": "Giants Strength",
      "tier": "C",
      "effect": "Max HP ↑↑↑, ATQ ↑↑↑, Attack Speed ↓↓, Size ↑↑"
    },
    {
      "name": "Meteor Pursuit",
      "tier": "C",
      "effect": "Increases the chance of generating meteors when attacking"
    },
    {
      "name": "Super Bolt",
      "tier": "C",
      "effect": "Improves lightning effects"
    },
    {
      "name": "Double Sword Shot",
      "tier": "C",
      "effect": "Doubles flying swords"
    },
    {
      "name": "Strike Boost",
      "tier": "C",
      "effect": "Strike ATQ ↑↑↑↑"
    },
    {
      "name": "Invincibility Potion",
      "tier": "C",
      "effect": "Gives invincibility potions"
    },
    {
      "name": "Fountain of Life",
      "tier": "C",
      "effect": "Max HP ↑↑, restores all HP when harvested"
    },
    {
      "name": "Swift Arrow",
      "tier": "C",
      "effect": "Attack Speed ↑↑↑↑↑, ATQ PWR ↓↓↓, Projectile Size ↓↓↓"
    },
    {
      "name": "Bomb Sprite",
      "tier": "C",
      "effect": "Gives a bomb sprite"
    },
    {
      "name": "Piercing Arrow",
      "tier": "C",
      "effect": "Projectiles can pierce monsters"
    },
    {
      "name": "Fairy of the Wind",
      "tier": "C",
      "effect": "Attack speed ↑, Movement speed ↑↑"
    },
    {
      "name": "Warriors Heart",
      "tier": "C",
      "effect": "Hearts can increase damage"
    },
    {
      "name": "Angelic Shelter",
      "tier": "C",
      "effect": "Max HP ↑, gives a period of invincibility after taking a hit"
    },
    {
      "name": "Instant Strike",
      "tier": "C",
      "effect": "Summons a Strike sword per second"
    },
    {
      "name": "Lightning Meteor Potion",
      "tier": "C",
      "effect": "Generates a lightning meteor"
    },
    {
      "name": "Warriors Breath",
      "tier": "C",
      "effect": "ATQ PWR ↑"
    },
    {
      "name": "Demon Recovery",
      "tier": "C",
      "effect": "Gives chances to heal yourself by killing enemies"
    },
    {
      "name": "Fairy's Breath",
      "tier": "C",
      "effect": "Attack speed ↑"
    },
    {
      "name": "Bane of Bosses",
      "tier": "C",
      "effect": "Damage inflicted on bosses ↑↑↑, heals completely before a boss fight"
    },
    {
      "name": "Frost Meteor Potion",
      "tier": "C",
      "effect": "Gives a potion that generates a meteor of ice"
    },
    {
      "name": "Venom Meteor Potion",
      "tier": "C",
      "effect": "Generates a poison meteor potion"
    },
    {
      "name": "Flame Meteor Potion",
      "tier": "C",
      "effect": "Generates a fire meteor potion"
    },
    {
      "name": "Ice Circle",
      "tier": "C",
      "effect": "Grants two ice orbs"
    },
    {
      "name": "Demon Slaying Meteor",
      "tier": "C",
      "effect": "Generates a meteor when an enemy is killed"
    },
    {
      "name": "Rotating Thunderballs",
      "tier": "C",
      "effect": "Grants two orbs of lightning"
    },
    {
      "name": "Rotating Web",
      "tier": "C",
      "effect": "All orbs form a web"
    },
    {
      "name": "Energy Ring",
      "tier": "D",
      "effect": "A ring of energy is generated after a charge period"
    },
    {
      "name": "Aqua Flight",
      "tier": "D",
      "effect": "Allows you to walk on water, movement speed ↑↑"
    },
    {
      "name": "Blitz Strike",
      "tier": "D",
      "effect": "Summons 5 strike swords with each wave"
    },
    {
      "name": "Lucky Heart",
      "tier": "D",
      "effect": "Looting hearts gives a chance to increase Max HP"
    },
    {
      "name": "Underworld Warrior",
      "tier": "D",
      "effect": "ATQ PWR ↑↑, the demon appears systematically after defeating a boss"
    },
    {
      "name": "Circle Boost",
      "tier": "D",
      "effect": "Orb Damage ↑↑↑"
    },
    {
      "name": "Charged Arrow",
      "tier": "D",
      "effect": "Chager to launch a giant arrow"
    },
    {
      "name": "Heart of Vitality",
      "tier": "D",
      "effect": "HP ↑↑, Red Heart Care ↑↑"
    },
    {
      "name": "Pursuit Strike",
      "tier": "D",
      "effect": "Generates strikes after killing enemies"
    },
    {
      "name": "Rotating Vampballs",
      "tier": "D",
      "effect": "Grants two vampiric orbs"
    },
    {
      "name": "Wounded Warrior",
      "tier": "D",
      "effect": "Significantly increases ATQ Power when taking damage, effect lasts 5 seconds"
    },
    {
      "name": "Fire Circle",
      "tier": "D",
      "effect": "Grants two fire orbs"
    },
    {
      "name": "Backward Arrow",
      "tier": "D",
      "effect": "The arrow shoots forwards and backwards"
    },
    {
      "name": "Fiery Path",
      "tier": "D",
      "effect": "The player leaves a trail of fire behind them"
    },
    {
      "name": "Breath of the Wind",
      "tier": "D",
      "effect": "Movement speed ↑"
    },
    {
      "name": "Posion Circle",
      "tier": "D",
      "effect": "Grants two poison orbs"
    },
    {
      "name": "Flying Sword Riposte",
      "tier": "E",
      "effect": "Generates flying swords to counterattack when the player has taken damage"
    },
    {
      "name": "Perilous Recovery",
      "tier": "E",
      "effect": "When HP is <30%, restores HP up to 30%."
    },
    {
      "name": "Strength Blood",
      "tier": "E",
      "effect": "Max HP ↑"
    },
    {
      "name": "Restore HP",
      "tier": "F",
      "effect": "Heals a random number of HP"
    },
    {
      "name": "Short-Range Strike",
      "tier": "F",
      "effect": "ATQ Range ↓↓, ATQ Power ↑↑↑, Attack Speed ↑↑↑↑"
    }
  ],
  "mapping": {
    "warriors_soul": "SuperAtk",
    "power_trio": "three-add",
    "multishot": "rapid-arrow-strong",
    "corrosive_field": "armor-downgrade",
    "energy_beam": "cannon-shot",
    "soul_of_strength": "SuperHP",
    "sacred_protection": "angle-inv-each",
    "sprite_king": "StrongLaserFairy",
    "super_meteor": "StarShockwave",
    "beam_strike": "Sword-Laser",
    "circle_web": "ball-line",
    "atk_boost": "strong",
    "giants_strength": "atlas",
    "weapon_enchantment": "auto-archer",
    "aspd_boost": "SuperSpd",
    "tracking_eye": "crosshair",
    "diag_arrow": "double-arrow",
    "energy_ring": "cannon-ball",
    "wall_piercing_arrow": "ThroughWall",
    "wind_blessing": "wing",
    "revive": "whole-revive",
    "super_blaze": "super-fire",
    "super_bolt": "super-thunder",
    "super_venom": "super-poison",
    "super_freeze": "super-ice",
    "laser_sprite": "LaswerFairy",
    "sprite_frenzy": "FeverFairy",
    "chain_meteors": "StarMore",
    "beam_circle": "ball-laser",
    "super_circle": "super-ball",
    "magic_strike": "Sword-Inheritance",
    "strike_boost": "Sword-Atk",
    "twin_strike": "Sword-Double",
    "underworld_warrior": "hooded-figure",
    "demon_slayer": "kill-atk",
    "warriors_heart": "hp-atk",
    "stand_strong": "stand-atk",
    "short_range_strike": "strong-arrow",
    "perilous_fervor": "near-death-atk",
    "swift_arrow": "rapid-arrow",
    "front_arrow": "gunshot",
    "charged_arrow": "charged-arrow",
    "pierce": "sun-spear",
    "split_shot": "shatter",
    "ricochet": "ricochet",
    "lucky_band_aid": "clover",
    "fountain_of_life": "heart-plus-max",
    "angelic_shelter": "near-death-inv",
    "fire_arrow": "flaming-arrow",
    "lightning_arrow": "thunder-arrow",
    "venom_arrow": "chemical-arrow",
    "ice_arrow": "frozen-arrow",
    "bomb_sprite": "BombFairy",
    "flying_swords": "Sword-Moment",
    "warriors_breath": "SoldierBreath",
    "fairys_breath": "FairyBreath",
    "hermes_boots": "wind-run",
    "max_hp_up": "heart-plus",
    "restore_hp": "heart-hp",
    "wounded_warrior": "hurt-atk",
    "boss_slayer": "boss-killer",
    "long_range_power": "laser-precision",
    "bouncy_wall": "eject-arrow",
    "rear_arrow": "back-arrow",
    "fiery_path": "fire-road",
    "bloodthirst": "Vampire",
    "orbit_orbs": "Vampire-ball",
    "assault_strike": "Sword-Assault"
  },
  "assets": [
    {
      "slug": "Additional_summons",
      "source": "Additional_summons_922327.png",
      "path": "assets/skills/Additional_summons.png",
      "sha256": "74f2dcb4d22a45a77ac6c346cabb7646240d26a15a7c47e504c1df8430791a6d",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "angle-health",
      "source": "angle-health_470f16.png",
      "path": "assets/skills/angle-health.png",
      "sha256": "c6d8937916534adf04d4eaa226a20e2c7dccc11508fe707b31f7b3056d69b45c",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "angle-inv",
      "source": "angle-inv_46e5eb.png",
      "path": "assets/skills/angle-inv.png",
      "sha256": "f38c7123bcbe32d2863f6d52d3aaaf23bf175809cb9333f1c8726fadde0a71e0",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "angle-inv-each",
      "source": "angle-inv-each_7c5223.png",
      "path": "assets/skills/angle-inv-each.png",
      "sha256": "b1a8a73ba92106bbf2c1d8220fd26be2818dba1d967370522624cf944a6c9186",
      "skillIds": [
        "sacred_protection"
      ],
      "status": "mapped"
    },
    {
      "slug": "angle-ring",
      "source": "angle-ring_7d02a0.png",
      "path": "assets/skills/angle-ring.png",
      "sha256": "a1f67f6c4b3e7f0e6eba2ae069065aad2954ba9da90850de90af372bdabb05e3",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "armor-downgrade",
      "source": "armor-downgrade_6cc0b8.png",
      "path": "assets/skills/armor-downgrade.png",
      "sha256": "060f47a4ab09d48847678f9d00998f8dd4d4178cf6a6dc25847cbc73ea96b226",
      "skillIds": [
        "corrosive_field"
      ],
      "status": "mapped"
    },
    {
      "slug": "Atk-potion",
      "source": "Atk-potion_ebb27c.png",
      "path": "assets/skills/Atk-potion.png",
      "sha256": "159024d653388fefd746fabded2b9d53f7786e156a66089b0d5d0e652c0d39c8",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "atk-zone",
      "source": "atk-zone_ccfa1e.png",
      "path": "assets/skills/atk-zone.png",
      "sha256": "0121e1634bb0de588ae53adabeccdeb5df384e597069f6fa92b264a090aa135b",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "atlas",
      "source": "atlas_b21de9.png",
      "path": "assets/skills/atlas.png",
      "sha256": "4e1eb286a2cc69221f1d8ba40bcb3ddab8ebbc1a65a34efab48ca579ab843d43",
      "skillIds": [
        "giants_strength"
      ],
      "status": "mapped"
    },
    {
      "slug": "Attack-ball",
      "source": "Attack-ball_2559a0.png",
      "path": "assets/skills/Attack-ball.png",
      "sha256": "72fb682f12261bcafa59ceb1cccf2f0d8f3ea02d23e578f5430ea60fb9aaea20",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "AttackStar",
      "source": "AttackStar_28da67.png",
      "path": "assets/skills/AttackStar.png",
      "sha256": "92b2d10c2a4bc8615533b21546ac7557a227e1d7bba83166e683a0dec56d13c5",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "auto-archer",
      "source": "auto-archer_38d11b.png",
      "path": "assets/skills/auto-archer.png",
      "sha256": "f088a62f5d945a9262cb3a00897808b5cd0bcc939fb28a0b6064bf04602df8d1",
      "skillIds": [
        "weapon_enchantment"
      ],
      "status": "mapped"
    },
    {
      "slug": "back-arrow",
      "source": "back-arrow_cc657b.png",
      "path": "assets/skills/back-arrow.png",
      "sha256": "b2564aa70437e2bd2bbbfa51d579b572a82601c75904f2a0f7c5f3d0f1c29898",
      "skillIds": [
        "rear_arrow"
      ],
      "status": "mapped"
    },
    {
      "slug": "bad-gnome",
      "source": "bad-gnome_3e3808.png",
      "path": "assets/skills/bad-gnome.png",
      "sha256": "81ed6cc9bf7105731dbdb6f8c04e18e5a708e5776373507836fece3a91c601f7",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "ball-laser",
      "source": "ball-laser_b2bdb1.png",
      "path": "assets/skills/ball-laser.png",
      "sha256": "b674fcd2834bbd63bc52a23830cdf87ed374e6e873916908939a9860fc11a8d0",
      "skillIds": [
        "beam_circle"
      ],
      "status": "mapped"
    },
    {
      "slug": "ball-line",
      "source": "ball-line_11a924.png",
      "path": "assets/skills/ball-line.png",
      "sha256": "f6266bd891772b28bb3975f76ad8bcdc4ee0abdc6c3cd386da099c8232e8d7b0",
      "skillIds": [
        "circle_web"
      ],
      "status": "mapped"
    },
    {
      "slug": "BallSawblade",
      "source": "BallSawblade_7fcd04.png",
      "path": "assets/skills/BallSawblade.png",
      "sha256": "68a4b622fe4a5376483eac58334c411683555f43deb2dfc2838d12f5c91e351c",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "BombFairy",
      "source": "BombFairy_dd9cf8.png",
      "path": "assets/skills/BombFairy.png",
      "sha256": "072caa951014b5b0c50cb08f5bb45eb25ebf3b9567190064ee2fa7d157b9c7e4",
      "skillIds": [
        "bomb_sprite"
      ],
      "status": "mapped"
    },
    {
      "slug": "boss-killer",
      "source": "boss-killer_398ea2.png",
      "path": "assets/skills/boss-killer.png",
      "sha256": "d081abafbf1b3bea6b9ac996ece1b59140f8a725256cf2f155dac06194a94ec8",
      "skillIds": [
        "boss_slayer"
      ],
      "status": "mapped"
    },
    {
      "slug": "cannon-ball",
      "source": "cannon-ball_19efd2.png",
      "path": "assets/skills/cannon-ball.png",
      "sha256": "23c6d73c0afbaf7eade489e4dc69e7f3b8c6cbf22d7cbe43ddf57ec653b71712",
      "skillIds": [
        "energy_ring"
      ],
      "status": "mapped"
    },
    {
      "slug": "cannon-shot",
      "source": "cannon-shot_a88760.png",
      "path": "assets/skills/cannon-shot.png",
      "sha256": "5a117c46d42f8edac8d428b590d2eed2ae8de292bd7c2ba91f0544287038c75e",
      "skillIds": [
        "energy_beam"
      ],
      "status": "mapped"
    },
    {
      "slug": "charged-arrow",
      "source": "charged-arrow_90dd53.png",
      "path": "assets/skills/charged-arrow.png",
      "sha256": "1df3e8b78b24b76d24e6e683e2dbd959e40974db19268f6413abe2a43a7916f7",
      "skillIds": [
        "charged_arrow"
      ],
      "status": "mapped"
    },
    {
      "slug": "chemical-arrow",
      "source": "chemical-arrow_d965ba.png",
      "path": "assets/skills/chemical-arrow.png",
      "sha256": "57c7300fa46a9e81962a391a235ebde553ad0a6c898b4bed88d546396c76ce29",
      "skillIds": [
        "venom_arrow"
      ],
      "status": "mapped"
    },
    {
      "slug": "clover",
      "source": "clover_f5ae69.png",
      "path": "assets/skills/clover.png",
      "sha256": "83ec30fb401328b4c1bf282d46aea61ff4f1986735dc77835cf5a909631adea6",
      "skillIds": [
        "lucky_band_aid"
      ],
      "status": "mapped"
    },
    {
      "slug": "crosshair",
      "source": "crosshair_677a4a.png",
      "path": "assets/skills/crosshair.png",
      "sha256": "188c77fdc2da7a03d26a4ad7558bd8bdf29a0d25cb2e47d8f88953424ce97a6d",
      "skillIds": [
        "tracking_eye"
      ],
      "status": "mapped"
    },
    {
      "slug": "Dead_s_Flowers",
      "source": "Dead_s_Flowers_2f391b.png",
      "path": "assets/skills/Dead_s_Flowers.png",
      "sha256": "23d7837982f7765bd315bee174e0fe154cc210175fcdee1edb4b0b6cd3989bee",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "death-arrow",
      "source": "death-arrow_a3c97d.png",
      "path": "assets/skills/death-arrow.png",
      "sha256": "31c493d2595ab51a23512f82e410395c3c2feee073adbb6ded4b1adb9140a26b",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "double-arrow",
      "source": "double-arrow_b18653.png",
      "path": "assets/skills/double-arrow.png",
      "sha256": "bae4e1177b4d9f4b0f9b2559783571b067a776c4141bd5c29dd2790ea763a65d",
      "skillIds": [
        "diag_arrow"
      ],
      "status": "mapped"
    },
    {
      "slug": "eject-arrow",
      "source": "eject-arrow_5ed51a.png",
      "path": "assets/skills/eject-arrow.png",
      "sha256": "d335189feb3cedadf0bcf1ba84f3a31455f44fb7da56359a35d8be9988ae469e",
      "skillIds": [
        "bouncy_wall"
      ],
      "status": "mapped"
    },
    {
      "slug": "ElfBreath",
      "source": "ElfBreath_155cc8.png",
      "path": "assets/skills/ElfBreath.png",
      "sha256": "a0b994d1a0b1355ebe50fafa0b69a5195d8dd25c90bb00f006cc097b4b9ade17",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "FairyBreath",
      "source": "FairyBreath_809614.png",
      "path": "assets/skills/FairyBreath.png",
      "sha256": "2c632657460d80bdc5c1298702131acd5bf5c0e255a4eb487a49164c1c25c70c",
      "skillIds": [
        "fairys_breath"
      ],
      "status": "mapped"
    },
    {
      "slug": "FairyPower",
      "source": "FairyPower_2eb152.png",
      "path": "assets/skills/FairyPower.png",
      "sha256": "bf30c24d429a9fef71be006782fb324542bb8eaac1c6baa9ebe5404bcb2eba83",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "falling-boulder",
      "source": "falling-boulder_e9bf19.png",
      "path": "assets/skills/falling-boulder.png",
      "sha256": "727351e4de3d65d0b673388fb3e85648dbdc1768725eded120c6d086fc183ec1",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "fast-forward-button",
      "source": "fast-forward-button_c4a8cc.png",
      "path": "assets/skills/fast-forward-button.png",
      "sha256": "571afa07789dba4f827513b8157e19145a39b224196b2716d4ee42cd9be9095d",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "FeverFairy",
      "source": "FeverFairy_59d18f.png",
      "path": "assets/skills/FeverFairy.png",
      "sha256": "b2ac78fe1dda7729e609a52dc963199109aac4add9bda42964f4c43b20e7b865",
      "skillIds": [
        "sprite_frenzy"
      ],
      "status": "mapped"
    },
    {
      "slug": "Fire-ball",
      "source": "Fire-ball_ae383f.png",
      "path": "assets/skills/Fire-ball.png",
      "sha256": "af0469f6eac76cd7139e121c1f6351aeff5938f6220c7a456d9ad4649444d4a5",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "FireFairy",
      "source": "FireFairy_ccedcd.png",
      "path": "assets/skills/FireFairy.png",
      "sha256": "6a05cc7d481bfe4d2289d2ea3fafea9bba5b264085538b3d1aa44c046cc79616",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "FireStar",
      "source": "FireStar_bd54a4.png",
      "path": "assets/skills/FireStar.png",
      "sha256": "51d5e5186b474ba9594c84237e46e36acbb0f299963f02439849896aa3fee9ab",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "fire-road",
      "source": "fire-road_9519c7.png",
      "path": "assets/skills/fire-road.png",
      "sha256": "110f7c651754f27f93c52012bac4d8a5b257b724aad5e582cb1a4782f37f6658",
      "skillIds": [
        "fiery_path"
      ],
      "status": "mapped"
    },
    {
      "slug": "fire-silhouette",
      "source": "fire-silhouette_6ba461.png",
      "path": "assets/skills/fire-silhouette.png",
      "sha256": "6f3a1cebbc81caa39612cb9860ffb2c231a953edf4e1fa22f4b45a57c0ccd643",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "flaming-arrow",
      "source": "flaming-arrow_b78ff0.png",
      "path": "assets/skills/flaming-arrow.png",
      "sha256": "5af429703676fc67037787673b82a04e2c40a99f352a8befc8357978d9287161",
      "skillIds": [
        "fire_arrow"
      ],
      "status": "mapped"
    },
    {
      "slug": "FlyWing",
      "source": "FlyWing_7932fb.png",
      "path": "assets/skills/FlyWing.png",
      "sha256": "54c3154cc48c62bd77e4a16291f7bff6d55807d3d203032d74c4a4bdd82b2009",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "frozen-arrow",
      "source": "frozen-arrow_58db49.png",
      "path": "assets/skills/frozen-arrow.png",
      "sha256": "8e59b29499cfa0092df53d08e0028978583959713e23003986a6ecac8bf4fa93",
      "skillIds": [
        "ice_arrow"
      ],
      "status": "mapped"
    },
    {
      "slug": "gunshot",
      "source": "gunshot_2eacb9.png",
      "path": "assets/skills/gunshot.png",
      "sha256": "4724a40c775e125fd88449640c089c64918801f2520187e30ac89b53996d83db",
      "skillIds": [
        "front_arrow"
      ],
      "status": "mapped"
    },
    {
      "slug": "half-revive",
      "source": "half-revive_43e6c8.png",
      "path": "assets/skills/half-revive.png",
      "sha256": "d1f2fb22574cc8740d36fbf5ef3598ca94ac532ced83d970c57e058b0a92364d",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "whole-revive",
      "source": "whole-revive_7518ca.png",
      "path": "assets/skills/whole-revive.png",
      "sha256": "a468b5ab18665d676a20f20429700fbc76ed71ad57988945d684ff595be38a78",
      "skillIds": [
        "revive"
      ],
      "status": "mapped"
    },
    {
      "slug": "Harvest-potion",
      "source": "Harvest-potion_798ee8.png",
      "path": "assets/skills/Harvest-potion.png",
      "sha256": "b79e6daf7ddaf292177d8f8328f8d57de04b105fc84a61ccb1a00610031788ef",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "heart-battery",
      "source": "heart-battery_ed843d.png",
      "path": "assets/skills/heart-battery.png",
      "sha256": "648259ec9696f030af28178c8815907a9af27872c1492ca2d2b513518a2892e0",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "heartburn",
      "source": "heartburn_5595c3.png",
      "path": "assets/skills/heartburn.png",
      "sha256": "464040dc6bdeae46ae52fbb1bf07d79c832c4fc8922d820e87b05148c0e6d445",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "heart-hp",
      "source": "heart-hp_5771d2.png",
      "path": "assets/skills/heart-hp.png",
      "sha256": "5e99c89945c0d5fee43fe473e44e3204b2e0f67924f5958927ccf8045e454c0c",
      "skillIds": [
        "restore_hp"
      ],
      "status": "mapped"
    },
    {
      "slug": "heart-plus",
      "source": "heart-plus_e479cb.png",
      "path": "assets/skills/heart-plus.png",
      "sha256": "21ccc1feb6fe5b64b21499629e024ba3e422ca0438809b92e116bf65e824eb58",
      "skillIds": [
        "max_hp_up"
      ],
      "status": "mapped"
    },
    {
      "slug": "heart-plus-max",
      "source": "heart-plus-max_d05772.png",
      "path": "assets/skills/heart-plus-max.png",
      "sha256": "4130ca3114efa0fc38cd5df3db0a478096def7d4766d8760e38dc56b047a6196",
      "skillIds": [
        "fountain_of_life"
      ],
      "status": "mapped"
    },
    {
      "slug": "hooded-figure",
      "source": "hooded-figure_5bb655.png",
      "path": "assets/skills/hooded-figure.png",
      "sha256": "ba1bf989dafe1c73729da5b28a40a5eb134fadecf07a574fc76e1b1078627eb8",
      "skillIds": [
        "underworld_warrior"
      ],
      "status": "mapped"
    },
    {
      "slug": "hp-atk",
      "source": "hp-atk_bbf2c7.png",
      "path": "assets/skills/hp-atk.png",
      "sha256": "db29a3be180cfe5991e21aaa79655140d568535393c5ae074350e36d0e87d7d7",
      "skillIds": [
        "warriors_heart"
      ],
      "status": "mapped"
    },
    {
      "slug": "hp-hold",
      "source": "hp-hold_d1c2d4.png",
      "path": "assets/skills/hp-hold.png",
      "sha256": "1bcce4390750fb1616bfee537115c56603752e9090705343512ce838c69c3d16",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "hurt-atk",
      "source": "hurt-atk_8688b7.png",
      "path": "assets/skills/hurt-atk.png",
      "sha256": "cd9d55ad006aad31dcb14ecbadb8eba9cba48470b03c2a23203c4eca0880aefc",
      "skillIds": [
        "wounded_warrior"
      ],
      "status": "mapped"
    },
    {
      "slug": "hurt-punish",
      "source": "hurt-punish_3e2881.png",
      "path": "assets/skills/hurt-punish.png",
      "sha256": "16beda723c4337c2179cf0f93250f59d43c30cc52a81018aea4b76f316e61e0e",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "Ice-ball",
      "source": "Ice-ball_db4e50.png",
      "path": "assets/skills/Ice-ball.png",
      "sha256": "fb039105c5196eb0278c73fba0d65b40b209185b38de4b3ed84d0495c4f1b1ec",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "IceFairy",
      "source": "IceFairy_21ed91.png",
      "path": "assets/skills/IceFairy.png",
      "sha256": "63540a1a201c338d378ec570458608299f3921a12647c4e87802f211ad695f45",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "Ice-potion",
      "source": "Ice-potion_996871.png",
      "path": "assets/skills/Ice-potion.png",
      "sha256": "6bde8b6fe5447a7b80311976fb5459e069a861d9634d23a714011f423fa3e6a7",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "IceStar",
      "source": "IceStar_59f2bd.png",
      "path": "assets/skills/IceStar.png",
      "sha256": "f2588937c69ae44b50cd7e0fbc2f1a7ad4a8d180a8de4c0f5f7a87778065184d",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "ifrit",
      "source": "ifrit_0b116c.png",
      "path": "assets/skills/ifrit.png",
      "sha256": "dff22c5a47dbe0857ef4a31bb743abba2c4e4f988a99798b20b936d57aa50571",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "imp-laugh",
      "source": "imp-laugh_02a1a9.png",
      "path": "assets/skills/imp-laugh.png",
      "sha256": "855088e2823dd9e67554fb610d0dcf6dcd638caade5916888de6903465bd1b80",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "Infernal-Contract",
      "source": "Infernal-Contract_05b076.png",
      "path": "assets/skills/Infernal-Contract.png",
      "sha256": "bdd7b57d6c133dd2a8427ec2fb66d4cb5d4da8c5b8a1d4407dbe12d1d0a0c398",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "kill-atk",
      "source": "kill-atk_ef8695.png",
      "path": "assets/skills/kill-atk.png",
      "sha256": "c8df963f216e937c7e81cfa39cb46666b83741b58c34e88268e9839b447373d6",
      "skillIds": [
        "demon_slayer"
      ],
      "status": "mapped"
    },
    {
      "slug": "KillStar",
      "source": "KillStar_9ce7aa.png",
      "path": "assets/skills/KillStar.png",
      "sha256": "5ea33e40ac98c2330b200f5ff6870cc814297bf021217833e2c8f3e50c08dd92",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "laser-precision",
      "source": "laser-precision_5f9939.png",
      "path": "assets/skills/laser-precision.png",
      "sha256": "11debd132efb7ca3c0c8bd6448ef3dd021706c984c2b021504958cdeb8bfe923",
      "skillIds": [
        "long_range_power"
      ],
      "status": "mapped"
    },
    {
      "slug": "Lasting-potion",
      "source": "Lasting-potion_107e38.png",
      "path": "assets/skills/Lasting-potion.png",
      "sha256": "f8825857a91264a0d8ebe21aae91abe323dd322e7cbda758cc6e3b864e86b9c6",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "LaswerFairy",
      "source": "LaswerFairy_637c33.png",
      "path": "assets/skills/LaswerFairy.png",
      "sha256": "1c6092ed83d8b749619fda2b7bad6bc91b4be2b5aa542f27c6463b30e5fb5cdd",
      "skillIds": [
        "laser_sprite"
      ],
      "status": "mapped"
    },
    {
      "slug": "Life_Transformation",
      "source": "Life_Transformation_4f1726.png",
      "path": "assets/skills/Life_Transformation.png",
      "sha256": "8c704864db72de77a284df6a92c9be5828184cd1826dea93aaa9260440cbb3d6",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "love-howl",
      "source": "love-howl_f26f84.png",
      "path": "assets/skills/love-howl.png",
      "sha256": "ef8403d050e1b0428647679034c84bba97f6c615afac7db51bf4fff2da991a04",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "lucky-cookie",
      "source": "lucky-cookie_47902a.png",
      "path": "assets/skills/lucky-cookie.png",
      "sha256": "54d20569cfbd00b394db8923e136a4ad708722cef40e0654411e8c4ddb96dd26",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "lucky-heart",
      "source": "lucky-heart_721aba.png",
      "path": "assets/skills/lucky-heart.png",
      "sha256": "8c3c35af57a74bc4e90a924619cb6774a118cec9daf780244c137d6a740123a2",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "Lucky-potion",
      "source": "Lucky-potion_16cb1c.png",
      "path": "assets/skills/Lucky-potion.png",
      "sha256": "3343b0b1599f5183971afecbb8803cafa4f9893f2951cac3654d94e1adc0f32a",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "near-death-atk",
      "source": "near-death-atk_a0c5f6.png",
      "path": "assets/skills/near-death-atk.png",
      "sha256": "6f5914efd0f7e1535c915b6294638f1839430e60f3afda9a22e2bf837e06db0c",
      "skillIds": [
        "perilous_fervor"
      ],
      "status": "mapped"
    },
    {
      "slug": "near-death-hp",
      "source": "near-death-hp_0d6f43.png",
      "path": "assets/skills/near-death-hp.png",
      "sha256": "aaa4b9ccda3ed35c7e55bb783dbf5091c7ef433be2233396fe5443eae75db25d",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "near-death-inv",
      "source": "near-death-inv_43d9cc.png",
      "path": "assets/skills/near-death-inv.png",
      "sha256": "e698cd9c3781fc7d177ed6d4f82a08fe3c8a98d40dac96f8d7c1d4c406238d3c",
      "skillIds": [
        "angelic_shelter"
      ],
      "status": "mapped"
    },
    {
      "slug": "pierced-heart",
      "source": "pierced-heart_5c74e8.png",
      "path": "assets/skills/pierced-heart.png",
      "sha256": "18e32672c56a757bb2b2d09ec1e7d1a64dfcd7734794722d113360cc8a306045",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "Plant_Guard",
      "source": "Plant_Guard_45a343.png",
      "path": "assets/skills/Plant_Guard.png",
      "sha256": "3a8325a8e136dbb04acb1b7a8482d63ed6c07543c820fc45e56adb763d5fd193",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "Plant_Rampage",
      "source": "Plant_Rampage_b1243c.png",
      "path": "assets/skills/Plant_Rampage.png",
      "sha256": "392c8b8b8caab9e9fcdc344d044874ee3de1fb8b6471272626199184dd203ab1",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "Plant_sentinel",
      "source": "Plant_sentinel_5ee7fa.png",
      "path": "assets/skills/Plant_sentinel.png",
      "sha256": "cad2054c5fa9fb654d4a36dbe68e14f71576dcfb98540da452cadb90df4a1516",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "Poison-ball",
      "source": "Poison-ball_6e0c8c.png",
      "path": "assets/skills/Poison-ball.png",
      "sha256": "1a6e02d9af90e946ac22d13ba0c847b5880a5aad582c27988e8a3799ae79201c",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "PoisonFairy",
      "source": "PoisonFairy_eeb22f.png",
      "path": "assets/skills/PoisonFairy.png",
      "sha256": "9733095dc3328c5483a9090417c948e2db76bbb6c28ef60493ff773337ef9c3a",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "PoisonStar",
      "source": "PoisonStar_474d2c.png",
      "path": "assets/skills/PoisonStar.png",
      "sha256": "cc53511a747178361ded30b4c1ed444d9c3ef330f9821862b259ec0c3244e104",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "polyMoreHurt2",
      "source": "polyMoreHurt2_2165cf.png",
      "path": "assets/skills/polyMoreHurt2.png",
      "sha256": "e56d28062a2ccc221d1dade19933d7131dd73b47c244c8c1fb53e871fc839b57",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "Punishment-potion",
      "source": "Punishment-potion_1a37c3.png",
      "path": "assets/skills/Punishment-potion.png",
      "sha256": "39b64d89468963f510396f77fc563feb40fef8189cfd64fc2c13349c1a176156",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "Quick-ball",
      "source": "Quick-ball_7e0c88.png",
      "path": "assets/skills/Quick-ball.png",
      "sha256": "2a67f367165d0b9823b54ab4e259cc1d12fe3fe6168e833c82445b55c521de0a",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "rapid-arrow",
      "source": "rapid-arrow_8f5d5f.png",
      "path": "assets/skills/rapid-arrow.png",
      "sha256": "2c92f1cdc2e43060f155b3f73e9d24e40f9d20033b785b1abf8ee9ed320c87dd",
      "skillIds": [
        "swift_arrow"
      ],
      "status": "mapped"
    },
    {
      "slug": "rapid-arrow-strong",
      "source": "rapid-arrow-strong_b616e8.png",
      "path": "assets/skills/rapid-arrow-strong.png",
      "sha256": "72184b4c0c8f8b1045ecf64044e25f54196367f0ced4646681debf19fc72121f",
      "skillIds": [
        "multishot"
      ],
      "status": "mapped"
    },
    {
      "slug": "revolt",
      "source": "revolt_17e24b.png",
      "path": "assets/skills/revolt.png",
      "sha256": "544d01ad86d078f335aaea40bbd88cacdd3e3dffc6da38a1495e8899a937241c",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "ricochet",
      "source": "ricochet_eb6afe.png",
      "path": "assets/skills/ricochet.png",
      "sha256": "d7c0ea35aaea46188c1df259cbfb39a4232f3f11adb5e37c30e2c4b29dd19f66",
      "skillIds": [
        "ricochet"
      ],
      "status": "mapped"
    },
    {
      "slug": "Root_Shield",
      "source": "Root_Shield_579903.png",
      "path": "assets/skills/Root_Shield.png",
      "sha256": "44517eebf4110d9b013007cd81bdbf66ab663b961468ba994e4e5824fe283de8",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "round-star",
      "source": "round-star_89f345.png",
      "path": "assets/skills/round-star.png",
      "sha256": "cafa2ebe0700430dc681566bca2211cb70a1b0b645b8b2afa9daad4911e5e266",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "royal-love",
      "source": "royal-love_fd73ee.png",
      "path": "assets/skills/royal-love.png",
      "sha256": "2120fb0ee06060fb121a25b4d0440b5be2dbfe41bea761a2bfa0a117be683b4b",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "shatter",
      "source": "shatter_cef27f.png",
      "path": "assets/skills/shatter.png",
      "sha256": "852d99ddbdf67de1412622502d125c563b2c237c553cdc4e7ab6eb5b052b3e62",
      "skillIds": [
        "split_shot"
      ],
      "status": "mapped"
    },
    {
      "slug": "smart",
      "source": "smart_8b6a44.png",
      "path": "assets/skills/smart.png",
      "sha256": "1646b8c92c399bde7a8da611fec5b81733d9b4f6b6197b9aeb63ffad1fd0b90b",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "SoldierBreath",
      "source": "SoldierBreath_6b2399.png",
      "path": "assets/skills/SoldierBreath.png",
      "sha256": "552bed5ecb9122fb196ea29d483861c1a5b27151bac89da98a54ec590cef1cae",
      "skillIds": [
        "warriors_breath"
      ],
      "status": "mapped"
    },
    {
      "slug": "spark-spirit",
      "source": "spark-spirit_3a2c0b.png",
      "path": "assets/skills/spark-spirit.png",
      "sha256": "7418990401bebca1021cadd728b6594ef19a5810c28d0a4f970bdb749ba77157",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "sparky-bomb",
      "source": "sparky-bomb_734ffb.png",
      "path": "assets/skills/sparky-bomb.png",
      "sha256": "a09f49361e12370dbecb9f399d74a81677bf7205e9242163493fd104a1bfefd4",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "spartan",
      "source": "spartan_e5a173.png",
      "path": "assets/skills/spartan.png",
      "sha256": "39d56b6082a6ca804763717e7ef2dec6f4edd4fa1a9dfccb9d66fa54cd608798",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "stand-atk",
      "source": "stand-atk_d96cb8.png",
      "path": "assets/skills/stand-atk.png",
      "sha256": "19d6cdb9938ac2015c9c383aff2e497a2c3dd620ead24367caa29f2855105ead",
      "skillIds": [
        "stand_strong"
      ],
      "status": "mapped"
    },
    {
      "slug": "StarMore",
      "source": "StarMore_c2216b.png",
      "path": "assets/skills/StarMore.png",
      "sha256": "ecbf206de32766b3cb63afe07a2b6cd824501c972362333fefabe0db16400417",
      "skillIds": [
        "chain_meteors"
      ],
      "status": "mapped"
    },
    {
      "slug": "StarShockwave",
      "source": "StarShockwave_8ee943.png",
      "path": "assets/skills/StarShockwave.png",
      "sha256": "5dedaa31f93f885e4b3bb0c96a18184aa3b4326c78a5774b5dc180a57c6debc0",
      "skillIds": [
        "super_meteor"
      ],
      "status": "mapped"
    },
    {
      "slug": "striking-balls",
      "source": "striking-balls_419179.png",
      "path": "assets/skills/striking-balls.png",
      "sha256": "237a0d6100a2fd1a46054bf6b03ab20d453e41f3a77ea98df7e5de852114fdcf",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "strong",
      "source": "strong_c49a8e.png",
      "path": "assets/skills/strong.png",
      "sha256": "7beb73551d89c58ff2843733bb8e74220af6606c3d788be9886e09a49887c564",
      "skillIds": [
        "atk_boost"
      ],
      "status": "mapped"
    },
    {
      "slug": "strong-arrow",
      "source": "strong-arrow_5085a1.png",
      "path": "assets/skills/strong-arrow.png",
      "sha256": "542f2ddbd796a574d6c7e585993a8ca3584be54fe8d1ccb3f4a80547964f918c",
      "skillIds": [
        "short_range_strike"
      ],
      "status": "mapped"
    },
    {
      "slug": "StrongLaserFairy",
      "source": "StrongLaserFairy_889f3d.png",
      "path": "assets/skills/StrongLaserFairy.png",
      "sha256": "6f8b2aa009d77e7c3aceaa916711eebe8ca08d655c4e6a227dcf7cbb5f70cf14",
      "skillIds": [
        "sprite_king"
      ],
      "status": "mapped"
    },
    {
      "slug": "sun-spear",
      "source": "sun-spear_831921.png",
      "path": "assets/skills/sun-spear.png",
      "sha256": "8137507d211a304f359566f05ad0ae4f86df148c4f9fcf1055e8146227e096b9",
      "skillIds": [
        "pierce"
      ],
      "status": "mapped"
    },
    {
      "slug": "SuperAtk",
      "source": "SuperAtk_893d50.png",
      "path": "assets/skills/SuperAtk.png",
      "sha256": "7c2f437f8fcdf65a3e71b5434f70385d06c92fc7e0b44fba547b7f3c5d27d33d",
      "skillIds": [
        "warriors_soul"
      ],
      "status": "mapped"
    },
    {
      "slug": "SuperHP",
      "source": "SuperHP_80ff45.png",
      "path": "assets/skills/SuperHP.png",
      "sha256": "d768d21b292535a18c5b7f1d4d0199378c17a9359d0d4f2dd50f9eaaeb40951b",
      "skillIds": [
        "soul_of_strength"
      ],
      "status": "mapped"
    },
    {
      "slug": "SuperSpd",
      "source": "SuperSpd_91cc6d.png",
      "path": "assets/skills/SuperSpd.png",
      "sha256": "9e1e00af38211b7cbbd812748b4103900dd240c1dca591c6f358cba5fb676474",
      "skillIds": [
        "aspd_boost"
      ],
      "status": "mapped"
    },
    {
      "slug": "super-ball",
      "source": "super-ball_d3eadd.png",
      "path": "assets/skills/super-ball.png",
      "sha256": "14d7521b5a74d42cae8baa9623f67c90ff06ca897b680adb90790b96292c704f",
      "skillIds": [
        "super_circle"
      ],
      "status": "mapped"
    },
    {
      "slug": "super-fire",
      "source": "super-fire_7439ed.png",
      "path": "assets/skills/super-fire.png",
      "sha256": "9bf89494796edebdfb1edfa13283818ec26f99c401917e7f647be50cbcdccd81",
      "skillIds": [
        "super_blaze"
      ],
      "status": "mapped"
    },
    {
      "slug": "super-ice",
      "source": "super-ice_1b5199.png",
      "path": "assets/skills/super-ice.png",
      "sha256": "f3fbc864d4b24971d9bd64ba93ead5398d9cd36b550dbe30d5fcb17b9fa5b8e0",
      "skillIds": [
        "super_freeze"
      ],
      "status": "mapped"
    },
    {
      "slug": "super-poison",
      "source": "super-poison_ff8725.png",
      "path": "assets/skills/super-poison.png",
      "sha256": "d265e5bd25a2c6700b39e2dab45cf06c368fa9fde2076cff1d5e2d1105090f03",
      "skillIds": [
        "super_venom"
      ],
      "status": "mapped"
    },
    {
      "slug": "super-thunder",
      "source": "super-thunder_9d2e70.png",
      "path": "assets/skills/super-thunder.png",
      "sha256": "af071eea66ae91ec0c5dfa37586b9dd84a49384c64ad9c147164eea94ab0ae38",
      "skillIds": [
        "super_bolt"
      ],
      "status": "mapped"
    },
    {
      "slug": "Sword-Assault",
      "source": "Sword-Assault_1f3ef7.png",
      "path": "assets/skills/Sword-Assault.png",
      "sha256": "7992704d27ea8704774890d2f43a6760196601217a65a7895d15eb5a6cd26bc7",
      "skillIds": [
        "assault_strike"
      ],
      "status": "mapped"
    },
    {
      "slug": "Sword-Atk",
      "source": "Sword-Atk_7edaa2.png",
      "path": "assets/skills/Sword-Atk.png",
      "sha256": "9510c6c3cfb8a2c824ad96b68910dc710b6e0155068068457aa1088d23f45ec0",
      "skillIds": [
        "strike_boost"
      ],
      "status": "mapped"
    },
    {
      "slug": "Sword-Counterattack",
      "source": "Sword-Counterattack_c2c3b9.png",
      "path": "assets/skills/Sword-Counterattack.png",
      "sha256": "1c34b7119d7d34c357e3c1ee27096e01ac664b8734cb70ead04c0b15a1caa311",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "Sword-Double",
      "source": "Sword-Double_b0fdeb.png",
      "path": "assets/skills/Sword-Double.png",
      "sha256": "718915cbf562bb57fe732e5a0de08a7a476da783b36c48b69402c7fbb526678c",
      "skillIds": [
        "twin_strike"
      ],
      "status": "mapped"
    },
    {
      "slug": "Sword-GO",
      "source": "Sword-GO_8f6df5.png",
      "path": "assets/skills/Sword-GO.png",
      "sha256": "33f3b5e39b17dd99ba43720efcde151452f71999486a2916047d7d9649b6e482",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "Sword-Inheritance",
      "source": "Sword-Inheritance_7b027d.png",
      "path": "assets/skills/Sword-Inheritance.png",
      "sha256": "77019cd07c0acd559af3db768754c27ff2551e50a52b34d3a3cbee4311f5654d",
      "skillIds": [
        "magic_strike"
      ],
      "status": "mapped"
    },
    {
      "slug": "Sword-Laser",
      "source": "Sword-Laser_19e5a1.png",
      "path": "assets/skills/Sword-Laser.png",
      "sha256": "6ef9282738a67ae6e3bf8ed5d26323172be8593715322236e054903bd173318c",
      "skillIds": [
        "beam_strike"
      ],
      "status": "mapped"
    },
    {
      "slug": "Sword-Moment",
      "source": "Sword-Moment_c0031d.png",
      "path": "assets/skills/Sword-Moment.png",
      "sha256": "52aac6f3acf97794ad995b3d10b5c374040e7bd78471d8d3b6000e85aea02a30",
      "skillIds": [
        "flying_swords"
      ],
      "status": "mapped"
    },
    {
      "slug": "Sword-Potion",
      "source": "Sword-Potion_eb47b4.png",
      "path": "assets/skills/Sword-Potion.png",
      "sha256": "33c46412a12729537a54e0c5b3a16e050bc82146036115d40b8fbbf844c7f6d2",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "Sword-Pursuit",
      "source": "Sword-Pursuit_d7c407.png",
      "path": "assets/skills/Sword-Pursuit.png",
      "sha256": "79223cd396b5893cee8b39a47ec03750a1d75f81ed28e1d360dd1ba0246eac75",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "take_root_and_sprout",
      "source": "take_root_and_sprout_26d84e.png",
      "path": "assets/skills/take_root_and_sprout.png",
      "sha256": "a05c10c9ddef0f2753a90caff9989981b97599d1a6bac83dfbb10c4848d8a717",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "three-add",
      "source": "three-add_c37874.png",
      "path": "assets/skills/three-add.png",
      "sha256": "56ea324e10ad658f5fce359a8bec45404c5a1c7b4eada4619b978b42ff72b86c",
      "skillIds": [
        "power_trio"
      ],
      "status": "mapped"
    },
    {
      "slug": "ThroughWall",
      "source": "ThroughWall_cd2231.png",
      "path": "assets/skills/ThroughWall.png",
      "sha256": "44aaa37a8b0a2bc3486be9fd6e54757a53b0d3d5d711b7b6b6bf3934bc114050",
      "skillIds": [
        "wall_piercing_arrow"
      ],
      "status": "mapped"
    },
    {
      "slug": "thunder-arrow",
      "source": "thunder-arrow_c138a1.png",
      "path": "assets/skills/thunder-arrow.png",
      "sha256": "fbde1ae1061dfc502fdd49aaa7e6d9df2b76621a5f317efd570be29c5f9a49c8",
      "skillIds": [
        "lightning_arrow"
      ],
      "status": "mapped"
    },
    {
      "slug": "Thunder-ball",
      "source": "Thunder-ball_d49437.png",
      "path": "assets/skills/Thunder-ball.png",
      "sha256": "3a4d63640151e37ab351b3a3ff9aa8239610321a4caa640c78df55ee7a16d74a",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "ThunderFairy",
      "source": "ThunderFairy_067549.png",
      "path": "assets/skills/ThunderFairy.png",
      "sha256": "5708bc7f557d83a15c5bfb29d83003ad0145cf2964e339f7e7aedc9a10aed3eb",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "ThunderStar",
      "source": "ThunderStar_9c72d0.png",
      "path": "assets/skills/ThunderStar.png",
      "sha256": "927b3d0a32e5a4d268ece69d5299f41c9065488f907b179b42c7e062ecb6aaad",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "tiniquick-arrow",
      "source": "tiniquick-arrow_a931c9.png",
      "path": "assets/skills/tiniquick-arrow.png",
      "sha256": "f379b1a2b05d92c8331ea034263a564ed5f28477169541d14328e6b9d23a3965",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "Vampire",
      "source": "Vampire_2814fc.png",
      "path": "assets/skills/Vampire.png",
      "sha256": "6d1a9dbc9be049ac1e0941da2affe07cec941c56f9c321dd80f4acb954945dca",
      "skillIds": [
        "bloodthirst"
      ],
      "status": "mapped"
    },
    {
      "slug": "Vampire-ball",
      "source": "Vampire-ball_70b3a2.png",
      "path": "assets/skills/Vampire-ball.png",
      "sha256": "63c9fb6d73b5d47de434020bb7ae6c0bed8c130a3656dbddc9a73a880fb7e63a",
      "skillIds": [
        "orbit_orbs"
      ],
      "status": "mapped"
    },
    {
      "slug": "Vine_Pursuit",
      "source": "Vine_Pursuit_8a59f0.png",
      "path": "assets/skills/Vine_Pursuit.png",
      "sha256": "83d9058903eeb0c737def2ad289d830c964912178dc9f25aae0ce416031dde68",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "wind-run",
      "source": "wind-run_db1f3f.png",
      "path": "assets/skills/wind-run.png",
      "sha256": "90e895995f0f92f1ec916af14414f4fee4a5f944bc44823f7adbb14a4476a749",
      "skillIds": [
        "hermes_boots"
      ],
      "status": "mapped"
    },
    {
      "slug": "wing",
      "source": "wing_a200a8.png",
      "path": "assets/skills/wing.png",
      "sha256": "cb1ca6b3084850201c64684a0b6c8379aaa00bcba1069797bcb37bd6cdec28d8",
      "skillIds": [
        "wind_blessing"
      ],
      "status": "mapped"
    },
    {
      "slug": "attracts_a_crowd_of_admirers",
      "source": "attracts_a_crowd_of_admirers_e0f14e.png",
      "path": "assets/skills/attracts_a_crowd_of_admirers.png",
      "sha256": "e66ebf220c7e195f5b708e647addd3a0e65304fe7b92ce60a59c976701a28ea0",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "decisive-battle-inv",
      "source": "decisive-battle-inv_c57ba4.png",
      "path": "assets/skills/decisive-battle-inv.png",
      "sha256": "bee9c76ac1e6f0ee8543a8056031fa71f4c44a5538fabd8adcc573519245aff4",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "diamonds-smile",
      "source": "diamonds-smile_78d885.png",
      "path": "assets/skills/diamonds-smile.png",
      "sha256": "bc14d361bb2d9e62f81aa41ace34977089465c38b2cfc0c1ee633d5927e82f0d",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    },
    {
      "slug": "bomb-end",
      "source": "bomb-end_8ed5bf.png",
      "path": "assets/skills/bomb-end.png",
      "sha256": "685ec4af5379b9a9b3ae9107a5877601a835b713c50f8f123ae12e28a7ee4da2",
      "skillIds": [],
      "status": "unused-engine-or-uncertain"
    }
  ],
  "unmappedSkillIds": [
    "water_walker",
    "slow_field",
    "meteor_shower",
    "lightwing_arrow"
  ],
  "notes": [
    "Giữ nguyên sát thương, thời gian, hitbox và save hiện có.",
    "orbit_orbs và assault_strike là kỹ năng gộp: hình chỉ đại diện wikiName chính.",
    "Hai nguồn được lưu độc lập; khác biệt mô tả không tự ghi đè chỉ số chiến đấu."
  ]
};
