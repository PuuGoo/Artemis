import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { sanitizeSave } from '../lib/save/schema.js';

// Chrome thật + auth/save bộ nhớ: không DB, không tài khoản thật, không đọc .env.
// PLAYWRIGHT_MODULE=<đường dẫn playwright-core/index.mjs> node tools/verify-battle-hub.mjs [--baseline]
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = resolve(root, 'public');
const evidence = resolve(root, 'docs/learned-modal-evidence');
await mkdir(evidence, { recursive: true });
const baselineOnly = process.argv.includes('--baseline');
const baselineHtml = baselineOnly ? execFileSync('git', ['show', 'dc0b831:public/index.html'], { cwd: root, maxBuffer: 4 * 1024 * 1024 }).toString('utf8') : null;
let saved = null;
let revision = 0;
const results = [];
const errors = [];
const failedLocal = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Content-Type', 'application/json');
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/auth/me') return res.end(JSON.stringify({ ok: true, authenticated: true, player: { id: 'battle_ui_fixture', username: 'battle_ui_fixture' } }));
    if (url.pathname === '/api/save' && req.method === 'GET') return res.end(JSON.stringify(saved ? { ok: true, hasSave: true, data: saved, revision } : { ok: true, hasSave: false, data: null, revision: 0 }));
    if (url.pathname === '/api/save' && req.method === 'PUT') {
      let body = ''; for await (const chunk of req) body += chunk;
      const input = JSON.parse(body);
      const checked = sanitizeSave(input.data);
      if (!checked.ok) { res.statusCode = 422; return res.end(JSON.stringify({ ok: false, error: checked.reason })); }
      saved = checked.data; revision++;
      return res.end(JSON.stringify({ ok: true, revision }));
    }
    res.statusCode = 404; return res.end(JSON.stringify({ ok: false }));
  }
  try {
    const file = resolve(publicDir, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1)));
    if (!file.startsWith(publicDir + sep)) throw Error('outside public');
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' })[extname(file)] || 'application/octet-stream');
    res.end(baselineHtml && url.pathname === '/' ? baselineHtml : await readFile(file));
  } catch { res.statusCode = 404; res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.ARTEMIS_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-extensions', '--disable-background-networking'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(7000);
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    const allowed = ['https://cdn.tailwindcss.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
    return url.origin === origin || (request.method() === 'GET' && allowed.includes(url.origin)) ? route.continue() : route.abort();
  });
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', res => { if (res.url().startsWith(origin) && res.status() >= 400 && !res.url().includes('/api/')) failedLocal.push(res.url()); });
  await page.goto(origin, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => window.Archero2FusionAPI && !document.documentElement.classList.contains('cloud-locked'));
  await page.setViewportSize({width:390,height:844});
  await page.locator('#btnStartGame').click();await page.locator('#btnBriefingStart').click();
  await page.waitForSelector('#skillSelectModal:not(.hidden)');await page.locator('.skill-choice-card').first().click();
  await page.waitForTimeout(300);await page.locator('#btnActiveSkill').click();
  console.log(await page.evaluate(()=>{const m=document.getElementById('summaryModal');return {pointer:getComputedStyle(m).pointerEvents,html:m.innerHTML.slice(-4000),buttons:[...m.querySelectorAll('button')].map(b=>{let r=b.getBoundingClientRect();return{id:b.id,text:b.innerText,pointer:getComputedStyle(b).pointerEvents,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,220)}})};}));
  await page.locator('#btnResumeGame').click({timeout:2000});
  assert.equal(await page.locator('#summaryModal').isVisible(),false);
}catch(error){console.error(error.message);process.exitCode=1;}
finally{await browser?.close();await new Promise(r=>server.close(r));}
