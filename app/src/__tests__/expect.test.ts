import { AssertionError, createExpect, deepEqual, stringify } from '../lib/expect';

describe('deepEqual', () => {
  it('порівнює примітиви та NaN', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual(NaN, NaN)).toBe(true);
    expect(deepEqual('a', 'b')).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
  });

  it('порівнює вкладені обʼєкти й масиви', () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });

  it('підтримує Date, Map, Set та циклічні посилання', () => {
    expect(deepEqual(new Date(5), new Date(5))).toBe(true);
    expect(deepEqual(new Map([[1, 'a']]), new Map([[1, 'a']]))).toBe(true);
    expect(deepEqual(new Set([1, 2]), new Set([2, 3]))).toBe(false);
    const a: Record<string, unknown> = { x: 1 };
    a.self = a;
    const b: Record<string, unknown> = { x: 1 };
    b.self = b;
    expect(deepEqual(a, b)).toBe(true);
  });
});

describe('stringify', () => {
  it('форматує різні типи значень', () => {
    expect(stringify('hi')).toBe('"hi"');
    expect(stringify(undefined)).toBe('undefined');
    expect(stringify([1, 'a'])).toBe('[1, "a"]');
    expect(stringify({ a: 1 })).toBe('{a: 1}');
    expect(stringify(new Error('boom'))).toBe('Error: boom');
    expect(stringify(() => 1)).toContain('Function');
  });
});

describe('createExpect - матчери', () => {
  const { expect: e, getAssertions } = createExpect();

  it('успішні перевірки не генерують помилок і рахуються', () => {
    e(2 + 2).toBe(4);
    e({ a: [1] }).toEqual({ a: [1] });
    e([1, 2, 3]).toContain(2);
    e('frontend').toMatch(/end$/);
    e(0.1 + 0.2).toBeCloseTo(0.3);
    e([1, 2]).toHaveLength(2);
    e({ user: { id: 1 } }).toHaveProperty('user.id', 1);
    e(null).toBeNull();
    e(5).toBeGreaterThan(3);
    e(() => {
      throw new RangeError('погано');
    }).toThrow(RangeError);
    e(1).not.toBe(2);
    expect(getAssertions()).toBe(11);
  });

  it('невдала перевірка генерує AssertionError з поясненням', () => {
    try {
      e(6).toBe(5);
      throw new Error('не мало дійти сюди');
    } catch (err) {
      expect(err).toBeInstanceOf(AssertionError);
      expect((err as Error).message).toContain('Очікувалось: 5');
      expect((err as Error).message).toContain('Отримано: 6');
    }
  });

  it('not інвертує результат', () => {
    expect(() => e([1]).not.toContain(1)).toThrow(AssertionError);
  });

  it('toThrow без виключення - помилка', () => {
    expect(() => e(() => 1).toThrow()).toThrow(/не сталося/);
  });

  it('resolves та rejects працюють з промісами', async () => {
    await e(Promise.resolve(3)).resolves.toBe(3);
    await e(Promise.reject(new Error('404'))).rejects.toThrow('404');
    await expect(e(Promise.resolve(1)).rejects.toThrow()).rejects.toThrow(AssertionError);
  });
});
