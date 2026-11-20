import type { CaseResult, ResultStatus, Run, RunStatus } from '../types';

export interface Summary {
  total: number;
  passed: number;
  failed: number;
  error: number;
  timeout: number;
  skipped: number;
  cancelled: number;
  /** Відсоток успішних серед виконаних (без пропущених і скасованих). */
  passRate: number;
  durationMs: number;
  finished: number;
}

const COUNTED: ResultStatus[] = ['passed', 'failed', 'error', 'timeout', 'skipped', 'cancelled'];

export function summarize(results: CaseResult[]): Summary {
  const s: Summary = {
    total: results.length,
    passed: 0,
    failed: 0,
    error: 0,
    timeout: 0,
    skipped: 0,
    cancelled: 0,
    passRate: 0,
    durationMs: 0,
    finished: 0,
  };
  for (const r of results) {
    if (COUNTED.includes(r.status)) (s as unknown as Record<string, number>)[r.status] += 1;
    s.durationMs += r.durationMs ?? 0;
    if (r.status !== 'queued' && r.status !== 'running') s.finished += 1;
  }
  const executed = s.passed + s.failed + s.error + s.timeout;
  s.passRate = executed ? Math.round((s.passed / executed) * 1000) / 10 : 0;
  s.durationMs = Math.round(s.durationMs);
  return s;
}

/** Підсумковий статус прогону за результатами. */
export function deriveRunStatus(results: CaseResult[], cancelled: boolean): RunStatus {
  if (cancelled) return 'cancelled';
  if (results.some((r) => r.status === 'queued' || r.status === 'running')) return 'running';
  return results.some((r) => r.status === 'failed' || r.status === 'error' || r.status === 'timeout') ? 'failed' : 'passed';
}

export interface RunFilter {
  query?: string;
  status?: RunStatus | 'all';
  suiteId?: string | 'all';
  from?: string;
  to?: string;
}

/** Фільтрація журналу прогонів (пошук, статус, набір, діапазон дат). */
export function filterRuns(runs: Run[], f: RunFilter): Run[] {
  const q = f.query?.trim().toLowerCase();
  const from = f.from ? new Date(`${f.from}T00:00:00`).getTime() : -Infinity;
  const to = f.to ? new Date(`${f.to}T23:59:59.999`).getTime() : Infinity;
  return runs.filter((run) => {
    if (f.status && f.status !== 'all' && run.status !== f.status) return false;
    if (f.suiteId && f.suiteId !== 'all' && !run.results.some((r) => r.suiteId === f.suiteId)) return false;
    const t = new Date(run.startedAt).getTime();
    if (t < from || t > to) return false;
    if (q) {
      const hay = `${run.title} ${run.triggeredBy} ${run.environment} ${run.results.map((r) => r.caseTitle).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export type SortKey = 'startedAt' | 'passRate' | 'durationMs' | 'total';

export function sortRuns(runs: Run[], key: SortKey, dir: 'asc' | 'desc'): Run[] {
  const val = (r: Run): number => {
    if (key === 'startedAt') return new Date(r.startedAt).getTime();
    const s = summarize(r.results);
    return key === 'passRate' ? s.passRate : key === 'durationMs' ? s.durationMs : s.total;
  };
  const sign = dir === 'asc' ? 1 : -1;
  return [...runs].sort((a, b) => (val(a) - val(b)) * sign);
}

export interface TrendPoint {
  id: string;
  label: string;
  passRate: number;
  passed: number;
  failed: number;
  error: number;
  timeout: number;
  skipped: number;
  durationMs: number;
}

/** Точки для графіків динаміки: останні N завершених прогонів у хронологічному порядку. */
export function buildTrend(runs: Run[], limit = 15): TrendPoint[] {
  return runs
    // Прогони без жодного виконаного тесту (повністю скасовані) не впливають на тренд.
    .filter((r) => r.status !== 'running' && r.results.some((x) => ['passed', 'failed', 'error', 'timeout'].includes(x.status)))
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
    .slice(-limit)
    .map((r, i, arr) => {
      const s = summarize(r.results);
      return {
        id: r.id,
        label: `#${runs.length - arr.length + i + 1}`,
        passRate: s.passRate,
        passed: s.passed,
        failed: s.failed,
        error: s.error,
        timeout: s.timeout,
        skipped: s.skipped + s.cancelled,
        durationMs: s.durationMs,
      };
    });
}

export interface FailingCase {
  caseId: string;
  title: string;
  suiteName: string;
  failures: number;
  executions: number;
  failRate: number;
  flaky: boolean;
  lastStatus: ResultStatus;
}

const BAD: ResultStatus[] = ['failed', 'error', 'timeout'];

/**
 * Рейтинг проблемних тест-кейсів. Нестабільний (flaky) - тест, що в межах
 * вибірки і проходив, і падав.
 */
export function topFailing(runs: Run[], limit = 5): FailingCase[] {
  const map = new Map<string, FailingCase>();
  const ordered = [...runs].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  for (const run of ordered) {
    for (const r of run.results) {
      if (!['passed', ...BAD].includes(r.status)) continue;
      const item = map.get(r.caseId) ?? {
        caseId: r.caseId,
        title: r.caseTitle,
        suiteName: r.suiteName,
        failures: 0,
        executions: 0,
        failRate: 0,
        flaky: false,
        lastStatus: r.status,
      };
      item.executions += 1;
      if (BAD.includes(r.status)) item.failures += 1;
      item.lastStatus = r.status;
      item.title = r.caseTitle;
      map.set(r.caseId, item);
    }
  }
  return [...map.values()]
    .filter((c) => c.failures > 0)
    .map((c) => ({
      ...c,
      failRate: Math.round((c.failures / c.executions) * 1000) / 10,
      flaky: c.failures > 0 && c.failures < c.executions,
    }))
    .sort((a, b) => b.failRate - a.failRate || b.failures - a.failures)
    .slice(0, limit);
}

/** Прогони за останні N днів (0 - усі). */
export function runsInPeriod(runs: Run[], days: number, now = Date.now()): Run[] {
  if (!days) return runs;
  const border = now - days * 24 * 60 * 60 * 1000;
  return runs.filter((r) => new Date(r.startedAt).getTime() >= border);
}

/** Звуження результатів прогонів до одного тестового набору. */
export function restrictToSuite(runs: Run[], suiteId: string | 'all'): Run[] {
  if (suiteId === 'all') return runs;
  return runs
    .map((r) => ({ ...r, results: r.results.filter((x) => x.suiteId === suiteId) }))
    .filter((r) => r.results.length > 0);
}
