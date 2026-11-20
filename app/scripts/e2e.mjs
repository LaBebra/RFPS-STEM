/**
 * Наскрізний (E2E) сценарій перевірки AutoQA Lab у headless-браузері Microsoft Edge.
 * Паралельно знімає скріншоти для пояснювальної записки.
 *
 * Запуск: npm run build && npm run preview  (в іншому терміналі)
 *         npm run e2e
 * Змінні середовища: APP_URL (типово http://localhost:4173/), EDGE_PATH, SHOTS_DIR.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.APP_URL ?? 'http://localhost:4173/';
const EDGE = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SHOTS = process.env.SHOTS_DIR ?? path.resolve(__dirname, '../../screenshots');
const DOWNLOADS = path.resolve(__dirname, '../.e2e-downloads');
fs.mkdirSync(SHOTS, { recursive: true });
fs.rmSync(DOWNLOADS, { recursive: true, force: true });
fs.mkdirSync(DOWNLOADS, { recursive: true });

const checks = [];
const consoleErrors = [];
function check(name, ok, details = '') {
  checks.push({ name, ok: Boolean(ok), details });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${details ? `  (${details})` : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-first-run', '--lang=uk-UA', '--force-color-profile=srgb'],
});

// Дозвіл на завантаження файлів (експорт звітів) для всього браузера.
const browserCdp = await browser.target().createCDPSession();
await browserCdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DOWNLOADS });

async function newPage(viewport, colorScheme = 'light') {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: colorScheme },
    // Без анімацій - щоб графіки на скріншотах були у фінальному стані.
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ]);
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  return page;
}

async function shot(page, name, opts = {}) {
  await sleep(opts.wait ?? 450);
  // Сповіщення ховаються, щоб не перекривати вміст на скріншотах (крім явно вказаних).
  await page.evaluate((show) => document.body.classList.toggle('e2e-hide-toasts', !show), Boolean(opts.toasts));
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: opts.fullPage ?? false });
}

const go = (page, hash) => page.goto(`${BASE}#${hash}`, { waitUntil: 'networkidle0' });
const textOf = (page) => page.evaluate(() => document.body.innerText);
const clickText = async (page, selector, text) => {
  const el = await page.waitForSelector(`${selector}::-p-text(${text})`, { visible: true, timeout: 8000 });
  await el.click();
};

async function login(page, user, pass) {
  await go(page, '/login');
  await page.waitForSelector('#username');
  await page.$eval('#username', (el) => (el.value = ''));
  await page.type('#username', user);
  await page.type('#password', pass);
  await Promise.all([page.waitForSelector('.sidebar', { timeout: 8000 }), page.click('button[type=submit]')]);
}

async function waitRunFinished(page, timeout = 20000) {
  await page.waitForFunction(() => !document.querySelector('.run-progress'), { timeout });
}

try {
  // ---------- 1. Вхід ----------
  const page = await newPage({ width: 1440, height: 900 });
  await go(page, '/');
  check('Неавторизований користувач переадресовується на /login', page.url().includes('#/login'));
  await page.waitForSelector('#username');
  await shot(page, '01_login');

  await page.click('button[type=submit]');
  check('Валідація порожньої форми входу', (await textOf(page)).includes('Введіть логін'));

  await page.type('#username', 'admin');
  await page.type('#password', 'wrong-pass');
  await page.click('button[type=submit]');
  await page.waitForSelector('.alert--error');
  check('Невірний пароль відхиляється', (await textOf(page)).includes('Невірний логін або пароль'));
  await shot(page, '02_login_error');

  await login(page, 'admin', 'Admin#2026');
  check('Успішний вхід адміністратора', (await textOf(page)).includes('Михайло Марчук'));

  // ---------- 2. Дашборд ----------
  await page.waitForSelector('.recharts-surface');
  check('Дашборд відображає графіки', (await page.$$('.recharts-surface')).length >= 3);
  await page.mouse.move(5, 5);
  await shot(page, '03_dashboard', { wait: 900 });
  await shot(page, '03b_dashboard_full', { fullPage: true, wait: 200 });

  await clickText(page, '.segmented button', '7 днів');
  await sleep(300);
  const kpi7 = await page.$eval('.kpi:nth-child(2) .kpi__value', (e) => e.textContent);
  await clickText(page, '.segmented button', 'Увесь час');
  await sleep(300);
  const kpiAll = await page.$eval('.kpi:nth-child(2) .kpi__value', (e) => e.textContent);
  check('Фільтр періоду змінює кількість прогонів', Number(kpi7) < Number(kpiAll), `7 днів: ${kpi7}, усі: ${kpiAll}`);

  // ---------- 3. Темна тема ----------
  await go(page, '/settings');
  await page.waitForSelector('#set-timeout');
  await page.click('input[name=theme][value=dark]');
  await page.waitForSelector('html[data-theme=dark]');
  await go(page, '/');
  await page.waitForSelector('.recharts-surface');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('Темна тема застосовується', bg === 'rgb(13, 13, 13)', bg);
  await shot(page, '15_dashboard_dark', { wait: 900 });
  await go(page, '/suites/suite_cart');
  await page.waitForSelector('tbody tr');
  await shot(page, '16_suite_dark');
  await go(page, '/settings');
  await page.click('input[name=theme][value=light]');
  await page.waitForSelector('html[data-theme=light]');

  // ---------- 4. Адаптивність: мобільний ----------
  const mobile = await newPage({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  // Сесія зберігається в sessionStorage, тобто окремо для кожної вкладки.
  await login(mobile, 'admin', 'Admin#2026');
  await mobile.waitForSelector('.recharts-surface');
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check('Мобільний: немає горизонтальної прокрутки', !overflow);
  await shot(mobile, '17_mobile_dashboard', { wait: 900 });
  await mobile.click('.topbar__menu');
  await shot(mobile, '18_mobile_menu');
  check('Мобільне меню відкривається', await mobile.$eval('.shell', (e) => e.classList.contains('shell--nav-open')));
  await mobile.keyboard.press('Escape');
  await go(mobile, '/suites/suite_cart');
  await mobile.waitForSelector('tbody tr');
  await shot(mobile, '19_mobile_suite');
  await go(mobile, '/runs');
  await mobile.waitForSelector('tbody tr');
  await shot(mobile, '20_mobile_runs');

  // Планшет
  const tablet = await newPage({ width: 768, height: 1024 });
  await login(tablet, 'admin', 'Admin#2026');
  await tablet.waitForSelector('.recharts-surface');
  const overflowT = await tablet.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check('Планшет: немає горизонтальної прокрутки', !overflowT);
  await shot(tablet, '21_tablet_dashboard', { wait: 900 });

  await mobile.close();
  await tablet.close();
  await page.bringToFront();

  // ---------- 5. Тестові набори: створення ----------
  await go(page, '/suites');
  await page.waitForSelector('.suite-card');
  check('Список наборів містить 4 демо-набори', (await page.$$('.suite-card')).length === 4);
  await shot(page, '04_suites');

  await clickText(page, 'button', 'Новий набір');
  await page.waitForSelector('#suite-name');
  await page.click('button[form=suite-form]');
  check('Валідація форми набору', (await textOf(page)).includes("Назва обов'язкова"));
  await page.type('#suite-name', 'Математичні утиліти');
  await page.type('#suite-tags', 'unit, math');
  await page.type('#suite-desc', 'Тести функцій add та divide');
  await page.click('#suite-setup', { clickCount: 3 });
  await page.$eval('#suite-setup', (el) => el.select());
  await page.keyboard.press('Backspace');
  await page.type('#suite-setup', 'function add(a, b) { return a + b; }\nfunction divide(a, b) {\nif (b === 0) throw new Error("Ділення на нуль");\nreturn a / b; }');
  await shot(page, '05_suite_form');
  await page.click('button[form=suite-form]');
  await page.waitForFunction(() => location.hash.startsWith('#/suites/suite_'));
  const h1 = await page.waitForSelector('h1::-p-text(Математичні утиліти)', { timeout: 8000 }).catch(() => null);
  check('Новий набір створено, відкрито його сторінку', Boolean(h1));

  // ---------- 6. Тест-кейс: створення та пробний запуск ----------
  await clickText(page, 'button', 'Додати тест-кейс');
  await page.waitForSelector('#case-title');
  await page.type('#case-title', 'add складає два числа');
  await page.select('#case-priority', 'high');
  await page.$eval('#case-code', (el) => el.select());
  await page.keyboard.press('Backspace');
  await page.type('#case-code', 'expect(add(2, 3)).toBe(5);\nexpect(add(-1, 1)).toBe(0);\nconsole.log("add OK");');
  await clickText(page, 'button', 'Пробний запуск');
  await page.waitForSelector('.trial .badge--passed', { timeout: 8000 });
  check('Пробний запуск тест-кейсу у Web Worker: пройдено', true);
  await shot(page, '06_case_form_trial');

  // Безпека: доступ до DOM з тесту неможливий; нескінченний цикл зупиняється тайм-аутом.
  await page.$eval('#case-code', (el) => el.select());
  await page.keyboard.press('Backspace');
  await page.type('#case-code', 'document.body.innerHTML = "hacked";\nexpect(1).toBe(1);');
  await clickText(page, 'button', 'Пробний запуск');
  await page.waitForSelector('.trial .badge--error', { timeout: 8000 });
  check('Код тесту не має доступу до document (ізоляція)', (await textOf(page)).includes('TypeError'));

  await page.$eval('#case-timeout', (el) => el.select());
  await page.type('#case-timeout', '500');
  await page.$eval('#case-code', (el) => el.select());
  await page.keyboard.press('Backspace');
  await page.type('#case-code', 'while (true) {}\nexpect(1).toBe(1);');
  await clickText(page, 'button', 'Пробний запуск');
  await page.waitForSelector('.trial .badge--timeout', { timeout: 8000 });
  check('Нескінченний цикл примусово зупиняється за тайм-аутом', true);
  await shot(page, '07_case_timeout');

  await page.$eval('#case-code', (el) => el.select());
  await page.keyboard.press('Backspace');
  await page.type('#case-code', 'expect(add(2, 3)).toBe(5);\nexpect(add(-1, 1)).toBe(0);');
  await page.$eval('#case-timeout', (el) => el.select());
  await page.type('#case-timeout', '2000');
  await page.click('button[form=case-form]');
  await page.waitForSelector('#case-title', { hidden: true });

  await clickText(page, 'button', 'Тест-кейс');
  await page.waitForSelector('#case-title');
  await page.type('#case-title', 'divide на нуль генерує помилку');
  await page.$eval('#case-code', (el) => el.select());
  await page.keyboard.press('Backspace');
  await page.type('#case-code', 'expect(() => divide(1, 0)).toThrow("нуль");\nexpect(divide(9, 3)).toBe(3);');
  await page.click('button[form=case-form]');
  await page.waitForSelector('#case-title', { hidden: true });
  check('У новому наборі 2 тест-кейси', (await page.$$('tbody tr')).length === 2);

  // ---------- 7. Стани кнопки запуску (діаграма станів) ----------
  await go(page, '/suites/suite_async');
  await page.waitForSelector('.run-control[data-state=idle]');
  await page.screenshot({ path: path.join(SHOTS, 'state_idle.png'), clip: await page.$eval('.page-header', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height + 4 }; }) });
  await shot(page, '08_suite_detail', { toasts: true });
  await clickText(page, '.page-header button', 'Запустити набір');
  await page.waitForSelector('.page-header .run-control[data-state=running]');
  await sleep(250);
  await page.screenshot({ path: path.join(SHOTS, 'state_running.png'), clip: await page.$eval('.page-header', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height + 4 }; }) });
  check('Кнопка запуску переходить у стан running', true);
  await page.waitForSelector('.page-header .run-control[data-state=failed]', { timeout: 10000 });
  await page.screenshot({ path: path.join(SHOTS, 'state_failed.png'), clip: await page.$eval('.page-header', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height + 4 }; }) });
  check('Після прогону з невдачами кнопка у стані failed', true);
  await page.waitForSelector('.page-header .run-control[data-state=idle]', { timeout: 8000 });
  check('Через 4 с кнопка повертається у стан idle', true);

  // Скасування прогону
  await clickText(page, '.page-header button', 'Запустити набір');
  await page.waitForSelector('.page-header .run-control[data-state=running]');
  await page.click('.page-header .run-control button');
  await page.waitForSelector('.page-header .run-control[data-state=cancelled]', { timeout: 8000 });
  await page.screenshot({ path: path.join(SHOTS, 'state_cancelled.png'), clip: await page.$eval('.page-header', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height + 4 }; }) });
  check('Прогін можна скасувати (стан cancelled)', true);

  // ---------- 8. Повний прогін із дашборду ----------
  await go(page, '/');
  await page.waitForSelector('.recharts-surface');
  await clickText(page, 'button', 'Запустити всі тести');
  await page.waitForFunction(() => location.hash.startsWith('#/runs/run_'));
  await page.waitForSelector('.run-progress');
  await sleep(300);
  await shot(page, '09_run_live', { wait: 100 });
  await waitRunFinished(page);
  const statuses = await page.$$eval('.result', (els) =>
    els.map((el) => ({ title: el.querySelector('.result__title b')?.textContent, status: el.querySelector('.badge')?.getAttribute('data-status') })),
  );
  const st = (t) => statuses.find((s) => s.title === t)?.status;
  check('Прогін виконав усі 18 тест-кейсів', statuses.length === 18, `отримано ${statuses.length}`);
  check('slugify: passed', st('slugify формує URL-сумісний рядок') === 'passed');
  check('Межове значення знижки: failed (виявлено дефект)', st('Знижка 10% для замовлення рівно 1000 грн') === 'failed');
  check('Повільний звіт: timeout', st('Звіт формується не довше 1,5 с') === 'timeout');
  check('Асинхронний тест з await: passed', st('Отримання користувача за id') === 'passed');
  check('rejects.toThrow: passed', st('Помилка 404 для неіснуючого користувача') === 'passed');
  check('Новий тест add: passed', st('add складає два числа') === 'passed');
  await shot(page, '10_run_result');
  await clickText(page, '.tabs button', 'Невдалі');
  await page.click('.result--failed .result__row');
  await shot(page, '11_run_failed_details');

  // Експорт
  await clickText(page, 'button', 'HTML');
  await clickText(page, 'button', 'CSV');
  await sleep(1200);
  const files = fs.readdirSync(DOWNLOADS);
  check('Експорт звіту HTML і CSV', files.some((f) => f.endsWith('.html')) && files.some((f) => f.endsWith('.csv')), files.join(', '));

  // Перезапуск невдалих
  await clickText(page, 'button', 'Перезапустити невдалі');
  await page.waitForSelector('.run-progress');
  await waitRunFinished(page);
  const rerunCount = (await page.$$('.result')).length;
  check('Перезапуск лише невдалих тест-кейсів', rerunCount > 0 && rerunCount < 18, `${rerunCount} тест-кейсів`);

  // ---------- 9. Журнал прогонів з фільтрами ----------
  await go(page, '/runs');
  await page.waitForSelector('tbody tr');
  await shot(page, '12_runs');
  const before = await page.$eval('.pagination span', (e) => e.textContent);
  await page.select('.filters select', 'passed');
  await sleep(300);
  const onlyPassed = await page.$$eval('tbody tr .badge', (els) => els.every((e) => e.getAttribute('data-status') === 'passed'));
  check('Фільтр журналу за статусом', onlyPassed, before);
  await page.type('.search input', 'нічний');
  await page.select('.filters select', 'all');
  await sleep(500);
  const titles = await page.$$eval('tbody tr td:first-child', (els) => els.map((e) => e.textContent));
  check('Пошук у журналі', titles.length > 0 && titles.every((t) => t.includes('нічний')), `${titles.length} рядків`);
  await shot(page, '13_runs_filtered');

  // ---------- 10. Налаштування ----------
  await go(page, '/settings');
  await page.waitForSelector('#set-timeout');
  await shot(page, '14_settings');
  await clickText(page, 'button', 'Експортувати JSON');
  await sleep(800);
  check('Експорт робочого простору JSON', fs.readdirSync(DOWNLOADS).some((f) => f.startsWith('autoqa_workspace')));

  // ---------- 11. RBAC: гість ----------
  await page.click('.sidebar__footer button');
  await page.waitForSelector('#username');
  check('Вихід із системи', page.url().includes('#/login'));
  await login(page, 'guest', 'Guest#2026');
  await go(page, '/suites');
  await page.waitForSelector('.suite-card');
  const hasCreate = await page.$('::-p-text(Новий набір)');
  const runDisabled = await page.$$eval('.suite-card .run-control button', (b) => b.every((x) => x.disabled));
  check('Роль "Спостерігач": немає створення і запуску', !hasCreate && runDisabled);

  // ---------- 12. Блокування після 5 невдалих спроб ----------
  await page.click('.sidebar__footer button');
  for (let i = 0; i < 5; i++) {
    await page.waitForSelector('#password');
    await page.$eval('#username', (el) => (el.value = ''));
    await page.type('#username', 'tester');
    await page.type('#password', `bad-pass-${i}`);
    await page.click('button[type=submit]');
    await sleep(250);
  }
  check('Блокування входу після 5 невдалих спроб', (await textOf(page)).includes('Забагато невдалих спроб'));
  await shot(page, '22_login_locked');

  check('Відсутні помилки в консолі браузера', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} catch (err) {
  check('Сценарій виконано без винятків', false, err.stack ?? String(err));
} finally {
  await browser.close();
  fs.rmSync(DOWNLOADS, { recursive: true, force: true });
}

const failed = checks.filter((c) => !c.ok);
fs.writeFileSync(path.join(SHOTS, 'e2e-report.json'), JSON.stringify({ date: new Date().toISOString(), total: checks.length, failed: failed.length, checks }, null, 2));
console.log(`\nE2E: ${checks.length - failed.length}/${checks.length} перевірок пройдено`);
process.exit(failed.length ? 1 : 0);
