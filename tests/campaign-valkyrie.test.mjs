import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const sandbox = {window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../public/obstacle-clearance.js', import.meta.url),'utf8'),sandbox);
const file = new URL('../public/campaign-valkyrie.js', import.meta.url);
if(fs.existsSync(file)) vm.runInNewContext(fs.readFileSync(file,'utf8'),sandbox);

test('NPC tìm vị trí có đường đi, không chạm nhân vật, vật cản và cổng',()=>{
  const api=sandbox.window.ArtemisCampaignValkyrie;
  assert.ok(api,'module NPC chưa được triển khai');
  for(const width of [360,780]) {
    const game={width,height:600,wallPad:28,player:{x:width/2,y:500,r:17},portalRect:{x:width/2-20,y:10,w:40,h:46},obstacles:[{x:width/2-40,y:260,w:80,h:60}]};
    const pos=api.findPosition(game);
    assert.ok(pos);
    assert.ok(Math.hypot(pos.x-game.player.x,pos.y-game.player.y)>55);
    assert.equal(sandbox.window.ArtemisObstacleClearance.overlapsObstacle(pos.x,pos.y,22,game.obstacles[0]),false);
    assert.ok(pos.y>100);
  }
});
test('NPC không xuyên bức tường kín; không treo khi không còn vị trí',()=>{
  const api=sandbox.window.ArtemisCampaignValkyrie;
  assert.ok(api);
  const g={width:360,height:600,wallPad:28,player:{x:180,y:500,r:17},portalRect:{x:160,y:10,w:40,h:46},obstacles:[{x:28,y:280,w:304,h:50}]};
  const p=api.findPosition(g);assert.ok(p);
  assert.ok(p.y - 22 > g.obstacles[0].y + g.obstacles[0].h, 'NPC remains on the player side of the sealed wall');
  assert.equal(sandbox.window.ArtemisObstacleClearance.overlapsObstacle(p.x,p.y,22,g.obstacles[0]),false);
  g.obstacles=[{x:0,y:0,w:360,h:600}];assert.equal(api.findPosition(g),null);
});
test('dessin Canvas hữu hạn, không thay đổi state, có nhánh giảm hiệu ứng',()=>{
  const api=sandbox.window.ArtemisCampaignValkyrie;assert.ok(api);
  const p={x:100,y:200,r:22},before=JSON.stringify(p);let saves=0;
  const ctx=new Proxy({save(){saves++},restore(){saves--}},{get(o,k){return k in o?o[k]:(...args)=>assert.ok(args.every(x=>typeof x!=='number'||Number.isFinite(x)));},set(o,k,v){o[k]=v;return true}});
  for(const low of [false,true]) assert.doesNotThrow(()=>api.draw(ctx,p,1500,low,true));
  assert.equal(saves,0);assert.equal(JSON.stringify(p),before);
});
