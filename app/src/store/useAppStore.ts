import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CaseResult, Run, Settings, Suite, TestCase, Workspace } from '../types';
import { createId } from '../lib/id';
import { createSeedWorkspace, DEFAULT_SETTINGS } from '../lib/seed';

export type SuiteInput = Pick<Suite, 'name' | 'description' | 'setupCode' | 'tags'>;
export type CaseInput = Pick<TestCase, 'suiteId' | 'title' | 'description' | 'priority' | 'code' | 'timeoutMs' | 'enabled' | 'tags'>;

export interface AppState {
  suites: Suite[];
  cases: TestCase[];
  runs: Run[];
  settings: Settings;

  addSuite: (input: SuiteInput) => Suite;
  updateSuite: (id: string, patch: Partial<SuiteInput>) => void;
  deleteSuite: (id: string) => void;

  addCase: (input: CaseInput) => TestCase;
  updateCase: (id: string, patch: Partial<CaseInput>) => void;
  deleteCase: (id: string) => void;
  duplicateCase: (id: string) => TestCase | undefined;
  toggleCase: (id: string) => void;

  addRun: (run: Run) => void;
  patchRun: (id: string, patch: Partial<Omit<Run, 'results'>>) => void;
  patchResult: (runId: string, index: number, patch: Partial<CaseResult>) => void;
  deleteRun: (id: string) => void;
  clearRuns: () => void;

  updateSettings: (patch: Partial<Settings>) => void;
  importWorkspace: (ws: Workspace) => void;
  resetDemo: () => void;
}

const now = () => new Date().toISOString();

/** Нормалізація налаштувань: значення завжди в допустимих межах. */
export function normalizeSettings(s: Partial<Settings>): Settings {
  const m = { ...DEFAULT_SETTINGS, ...s };
  const clamp = (v: number, lo: number, hi: number, d: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
  return {
    theme: ['system', 'light', 'dark'].includes(m.theme) ? m.theme : 'system',
    defaultTimeoutMs: clamp(m.defaultTimeoutMs, 100, 30_000, DEFAULT_SETTINGS.defaultTimeoutMs),
    concurrency: clamp(m.concurrency, 1, 4, DEFAULT_SETTINGS.concurrency),
    stopOnFirstFailure: Boolean(m.stopOnFirstFailure),
    historyLimit: clamp(m.historyLimit, 10, 500, DEFAULT_SETTINGS.historyLimit),
  };
}

const seed = createSeedWorkspace();

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      suites: seed.suites,
      cases: seed.cases,
      runs: seed.runs,
      settings: seed.settings,

      addSuite: (input) => {
        const suite: Suite = { id: createId('suite'), ...input, createdAt: now(), updatedAt: now() };
        set((s) => ({ suites: [...s.suites, suite] }));
        return suite;
      },
      updateSuite: (id, patch) =>
        set((s) => ({ suites: s.suites.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: now() } : x)) })),
      deleteSuite: (id) =>
        set((s) => ({ suites: s.suites.filter((x) => x.id !== id), cases: s.cases.filter((c) => c.suiteId !== id) })),

      addCase: (input) => {
        const tc: TestCase = { id: createId('case'), ...input, createdAt: now(), updatedAt: now() };
        set((s) => ({ cases: [...s.cases, tc] }));
        return tc;
      },
      updateCase: (id, patch) =>
        set((s) => ({ cases: s.cases.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: now() } : x)) })),
      deleteCase: (id) => set((s) => ({ cases: s.cases.filter((x) => x.id !== id) })),
      duplicateCase: (id) => {
        const src = get().cases.find((c) => c.id === id);
        if (!src) return undefined;
        const copy: TestCase = { ...src, id: createId('case'), title: `${src.title} (копія)`.slice(0, 80), createdAt: now(), updatedAt: now() };
        set((s) => ({ cases: [...s.cases, copy] }));
        return copy;
      },
      toggleCase: (id) =>
        set((s) => ({ cases: s.cases.map((x) => (x.id === id ? { ...x, enabled: !x.enabled, updatedAt: now() } : x)) })),

      addRun: (run) =>
        set((s) => ({ runs: [run, ...s.runs].slice(0, s.settings.historyLimit) })),
      patchRun: (id, patch) => set((s) => ({ runs: s.runs.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      patchResult: (runId, index, patch) =>
        set((s) => ({
          runs: s.runs.map((r) =>
            r.id === runId ? { ...r, results: r.results.map((x, i) => (i === index ? { ...x, ...patch } : x)) } : r,
          ),
        })),
      deleteRun: (id) => set((s) => ({ runs: s.runs.filter((r) => r.id !== id) })),
      clearRuns: () => set((s) => ({ runs: s.runs.filter((r) => r.status === 'running') })),

      updateSettings: (patch) => set((s) => ({ settings: normalizeSettings({ ...s.settings, ...patch }) })),
      importWorkspace: (ws) =>
        set({ suites: ws.suites, cases: ws.cases, runs: ws.runs, settings: normalizeSettings(ws.settings) }),
      resetDemo: () => {
        const fresh = createSeedWorkspace();
        set({ suites: fresh.suites, cases: fresh.cases, runs: fresh.runs, settings: fresh.settings });
      },
    }),
    {
      name: 'autoqa-lab:workspace',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ suites: s.suites, cases: s.cases, runs: s.runs, settings: s.settings }),
      // Прогони, перервані перезавантаженням сторінки, позначаються як скасовані.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const interrupted = state.runs.some((r) => r.status === 'running');
        if (interrupted) {
          state.runs = state.runs.map((r) =>
            r.status === 'running'
              ? {
                  ...r,
                  status: 'cancelled',
                  finishedAt: r.finishedAt ?? now(),
                  results: r.results.map((x) =>
                    x.status === 'queued' || x.status === 'running' ? { ...x, status: 'cancelled', error: 'Прогін перервано перезавантаженням сторінки' } : x,
                  ),
                }
              : r,
          );
        }
        state.settings = normalizeSettings(state.settings);
      },
    },
  ),
);
