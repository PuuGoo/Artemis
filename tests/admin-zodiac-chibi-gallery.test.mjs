import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Script } from 'node:vm';
import { getCampaignDetail } from '../lib/campaignCatalog.js';

const ui=fs.readFileSync(new URL('../public/admin-campaign.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/admin-campaign.css',import.meta.url),'utf8');
const code=fs.readFileSync(new URL('../public/zodiac-chibi-bosses.js',import.meta.url),'utf8');
const signs='leo aries taurus gemini cancer virgo libra scorpio sagittarius capricorn aquarius pisces'.split(' ');

test('admin maps all 12 chapters to their actual native-Canvas zodiac bosses',()=>{
  for(let i=0;i<signs.length;i++){
    const ch=i+1,type='zodiac_'+signs[i];
    const d=getCampaignDetail(ch);
    assert.ok(d && d.bosses.length>0);
    assert.equal(d.bosses.find(b=>b.room===50)?.type,type,'Chapter '+ch+' final boss');
    assert.deepEqual(d.bosses.filter(b=>b.room<50).map(b=>b.room),[10,20,30,40]);
  }
  assert.match(code,/renderMode:'canvas-paths'/);
  assert.match(ui,/function bossArt\(id\)/);
  assert.match(ui,/zodiacSlugs\[id-1\]/);
});

test('admin draws boss images using the shared Canvas API',()=>{
  new Script(ui);
  assert.match(ui,/id="ccZodiacGallery"/);
  assert.match(ui,/function renderZodiacGallery\(/);
  assert.match(ui,/function paintZodiacCards\(/);
  assert.match(ui,/canvas width="200" height="170" data-zodiac/);
  assert.match(ui,/canvas width="220" height="195" data-zodiac/);
  assert.match(ui,/cc-zodiac-sprite/);
  // Boss arena must no longer bypass drawMonster: only that game renderer
  // applies Leo's actual Idle/Attack/Hit/Death PNG atlases.
  assert.doesNotMatch(ui,/function drawZodiacInArena\(/);
  assert.match(ui,/activeEntities\.forEach\(function\(e\)\{api\.drawMonster\(ctx,e,now\);\}\)/);
  assert.match(ui,/zodiac-chibi-bosses\.js/);
  assert.match(ui,/api\.drawMonster\(ctx,e,now\)/);
  for(const cls of ['.cc-zodiac-grid','.cc-zodiac-card','.cc-zodiac-sprite','.cc-boss-feature'])
    assert.ok(css.includes(cls),'Missing '+cls);
});
