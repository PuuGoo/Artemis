import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {startFixture} from './verify-campaign-http.mjs';
const fixture=await startFixture();
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
const context=await browser.newContext({viewport:{width:390,height:844}});
const reg=await context.request.post(fixture.origin+'/api/auth/register',{data:{username:'wheel_'+Date.now().toString(36),password:'fixture-password-only'}});assert.equal(reg.status(),201);
const page=await context.newPage();page.setDefaultTimeout(12000);
await page.goto(fixture.origin);await page.waitForFunction(()=>window.ArtemisCloud?.getState().ready&&window.Archero2FusionAPI);
await page.locator('#btnStartGame').click();await page.locator('#btnBriefingStart').click();
await page.waitForSelector('#skillSelectModal:not(.hidden)');await page.locator('.skill-choice-card').first().click();
await page.waitForFunction(()=>!window.Archero2FusionAPI.Game.skillClaimBusy&&!window.Archero2FusionAPI.Game.paused);
assert.equal(await page.evaluate(()=>window.ArtemisCloud.flushCheckpoint()),true);
await page.evaluate(()=>{const a=window.Archero2FusionAPI,g=a.Game;a.stopGameLoop();a.setupRoom(4);g.enemies=[];g.drops=[];g.roomCleared=true;g.portalOpen=true;g.paused=false;a.updateGame(.001);});
assert.equal(await page.evaluate(()=>window.ArtemisCloud.flushCheckpoint()),true,'ready receipt accepted');
await page.evaluate(()=>{const a=window.Archero2FusionAPI,g=a.Game;g.player.x=g.wheelNpc.x;g.player.y=g.wheelNpc.y;a.updateGame(.001);});
await page.waitForSelector('.campaign-wheel-overlay');await page.locator('.campaign-wheel-start').click();
await page.waitForFunction(()=>document.querySelector('.campaign-wheel-start')?.textContent==='Đang Xoay');
await page.locator('.campaign-wheel-overlay').click({position:{x:5,y:100}});
await page.waitForSelector('.campaign-wheel-reward:not([hidden])');
const res=await context.request.get(fixture.origin+'/api/save');assert.equal(res.status(),200);const saved=await res.json();
assert.equal(saved.data.dungeonCheckpoint.wheel.status,'claimed');
const gold=saved.data.dungeonCheckpoint.runGold,scrolls=saved.data.gearScrolls.weapon;
await page.locator('.campaign-wheel-overlay').click({position:{x:5,y:100}});
await page.evaluate(()=>{const a=window.Archero2FusionAPI;a.setupRoom(5);});
assert.equal(await page.evaluate(()=>window.ArtemisCloud.flushCheckpoint()),true,'later safe room retains receipt');
const later=await (await context.request.get(fixture.origin+'/api/save')).json();assert.equal(later.data.dungeonCheckpoint.wheel.status,'claimed');assert.equal(later.data.dungeonCheckpoint.runGold,gold);assert.equal(later.data.gearScrolls.weapon,scrolls);
console.log(JSON.stringify({scope:'real HTTP auth/save, isolated memoryDB, fixture room jump',status:'PASS',wheel:saved.data.dungeonCheckpoint.wheel,laterRoom:later.data.dungeonCheckpoint.room,httpErrors:fixture.requests.filter(r=>r.status>=400)},null,2));
}catch(e){console.error(e);console.error(JSON.stringify(fixture.requests.filter(r=>r.status>=400)));process.exitCode=1;}
finally{await browser.close();await fixture.close();}
