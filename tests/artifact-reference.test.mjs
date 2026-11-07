import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';


const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../public/artifact-reference.js', import.meta.url), 'utf8');
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/artifact-wiki-1781.json', import.meta.url)));
function setup() {
  const ctx = vm.createContext({ SaveState: { artifactStars: {} } });
  vm.runInContext(source, ctx);
  const start = html.indexOf('const ARTIFACTS_DATA');
  const end = html.indexOf('// Normalize a single gear item', start);
  assert.ok(start > 0 && end > start);
  vm.runInContext(html.slice(start, end) + ';globalThis.catalog=ARTIFACTS_DATA;globalThis.sets=ARTIFACT_SETS_DATA;', ctx);
  return ctx;
}
const plain = obj => JSON.parse(JSON.stringify(obj));

test('all 46 wiki rows retain exact cells, rarities and absent obtain sources', () => {
  const ctx = setup();
  const counts = {};
  for (const [i, rarity] of ['mythic', 'legendary', 'epic', 'rare'].entries()) {
    for (const row of fixture.tables[i].slice(1)) {
      const a = ctx.catalog.find(x => x.wikiName === row[0]);
      assert.ok(a, row[0]);
      assert.equal(a.rarity, rarity);
      assert.equal(a.desc, row[1]);
      assert.equal(a.reference.baseStats, row[2]);
      assert.equal(a.specialStatText, row[3]);
      assert.equal(a.reference.obtain, row[4] ?? null);
      if (row[4]) assert.equal(a.source, row[4]);
      counts[rarity] = (counts[rarity] || 0) + 1;
    }
  }
  assert.deepEqual(counts, { mythic:18, legendary:16, epic:7, rare:5 });
  assert.equal(ctx.catalog.length, 46);
  assert.equal(ctx.ArtifactReference.reference.sha256, fixture.sourceSha256);
  assert.equal(ctx.ArtifactReference.reference.revision, 1781);
});

test('all 13 set memberships and all six tier percentages match supplied table cells', () => {
  const ctx = setup();
  assert.equal(ctx.sets.length, 13);
  for (const table of fixture.tables.slice(4)) {
    const row = table[1];
    const set = ctx.sets.find(s => s.members.map(id => ctx.catalog.find(a => a.id === id).wikiName).join(' ') === row[0]);
    assert.ok(set, row[0]);
    assert.deepEqual(plain(set.tiersPct), row.slice(1).map(text => Number(/ATK \+([\d.]+)%/.exec(text)[1])));
  }
});

test('44 identity-mapped PNG files exist and missing art keeps a fallback', () => {
  const ctx = setup();
  const mapped = ctx.catalog.filter(a => a.artPath);
  assert.equal(mapped.length, 44);
  assert.equal(new Set(mapped.map(a => a.artPath)).size, 44);
  for (const a of mapped) {
    const bytes = fs.readFileSync(new URL('../public/' + a.artPath, import.meta.url));
    assert.equal(bytes.subarray(0,8).toString('hex'), '89504e470d0a1a0a', a.id);
    assert.ok(bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0);
    const markup = ctx.renderArtifactIcon(a);
    assert.ok(markup.includes('src="' + a.artPath + '"'));
    assert.match(markup, /onerror="this.hidden=true"/);
    assert.match(markup, /onload="this.previousElementSibling.hidden=true"/);
  }
  assert.deepEqual(plain(ctx.catalog.filter(a => !a.artPath).map(a => a.id)).sort(), ['quiet_quill','voidblade']);
  for (const a of ctx.catalog.filter(a => !a.artPath)) assert.doesNotMatch(ctx.renderArtifactIcon(a), /<img/);
  assert.match(ctx.catalog.find(a => a.id === 'magic_carpet').artPath, /Margic_Carpet.png$/);
  assert.match(ctx.catalog.find(a => a.id === 'damocles_sword').artPath, /Damocles_Sword.png$/);
});

test('catalog overlay preserves IDs, ownership and legacy carpet ATK/HP', () => {
  const ctx = setup();
  const before = plain(ctx.SaveState);
  const ids = ctx.catalog.map(a => a.id).join(',');
  ctx.ArtifactReference.applyCatalog(ctx.catalog);
  assert.equal(ctx.catalog.map(a => a.id).join(','), ids);
  assert.deepEqual(plain(ctx.SaveState), before);
  const carpet = ctx.catalog.find(a => a.id === 'magic_carpet');
  assert.equal(carpet.wikiName, 'Margic Carpet');
  assert.equal(carpet.reference.baseStats, 'Gold in Gold Cave +4%');
  assert.equal(carpet.baseAtk, 60);
  assert.equal(carpet.baseHp, 240);
  const totals = ctx.computeAllArtifactsAndSetsBonuses();
  assert.equal(totals.flatAtk, 0);
  assert.equal(totals.flatHp, 0);
  assert.equal(totals.activeSetsInfo.length, 0);
  for (const a of ctx.catalog) assert.equal(ctx.computeSingleArtifactStats(a).owned, false);
});

test('actual set aggregation requires every member and follows 1/3/6/9/12/15 thresholds', () => {
  const ctx = setup();
  for (const set of ctx.sets) {
    for (const [i, star] of [1,3,6,9,12,15].entries()) {
      ctx.SaveState.artifactStars = Object.fromEntries(set.members.map(id => [id, star]));
      const active = ctx.computeAllArtifactsAndSetsBonuses().activeSetsInfo.find(x => x.id === set.id);
      assert.equal(active.activePct, set.tiersPct[i]);
      delete ctx.SaveState.artifactStars[set.members[0]];
      assert.equal(ctx.computeAllArtifactsAndSetsBonuses().activeSetsInfo.some(x => x.id === set.id), false);
    }
  }
});

test('all four production icon surfaces call shared provider and safe CSS is present', () => {
  assert.equal((html.match(/\$\{renderArtifactIcon\((?:a|art|it)\)\}/g) || []).length, 4);
  assert.ok(html.indexOf('<script src="/artifact-reference.js">') < html.indexOf('ArtifactReference.applyCatalog'));
  assert.match(html, /\.artifact-art img[^}]*object-fit:contain; pointer-events:none/s);
  assert.match(html, /title="\$\{ArtifactReference.escapeHtml\(a.desc\)\}"/);
  assert.match(html, /const VN_VELVET_ARTIFACTS = ARTIFACTS_DATA.map/);
  assert.match(html, /const VN_VELVET_ARTIFACT_SETS = ARTIFACT_SETS_DATA.map/);
});

test('real legacy collection renderer uses 46 live stars, 13 real sets and read-only item clicks', () => {
  const ctx = setup();
  const cards = [];
  const el = { innerHTML:'', querySelectorAll(selector) { return selector === '[data-vn-velvet-art]' ? cards : []; } };
  ctx.document = { getElementById(id) { return id === 'vnCollectiblesAuthenticContainer' ? el : null; } };
  ctx.ensureVnAuthenticUIState = () => {};
  ctx.getAchievementCounts = () => ({ unlocked:0, total:0 });
  ctx.ACHIEVEMENTS = [];
  ctx.showToast = () => {};
  ctx.SaveState.vnUiState = { collectMainTab:'artifacts', collectSubView:'library' };
  ctx.SaveState.artifactStars.golden_mask = 3;
  cards.push({ getAttribute: () => 'golden_mask' });
  const start = html.indexOf('function renderVnCollectiblesTabUI()');
  const end = html.indexOf('// 5. RENDER TAB 5:', start);
  vm.runInContext(html.slice(start,end),ctx);
  ctx.renderVnCollectiblesTabUI();
  assert.equal((el.innerHTML.match(/data-vn-velvet-art=/g)||[]).length,46);
  assert.equal((el.innerHTML.match(/assets\/artifacts\//g)||[]).length,44);
  assert.ok(el.innerHTML.includes('⭐⭐⭐'));
  const snapshot = JSON.stringify(ctx.SaveState);
  cards[0].onclick();
  assert.equal(JSON.stringify(ctx.SaveState), snapshot);
  ctx.SaveState.vnUiState.collectSubView = 'sets';
  ctx.renderVnCollectiblesTabUI();
  for (const s of ctx.sets) assert.ok(el.innerHTML.includes(s.name));
  assert.doesNotMatch(el.innerHTML,/Dệt Mệnh|Sát Thương Chí Mạng\+20%/);
});

test('real gallery renderer produces set and codex image markup without granting ownership', () => {
  const ctx = setup();
  const container = { innerHTML:'', classList:{ add() {} }, querySelectorAll() { return []; } };
  ctx.document = { getElementById(id) { return id === 'artifactsMainContainer' ? container : null; } };
  const start = html.indexOf("let artifactViewMode = 'set'");
  const end = html.indexOf('// ==================== ARCHERO 2 OFFICIAL WIKI CURRENCY', start);
  assert.ok(start > 0 && end > start);
  vm.runInContext(html.slice(start, end), ctx);
  ctx.renderArtifactsSubtabUI();
  assert.equal((container.innerHTML.match(/data-artifact-focus=/g)||[]).length, ctx.sets.reduce((n,s) => n+s.members.length,0));
  assert.ok(container.innerHTML.includes('Margic Carpet'));
  assert.ok(container.innerHTML.includes('oldid=1781'));
  vm.runInContext("artifactViewMode='codex'", ctx);
  ctx.renderArtifactsSubtabUI();
  assert.equal((container.innerHTML.match(/data-upgrade-artifact=/g)||[]).length, 46);
  assert.equal((container.innerHTML.match(/assets\/artifacts\//g)||[]).length, 44);
  assert.ok(container.innerHTML.includes('&quot;Flammable and Explosive&quot;'));
  assert.ok(container.innerHTML.includes('Wiki · Gold in Gold Cave +4%'));
  assert.deepEqual(plain(ctx.SaveState.artifactStars), {});
});

test('every inline script compiles without executing game boot', () => {
  let count=0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!match[2].trim() || /type=["']application\/ld\+json/.test(match[1])) continue;
    new vm.Script(match[2], {filename:'inline-'+(++count)+'.js'});
  }
  assert.ok(count > 0);
  console.log('Compiled inline scripts:', count);
});
