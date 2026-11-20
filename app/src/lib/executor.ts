import type { ExecOutcome } from '../types';
import { AssertionError, createExpect, stringify } from './expect';

const AsyncFunction = Object.getPrototypeOf(async function () {
  /* noop */
}).constructor as new (...args: string[]) => (...a: unknown[]) => Promise<unknown>;

/** Імена глобальних об'єктів, які затіняються всередині коду тесту. */
export const SHADOWED_GLOBALS = [
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'importScripts',
  'postMessage',
  'self',
  'parent',
  'top',
] as const;

const MAX_LOGS = 200;
const MAX_LOG_LEN = 2000;

function formatLog(level: string, args: unknown[]): string {
  const text = args.map((a) => (typeof a === 'string' ? a : stringify(a))).join(' ');
  const line = level === 'log' ? text : `[${level}] ${text}`;
  return line.length > MAX_LOG_LEN ? `${line.slice(0, MAX_LOG_LEN)}...` : line;
}

/**
 * Виконує тіло тест-кейсу разом із кодом підготовки набору.
 * Чиста функція без доступу до DOM: у браузері викликається всередині Web Worker,
 * у модульних тестах - напряму.
 */
export async function executeTest(code: string, setupCode = ''): Promise<ExecOutcome> {
  const logs: string[] = [];
  const push = (level: string) => (...args: unknown[]) => {
    if (logs.length < MAX_LOGS) logs.push(formatLog(level, args));
  };
  const sandboxConsole = Object.freeze({
    log: push('log'),
    info: push('info'),
    warn: push('warn'),
    error: push('error'),
    debug: push('debug'),
  });
  const { expect, getAssertions } = createExpect();
  const started = performance.now();
  const done = (status: ExecOutcome['status'], error?: string): ExecOutcome => ({
    status,
    error,
    logs,
    assertions: getAssertions(),
    durationMs: Math.round((performance.now() - started) * 100) / 100,
  });

  let fn: (...a: unknown[]) => Promise<unknown>;
  try {
    fn = new AsyncFunction(
      'expect',
      'console',
      ...SHADOWED_GLOBALS,
      `"use strict";\n${setupCode}\n;\n${code}\n`,
    );
  } catch (err) {
    return done('error', `Синтаксична помилка: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    await fn(expect, sandboxConsole, ...SHADOWED_GLOBALS.map(() => undefined));
  } catch (err) {
    if (err instanceof AssertionError) return done('failed', err.message);
    const message = err instanceof Error ? `${err.name}: ${err.message}` : `Виключення: ${stringify(err)}`;
    return done('error', message);
  }

  if (getAssertions() === 0) {
    return done('failed', 'Тест не містить жодної перевірки expect(). Додайте хоча б одну перевірку.');
  }
  return done('passed');
}
