import { inlineExecutor } from '../lib/runner';
import { cancelRun, launchRun, setExecutor } from '../store/runActions';
import { normalizeSettings, useAppStore } from '../store/useAppStore';

const store = () => useAppStore.getState();

beforeEach(() => {
  store().resetDemo();
  setExecutor(inlineExecutor);
});

describe('сховище робочого простору', () => {
  it('містить демо-дані: 4 набори, 16 тест-кейсів, історію', () => {
    expect(store().suites).toHaveLength(4);
    expect(store().cases).toHaveLength(16);
    expect(store().runs.length).toBeGreaterThan(10);
  });

  it('створює, оновлює та каскадно видаляє набір', () => {
    const s = store().addSuite({ name: 'Новий', description: '', setupCode: '', tags: [] });
    store().addCase({ suiteId: s.id, title: 'Тест', description: '', priority: 'low', code: 'expect(1).toBe(1)', timeoutMs: 1000, enabled: true, tags: [] });
    store().updateSuite(s.id, { name: 'Перейменований' });
    expect(store().suites.find((x) => x.id === s.id)?.name).toBe('Перейменований');
    store().deleteSuite(s.id);
    expect(store().suites.find((x) => x.id === s.id)).toBeUndefined();
    expect(store().cases.some((c) => c.suiteId === s.id)).toBe(false);
  });

  it('дублює й перемикає тест-кейс', () => {
    const copy = store().duplicateCase('case_slug');
    expect(copy?.title).toContain('(копія)');
    expect(copy?.id).not.toBe('case_slug');
    store().toggleCase('case_slug');
    expect(store().cases.find((c) => c.id === 'case_slug')?.enabled).toBe(false);
  });

  it('normalizeSettings обмежує значення допустимими межами', () => {
    const s = normalizeSettings({ concurrency: 99, defaultTimeoutMs: 5, historyLimit: NaN, theme: 'neon' as never });
    expect(s).toMatchObject({ concurrency: 4, defaultTimeoutMs: 100, historyLimit: 100, theme: 'system' });
  });

  it('історія прогонів обмежується historyLimit', () => {
    store().updateSettings({ historyLimit: 10 });
    for (let i = 0; i < 3; i++) {
      store().addRun({ ...store().runs[0], id: `extra_${i}` });
    }
    expect(store().runs.length).toBeLessThanOrEqual(10);
  });
});

describe('запуск прогону (launchRun)', () => {
  it('виконує тести набору й фіксує результати та підсумковий статус', async () => {
    const ids = store().cases.filter((c) => c.suiteId === 'suite_cart').map((c) => c.id);
    const { runId, done } = launchRun({ caseIds: ids, title: 'Кошик', scope: 'suite', triggeredBy: 'tester' });
    expect(store().runs[0].id).toBe(runId);
    expect(store().runs[0].status).toBe('running');
    const run = await done;
    expect(run.status).toBe('failed');
    expect(run.results.find((r) => r.caseId === 'case_cart_disc')?.status).toBe('failed');
    expect(run.results.find((r) => r.caseId === 'case_cart_add')?.status).toBe('passed');
    expect(run.finishedAt).toBeDefined();
  });

  it('скасування переводить прогін у стан cancelled', async () => {
    const { runId, done } = launchRun({ caseIds: ['case_api_slow', 'case_api_user'], title: 'Async', scope: 'suite', triggeredBy: 'tester' });
    expect(cancelRun(runId)).toBe(true);
    const run = await done;
    expect(run.status).toBe('cancelled');
    expect(cancelRun(runId)).toBe(false);
  });

  it('порожній список тестів не запускається', () => {
    expect(() => launchRun({ caseIds: ['nope'], title: 'x', scope: 'case', triggeredBy: 'a' })).toThrow('Немає тест-кейсів');
  });
});
