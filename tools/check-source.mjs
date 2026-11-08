// Syntax gate offline: không import/execute mã ứng dụng, không mở DB/browser.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SKIP = new Set(['node_modules', '.git', 'assets']);

function collectFiles(root) {
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory() && !SKIP.has(entry.name)) walk(target);
      else if (entry.isFile() && /\.(?:js|mjs|html)$/.test(entry.name)) files.push(target);
    }
  }
  for (const dir of ['api', 'lib', 'public', 'tools', 'tests']) walk(path.join(root, dir));
  const server = path.join(root, 'dev-server.mjs');
  if (fs.existsSync(server)) files.push(server);
  return files.sort();
}

function attribute(attrs, name) {
  const re = new RegExp('(?:^|\\s)' + name + '(?:\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+)))?(?=\\s|$)', 'i');
  const match = attrs.match(re);
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null;
}

function checkNode(file, source) {
  const args = ['--max-old-space-size=96', '--check'];
  if (source !== undefined) args.push('--input-type=module');
  else args.push(file);
  const result = spawnSync(process.execPath, args, {
    encoding: 'utf8', input: source, timeout: 5000, maxBuffer: 128 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr || `node --check exited ${result.status}`);
  }
}

/** Duyệt source có kiểm soát; từng file/từng process tuần tự để giữ RAM thấp. */
export function checkProject(root) {
  const files = collectFiles(root);
  const result = { files: files.length, inlineScripts: 0, failures: [] };
  for (const file of files) {
    const relative = path.relative(root, file).replaceAll('\\', '/');
    try {
      if (file.endsWith('.html')) {
        const html = fs.readFileSync(file, 'utf8');
        // HTML của repo được kiểm soát; chỉ lấy script executable, không lấy JSON/importmap.
        for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
          const attrs = match[1];
          if (attribute(attrs, 'src') !== null) continue;
          const type = (attribute(attrs, 'type') || '').toLowerCase().split(';')[0].trim();
          if (!['', 'text/javascript', 'application/javascript', 'module'].includes(type)) continue;
          if (!match[2].trim()) continue;
          result.inlineScripts++;
          const bodyStart = match.index + match[0].indexOf('>') + 1;
          const lineOffset = html.slice(0, bodyStart).split('\n').length - 1;
          try {
            if (type === 'module') checkNode(file, match[2]);
            else new vm.Script(match[2], { filename: relative, lineOffset });
          } catch (error) {
            result.failures.push({ file: relative, message: error.stack || error.message });
          }
        }
      } else if (relative.startsWith('public/') && file.endsWith('.js')) {
        // Browser classic script: top-level await/import phải lỗi dù package là ESM.
        new vm.Script(fs.readFileSync(file, 'utf8'), { filename: relative });
      } else {
        checkNode(file);
      }
    } catch (error) {
      result.failures.push({ file: relative, message: error.stack || error.message });
    }
  }
  return result;
}

const self = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const result = checkProject(path.resolve(path.dirname(self), '..'));
  for (const failure of result.failures) console.error(`${failure.file}\n${failure.message}`);
  console.log(`Syntax: ${result.files} files, ${result.inlineScripts} inline scripts, ${result.failures.length} errors`);
  if (result.failures.length) process.exitCode = 1;
}
