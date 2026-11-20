import type { CaseResult, Priority, ResultStatus, Run, Settings, Suite, TestCase, Workspace } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  defaultTimeoutMs: 2000,
  concurrency: 2,
  stopOnFirstFailure: false,
  historyLimit: 100,
};

interface SeedCase {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  code: string;
  timeoutMs?: number;
  tags?: string[];
  /** Для генерації історії: ймовірність падіння в минулих прогонах. */
  failRate?: number;
  failStatus?: ResultStatus;
}

interface SeedSuite {
  id: string;
  name: string;
  description: string;
  tags: string[];
  setupCode: string;
  cases: SeedCase[];
}

const SUITES: SeedSuite[] = [
  {
    id: 'suite_strings',
    name: 'Утиліти рядків',
    description: 'Модульні тести допоміжних функцій обробки тексту: slugify, capitalize, truncate.',
    tags: ['unit', 'utils'],
    setupCode: `// Код, що тестується (system under test)
function slugify(text) {
  return text.toLowerCase().trim()
    .replace(/[^a-z0-9\\s-]/g, '')
    .replace(/[\\s-]+/g, '-')
    .replace(/^-|-$/g, '');
}
function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}
function truncate(s, max) {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}
function isPalindrome(s) {
  const clean = s.toLowerCase().replace(/[^a-zа-яіїєґ0-9]/g, '');
  return clean === [...clean].reverse().join('');
}`,
    cases: [
      {
        id: 'case_slug',
        title: 'slugify формує URL-сумісний рядок',
        description: 'Пробіли замінюються дефісами, спецсимволи видаляються.',
        priority: 'high',
        code: `expect(slugify('Hello World')).toBe('hello-world');
expect(slugify('  Test  Automation 2026! ')).toBe('test-automation-2026');
expect(slugify('a--b')).toBe('a-b');`,
        tags: ['smoke'],
      },
      {
        id: 'case_cap',
        title: 'capitalize робить першу літеру великою',
        description: '',
        priority: 'medium',
        code: `expect(capitalize('frontend')).toBe('Frontend');
expect(capitalize('')).toBe('');`,
      },
      {
        id: 'case_trunc',
        title: 'truncate обрізає довгий текст',
        description: 'Довжина результату не перевищує ліміт.',
        priority: 'low',
        code: `const out = truncate('Автоматизація тестування', 10);
expect(out).toHaveLength(10);
expect(out.endsWith('…')).toBeTruthy();
expect(truncate('Коротко', 20)).toBe('Коротко');`,
      },
      {
        id: 'case_pal',
        title: 'isPalindrome розпізнає паліндроми',
        description: '',
        priority: 'low',
        code: `expect(isPalindrome('Козак з казок')).toBe(true);
expect(isPalindrome('React')).toBe(false);
console.log('Перевірено 2 рядки');`,
      },
    ],
  },
  {
    id: 'suite_cart',
    name: 'Кошик інтернет-магазину',
    description: 'Бізнес-логіка кошика: сума, знижки, форматування ціни. Містить навмисну помилку у межовому значенні знижки.',
    tags: ['unit', 'business'],
    setupCode: `function createCart() { return { items: [] }; }
function addItem(cart, item) {
  if (item.qty <= 0) throw new RangeError('Кількість має бути додатною');
  const found = cart.items.find((i) => i.id === item.id);
  if (found) found.qty += item.qty; else cart.items.push({ ...item });
  return cart;
}
function subtotal(cart) {
  return cart.items.reduce((s, i) => s + i.price * i.qty, 0);
}
// Знижка 10% для замовлень від 1000 грн включно
function total(cart) {
  const sum = subtotal(cart);
  return sum > 1000 ? Math.round(sum * 0.9 * 100) / 100 : sum; // BUG: має бути >=
}
function formatPrice(v) {
  return v.toFixed(2).replace('.', ',') + ' грн';
}`,
    cases: [
      {
        id: 'case_cart_add',
        title: 'Додавання товару збільшує кількість',
        description: 'Повторне додавання того самого товару об’єднує позиції.',
        priority: 'critical',
        code: `const cart = createCart();
addItem(cart, { id: 1, price: 200, qty: 1 });
addItem(cart, { id: 1, price: 200, qty: 2 });
expect(cart.items).toHaveLength(1);
expect(cart.items[0].qty).toBe(3);`,
        tags: ['smoke'],
      },
      {
        id: 'case_cart_sum',
        title: 'Підсумкова сума без знижки',
        description: '',
        priority: 'high',
        code: `const cart = createCart();
addItem(cart, { id: 1, price: 150.5, qty: 2 });
addItem(cart, { id: 2, price: 99, qty: 1 });
expect(subtotal(cart)).toBeCloseTo(400);
expect(total(cart)).toBeCloseTo(400);`,
      },
      {
        id: 'case_cart_disc',
        title: 'Знижка 10% для замовлення рівно 1000 грн',
        description: 'Межове значення: знижка має застосовуватись і при сумі 1000 грн. Виявляє дефект у функції total().',
        priority: 'critical',
        code: `const cart = createCart();
addItem(cart, { id: 7, price: 500, qty: 2 });
expect(total(cart)).toBe(900);`,
        failRate: 1,
        failStatus: 'failed',
        tags: ['boundary'],
      },
      {
        id: 'case_cart_neg',
        title: 'Від’ємна кількість генерує виключення',
        description: '',
        priority: 'medium',
        code: `const cart = createCart();
expect(() => addItem(cart, { id: 3, price: 10, qty: -1 })).toThrow(RangeError);
expect(() => addItem(cart, { id: 3, price: 10, qty: 0 })).toThrow('додатною');`,
      },
      {
        id: 'case_cart_fmt',
        title: 'Форматування ціни у гривнях',
        description: '',
        priority: 'low',
        code: `expect(formatPrice(1234.5)).toBe('1234,50 грн');
expect(formatPrice(0)).toMatch(/^0,00/);`,
      },
    ],
  },
  {
    id: 'suite_forms',
    name: 'Валідація форм',
    description: 'Перевірка правил валідації полів реєстрації: email, пароль, телефон.',
    tags: ['unit', 'validation'],
    setupCode: `const isEmail = (v) => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(v);
const isStrongPassword = (v) =>
  v.length >= 8 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /\\d/.test(v) && /[^A-Za-z0-9]/.test(v);
// Український номер: +380XXXXXXXXX
const isPhoneUA = (v) => /^\\+380\\d{9}$/.test(v);`,
    cases: [
      {
        id: 'case_email',
        title: 'Коректні та некоректні email',
        description: '',
        priority: 'high',
        code: `for (const ok of ['user@knu.ua', 'a.b@mail.com']) expect(isEmail(ok)).toBe(true);
for (const bad of ['user@', '@knu.ua', 'user knu@ua.com', 'a@b.c']) expect(isEmail(bad)).toBe(false);`,
        tags: ['smoke'],
      },
      {
        id: 'case_pass',
        title: 'Політика надійного пароля',
        description: 'Мінімум 8 символів, великі й малі літери, цифра та спецсимвол.',
        priority: 'critical',
        code: `expect(isStrongPassword('Qwerty#2026')).toBe(true);
expect(isStrongPassword('qwerty')).toBe(false);
expect(isStrongPassword('NoDigits!!')).toBe(false);`,
      },
      {
        id: 'case_phone',
        title: 'Телефон з пробілами вважається коректним',
        description: 'Вимога: користувач може вводити номер з пробілами. Тест виявляє невідповідність реалізації вимозі.',
        priority: 'medium',
        code: `expect(isPhoneUA('+380501234567')).toBe(true);
expect(isPhoneUA('+380 50 123 45 67')).toBe(true);`,
        failRate: 0.85,
        failStatus: 'failed',
      },
    ],
  },
  {
    id: 'suite_async',
    name: 'Асинхронні операції та API-моки',
    description: 'Тести промісів, затримок і обробки помилок мок-сервісу. Демонструють тайм-аут і нестабільний (flaky) тест.',
    tags: ['integration', 'async'],
    setupCode: `const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const api = {
  async getUser(id) {
    await delay(30);
    if (id <= 0) throw new Error('404: користувача не знайдено');
    return { id, name: 'User ' + id, active: true };
  },
  async slowReport() { await delay(3000); return { ready: true }; },
  async unstable() { await delay(20); return Math.random() > 0.3 ? 'ok' : 'fail'; },
};`,
    cases: [
      {
        id: 'case_api_user',
        title: 'Отримання користувача за id',
        description: '',
        priority: 'high',
        code: `const user = await api.getUser(5);
expect(user).toEqual({ id: 5, name: 'User 5', active: true });
expect(user).toHaveProperty('active', true);`,
        tags: ['smoke'],
      },
      {
        id: 'case_api_404',
        title: 'Помилка 404 для неіснуючого користувача',
        description: '',
        priority: 'medium',
        code: `await expect(api.getUser(0)).rejects.toThrow('404');`,
      },
      {
        id: 'case_api_slow',
        title: 'Звіт формується не довше 1,5 с',
        description: 'Нефункціональна вимога до швидкодії. Тайм-аут тест-кейсу 1500 мс.',
        priority: 'high',
        code: `const report = await api.slowReport();
expect(report.ready).toBe(true);`,
        timeoutMs: 1500,
        failRate: 1,
        failStatus: 'timeout',
        tags: ['performance'],
      },
      {
        id: 'case_api_flaky',
        title: 'Нестабільний сервіс повертає ok',
        description: 'Навмисно нестабільний тест (≈30% падінь) для демонстрації виявлення flaky-тестів.',
        priority: 'low',
        code: `const res = await api.unstable();
expect(res).toBe('ok');`,
        failRate: 0.3,
        failStatus: 'failed',
        tags: ['flaky'],
      },
    ],
  },
];

/** Детермінований генератор псевдовипадкових чисел (mulberry32). */
export function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ERRORS: Record<string, string> = {
  case_cart_disc: 'expect(отримане).toBe(900)\nОчікувалось: 900\nОтримано: 1000',
  case_phone: 'expect(отримане).toBe(true)\nОчікувалось: true\nОтримано: false',
  case_api_slow: 'Перевищено тайм-аут 1500 мс. Виконання тесту примусово зупинено.',
  case_api_flaky: 'expect(отримане).toBe("ok")\nОчікувалось: "ok"\nОтримано: "fail"',
};

function buildHistory(suites: Suite[], cases: TestCase[], now: number): Run[] {
  const rnd = prng(2026);
  const runs: Run[] = [];
  const seedCases = SUITES.flatMap((s) => s.cases);
  const users = ['admin', 'tester', 'tester', 'admin'];
  const envs = ['Chrome 131', 'Edge 131', 'Firefox 133', 'Chrome 131'];
  const total = 16;
  for (let i = 0; i < total; i++) {
    const daysAgo = Math.round(((total - i) * 20) / total);
    const started = now - daysAgo * 86_400_000 - Math.floor(rnd() * 8) * 3_600_000 - 3_600_000;
    // Дефект у кошику "з'явився" на 6-му прогоні, вимога до телефону - на 9-му.
    const results: CaseResult[] = cases.map((c) => {
      const sc = seedCases.find((x) => x.id === c.id)!;
      const suite = suites.find((s) => s.id === c.suiteId)!;
      let status: ResultStatus = 'passed';
      const activeFrom = c.id === 'case_cart_disc' ? 5 : c.id === 'case_phone' ? 8 : 0;
      if (sc.failRate && i >= activeFrom && rnd() < sc.failRate) status = sc.failStatus ?? 'failed';
      const durationMs =
        status === 'timeout' ? c.timeoutMs : Math.round((c.suiteId === 'suite_async' ? 25 + rnd() * 40 : 0.4 + rnd() * 3) * 100) / 100;
      return {
        caseId: c.id,
        caseTitle: c.title,
        suiteId: suite.id,
        suiteName: suite.name,
        priority: c.priority,
        status,
        durationMs,
        assertions: status === 'timeout' ? 0 : Math.max(1, (c.code.match(/expect\(/g) ?? []).length),
        error: status === 'passed' ? undefined : ERRORS[c.id],
        logs: c.id === 'case_pal' ? ['Перевірено 2 рядки'] : [],
      };
    });
    const failed = results.some((r) => r.status !== 'passed');
    const duration = results.reduce((s, r) => s + (r.durationMs ?? 0), 0);
    runs.push({
      id: `run_seed_${String(i + 1).padStart(2, '0')}`,
      title: i % 4 === 3 ? 'Регресійний прогін (нічний)' : 'Повний прогін усіх наборів',
      scope: 'all',
      status: failed ? 'failed' : 'passed',
      startedAt: new Date(started).toISOString(),
      finishedAt: new Date(started + duration + 400).toISOString(),
      triggeredBy: users[i % users.length],
      environment: envs[i % envs.length],
      results,
    });
  }
  return runs.reverse();
}

/** Демонстраційний робочий простір: 4 набори, 16 тест-кейсів, історія прогонів. */
export function createSeedWorkspace(now = Date.now()): Workspace {
  const created = new Date(now - 25 * 86_400_000).toISOString();
  const suites: Suite[] = SUITES.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    tags: s.tags,
    setupCode: s.setupCode,
    createdAt: created,
    updatedAt: created,
  }));
  const cases: TestCase[] = SUITES.flatMap((s) =>
    s.cases.map((c) => ({
      id: c.id,
      suiteId: s.id,
      title: c.title,
      description: c.description,
      priority: c.priority,
      code: c.code,
      timeoutMs: c.timeoutMs ?? DEFAULT_SETTINGS.defaultTimeoutMs,
      enabled: true,
      tags: c.tags ?? [],
      createdAt: created,
      updatedAt: created,
    })),
  );
  return { version: 1, suites, cases, runs: buildHistory(suites, cases, now), settings: { ...DEFAULT_SETTINGS } };
}
