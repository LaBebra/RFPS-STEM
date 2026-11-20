/** Доменні типи AutoQA Lab. */

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export type Role = 'admin' | 'tester' | 'viewer';

export interface User {
  username: string;
  name: string;
  role: Role;
}

/** Тестовий набір (suite): група тест-кейсів + спільний код системи, що тестується. */
export interface Suite {
  id: string;
  name: string;
  description: string;
  /** Код, що виконується перед кожним тест-кейсом набору (функції під тестом, фікстури). */
  setupCode: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** Тест-кейс: тіло тесту на JavaScript з перевірками expect(). */
export interface TestCase {
  id: string;
  suiteId: string;
  title: string;
  description: string;
  priority: Priority;
  code: string;
  timeoutMs: number;
  enabled: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** Стан окремого тест-кейсу в межах прогону. */
export type ResultStatus =
  | 'queued'
  | 'running'
  | 'passed'
  | 'failed'
  | 'error'
  | 'timeout'
  | 'skipped'
  | 'cancelled';

/** Підсумковий стан прогону. */
export type RunStatus = 'running' | 'passed' | 'failed' | 'cancelled';

export type RunScope = 'all' | 'suite' | 'case' | 'selection' | 'rerun';

export interface CaseResult {
  caseId: string;
  caseTitle: string;
  suiteId: string;
  suiteName: string;
  priority: Priority;
  status: ResultStatus;
  durationMs?: number;
  assertions: number;
  error?: string;
  logs: string[];
}

export interface Run {
  id: string;
  title: string;
  scope: RunScope;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  triggeredBy: string;
  environment: string;
  results: CaseResult[];
}

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemeMode;
  defaultTimeoutMs: number;
  concurrency: number;
  stopOnFirstFailure: boolean;
  historyLimit: number;
}

export interface Workspace {
  version: 1;
  suites: Suite[];
  cases: TestCase[];
  runs: Run[];
  settings: Settings;
}

/** Результат виконання коду тесту (повертає виконавець у Web Worker). */
export interface ExecOutcome {
  status: 'passed' | 'failed' | 'error';
  assertions: number;
  error?: string;
  logs: string[];
  durationMs: number;
}
