import type { Run } from '../types';
import { can, LOCK_MS, MAX_ATTEMPTS, safeEqual, sha256Hex, verifyCredentials } from '../lib/auth';
import { csvCell, escapeHtml, runToCsv, runToHtml, safeFileName } from '../lib/export';
import { DEFAULT_SETTINGS } from '../lib/seed';
import { parseTags, parseWorkspace, validateCase, validateSuite } from '../lib/validate';

describe('автентифікація', () => {
  const fresh = { attempts: 0, lockedUntil: 0 };

  it('sha256Hex обчислює коректний хеш', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('приймає правильні облікові дані', async () => {
    const { result, state } = await verifyCredentials('Admin', 'Admin#2026', fresh);
    expect(result.ok).toBe(true);
    expect(state.attempts).toBe(0);
  });

  it('відхиляє неправильний пароль і рахує спроби', async () => {
    const { result, state } = await verifyCredentials('admin', 'nope', fresh);
    expect(result).toMatchObject({ ok: false, reason: 'invalid', attemptsLeft: MAX_ATTEMPTS - 1 });
    expect(state.attempts).toBe(1);
  });

  it('блокує вхід після MAX_ATTEMPTS невдалих спроб', async () => {
    const now = 1_000_000;
    let state = fresh;
    for (let i = 0; i < MAX_ATTEMPTS; i++) state = (await verifyCredentials('admin', 'bad', state, now)).state;
    expect(state.lockedUntil).toBe(now + LOCK_MS);
    // навіть правильний пароль не приймається під час блокування
    const locked = await verifyCredentials('admin', 'Admin#2026', state, now + 1000);
    expect(locked.result).toMatchObject({ ok: false, reason: 'locked' });
    // після завершення блокування вхід можливий
    const after = await verifyCredentials('admin', 'Admin#2026', state, now + LOCK_MS + 1);
    expect(after.result.ok).toBe(true);
  });

  it('safeEqual порівнює рядки', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'ab')).toBe(false);
  });

  it('RBAC: права ролей', () => {
    expect(can('admin', 'admin')).toBe(true);
    expect(can('tester', 'run')).toBe(true);
    expect(can('tester', 'admin')).toBe(false);
    expect(can('viewer', 'view')).toBe(true);
    expect(can('viewer', 'edit')).toBe(false);
    expect(can(undefined, 'view')).toBe(false);
  });
});

describe('безпечний експорт', () => {
  it('escapeHtml нейтралізує розмітку', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });

  it('csvCell захищає від формульних інʼєкцій і екранує лапки', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('просто текст')).toBe('просто текст');
  });

  const run: Run = {
    id: 'r1',
    title: '<script>alert(1)</script>',
    scope: 'all',
    status: 'failed',
    startedAt: '2026-11-20T10:00:00Z',
    triggeredBy: 'admin',
    environment: 'Edge 131',
    results: [{ caseId: 'c', caseTitle: '=cmd', suiteId: 's', suiteName: 'S', priority: 'low', status: 'failed', assertions: 1, logs: [], error: '<b>x</b>' }],
  };

  it('HTML-звіт не містить неекранованих тегів з даних', () => {
    const html = runToHtml(run);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<b>x</b>');
  });

  it('CSV-звіт починається з BOM і містить екрановані значення', () => {
    const csv = runToCsv(run);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("'=cmd");
  });

  it('safeFileName прибирає небезпечні символи', () => {
    expect(safeFileName('../../etc/passwd')).toBe('.._.._etc_passwd');
    expect(safeFileName('Прогін: №1 <test>')).toBe('Прогін_1_test');
    expect(safeFileName('???')).toBe('report');
  });
});

describe('валідація форм', () => {
  it('parseTags нормалізує й прибирає дублікати', () => {
    expect(parseTags(' Smoke, unit,smoke ,, UI ')).toEqual(['smoke', 'unit', 'ui']);
  });

  it('validateSuite перевіряє обовʼязкові поля та унікальність', () => {
    expect(validateSuite({ name: '', description: '', tags: '', setupCode: '' }).name).toBeDefined();
    expect(validateSuite({ name: 'Кошик', description: '', tags: '', setupCode: '' }, ['кошик']).name).toContain('вже існує');
    expect(validateSuite({ name: 'Новий набір', description: '', tags: 'a,b', setupCode: '' })).toEqual({});
  });

  it('validateCase вимагає expect() і коректний тайм-аут', () => {
    const base = { title: 'Тест', description: '', priority: 'high' as const, code: 'expect(1).toBe(1)', timeoutMs: '2000', tags: '', enabled: true };
    expect(validateCase(base)).toEqual({});
    expect(validateCase({ ...base, code: 'const a = 1;' }).code).toContain('expect');
    expect(validateCase({ ...base, timeoutMs: '50' }).timeoutMs).toBeDefined();
    expect(validateCase({ ...base, timeoutMs: 'abc' }).timeoutMs).toBeDefined();
  });
});

describe('імпорт робочого простору', () => {
  const valid = {
    format: 'autoqa-workspace',
    suites: [{ id: 's1', name: 'Набір', description: '', setupCode: '', tags: [] }],
    cases: [{ id: 'c1', suiteId: 's1', title: 'Тест', code: 'expect(1).toBe(1)', priority: 'low', timeoutMs: 1000, enabled: true, tags: [] }],
    runs: [],
  };

  it('приймає коректний файл', () => {
    const r = parseWorkspace(JSON.stringify(valid), DEFAULT_SETTINGS);
    expect(r.ok).toBe(true);
  });

  it('відхиляє не-JSON, чужий формат і пошкоджені дані', () => {
    expect(parseWorkspace('{bad', DEFAULT_SETTINGS)).toMatchObject({ ok: false });
    expect(parseWorkspace(JSON.stringify({ format: 'other' }), DEFAULT_SETTINGS)).toMatchObject({ ok: false });
    const broken = { ...valid, cases: [{ ...valid.cases[0], priority: 'urgent' }] };
    expect(parseWorkspace(JSON.stringify(broken), DEFAULT_SETTINGS)).toMatchObject({ ok: false, error: 'Некоректний список тест-кейсів' });
    const orphan = { ...valid, cases: [{ ...valid.cases[0], suiteId: 'zzz' }] };
    expect(parseWorkspace(JSON.stringify(orphan), DEFAULT_SETTINGS)).toMatchObject({ ok: false });
  });
});
