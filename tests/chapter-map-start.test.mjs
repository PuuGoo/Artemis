import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/battle-hub.css',import.meta.url),'utf8');

function mapFunction(){
 const a=html.indexOf('      function renderMapSelect() {');
 const b=html.indexOf('      /** Mở/đóng Sổ Tay Quái Vật. */',a);
 assert.ok(a>0 && b>a);
 return html.slice(a,b);
}
const ch1={id:1,name:'Chương 1: Leo',themeName:'Sư Tử',icon:'🦁',accent:'#fbbf24',enemyScale:1,
 difficulty:1,difficultyLabel:'Dễ — Sư Tử',rooms:50,mapAsset:'/assets/map-ch12-zodiac-leo.svg',
 mapRegion:'Thánh Điện',mapTagline:'Leo',desc:'Leo',bossIcon:'🦁',bossName:'Leo',unlock:null};
const ch2={...ch1,id:2,themeName:'Bạch Dương',unlock:{type:'chapterWin',chapterId:1,label:'Thắng Chương 1'}};

function render(preview=null){
 let clicks=0,handler=null;
 const stage={innerHTML:'',querySelectorAll(){return[];},querySelector(){return null;}};
 const start={disabled:preview!==null,click(){clicks++}};
 const document={
   getElementById(id){
     if(id==='mapSelectPanel')return stage;
     if(id==='btnMapStartChapter')return stage.innerHTML.includes('id="btnMapStartChapter"')?
       {addEventListener(type,fn){if(type==='click')handler=fn;}}:null;
     if(id==='btnStartGame')return start;
     if(id==='msBtnBestiary')return {addEventListener(){}};
     return null;
   },
   querySelector(){return null;}
 };
 const sandbox={document,CHAPTERS:[ch1,ch2],previewChapterIdx:preview,
   SaveState:{selectedChapterIdx:0,winsByChapter:{},save(){}},
   getActiveGameMode(){return {id:'campaign',hasChapters:true};},
   isChapterLocked(ch){return !!ch.unlock;},
   getChapterBest(){return 0;},getComputedStats(){return {baseAtk:120};},
   normalizeSelectedChapter(){return 0;},
   syncBattleLaunch(){},openBestiaryModal(){},
   SoundFX:{coinPickup(){}}
 };
 vm.runInNewContext(mapFunction()+'\nrenderMapSelect();',sandbox);
 return {stage,start,get handler(){return handler;},get clicks(){return clicks;}};
}

test('Chương 1 có nút Bắt đầu ngay tại bản đồ và dùng đúng briefing cũ',()=>{
 const v=render();
 assert.match(v.stage.innerHTML,/id="btnMapStartChapter"/);
 assert.match(v.stage.innerHTML,/BẮT ĐẦU CHƯƠNG 1/);
 assert.ok(v.stage.innerHTML.indexOf('id="btnMapStartChapter"') <
   v.stage.innerHTML.indexOf('class="ms-info"'));
 assert.equal(typeof v.handler,'function');
 v.handler();
 assert.equal(v.clicks,1);
});
test('Chương chưa mở không có nút khởi động trong bản đồ',()=>{
 const v=render(1);
 assert.doesNotMatch(v.stage.innerHTML,/id="btnMapStartChapter"/);
 assert.match(v.stage.innerHTML,/ms-lockbar/);
 assert.equal(v.start.disabled,true);
});
test('Không nhân đôi nút chính và không bỏ qua quy tắc vào trận; CTA có responsive',()=>{
 assert.equal((html.match(/id="btnStartGame"/g)||[]).length,1);
 assert.equal((html.match(/id="btnMapStartChapter"/g)||[]).length,1);
 assert.match(mapFunction(),/if \(start && !start\.disabled\) start\.click\(\);/);
 assert.doesNotMatch(mapFunction(),/startNewRun\('fresh'\)/);
 assert.match(css,/#tabBattle \.ms-chapter-launch \{/);
 assert.match(css,/#tabBattle \.ms-chapter-start \{/);
 assert.match(css,/@media \(max-width: 600px\)[\s\S]*?\.ms-chapter-start/);
});
