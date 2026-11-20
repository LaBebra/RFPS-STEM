# AutoQA Lab

Веб-застосунок для автоматизації тестування програмного забезпечення (фронтенд складова).
Індивідуальний STEM-проєкт з ОК «Розробник фронтенду програмних систем».

Виконав: Марчук Михайло, група ІПЗ-33, ФІТ КНУ імені Тараса Шевченка, 2026.

## Можливості

- вхід із перевіркою облікових даних (солені SHA-256 хеші), блокування після 5 невдалих спроб, сесія з обмеженим строком дії;
- ролі: адміністратор, тестувальник, спостерігач (RBAC);
- тестові набори з кодом підготовки (system under test) і тест-кейси на JavaScript з перевірками `expect()` у стилі Jest;
- реальне виконання тестів у браузері: кожен тест працює в окремому Web Worker з тайм-аутом, скасуванням і пулом паралельних виконавців;
- live-прогрес прогону, журнал прогонів із пошуком, фільтрами за статусом, набором і датами, сортуванням і пагінацією;
- дашборд: KPI, графік динаміки успішності, кільцева та стовпчикова діаграми (Recharts), рейтинг проблемних і нестабільних (flaky) тестів;
- експорт звітів HTML, CSV, JSON; експорт та імпорт робочого простору;
- адаптивна верстка (десктоп, планшет, телефон), світла й темна теми, доступність (клавіатура, ARIA, `prefers-reduced-motion`).

## Технології

React 18, TypeScript 5, Vite 5, React Router 6, Zustand 4, Recharts 2, Vitest 2 + Testing Library, Puppeteer (E2E), Autoprefixer.

## Запуск

```bash
npm install
npm run dev        # режим розробки, http://localhost:5173
npm run build      # production-збірка в dist/
npm run preview    # перегляд збірки, http://localhost:4173
```

Демонстраційні облікові записи:

| Логін | Пароль | Роль |
|---|---|---|
| admin | Admin#2026 | Адміністратор |
| tester | Tester#2026 | Тестувальник |
| guest | Guest#2026 | Спостерігач |

## Тестування

```bash
npm test           # 76 модульних і компонентних тестів (Vitest)
npm run coverage   # звіт покриття коду
npm run build && npm run preview   # в окремому терміналі
npm run e2e        # 37 наскрізних перевірок у headless Microsoft Edge + скріншоти
```

Для E2E потрібен встановлений Microsoft Edge (шлях задається змінною `EDGE_PATH`).

## Структура

```
src/
  lib/          бізнес-логіка: expect, executor, runner (+ worker), stats, export, validate, auth, seed
  store/        стан (Zustand): робочий простір, автентифікація, сповіщення, запуск прогонів
  components/   Layout, Modal, RunControl, StatusBadge, CodeEditor, форми
  pages/        Login, Dashboard, Suites, SuiteDetail, Runs, RunDetail, Settings, NotFound
  styles/       global.css (дизайн-токени, адаптивність, темна тема)
  __tests__/    модульні та компонентні тести
scripts/e2e.mjs наскрізний сценарій перевірки
```
