import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startFixture} from './verify-campaign-http.mjs';
const handlers={};
const fixture=await startFixture({extraHandlers:handlers});
// startFixture copies handlers; start again after test-only environment is initialized.
await fixture.close();
const patrol=await import('../api/privileges.js');
const server=await startFixture({extraHandlers:{'/api/patrol':patrol}});
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const evidence=resolve('docs/patrol-evidence');await mkdir(evidence,{recursive:true});
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const registration=await context.request.post(server.origin+'/api/auth/register',{data:{username:'patrol_'+Date.now().toString(36),password:'fixture-password-only'}});
 assert.equal(registration.status(),201);
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.origin);await page.waitForFunction(()=>window.ArtemisCloud?.getState().ready&&window.Archero2FusionAPI);
 await page.getByRole('button',{name:'Tuần Tra',exact:true}).click();
 await page.waitForSelector('#artemis-patrol [data-patrol="quick"]');
 assert.equal(await page.evaluate(()=>window.ArtemisCloud.getState().saving),false,'preview initialization unlocks cloud');
 const getSave=async()=>{const r=await context.request.get(server.origin+'/api/save');assert.equal(r.status(),200);return r.json();};
 let before=await getSave();
 await page.screenshot({path:resolve(evidence,'patrol-390.png')});
 await page.locator('[data-patrol="quick"]').click();
 assert.equal(await page.locator('[data-patrol="quickAd"]').isDisabled(),true);
 await page.screenshot({path:resolve(evidence,'quick-390.png')});
 await page.locator('[data-patrol="quickEnergy"]').click();
 await page.waitForSelector('.patrol-received');
 let after=await getSave();
 assert.equal(after.data.stamina,before.data.stamina-5);
 assert.ok(after.data.gold>before.data.gold);
 assert.ok(after.data.patrolExp>before.data.patrolExp);
 assert.equal(await page.evaluate(()=>window.Archero2FusionAPI.SaveState.gold),after.data.gold,'cloud state matches exact server readback');
 await page.screenshot({path:resolve(evidence,'rewards-390.png')});
 await page.locator('[data-patrol="back"]').click();
 await page.evaluate(async()=>{window.Archero2FusionAPI.SaveState.save();if(!await window.ArtemisCloud.flushCheckpoint())throw Error('flush failed');});
 const persisted=await getSave();assert.equal(persisted.data.patrolExp,after.data.patrolExp);assert.equal(persisted.data.gold,after.data.gold);
 await page.reload();await page.waitForFunction(()=>window.ArtemisCloud?.getState().ready);
 assert.equal(await page.evaluate(()=>window.Archero2FusionAPI.SaveState.patrolExp),after.data.patrolExp);
 assert.deepEqual(errors,[]);
 const result={scope:'Chrome with real auth/patrol/save HTTP handlers, isolated memory DB; no production',quickEnergy:true,adUnavailable:true,staminaBefore:before.data.stamina,staminaAfter:after.data.stamina,goldGranted:after.data.gold-before.data.gold,expGranted:after.data.patrolExp-before.data.patrolExp,reloadPersists:true,errors};
 await writeFile(resolve(evidence,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(e){console.error(e);console.error(JSON.stringify(server.requests.filter(r=>r.status>=400)));process.exitCode=1;}
finally{await browser.close();await server.close();}
