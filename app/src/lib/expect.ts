/**
 * Мінімальна бібліотека перевірок у стилі Jest/Vitest.
 * Використовується всередині ізольованого Web Worker для виконання тест-кейсів.
 */

export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}

/** Компактне текстове представлення значення для повідомлень про помилки. */
export function stringify(value: unknown, depth = 0): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : String(value);
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  if (typeof value === 'symbol') return value.toString();
  if (typeof value !== 'object') return String(value);
  if (depth > 3) return Array.isArray(value) ? '[...]' : '{...}';
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (value instanceof Date) return `Date(${isNaN(value.getTime()) ? 'Invalid' : value.toISOString()})`;
  if (value instanceof RegExp) return value.toString();
  if (value instanceof Map) {
    return `Map{${[...value.entries()].map(([k, v]) => `${stringify(k, depth + 1)} => ${stringify(v, depth + 1)}`).join(', ')}}`;
  }
  if (value instanceof Set) {
    return `Set{${[...value].map((v) => stringify(v, depth + 1)).join(', ')}}`;
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, 20).map((v) => stringify(v, depth + 1));
    if (value.length > 20) items.push(`... ще ${value.length - 20}`);
    return `[${items.join(', ')}]`;
  }
  const entries = Object.keys(value as object)
    .slice(0, 20)
    .map((k) => `${k}: ${stringify((value as Record<string, unknown>)[k], depth + 1)}`);
  return `{${entries.join(', ')}}`;
}

/** Глибоке структурне порівняння (аналог toEqual). */
export function deepEqual(a: unknown, b: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (typeof a !== 'object') return false;

  const objA = a as object;
  const objB = b as object;
  if (seen.get(objA) === objB) return true;
  seen.set(objA, objB);

  if (Object.getPrototypeOf(objA) !== Object.getPrototypeOf(objB)) return false;
  if (objA instanceof Date) return objA.getTime() === (objB as Date).getTime();
  if (objA instanceof RegExp) return objA.toString() === (objB as RegExp).toString();
  if (objA instanceof Map) {
    const mb = objB as Map<unknown, unknown>;
    if (objA.size !== mb.size) return false;
    for (const [k, v] of objA) {
      if (!mb.has(k) || !deepEqual(v, mb.get(k), seen)) return false;
    }
    return true;
  }
  if (objA instanceof Set) {
    const sb = objB as Set<unknown>;
    if (objA.size !== sb.size) return false;
    for (const v of objA) if (!sb.has(v)) return false;
    return true;
  }
  if (Array.isArray(objA)) {
    const arrB = objB as unknown[];
    if (objA.length !== arrB.length) return false;
    return objA.every((v, i) => deepEqual(v, arrB[i], seen));
  }
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(
    (k) =>
      Object.prototype.hasOwnProperty.call(objB, k) &&
      deepEqual((objA as Record<string, unknown>)[k], (objB as Record<string, unknown>)[k], seen),
  );
}

type MatcherResult = { pass: boolean; message: string };
type MatcherFn = (received: unknown, ...args: unknown[]) => MatcherResult;

const matchers = {
  toBe: (r, e) => ({
    pass: Object.is(r, e),
    message: `Очікувалось: ${stringify(e)}\nОтримано: ${stringify(r)}`,
  }),
  toEqual: (r, e) => ({
    pass: deepEqual(r, e),
    message: `Очікувалось (структурно): ${stringify(e)}\nОтримано: ${stringify(r)}`,
  }),
  toBeTruthy: (r) => ({ pass: Boolean(r), message: `Очікувалось істинне значення, отримано ${stringify(r)}` }),
  toBeFalsy: (r) => ({ pass: !r, message: `Очікувалось хибне значення, отримано ${stringify(r)}` }),
  toBeNull: (r) => ({ pass: r === null, message: `Очікувалось null, отримано ${stringify(r)}` }),
  toBeUndefined: (r) => ({ pass: r === undefined, message: `Очікувалось undefined, отримано ${stringify(r)}` }),
  toBeDefined: (r) => ({ pass: r !== undefined, message: `Очікувалось визначене значення, отримано undefined` }),
  toBeNaN: (r) => ({ pass: Number.isNaN(r), message: `Очікувалось NaN, отримано ${stringify(r)}` }),
  toBeGreaterThan: (r, e) => ({
    pass: (r as number) > (e as number),
    message: `Очікувалось > ${stringify(e)}, отримано ${stringify(r)}`,
  }),
  toBeGreaterThanOrEqual: (r, e) => ({
    pass: (r as number) >= (e as number),
    message: `Очікувалось >= ${stringify(e)}, отримано ${stringify(r)}`,
  }),
  toBeLessThan: (r, e) => ({
    pass: (r as number) < (e as number),
    message: `Очікувалось < ${stringify(e)}, отримано ${stringify(r)}`,
  }),
  toBeLessThanOrEqual: (r, e) => ({
    pass: (r as number) <= (e as number),
    message: `Очікувалось <= ${stringify(e)}, отримано ${stringify(r)}`,
  }),
  toBeCloseTo: (r, e, digits = 2) => {
    const precision = 10 ** -(digits as number) / 2;
    return {
      pass: Math.abs((r as number) - (e as number)) < precision,
      message: `Очікувалось ≈ ${stringify(e)} (точність ${digits} знаки), отримано ${stringify(r)}`,
    };
  },
  toContain: (r, e) => {
    const pass =
      typeof r === 'string'
        ? r.includes(String(e))
        : Array.isArray(r) || r instanceof Set
          ? [...(r as Iterable<unknown>)].includes(e)
          : false;
    return { pass, message: `Очікувалось, що ${stringify(r)} містить ${stringify(e)}` };
  },
  toHaveLength: (r, e) => {
    const len = (r as { length?: number } | null)?.length;
    return { pass: len === e, message: `Очікувана довжина ${stringify(e)}, фактична ${stringify(len)}` };
  },
  toHaveProperty: function (r: unknown, key: unknown, value?: unknown) {
    const path = String(key).split('.');
    let cur: unknown = r;
    let exists = true;
    for (const p of path) {
      if (cur !== null && typeof cur === 'object' && p in (cur as object)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        exists = false;
        break;
      }
    }
    // Третій аргумент передається лише коли його вказали явно.
    const checkValue = arguments.length > 2;
    const pass = exists && (!checkValue || deepEqual(cur, value));
    return {
      pass,
      message: checkValue
        ? `Очікувалась властивість "${key}" = ${stringify(value)}, отримано ${exists ? stringify(cur) : 'відсутня'}`
        : `Очікувалась наявність властивості "${key}" у ${stringify(r)}`,
    };
  },
  toMatch: (r, e) => {
    const re = e instanceof RegExp ? e : new RegExp(String(e));
    return { pass: typeof r === 'string' && re.test(r), message: `Очікувалось, що ${stringify(r)} відповідає ${re}` };
  },
  toBeInstanceOf: (r, e) => ({
    pass: typeof e === 'function' && r instanceof (e as new () => unknown),
    message: `Очікувався екземпляр ${(e as { name?: string })?.name ?? stringify(e)}, отримано ${stringify(r)}`,
  }),
  toThrow: (r, e?) => {
    if (typeof r !== 'function') {
      return { pass: false, message: 'toThrow() очікує функцію, наприклад expect(() => fn()).toThrow()' };
    }
    let thrown: unknown;
    let didThrow = false;
    try {
      (r as () => unknown)();
    } catch (err) {
      didThrow = true;
      thrown = err;
    }
    if (!didThrow) return { pass: false, message: 'Очікувалось, що функція згенерує виключення, але цього не сталося' };
    if (e === undefined) return { pass: true, message: `Функція згенерувала ${stringify(thrown)}` };
    const msg = thrown instanceof Error ? thrown.message : String(thrown);
    const pass =
      e instanceof RegExp ? e.test(msg) : typeof e === 'function' ? thrown instanceof (e as new () => unknown) : msg.includes(String(e));
    return { pass, message: `Очікувалось виключення ${stringify(e)}, отримано ${stringify(thrown)}` };
  },
} satisfies Record<string, MatcherFn>;

type MatcherName = keyof typeof matchers;

export type Matchers = {
  [K in MatcherName]: (...args: unknown[]) => void;
};

export interface Expectation extends Matchers {
  not: Matchers;
  resolves: { [K in MatcherName]: (...args: unknown[]) => Promise<void> };
  rejects: { toThrow: (expected?: unknown) => Promise<void> };
}

export const MATCHER_NAMES = Object.keys(matchers) as MatcherName[];

/** Створює функцію expect() з лічильником перевірок (окремий для кожного тесту). */
export function createExpect() {
  let assertions = 0;

  function build(received: unknown, negate: boolean): Matchers {
    const api = {} as Matchers;
    for (const name of MATCHER_NAMES) {
      api[name] = (...args: unknown[]) => {
        assertions += 1;
        const { pass, message } = (matchers[name] as MatcherFn).apply(null, [received, ...args]);
        if (pass === negate) {
          const header = `expect(отримане)${negate ? '.not' : ''}.${name}(${args.map((a) => stringify(a)).join(', ')})`;
          throw new AssertionError(negate ? `${header}\nПеревірка мала НЕ виконатись. ${message}` : `${header}\n${message}`);
        }
      };
    }
    return api;
  }

  function expect(received: unknown): Expectation {
    const e = build(received, false) as Expectation;
    e.not = build(received, true);
    const resolves = {} as Expectation['resolves'];
    for (const name of MATCHER_NAMES) {
      resolves[name] = async (...args: unknown[]) => {
        const value = await (received as Promise<unknown>);
        build(value, false)[name](...args);
      };
    }
    e.resolves = resolves;
    e.rejects = {
      toThrow: async (expected?: unknown) => {
        assertions += 1;
        try {
          await (received as Promise<unknown>);
        } catch (err) {
          if (expected === undefined) return;
          const msg = err instanceof Error ? err.message : String(err);
          const ok = expected instanceof RegExp ? expected.test(msg) : msg.includes(String(expected));
          if (!ok) throw new AssertionError(`Очікувалось відхилення з ${stringify(expected)}, отримано ${stringify(err)}`);
          return;
        }
        throw new AssertionError('Очікувалось, що проміс буде відхилено, але він виконався успішно');
      },
    };
    return e;
  }

  return { expect, getAssertions: () => assertions };
}
