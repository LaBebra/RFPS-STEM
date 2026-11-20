import type { Priority, ResultStatus, RunStatus } from '../types';

const dateFmt = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const shortFmt = new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit' });

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '-' : dateFmt.format(d);
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '-' : shortFmt.format(d);
}

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined || !isFinite(ms)) return '-';
  if (ms < 1) return '<1 мс';
  if (ms < 1000) return `${Math.round(ms)} мс`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} с`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m} хв ${s} с`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

export const RESULT_LABELS: Record<ResultStatus, string> = {
  queued: 'У черзі',
  running: 'Виконується',
  passed: 'Пройдено',
  failed: 'Провалено',
  error: 'Помилка',
  timeout: 'Тайм-аут',
  skipped: 'Пропущено',
  cancelled: 'Скасовано',
};

export const RUN_LABELS: Record<RunStatus, string> = {
  running: 'Виконується',
  passed: 'Успішний',
  failed: 'З помилками',
  cancelled: 'Скасований',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Низький',
  medium: 'Середній',
  high: 'Високий',
  critical: 'Критичний',
};

export const PRIORITY_ORDER: Priority[] = ['critical', 'high', 'medium', 'low'];

/** Коротка назва браузера з User-Agent для поля "середовище" прогону. */
export function detectEnvironment(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string {
  const rules: [RegExp, string][] = [
    [/Edg\/(\d+)/, 'Edge'],
    [/OPR\/(\d+)/, 'Opera'],
    [/Firefox\/(\d+)/, 'Firefox'],
    [/Chrome\/(\d+)/, 'Chrome'],
    [/Version\/(\d+).*Safari/, 'Safari'],
  ];
  for (const [re, name] of rules) {
    const m = ua.match(re);
    if (m) return `${name} ${m[1]}`;
  }
  return 'Невідомий браузер';
}
