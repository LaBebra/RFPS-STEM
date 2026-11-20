import type { CaseResult, Run, RunScope, TestCase } from '../types';
import { createId } from '../lib/id';
import { detectEnvironment } from '../lib/format';
import { runQueue, workerExecutor, type Executor } from '../lib/runner';
import { deriveRunStatus } from '../lib/stats';
import { useAppStore } from './useAppStore';

const controllers = new Map<string, AbortController>();

let executor: Executor = workerExecutor;
/** Дозволяє підмінити виконавця (у модульних тестах). */
export function setExecutor(e: Executor) {
  executor = e;
}

export function isRunActive(runId: string) {
  return controllers.has(runId);
}

export interface LaunchOptions {
  caseIds: string[];
  title: string;
  scope: RunScope;
  triggeredBy: string;
}

/**
 * Створює новий прогін, додає його в журнал і асинхронно виконує.
 * Повертає id прогону одразу, щоб інтерфейс міг перейти на сторінку live-прогресу.
 */
export function launchRun({ caseIds, title, scope, triggeredBy }: LaunchOptions): { runId: string; done: Promise<Run> } {
  const store = useAppStore.getState();
  const byId = new Map(store.cases.map((c) => [c.id, c]));
  const cases = caseIds.map((id) => byId.get(id)).filter((c): c is TestCase => Boolean(c));
  if (!cases.length) throw new Error('Немає тест-кейсів для запуску');
  const suites = new Map(store.suites.map((s) => [s.id, s]));

  const results: CaseResult[] = cases.map((c) => ({
    caseId: c.id,
    caseTitle: c.title,
    suiteId: c.suiteId,
    suiteName: suites.get(c.suiteId)?.name ?? '-',
    priority: c.priority,
    status: 'queued',
    assertions: 0,
    logs: [],
  }));

  const run: Run = {
    id: createId('run'),
    title,
    scope,
    status: 'running',
    startedAt: new Date().toISOString(),
    triggeredBy,
    environment: detectEnvironment(),
    results,
  };
  store.addRun(run);

  const controller = new AbortController();
  controllers.set(run.id, controller);

  const done = runQueue(
    cases.map((c) => ({
      code: c.code,
      setupCode: suites.get(c.suiteId)?.setupCode ?? '',
      timeoutMs: c.timeoutMs,
      enabled: c.enabled,
    })),
    {
      concurrency: store.settings.concurrency,
      stopOnFirstFailure: store.settings.stopOnFirstFailure,
      executor,
      signal: controller.signal,
      onUpdate: (index, patch) => useAppStore.getState().patchResult(run.id, index, patch),
    },
  ).then(() => {
    controllers.delete(run.id);
    const current = useAppStore.getState().runs.find((r) => r.id === run.id);
    const finalResults = current?.results ?? results;
    useAppStore.getState().patchRun(run.id, {
      status: deriveRunStatus(finalResults, controller.signal.aborted),
      finishedAt: new Date().toISOString(),
    });
    return useAppStore.getState().runs.find((r) => r.id === run.id) ?? run;
  });

  return { runId: run.id, done };
}

export function cancelRun(runId: string): boolean {
  const c = controllers.get(runId);
  if (!c) return false;
  c.abort();
  return true;
}
