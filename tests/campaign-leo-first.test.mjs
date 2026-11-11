import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { getCampaignSummaries, getCampaignDetail } from '../lib/campaignCatalog.js';
import '../public/campaign-order.js';

const order=['leo','aries','taurus','gemini','cancer','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
const legacy=[12,8,9,10,11,13,14,15,16,17,18,19];
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const summary=getCampaignSummaries();

test('Exactly twelve consecutive zodiac chapters, with Leo promoted to chapter 1',()=>{
  assert.deepEqual(summary.map(x=>x.id),Array.from({length:12},(_,i)=>i+1));
  for(let i=0;i<12;i++){
    const chapter=summary[i];
    assert.match(chapter.name,new RegExp('^Chương '+(i+1)+':'));
    assert.equal(chapter.unlockChapter,i===0?null:i);
    assert.equal(chapter.rooms,50);
    assert.equal(chapter.mapAsset,'/assets/map-ch'+legacy[i]+'-zodiac-'+order[i]+'.svg');
    assert.ok(existsSync(new URL('../public'+chapter.mapAsset,import.meta.url)));
    const final=getCampaignDetail(chapter.id)?.bosses.find(b=>b.room===50);
    assert.equal(final?.type,'zodiac_'+order[i]);
  }
  assert.equal(summary[0].themeName,'Sư Tử');
  assert.equal(getCampaignDetail(13),null);
});
test('Client index has the same 12 chapter IDs and imports the migration before cloud',()=>{
  const from=html.indexOf('const CHAPTERS = [');
  const end=html.indexOf('\n      ];',from);
  assert.ok(from>0&&end>from);
  const source=html.slice(from,end);
  const ids=[...source.matchAll(/^          id: (\d+),/gm)].map(m=>Number(m[1]));
  assert.deepEqual(ids,Array.from({length:12},(_,i)=>i+1));
  assert.match(source,/id: 1,[\s\S]*?themeName: 'Sư Tử'/);
  assert.doesNotMatch(source,/Hầm Ngục Đá Cổ|Nữ Hoàng Sợi Nấm|Đại Ma Vương Atreus/);
  assert.ok(html.indexOf('src="/campaign-order.js"')<html.indexOf('src="/cloud.js"'));
  assert.match(html,/campaignOrderVersion: this.campaignOrderVersion \|\| 0/);
});
test('Save migration is identity based, never granting old chapter 1 wins to Leo',()=>{
  const api=globalThis.ArtemisCampaignOrder;
  const original={
    campaign50Version:1,
    selectedChapterIdx:11,
    campaignOrderVersion:0,
    winsByChapter:{1:25,7:3,8:2,12:4,19:1},
    bestRooms:{1:50,8:19,12:48,19:50},
    dungeonCheckpoint:{chapterId:12,chapterIdx:11,room:48}
  };
  const migrated=api.migrateSave(original);
  assert.deepEqual(migrated.winsByChapter,{1:4,2:2,12:1});
  assert.deepEqual(migrated.bestRooms,{1:48,2:19,12:50});
  assert.equal(migrated.selectedChapterIdx,0);
  assert.equal(migrated.campaignOrderVersion,2);
  assert.equal(migrated.dungeonCheckpoint,null);
  assert.deepEqual(api.migrateSave(migrated),migrated);
  assert.equal(original.winsByChapter[1],25);
});
test('Campaign config/renderer use Leo as chapter 1 and retain all four sprite files',()=>{
  const config=globalThis.ArtemisCampaignConfig;
  assert.equal(config.bossType(1,50),'zodiac_leo');
  assert.equal(config.roomPlan(1,50).isFinalBoss,true);
  assert.equal(config.roomPlan(1,10).bossType,'golem');
  const renderer=readFileSync(new URL('../public/js/game/rendering/arena-renderer.js',import.meta.url),'utf8');
  assert.match(renderer,/1: \['zodiac_leo'\]/);
  assert.match(renderer,/Number\(Game.chapter.id\) - 1/);
  for(const action of ['idle','attack','hit','death']){
    assert.ok(existsSync(new URL('../public/assets/zodiac/leo-'+action+'.png',import.meta.url)));
  }
});
test('Admin and boss artist map Leo to chapter 1',()=>{
  const admin=readFileSync(new URL('../public/admin-campaign.js',import.meta.url),'utf8');
  const zodiac=readFileSync(new URL('../public/zodiac-chibi-bosses.js',import.meta.url),'utf8');
  assert.match(admin,/Chương 1–12/);
  const window={};
  vm.runInNewContext(zodiac,{window});
  assert.equal(window.ArtemisZodiacBosses.sources.zodiac_leo.chapter,1);
  assert.equal(window.ArtemisZodiacBosses.sources.zodiac_aries.chapter,2);
});
