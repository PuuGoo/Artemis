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
for(const stage of [9,10]){
await page.evaluate(stage=>{const a=window.Archero2FusionAPI,g=a.Game;a.stopGameLoop();a.setupRoom(stage);g.enemies=[];g.drops=[];g.enemyBullets=[];g.roomCleared=true;g.portalOpen=true;g.paused=false;a.updateGame(.001);},stage);
assert.equal(await page.evaluate(()=>window.ArtemisCloud.flushCheckpoint()),true,'stage baseline accepted');
assert.equal(await page.locator('.campaign-encounter').count(),0,'no remote popup');
await page.evaluate(()=>{const a=window.Archero2FusionAPI,g=a.Game;g.player.x=g.encounterNpc.x;g.player.y=g.encounterNpc.y;a.updateGame(.001);});
await page.waitForSelector('.campaign-encounter');
await page.locator('.encounter-card').first().click();
await page.waitForSelector('.campaign-encounter',{state:'detached'});
const saved=await (await context.request.get(fixture.origin+'/api/save')).json();
assert.equal(saved.data.dungeonCheckpoint.encounters.receipts.at(-1).stage,stage);
console.log(JSON.stringify({stage,receipt:saved.data.dungeonCheckpoint.encounters.receipts.at(-1)}));
}
console.log('Real HTTP NPC contact/offer/claim PASS');
}catch(e){console.error(e);console.error(JSON.stringify(fixture.requests.filter(r=>r.status>=400)));process.exitCode=1;}
finally{await browser.close();await fixture.close();}