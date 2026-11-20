import type { Priority, Run, Settings, Suite, TestCase, Workspace } from '../types';

export type Errors<T> = Partial<Record<keyof T, string>>;

export const LIMITS = {
  name: 80,
  description: 500,
  code: 20_000,
  tags: 8,
  tag: 24,
  timeoutMin: 100,
  timeoutMax: 30_000,
  importBytes: 2_000_000,
};

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical'];

/** Розбір рядка тегів "a, b, c" у нормалізований масив. */
export function parseTags(input: string): string[] {
  return [
    ...new Set(
      input
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export interface SuiteForm {
  name: string;
  description: string;
  tags: string;
  setupCode: string;
}

export function validateSuite(f: SuiteForm, existingNames: string[] = []): Errors<SuiteForm> {
  const e: Errors<SuiteForm> = {};
  const name = f.name.trim();
  if (!name) e.name = "Назва обов'язкова";
  else if (name.length < 3) e.name = 'Мінімум 3 символи';
  else if (name.length > LIMITS.name) e.name = `Максимум ${LIMITS.name} символів`;
  else if (existingNames.some((n) => n.trim().toLowerCase() === name.toLowerCase())) e.name = 'Набір з такою назвою вже існує';
  if (f.description.length > LIMITS.description) e.description = `Максимум ${LIMITS.description} символів`;
  const tags = parseTags(f.tags);
  if (tags.length > LIMITS.tags) e.tags = `Не більше ${LIMITS.tags} тегів`;
  else if (tags.some((t) => t.length > LIMITS.tag)) e.tags = `Тег не довший за ${LIMITS.tag} символи`;
  if (f.setupCode.length > LIMITS.code) e.setupCode = 'Код занадто великий';
  return e;
}

export interface CaseForm {
  title: string;
  description: string;
  priority: Priority;
  code: string;
  timeoutMs: string;
  tags: string;
  enabled: boolean;
}

export function validateCase(f: CaseForm): Errors<CaseForm> {
  const e: Errors<CaseForm> = {};
  const title = f.title.trim();
  if (!title) e.title = "Назва обов'язкова";
  else if (title.length < 3) e.title = 'Мінімум 3 символи';
  else if (title.length > LIMITS.name) e.title = `Максимум ${LIMITS.name} символів`;
  if (f.description.length > LIMITS.description) e.description = `Максимум ${LIMITS.description} символів`;
  if (!PRIORITIES.includes(f.priority)) e.priority = 'Оберіть пріоритет';
  if (!f.code.trim()) e.code = 'Тіло тесту не може бути порожнім';
  else if (f.code.length > LIMITS.code) e.code = 'Код занадто великий';
  else if (!/expect\s*\(/.test(f.code)) e.code = 'Додайте хоча б одну перевірку expect(...)';
  const t = Number(f.timeoutMs);
  if (!Number.isInteger(t) || t < LIMITS.timeoutMin || t > LIMITS.timeoutMax) {
    e.timeoutMs = `Ціле число від ${LIMITS.timeoutMin} до ${LIMITS.timeoutMax} мс`;
  }
  const tags = parseTags(f.tags);
  if (tags.length > LIMITS.tags) e.tags = `Не більше ${LIMITS.tags} тегів`;
  return e;
}

export function hasErrors(e: object): boolean {
  return Object.values(e).some(Boolean);
}

// ---------- Перевірка імпортованого JSON ----------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown, max = 100_000): v is string => typeof v === 'string' && v.length <= max;
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => isStr(x, 100));

function checkSuite(v: unknown): v is Suite {
  return isObj(v) && isStr(v.id, 64) && isStr(v.name, LIMITS.name) && isStr(v.description) && isStr(v.setupCode) && isStrArr(v.tags);
}

function checkCase(v: unknown): v is TestCase {
  return (
    isObj(v) &&
    isStr(v.id, 64) &&
    isStr(v.suiteId, 64) &&
    isStr(v.title, LIMITS.name) &&
    isStr(v.code) &&
    PRIORITIES.includes(v.priority as Priority) &&
    typeof v.timeoutMs === 'number' &&
    v.timeoutMs >= LIMITS.timeoutMin &&
    v.timeoutMs <= LIMITS.timeoutMax &&
    typeof v.enabled === 'boolean' &&
    isStrArr(v.tags)
  );
}

function checkRun(v: unknown): v is Run {
  return isObj(v) && isStr(v.id, 64) && isStr(v.title, 200) && isStr(v.startedAt, 40) && Array.isArray(v.results);
}

export type ImportResult = { ok: true; data: Workspace } | { ok: false; error: string };

/** Сувора перевірка структури файлу робочого простору перед імпортом. */
export function parseWorkspace(text: string, fallbackSettings: Settings): ImportResult {
  if (text.length > LIMITS.importBytes) return { ok: false, error: 'Файл завеликий (понад 2 МБ)' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Файл не є коректним JSON' };
  }
  if (!isObj(raw) || raw.format !== 'autoqa-workspace') return { ok: false, error: 'Невідомий формат файлу (очікується експорт AutoQA Lab)' };
  if (!Array.isArray(raw.suites) || !raw.suites.every(checkSuite)) return { ok: false, error: 'Некоректний список тестових наборів' };
  if (!Array.isArray(raw.cases) || !raw.cases.every(checkCase)) return { ok: false, error: 'Некоректний список тест-кейсів' };
  const suiteIds = new Set((raw.suites as Suite[]).map((s) => s.id));
  if ((raw.cases as TestCase[]).some((c) => !suiteIds.has(c.suiteId))) return { ok: false, error: 'Тест-кейс посилається на неіснуючий набір' };
  const runs = Array.isArray(raw.runs) ? raw.runs.filter(checkRun) : [];
  const now = new Date().toISOString();
  return {
    ok: true,
    data: {
      version: 1,
      suites: (raw.suites as Suite[]).map((s) => ({ ...s, createdAt: s.createdAt ?? now, updatedAt: s.updatedAt ?? now })),
      cases: (raw.cases as TestCase[]).map((c) => ({ ...c, description: c.description ?? '', createdAt: c.createdAt ?? now, updatedAt: c.updatedAt ?? now })),
      runs: runs as Run[],
      settings: isObj(raw.settings) ? { ...fallbackSettings, ...(raw.settings as Partial<Settings>) } : fallbackSettings,
    },
  };
}
