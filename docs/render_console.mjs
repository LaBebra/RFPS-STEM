/**
 * Рендерить текстовий вивід тестів (Vitest, E2E) у вигляді знімка терміналу для звіту.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pptr = path.resolve(here, '../app/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js');
const { default: puppeteer } = await import(pathToFileURL(pptr).href);
const out = path.resolve(here, '../screenshots/diagrams');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function colorize(line) {
  let l = esc(line);
  l = l.replace(/(✓|PASS)/g, '<span class="g">$1</span>').replace(/(×|FAIL)/g, '<span class="r">$1</span>');
  if (/Tests\s+\d+ passed|Test Files|E2E:/.test(line)) l = `<b class="g">${l}</b>`;
  return l;
}

const vitest = fs.readFileSync(path.resolve(here, 'test-logs/test-output.txt'), 'utf8').split(/\r?\n/);
const vitestLines = [
  '> npm run coverage',
  '',
  ...vitest.filter((l) => /^ (✓|×) /.test(l) || /Test Files|Tests |Duration|Coverage report/.test(l)),
  '',
  ...vitest.filter((l) => /\|/.test(l) && !/stderr/.test(l)),
];

const e2e = fs.readFileSync(path.resolve(here, 'test-logs/e2e-output.txt'), 'utf8').split(/\r?\n/).filter(Boolean);
const e2eLines = ['> npm run e2e', '', ...e2e];

const page = (lines) => `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#fff}
pre{display:inline-block;margin:0;padding:18px 22px;background:#1e1e1e;color:#d4d4d4;font:14px/1.45 'Cascadia Code',Consolas,monospace;border-radius:8px}
.g{color:#6ad06a}.r{color:#ff6b6b}
</style></head><body><pre id="t">${lines.map(colorize).join('\n')}</pre></body></html>`;

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const p = await browser.newPage();
await p.setViewport({ width: 1400, height: 900, deviceScaleFactor: 2 });
for (const [name, lines] of [
  ['console_vitest', vitestLines],
  ['console_e2e', e2eLines],
]) {
  await p.setContent(page(lines));
  await (await p.$('#t')).screenshot({ path: path.join(out, `${name}.png`) });
  console.log('ok', name);
}
await browser.close();
