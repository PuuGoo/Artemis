import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
test('hero roster is canonical equipment workspace, not a global card tab',()=>{
 assert.doesNotMatch(html,/data-tab="tabHeroes"/);
 assert.match(html,/id="subpanelCharacters"[\s\S]*?id="tabHeroes"[\s\S]*?id="heroDetailPanel"[\s\S]*?id="characterReferenceNavigation"[\s\S]*?id="heroRosterGrid"/);
 assert.doesNotMatch(html,/id="btnOpenHeroRoster"|id="btnUpgradeAllGear"|gearUpgradeCostText|btnCycleStageTheme|Cài đặt sân khấu|Tinh thông vũ khí/);
});
test('preview is separate from guarded use, with four portrait columns and real skill tiers',()=>{
 assert.match(html,/let heroPreviewId/);
 assert.match(html,/data-hero-use/);
 assert.match(html,/hero-reference-grid/);
 assert.match(html,/heroArtImgTag\(h.id/);
 assert.match(html,/\[0, 2, 5, 8\]/);
 assert.match(html,/getHeroMilestoneData\(tier, hero\)/);
});
