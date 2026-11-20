import type { CaseResult, ResultStatus, Run } from '../types';
import { buildTrend, deriveRunStatus, filterRuns, restrictToSuite, runsInPeriod, sortRuns, summarize, topFailing } from '../lib/stats';

const res = (caseId: string, status: ResultStatus, suiteId = 's1', durationMs = 10): CaseResult => ({
  caseId,
  caseTitle: `Тест ${caseId}`,
  suiteId,
  suiteName: suiteId === 's1' ? 'Кошик' : 'Форми',
  priority: 'medium',
  status,
  durationMs,
  assertions: 1,
  logs: [],
});

const run = (id: string, startedAt: string, results: CaseResult[], extra: Partial<Run> = {}): Run => ({
  id,
  title: `Прогін ${id}`,
  scope: 'all',
  status: deriveRunStatus(results, false),
  startedAt,
  triggeredBy: 'tester',
  environment: 'Edge 131',
  results,
  ...extra,
});

describe('summarize', () => {
  it('рахує статуси, успішність і тривалість', () => {
    const s = summarize([res('a', 'passed'), res('b', 'failed'), res('c', 'timeout'), res('d', 'skipped'), res('e', 'passed')]);
    expect(s).toMatchObject({ total: 5, passed: 2, failed: 1, timeout: 1, skipped: 1, finished: 5, durationMs: 50 });
    // пропущені не входять у знаменник: 2 з 4 = 50%
    expect(s.passRate).toBe(50);
  });

  it('порожній список дає нульову успішність', () => {
    expect(summarize([]).passRate).toBe(0);
  });
});

describe('deriveRunStatus', () => {
  it('визначає підсумковий статус прогону', () => {
    expect(deriveRunStatus([res('a', 'passed'), res('b', 'skipped')], false)).toBe('passed');
    expect(deriveRunStatus([res('a', 'passed'), res('b', 'error')], false)).toBe('failed');
    expect(deriveRunStatus([res('a', 'running')], false)).toBe('running');
    expect(deriveRunStatus([res('a', 'passed')], true)).toBe('cancelled');
  });
});

describe('фільтрація і сортування журналу', () => {
  const runs = [
    run('1', '2026-11-01T10:00:00Z', [res('a', 'passed'), res('b', 'passed', 's2')]),
    run('2', '2026-11-10T10:00:00Z', [res('a', 'failed')], { title: 'Нічний регрес' }),
    run('3', '2026-11-15T10:00:00Z', [res('a', 'passed'), res('b', 'failed', 's2'), res('c', 'failed', 's2')]),
  ];

  it('за статусом', () => {
    expect(filterRuns(runs, { status: 'failed' }).map((r) => r.id)).toEqual(['2', '3']);
  });
  it('за набором', () => {
    expect(filterRuns(runs, { suiteId: 's2' }).map((r) => r.id)).toEqual(['1', '3']);
  });
  it('за діапазоном дат', () => {
    expect(filterRuns(runs, { from: '2026-11-05', to: '2026-11-12' }).map((r) => r.id)).toEqual(['2']);
  });
  it('за текстовим запитом без урахування регістру', () => {
    expect(filterRuns(runs, { query: 'НІЧНИЙ' }).map((r) => r.id)).toEqual(['2']);
  });
  it('сортування за успішністю та датою', () => {
    expect(sortRuns(runs, 'passRate', 'asc').map((r) => r.id)).toEqual(['2', '3', '1']);
    expect(sortRuns(runs, 'startedAt', 'desc').map((r) => r.id)).toEqual(['3', '2', '1']);
  });

  it('restrictToSuite залишає лише результати одного набору', () => {
    const r = restrictToSuite(runs, 's2');
    expect(r).toHaveLength(2);
    expect(r.every((x) => x.results.every((y) => y.suiteId === 's2'))).toBe(true);
  });

  it('runsInPeriod відкидає старі прогони', () => {
    const now = new Date('2026-11-16T00:00:00Z').getTime();
    expect(runsInPeriod(runs, 7, now).map((r) => r.id)).toEqual(['2', '3']);
    expect(runsInPeriod(runs, 0, now)).toHaveLength(3);
  });

  it('buildTrend формує точки у хронологічному порядку', () => {
    const t = buildTrend([...runs].reverse(), 2);
    expect(t.map((p) => p.id)).toEqual(['2', '3']);
    expect(t[1].failed).toBe(2);
  });
});

describe('topFailing', () => {
  it('ранжує проблемні тести і виявляє нестабільні (flaky)', () => {
    const runs = [
      run('1', '2026-11-01T10:00:00Z', [res('a', 'passed'), res('b', 'failed')]),
      run('2', '2026-11-02T10:00:00Z', [res('a', 'failed'), res('b', 'failed')]),
      run('3', '2026-11-03T10:00:00Z', [res('a', 'passed'), res('b', 'timeout'), res('c', 'passed')]),
    ];
    const top = topFailing(runs);
    expect(top.map((t) => t.caseId)).toEqual(['b', 'a']);
    expect(top[0]).toMatchObject({ failRate: 100, flaky: false, lastStatus: 'timeout' });
    expect(top[1]).toMatchObject({ failures: 1, executions: 3, flaky: true });
  });
});
