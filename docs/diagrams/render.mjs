/**
 * Рендеринг діаграм (Mermaid) та каркасів екранів у PNG для пояснювальної записки.
 * Запуск: node render.mjs <шлях до mermaid.min.js>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pptr = path.resolve(here, '../../app/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js');
const { default: puppeteer } = await import(pathToFileURL(pptr).href);
const mermaidPath = process.argv[2];
if (!mermaidPath) throw new Error('Вкажіть шлях до mermaid.min.js');
const outDir = path.resolve(here, '../../screenshots/diagrams');
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  args: ['--allow-file-access-from-files'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1700, height: 1400, deviceScaleFactor: 2 });

const html = fs.readFileSync(path.join(here, 'render.html'), 'utf8').replace('MERMAID', pathToFileURL(mermaidPath).href);
const tmp = path.join(path.dirname(mermaidPath), 'render.tmp.html');
fs.writeFileSync(tmp, html);
await page.goto(pathToFileURL(tmp).href);

const widths = { user_flow_auth: 760, user_flow_testing_1: 0, user_flow_testing_2: 0, state_runcontrol: 760, state_result: 1100, architecture: 1150 };
const fonts = { user_flow_auth: 18, user_flow_testing_1: 17, user_flow_testing_2: 17 };
for (const name of Object.keys(widths)) {
  const code = fs.readFileSync(path.join(here, `${name}.mmd`), 'utf8');
  await page.evaluate((c, w, f) => window.renderDiagram(c, w, f), code, widths[name], fonts[name]);
  const el = await page.$('#out');
  await el.screenshot({ path: path.join(outDir, `${name}.png`) });
  console.log('ok', name);
}

await page.goto(pathToFileURL(path.join(here, 'wireframes.html')).href);
for (const id of ['wf-login', 'wf-dashboard', 'wf-suite', 'wf-mobile']) {
  const el = await page.$(`#${id}`);
  await el.screenshot({ path: path.join(outDir, `${id}.png`) });
  console.log('ok', id);
}
await browser.close();
