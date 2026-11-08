// Runner chỉ tìm *.test.mjs; không tự chạy audit/tool hoặc fixtures.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export function discoverTestFiles(directory) {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory() && !['fixtures', 'node_modules', '.git'].includes(entry.name)) walk(file);
      else if (entry.isFile() && entry.name.endsWith('.test.mjs')) files.push(file);
    }
  }
  walk(directory);
  return files.sort();
}

const self = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const root = path.resolve(path.dirname(self), '..');
  const files = discoverTestFiles(path.join(root, 'tests'));
  if (!files.length) {
    console.error('Không tìm thấy *.test.mjs trong tests/');
    process.exitCode = 1;
  } else {
    const result = spawnSync(process.execPath, [
      '--max-old-space-size=256', '--test', '--test-concurrency=1', ...process.argv.slice(2), ...files,
    ], { cwd: root, stdio: 'inherit', windowsHide: true });
    if (result.error) console.error(result.error.message);
    process.exitCode = result.status ?? 1;
  }
}
