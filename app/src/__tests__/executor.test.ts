import { executeTest } from '../lib/executor';

describe('executeTest - виконання коду тест-кейсу', () => {
  it('успішний тест повертає passed і кількість перевірок', async () => {
    const r = await executeTest('expect(sum(2, 3)).toBe(5); expect(sum(0, 0)).toBe(0);', 'const sum = (a, b) => a + b;');
    expect(r.status).toBe('passed');
    expect(r.assertions).toBe(2);
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('невдала перевірка дає статус failed з повідомленням', async () => {
    const r = await executeTest('expect(1 + 1).toBe(3);');
    expect(r.status).toBe('failed');
    expect(r.error).toContain('Очікувалось: 3');
  });

  it('виняток у коді дає статус error', async () => {
    const r = await executeTest('null.x; expect(1).toBe(1);');
    expect(r.status).toBe('error');
    expect(r.error).toMatch(/TypeError/);
  });

  it('синтаксична помилка розпізнається до виконання', async () => {
    const r = await executeTest('expect(1).toBe(1');
    expect(r.status).toBe('error');
    expect(r.error).toContain('Синтаксична помилка');
  });

  it('тест без жодної перевірки вважається невдалим', async () => {
    const r = await executeTest('const a = 1;');
    expect(r.status).toBe('failed');
    expect(r.error).toContain('expect');
  });

  it('підтримує async/await', async () => {
    const r = await executeTest('const v = await new Promise((r) => setTimeout(() => r(7), 5)); expect(v).toBe(7);');
    expect(r.status).toBe('passed');
  });

  it('перехоплює console.log у журнал тесту', async () => {
    const r = await executeTest('console.log("крок", 1, { a: 2 }); console.warn("увага"); expect(true).toBeTruthy();');
    expect(r.logs).toEqual(['крок 1 {a: 2}', '[warn] увага']);
  });

  it('затіняє небезпечні глобальні обʼєкти (window, document, fetch, localStorage)', async () => {
    const r = await executeTest(
      'expect(typeof window).toBe("undefined"); expect(typeof document).toBe("undefined"); expect(typeof fetch).toBe("undefined"); expect(typeof localStorage).toBe("undefined");',
    );
    expect(r.status).toBe('passed');
  });

  it('працює в суворому режимі (strict mode)', async () => {
    const r = await executeTest('undeclaredVar = 5; expect(1).toBe(1);');
    expect(r.status).toBe('error');
    expect(r.error).toMatch(/ReferenceError/);
  });
});
