# STEM-проєкт: AutoQA Lab

Тема: «Веб-застосунок для автоматизації тестування програмного забезпечення (Фронтенд складова)».
ОК «Розробник фронтенду програмних систем». Виконав: Марчук Михайло, ІПЗ-33, ФІТ КНУ імені Тараса Шевченка, 2026.

## Вміст каталогу

| Шлях | Що це |
|---|---|
| `SP_Front.pdf` | умова STEM-проєкту |
| `app/` | вихідний код застосунку (React + TypeScript + Vite), див. `app/README.md` |
| `Пояснювальна_записка_STEM_Марчук_ІПЗ-33.docx` | пояснювальна записка: проєктування (User Flow, діаграми станів), реалізація, керівництво користувача, висновки, джерела |
| `screenshots/` | скріншоти застосунку (E2E), `screenshots/diagrams/` - діаграми та каркаси екранів |
| `docs/diagrams/` | вихідні тексти діаграм (Mermaid), каркаси екранів (HTML), скрипт рендерингу |
| `docs/build_report.py` | генератор пояснювальної записки (python-docx) |
| `docs/render_console.mjs` | знімки консольного виводу тестів |
| `docs/test-logs/` | вивід модульних і E2E тестів |

## Швидкий запуск

```bash
cd app
npm install
npm run build
npm run preview    # http://localhost:4173, вхід: admin / Admin#2026
```

## Перегенерація документів

```bash
cd app && npm run coverage > ../docs/test-logs/test-output.txt
cd app && npm run e2e > ../docs/test-logs/e2e-output.txt     # потрібен запущений preview
node docs/diagrams/render.mjs <шлях до mermaid.min.js>
node docs/render_console.mjs
python docs/build_report.py
```

Зміст у записці заповнено з оцінкою номерів сторінок; після відкриття у Word його можна уточнити: клацнути по змісту і натиснути F9 («Оновити лише номери сторінок»).
