import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const html = fs.readFileSync(new URL('public/index.html', root), 'utf8');
const code = fs.readFileSync(new URL('public/zodiac-chibi-bosses.js', root), 'utf8');
const signs = 'aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces'.split(' ');

test('each zodiac has independent vector Canvas art instead of displaying SVG sprites', () => {
  assert.doesNotMatch(code, /(?:\.drawImage\(|new Image\(|new OffscreenCanvas\(|\.src\s*=)/);
  signs.forEach((sign, index) => {
    assert.match(code, new RegExp('function ' + sign + '\\(c,t\\)\\s*\\{'));
    assert.ok(fs.existsSync(new URL('public/assets/boss-ch'+(index+8)+'-'+sign+'.svg',root)),
      'Retain older SVG assets for backwards compatibility');
  });
});

test('all 12 chibi bosses render with paths, charge and rage without an image load', () => {
  const globals={window:{},Image:class {constructor(){throw Error('Image must not load');}}};
  vm.runInNewContext(code,globals);
  const art=globals.window.ArtemisZodiacBosses;
  assert.equal(art.renderMode,'canvas-paths');
  assert.equal(Object.keys(art.sources).length,12);
  let fills=0,curves=0;
  const ctx={
    save(){},restore(){},translate(){},rotate(){},scale(){},
    moveTo(){},lineTo(){},closePath(){},beginPath(){},
    quadraticCurveTo(){curves++;},bezierCurveTo(){curves++;},
    ellipse(){curves++;},arc(){curves++;},
    fill(){fills++;},stroke(){},
    createLinearGradient(){return {addColorStop(){}}},
    drawImage(){throw Error('Raster rendering forbidden');}
  };
  for(const sign of signs){
    const type='zodiac_'+sign;
    assert.equal(art.preload(type).ready,true);
    assert.equal(art.draw(ctx,type,35,1000,1,false),true,type+' idle');
    assert.equal(art.draw(ctx,type,35,1200,.25,true),true,type+' enraged');
  }
  assert.ok(fills>300,'Boss shapes should be richly detailed');
  assert.ok(curves>300,'Drawings should use curved Canvas paths');
  assert.equal(art.draw(ctx,'zodiac_unknown',35,1000,1,false),false);
  assert.equal(art.draw(ctx,'zodiac_aries',0,1000,1,false),false);
});

test('campaign remains wired to the same pure visual drawing hook', () => {
  assert.match(html,/<script src="\/zodiac-chibi-bosses\.js"><\/script>/);
  const boss=html.slice(html.indexOf('function drawZodiacBoss('),html.indexOf('const BOSSFN'));
  assert.match(boss,/ArtemisZodiacBosses/);
  assert.match(boss,/\.draw\(ctx, curBiome\?\.boss, r, t, hr, charge\)/);
  assert.match(html,/zodiac_pisces:\s*drawZodiacBoss/);
});

test('unsupported contexts allow old Canvas fallback',()=>{
  const globals={window:{}};vm.runInNewContext(code,globals);
  assert.equal(globals.window.ArtemisZodiacBosses.draw({},'zodiac_aries',35,1000,1,false),false);
});
