import type { ExecOutcome, ResultStatus } from '../types';
import { executeTest } from './executor';
import { createId } from './id';

export interface ExecRequest {
  code: string;
  setupCode: string;
  timeoutMs: number;
  signal: AbortSignal;
}

export interface ExecResult {
  status: 'passed' | 'failed' | 'error' | 'timeout' | 'cancelled';
  assertions: number;
  error?: string;
  logs: string[];
  durationMs: number;
}

/** Абстракція виконавця: у браузері - Web Worker, у модульних тестах - підміна. */
export type Executor = (req: ExecRequest) => Promise<ExecResult>;

/** Виконавець на основі Web Worker з примусовим тайм-аутом і скасуванням. */
export const workerExecutor: Executor = ({ code, setupCode, timeoutMs, signal }) =>
  new Promise<ExecResult>((resolve) => {
    const started = performance.now();
    const elapsed = () => Math.round(performance.now() - started);
    if (signal.aborted) {
      resolve({ status: 'cancelled', assertions: 0, logs: [], durationMs: 0 });
      return;
    }
    const worker = new Worker(new URL('./runner.worker.ts', import.meta.url), { type: 'module' });
    const nonce = createId('n');
    let settled = false;

    const finish = (result: ExecResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      worker.terminate();
      resolve(result);
    };
    const onAbort = () =>
      finish({ status: 'cancelled', assertions: 0, logs: [], durationMs: elapsed(), error: 'Прогін скасовано користувачем' });

    const timer = setTimeout(
      () =>
        finish({
          status: 'timeout',
          assertions: 0,
          logs: [],
          durationMs: elapsed(),
          error: `Перевищено тайм-аут ${timeoutMs} мс. Виконання тесту примусово зупинено.`,
        }),
      timeoutMs,
    );
    signal.addEventListener('abort', onAbort);

    worker.onmessage = (event: MessageEvent<{ nonce: string; outcome: ExecOutcome }>) => {
      // Повідомлення без правильного одноразового ключа ігноруються (підробка результату з коду тесту).
      if (!event.data || event.data.nonce !== nonce) return;
      finish({ ...event.data.outcome });
    };
    worker.onerror = (event) => {
      event.preventDefault();
      finish({ status: 'error', assertions: 0, logs: [], durationMs: elapsed(), error: event.message || 'Помилка середовища виконання' });
    };
    worker.postMessage({ nonce, code, setupCode });
  });

/** Виконавець у поточному потоці (для тестів і середовищ без Worker). Не зупиняє синхронні цикли. */
export const inlineExecutor: Executor = async ({ code, setupCode, timeoutMs, signal }) => {
  if (signal.aborted) return { status: 'cancelled', assertions: 0, logs: [], durationMs: 0 };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ExecResult>((resolve) => {
    timer = setTimeout(
      () => resolve({ status: 'timeout', assertions: 0, logs: [], durationMs: timeoutMs, error: `Перевищено тайм-аут ${timeoutMs} мс.` }),
      timeoutMs,
    );
  });
  let onAbort = () => {};
  const aborted = new Promise<ExecResult>((resolve) => {
    onAbort = () => resolve({ status: 'cancelled', assertions: 0, logs: [], durationMs: 0, error: 'Прогін скасовано користувачем' });
    signal.addEventListener('abort', onAbort, { once: true });
  });
  const result = await Promise.race([executeTest(code, setupCode), timeout, aborted]);
  clearTimeout(timer);
  signal.removeEventListener('abort', onAbort);
  return result;
};

export interface QueueItem {
  code: string;
  setupCode: string;
  timeoutMs: number;
  enabled: boolean;
}

export interface QueuePatch {
  status: ResultStatus;
  durationMs?: number;
  assertions?: number;
  error?: string;
  logs?: string[];
}

export interface QueueOptions {
  concurrency: number;
  stopOnFirstFailure: boolean;
  executor: Executor;
  signal: AbortSignal;
  onUpdate: (index: number, patch: QueuePatch) => void;
}

const FAILING: ResultStatus[] = ['failed', 'error', 'timeout'];

/**
 * Виконує чергу тест-кейсів пулом з N паралельних виконавців.
 * Повідомляє про кожну зміну стану через onUpdate.
 */
export async function runQueue(items: QueueItem[], opts: QueueOptions): Promise<void> {
  const { executor, signal, onUpdate } = opts;
  const concurrency = Math.max(1, Math.min(8, Math.floor(opts.concurrency) || 1));
  let next = 0;
  let stopped = false;

  items.forEach((item, i) => {
    if (!item.enabled) onUpdate(i, { status: 'skipped', error: 'Тест-кейс вимкнено', durationMs: 0, assertions: 0 });
  });

  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      const item = items[index];
      if (!item.enabled) continue;
      if (signal.aborted) {
        onUpdate(index, { status: 'cancelled', error: 'Прогін скасовано', durationMs: 0 });
        continue;
      }
      if (stopped) {
        onUpdate(index, { status: 'skipped', error: 'Пропущено: зупинка після першої невдачі', durationMs: 0 });
        continue;
      }
      onUpdate(index, { status: 'running' });
      const result = await executor({ code: item.code, setupCode: item.setupCode, timeoutMs: item.timeoutMs, signal });
      onUpdate(index, {
        status: result.status,
        durationMs: result.durationMs,
        assertions: result.assertions,
        error: result.error,
        logs: result.logs,
      });
      if (opts.stopOnFirstFailure && FAILING.includes(result.status)) stopped = true;
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, worker));
}
