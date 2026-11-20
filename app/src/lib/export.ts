import type { Run, Workspace } from '../types';
import { formatDateTime, formatDuration, RESULT_LABELS, RUN_LABELS } from './format';
import { summarize } from './stats';

/** Екранування HTML-спецсимволів (захист від XSS у згенерованому звіті). */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Екранування комірки CSV. Значення, що починаються з = + - @ або табуляції,
 * префіксуються апострофом (захист від CSV/формульних ін'єкцій у табличних редакторах).
 */
export function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function runToCsv(run: Run): string {
  const header = ['Набір', 'Тест-кейс', 'Пріоритет', 'Статус', 'Тривалість, мс', 'Перевірок', 'Помилка'];
  const rows = run.results.map((r) => [
    r.suiteName,
    r.caseTitle,
    r.priority,
    RESULT_LABELS[r.status],
    r.durationMs ?? '',
    r.assertions,
    r.error ?? '',
  ]);
  // BOM - щоб Excel коректно відкрив кирилицю.
  return '﻿' + [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
}

export function runToJson(run: Run): string {
  return JSON.stringify({ format: 'autoqa-run', version: 1, run, summary: summarize(run.results) }, null, 2);
}

export function workspaceToJson(ws: Workspace): string {
  return JSON.stringify({ format: 'autoqa-workspace', ...ws }, null, 2);
}

export function runToHtml(run: Run): string {
  const s = summarize(run.results);
  const color: Record<string, string> = {
    passed: '#0a7f0a',
    failed: '#c42f2f',
    error: '#b5502a',
    timeout: '#9a6a00',
    skipped: '#666',
    cancelled: '#666',
  };
  const rows = run.results
    .map(
      (r) => `<tr>
  <td>${escapeHtml(r.suiteName)}</td>
  <td>${escapeHtml(r.caseTitle)}</td>
  <td style="color:${color[r.status] ?? '#333'};font-weight:600">${escapeHtml(RESULT_LABELS[r.status])}</td>
  <td>${escapeHtml(formatDuration(r.durationMs))}</td>
  <td>${r.assertions}</td>
  <td><pre>${escapeHtml(r.error ?? '')}</pre></td>
</tr>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="uk"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Звіт прогону ${escapeHtml(run.title)}</title>
<style>
body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:24px;color:#111}
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#f1f1ef} pre{margin:0;white-space:pre-wrap;font-size:12px}
.kpi{display:flex;gap:16px;flex-wrap:wrap;margin:12px 0 20px}
.kpi div{border:1px solid #ddd;border-radius:8px;padding:8px 12px}
</style></head><body>
<h1>Звіт прогону: ${escapeHtml(run.title)}</h1>
<p>Статус: <b>${escapeHtml(RUN_LABELS[run.status])}</b> · Запущено: ${escapeHtml(formatDateTime(run.startedAt))} ·
Користувач: ${escapeHtml(run.triggeredBy)} · Середовище: ${escapeHtml(run.environment)}</p>
<div class="kpi">
<div>Усього: <b>${s.total}</b></div><div>Пройдено: <b>${s.passed}</b></div>
<div>Провалено: <b>${s.failed}</b></div><div>Помилки: <b>${s.error}</b></div>
<div>Тайм-аути: <b>${s.timeout}</b></div><div>Успішність: <b>${s.passRate}%</b></div>
<div>Тривалість: <b>${escapeHtml(formatDuration(s.durationMs))}</b></div>
</div>
<table><thead><tr><th>Набір</th><th>Тест-кейс</th><th>Статус</th><th>Час</th><th>Перевірок</th><th>Помилка</th></tr></thead>
<tbody>
${rows}
</tbody></table>
<p style="color:#666;font-size:12px">Згенеровано AutoQA Lab ${escapeHtml(formatDateTime(new Date().toISOString()))}</p>
</body></html>`;
}

/** Ініціює завантаження файлу у браузері. */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Безпечна назва файлу з довільного рядка. */
export function safeFileName(name: string): string {
  return (
    name
      .replace(/[^\p{L}\p{N}_.-]+/gu, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 60) || 'report'
  );
}
