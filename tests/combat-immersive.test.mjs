import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8').replace(/\r\n/g,'\n');
function body(name) {
  const start=html.indexOf(`function ${name}(`); assert.ok(start>=0,`production ${name} exists`);
  let i=html.indexOf('{',start),depth=1,j=i+1;
  for(;depth && j<html.length;j++){if(html[j]==='{')depth++;if(html[j]==='}')depth--;}
  return html.slice(start,j);
}
function node(hidden=false){const classes=new Set(hidden?['hidden']:[]);return {dataset:{},inert:false,innerHTML:'',textContent:'',classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,v){if(v??!classes.has(c))classes.add(c);else classes.delete(c);}}};}
function load(){
  const nodes={}; for(const id of ['appRoot','summaryModal','summaryModalIcon','summaryModalTitle','summaryModalSubtitle','summaryRoomReached','summaryKills','summaryRewardText','summarySkillsList','btnPauseGame','btnResumeGame','btnReturnLobby','btnPlayAgain','chapterVictoryModal','gameArenaView','tabBattle','bottomNavBar'])nodes[id]=node();
  const lobby=[node(),node(),nodes.bottomNavBar];lobby[1].inert=true;
  const Game={running:true,paused:false,lastTime:12,animId:7,room:9,maxRooms:50,kills:12,runGold:35,width:800,height:600,player:{x:34,y:61,hp:70,skillList:[{id:'fire',name:'Lửa'}],skills:{fire:2}},enemies:[{x:43,y:12,hp:10}],obstacles:[{x:14,y:22,w:7,h:9}]};
  const save={gold:120,gearBag:[{uid:'owned'}],dungeonCheckpoint:{room:5},save(){}};
  let confirmations=0,renders=0;
  const sandbox={Game,SaveState:save,performance:{now:()=>99},window:{confirm(){confirmations++;return sandbox.accept;}},accept:false,cancelAnimationFrame(){},hideRoomClearOverlay(){},renderLobbyUI(){renders++;},renderSkillIcon:sk=>`[${sk.id}]`,document:{getElementById:id=>nodes[id],querySelectorAll:()=>lobby}};
  vm.createContext(sandbox);
  return {nodes,lobby,Game,save,sandbox,counts:()=>({confirmations,renders})};
}
function wire(h,id){
  let click; h.nodes[id].addEventListener=(type,fn)=>{click=fn;};
  const start=html.indexOf(`document.getElementById('${id}').addEventListener('click', () => {`);
  assert.ok(start>=0); const end=html.indexOf('\n      });',start);
  vm.runInContext(html.slice(start,end+10),h.sandbox);return ()=>click();
}
test('pause and resume use actual handlers, retain arena isolation and leave world/account unchanged',()=>{
  const h=load();vm.runInContext(body('showSummaryModal'),h.sandbox);
  const before=JSON.stringify(h.Game),account=JSON.stringify(h.save);
  const pause=wire(h,'btnPauseGame'),resume=wire(h,'btnResumeGame');
  pause();assert.equal(h.Game.paused,true);assert.equal(h.Game.running,true);
  assert.equal(h.nodes.summaryModal.classList.contains('hidden'),false);
  assert.equal(h.nodes.btnPlayAgain.classList.contains('hidden'),true);
  assert.equal(h.nodes.summaryModal.dataset.pause,'true');
  assert.match(h.nodes.summarySkillsList.innerHTML,/Lửa/);
  assert.match(h.nodes.summarySkillsList.innerHTML,/2/);
  resume();assert.equal(h.Game.paused,false);assert.equal(h.Game.lastTime,99);
  assert.equal(h.nodes.summaryModal.classList.contains('hidden'),true);
  h.Game.lastTime=12;assert.equal(JSON.stringify(h.Game),before);assert.equal(JSON.stringify(h.save),account);
  assert.equal(h.counts().renders,0);
});
test('explicit pause exit asks confirmation and cancel keeps the run; accepted exit restores lobby without grants',()=>{
  const h=load();vm.runInContext([body('setCombatImmersive'),body('returnToLobby')].join('\n'),h.sandbox);
  h.sandbox.setCombatImmersive(true);h.Game.paused=true;
  const account=JSON.stringify(h.save),world=JSON.stringify(h.Game.player);
  const exit=wire(h,'btnReturnLobby');exit();
  assert.equal(h.Game.running,true);assert.equal(h.Game.paused,true);assert.equal(h.counts().renders,0);
  h.sandbox.accept=true;exit();assert.equal(h.counts().confirmations,2);
  assert.equal(h.Game.running,false);assert.equal(h.Game.paused,false);
  assert.equal(h.nodes.appRoot.classList.contains('combat-immersive'),false);
  assert.equal(h.nodes.gameArenaView.classList.contains('hidden'),true);
  assert.equal(JSON.stringify(h.save),account);assert.equal(JSON.stringify(h.Game.player),world);
  assert.equal(h.counts().renders,1);
});
test('minimal combat HUD keeps live writer ids but moves skills, hints and settings into pause',()=>{
  const arena=html.slice(html.indexOf('<section id="gameArenaView"'),html.indexOf('</section>',html.indexOf('<section id="gameArenaView"')));
  for(const id of ['btnPauseGame','hudLevelText','hudXpBar','hudRoomText','hudRunGold','hudHpText','bossHpBar'])assert.ok(arena.includes(`id="${id}"`),id);
  for(const id of ['btnHudGfx','btnArenaSize','hudSkillIcons','hudHintBanner','hudStageName','hudNextUp','hudRoomPips','hudEnemyLeftText']){
    assert.equal(arena.includes(`id="${id}"`),false,`${id} must not clutter combat`);
    assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,`${id} writer stays valid`);
  }
  const pause=html.slice(html.indexOf('<div id="summaryModal"'),html.indexOf('<!-- ==================== MODAL 4:'));
  assert.match(pause,/id="pauseSettings"/);assert.match(pause,/id="btnHudGfx"/);assert.match(pause,/id="btnArenaSize"/);
  assert.match(pause,/Tiếp tục/);assert.match(pause,/Rời trận/);assert.match(pause,/aria-modal="true"/);
  const css=fs.readFileSync(new URL('../public/arena-viewport.css',import.meta.url),'utf8');
  assert.match(body('setCombatImmersive'),/#cloudSaveIndicator/);
  assert.match(css,/body:has\(#appRoot\.combat-immersive\) #cloudSaveIndicator/);
  assert.match(css,/#arenaHudHeader \.hv2-xp > div:last-child > div:first-child\s*\{\s*display:\s*flex/);
  assert.match(css,/#appRoot\.combat-immersive\s*>\s*header/);
  assert.match(css,/#appRoot\.combat-immersive\s*>\s*main\s*>\s*section:not\(#gameArenaView\)/);
  assert.match(css,/#summaryModal\[data-pause="true"\] #summarySkillsList[\s\S]*?display:\s*grid/);
});
test('combat isolation hides and inerts lobby until explicit return, preserving previous inert state',()=>{
  const h=load();vm.runInContext(body('setCombatImmersive'),h.sandbox);
  h.sandbox.setCombatImmersive(true);h.sandbox.setCombatImmersive(true);
  assert.ok(h.nodes.appRoot.classList.contains('combat-immersive'));assert.ok(h.lobby.every(n=>n.inert));
  h.sandbox.setCombatImmersive(false);
  assert.equal(h.nodes.appRoot.classList.contains('combat-immersive'),false);
  assert.deepEqual(h.lobby.map(n=>n.inert),[false,true,false]);
  assert.match(body('startNewRun'),/setCombatImmersive\(true\)/);
  assert.match(body('returnToLobby'),/setCombatImmersive\(false\)/);
  const nav=html.slice(html.indexOf("document.querySelectorAll('.nav-tab-btn').forEach"),html.indexOf('/** Chuyển sang tab khác'));
  assert.match(nav,/if \(Game.running\) return;/);
});
