"""Nhập đúng lô ảnh kỹ năng và giữ hai nguồn tham chiếu độc lập."""
from pathlib import Path
import re, json, html, hashlib, shutil
ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('C:/Users/PuuGoo/AppData/Roaming/Hermes/composer-images')
ATTACH = Path('C:/Users/PuuGoo/AppData/Local/hermes/attachments')
SLUGS = '''Additional_summons angle-health angle-inv angle-inv-each angle-ring armor-downgrade Atk-potion atk-zone atlas Attack-ball AttackStar auto-archer back-arrow bad-gnome ball-laser ball-line BallSawblade BombFairy boss-killer cannon-ball cannon-shot charged-arrow chemical-arrow clover crosshair Dead_s_Flowers death-arrow double-arrow eject-arrow ElfBreath FairyBreath FairyPower falling-boulder fast-forward-button FeverFairy Fire-ball FireFairy FireStar fire-road fire-silhouette flaming-arrow FlyWing frozen-arrow gunshot half-revive whole-revive Harvest-potion heart-battery heartburn heart-hp heart-plus heart-plus-max hooded-figure hp-atk hp-hold hurt-atk hurt-punish Ice-ball IceFairy Ice-potion IceStar ifrit imp-laugh Infernal-Contract kill-atk KillStar laser-precision Lasting-potion LaswerFairy Life_Transformation love-howl lucky-cookie lucky-heart Lucky-potion near-death-atk near-death-hp near-death-inv pierced-heart Plant_Guard Plant_Rampage Plant_sentinel Poison-ball PoisonFairy PoisonStar polyMoreHurt2 Punishment-potion Quick-ball rapid-arrow rapid-arrow-strong revolt ricochet Root_Shield round-star royal-love shatter smart SoldierBreath spark-spirit sparky-bomb spartan stand-atk StarMore StarShockwave striking-balls strong strong-arrow StrongLaserFairy sun-spear SuperAtk SuperHP SuperSpd super-ball super-fire super-ice super-poison super-thunder Sword-Assault Sword-Atk Sword-Counterattack Sword-Double Sword-GO Sword-Inheritance Sword-Laser Sword-Moment Sword-Potion Sword-Pursuit take_root_and_sprout three-add ThroughWall thunder-arrow Thunder-ball ThunderFairy ThunderStar tiniquick-arrow Vampire Vampire-ball Vine_Pursuit wind-run wing attracts_a_crowd_of_admirers decisive-battle-inv diamonds-smile bomb-end'''.split()
# Ánh xạ theo tên/tác dụng; các mục gộp chỉ lấy hình cho wikiName chính.
MAP = dict(line.split('=') for line in '''warriors_soul=SuperAtk
power_trio=three-add
multishot=rapid-arrow-strong
corrosive_field=armor-downgrade
energy_beam=cannon-shot
soul_of_strength=SuperHP
sacred_protection=angle-inv-each
sprite_king=StrongLaserFairy
super_meteor=StarShockwave
beam_strike=Sword-Laser
circle_web=ball-line
atk_boost=strong
giants_strength=atlas
weapon_enchantment=auto-archer
aspd_boost=SuperSpd
tracking_eye=crosshair
diag_arrow=double-arrow
energy_ring=cannon-ball
wall_piercing_arrow=ThroughWall
wind_blessing=wing
water_walker=FlyWing
slow_field=angle-ring
revive=whole-revive
super_blaze=super-fire
super_bolt=super-thunder
super_venom=super-poison
super_freeze=super-ice
laser_sprite=LaswerFairy
sprite_frenzy=FeverFairy
meteor_shower=AttackStar
chain_meteors=StarMore
beam_circle=ball-laser
super_circle=super-ball
magic_strike=Sword-Inheritance
strike_boost=Sword-Atk
twin_strike=Sword-Double
underworld_warrior=hooded-figure
demon_slayer=kill-atk
warriors_heart=hp-atk
stand_strong=stand-atk
short_range_strike=strong-arrow
perilous_fervor=near-death-atk
lightwing_arrow=death-arrow
swift_arrow=rapid-arrow
front_arrow=gunshot
charged_arrow=charged-arrow
pierce=sun-spear
split_shot=shatter
ricochet=ricochet
lucky_band_aid=clover
fountain_of_life=heart-plus-max
angelic_shelter=near-death-inv
fire_arrow=flaming-arrow
lightning_arrow=thunder-arrow
venom_arrow=chemical-arrow
ice_arrow=frozen-arrow
bomb_sprite=BombFairy
flying_swords=Sword-Moment
warriors_breath=SoldierBreath
fairys_breath=FairyBreath
hermes_boots=wind-run
max_hp_up=heart-plus
restore_hp=heart-hp
wounded_warrior=hurt-atk
boss_slayer=boss-killer
long_range_power=laser-precision
bouncy_wall=eject-arrow
rear_arrow=back-arrow
fiery_path=fire-road
bloodthirst=Vampire
orbit_orbs=Vampire-ball
assault_strike=Sword-Assault'''.splitlines())
# Không gán âm thầm các slug có nhiều cách diễn giải.
UNCERTAIN = {'water_walker','slow_field','lightwing_arrow','meteor_shower'}
for key in UNCERTAIN: MAP.pop(key)
clean = lambda s: re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', ' ', s))).strip()
wiki_path = ATTACH/'pasted_content_2026-11-07_16-42-10-212_df338a.txt'
mobi_path = ATTACH/'pasted_content_2026-11-07_16-44-28-280_6a7190.txt'
wiki = wiki_path.read_text(encoding='utf-8'); mobi = mobi_path.read_text(encoding='utf-8')
rows = []
for rarity, table in zip(['legend','epic','rare','common'],re.findall(r'<table\b[\s\S]*?</table>',wiki)[3:7]):
    for tr in re.findall(r'<tr\b[\s\S]*?</tr>',table)[1:]:
        cells = re.findall(r'<td\b[^>]*>([\s\S]*?)</td>',tr)
        if len(cells)!=2: continue
        rows.append({'name':clean(re.split(r'<br\s*/?>', cells[0])[0]),'rarity':rarity,'description':clean(cells[0]),'effects':clean(cells[1])})
editorial=[]
for tr in re.findall(r'<tr\b[\s\S]*?</tr>',re.findall(r'<table\b[\s\S]*?</table>',mobi)[0]):
    cells=re.findall(r'<td\b[^>]*>([\s\S]*?)</td>',tr)
    if len(cells)==3: editorial.append(dict(zip(['name','tier','effect'],map(clean,cells))))
assets=[]; dest=ROOT/'public/assets/skills'; dest.mkdir(parents=True,exist_ok=True)
for slug in SLUGS:
    found=list(SOURCE.glob(slug+'_??????.png'))
    if len(found)!=1: raise ValueError((slug,found))
    f=found[0]; shutil.copyfile(f,dest/(slug+'.png'))
    assets.append({'slug':slug,'source':f.name,'path':'assets/skills/'+slug+'.png','sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'skillIds':[k for k,v in MAP.items() if v==slug], 'status':'mapped' if slug in MAP.values() else 'unused-engine-or-uncertain'})
h= (ROOT/'public/index.html').read_text(encoding='utf-8'); block=h[h.index('const ROGUE_SKILLS'):]; block=block[:block.index('];')]
ids=re.findall(r"id: '([^']+)'",block)
data={'sources':{'wiki':{'url':'https://archero-2.game-vault.net/wiki/Skills','revision':1858,'sha256':hashlib.sha256(wiki.encode()).hexdigest()},'editorial':{'url':'https://mobi.gg/en/tips/archero-2-skill-tier-list/','sha256':hashlib.sha256(mobi.encode()).hexdigest(),'note':'S–F là xếp hạng biên tập, không phải độ hiếm. Giữ nguyên mô tả; không suy ra số từ ↑.'}},'wiki':rows,'editorial':editorial,'mapping':MAP,'assets':assets,'unmappedSkillIds':[i for i in ids if i not in MAP],'notes':['Giữ nguyên sát thương, thời gian, hitbox và save hiện có.','orbit_orbs và assault_strike là kỹ năng gộp: hình chỉ đại diện wikiName chính.','Hai nguồn được lưu độc lập; khác biệt mô tả không tự ghi đè chỉ số chiến đấu.']}
(ROOT/'public/skill-art-data.js').write_text('/* Dữ liệu tham chiếu; sinh bằng tools/import-skill-art.py. */\nglobalThis.SkillArtData = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
(ROOT/'docs/skill-art-coverage.json').write_text(json.dumps({'assets':len(assets),'mappedSkills':len(MAP),'engineSkills':len(ids),'wikiRows':len(rows),'editorialRows':len(editorial),'unusedAssets':[a['slug'] for a in assets if not a['skillIds']],'unmappedSkillIds':data['unmappedSkillIds'],'notes':data['notes']},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'assets':len(assets),'mappedSkills':len(MAP),'engineSkills':len(ids),'wikiRows':len(rows),'editorialRows':len(editorial),'unusedAssets':sum(not a['skillIds'] for a in assets),'unmappedSkillIds':data['unmappedSkillIds']}))
