import { inlineExecutor, runQueue, type Executor, type QueueItem, type QueuePatch } from '../lib/runner';

const item = (code: string, enabled = true, timeoutMs = 1000): QueueItem => ({ code, setupCode: '', timeoutMs, enabled });

function collect() {
  const patches: { index: number; patch: QueuePatch }[] = [];
  return { patches, onUpdate: (index: number, patch: QueuePatch) => patches.push({ index, patch }) };
}
const finalStatus = (patches: { index: number; patch: QueuePatch }[], i: number) =>
  patches.filter((p) => p.index === i).slice(-1)[0]?.patch.status;

describe('runQueue - оркестрація прогону', () => {
  it('виконує всі тести і повідомляє про стани running -> результат', async () => {
    const { patches, onUpdate } = collect();
    await runQueue([item('expect(1).toBe(1)'), item('expect(1).toBe(2)')], {
      concurrency: 2,
      stopOnFirstFailure: false,
      executor: inlineExecutor,
      signal: new AbortController().signal,
      onUpdate,
    });
    expect(patches.filter((p) => p.index === 0).map((p) => p.patch.status)).toEqual(['running', 'passed']);
    expect(finalStatus(patches, 1)).toBe('failed');
  });

  it('вимкнені тест-кейси пропускаються', async () => {
    const { patches, onUpdate } = collect();
    await runQueue([item('expect(1).toBe(1)', false)], { concurrency: 1, stopOnFirstFailure: false, executor: inlineExecutor, signal: new AbortController().signal, onUpdate });
    expect(finalStatus(patches, 0)).toBe('skipped');
  });

  it('режим "зупинка після першої невдачі" пропускає решту', async () => {
    const { patches, onUpdate } = collect();
    await runQueue([item('expect(1).toBe(2)'), item('expect(1).toBe(1)'), item('expect(2).toBe(2)')], {
      concurrency: 1,
      stopOnFirstFailure: true,
      executor: inlineExecutor,
      signal: new AbortController().signal,
      onUpdate,
    });
    expect([0, 1, 2].map((i) => finalStatus(patches, i))).toEqual(['failed', 'skipped', 'skipped']);
  });

  it('скасування позначає невиконані тести як cancelled', async () => {
    const controller = new AbortController();
    const { patches, onUpdate } = collect();
    const slow: Executor = (req) =>
      new Promise((resolve) => {
        const t = setTimeout(() => resolve({ status: 'passed', assertions: 1, logs: [], durationMs: 50 }), 50);
        req.signal.addEventListener('abort', () => {
          clearTimeout(t);
          resolve({ status: 'cancelled', assertions: 0, logs: [], durationMs: 1 });
        });
      });
    const p = runQueue([item('a'), item('b'), item('c')], { concurrency: 1, stopOnFirstFailure: false, executor: slow, signal: controller.signal, onUpdate });
    setTimeout(() => controller.abort(), 10);
    await p;
    expect([0, 1, 2].map((i) => finalStatus(patches, i))).toEqual(['cancelled', 'cancelled', 'cancelled']);
  });

  it('обмежує кількість одночасно виконуваних тестів', async () => {
    let active = 0;
    let peak = 0;
    const exec: Executor = async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
      return { status: 'passed', assertions: 1, logs: [], durationMs: 10 };
    };
    await runQueue(Array.from({ length: 6 }, () => item('x')), { concurrency: 2, stopOnFirstFailure: false, executor: exec, signal: new AbortController().signal, onUpdate: () => {} });
    expect(peak).toBe(2);
  });

  it('inlineExecutor повертає timeout для довгого асинхронного тесту', async () => {
    const r = await inlineExecutor({ code: 'await new Promise((r) => setTimeout(r, 300)); expect(1).toBe(1);', setupCode: '', timeoutMs: 50, signal: new AbortController().signal });
    expect(r.status).toBe('timeout');
  });
});
