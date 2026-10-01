# mtch. MVP

mtch. — сервис обратного найма для ИТ: специалист публикует профиль, работодатель выбирает внутренний Search Profile, просматривает ранжированную ленту и первым отправляет предложение. После принятия создаётся Match и открываются контакты сторон.

## Стек

Next.js 16, React 19, TypeScript, PostgreSQL 16, Drizzle ORM и Better Auth. Приложение, миграции и demo seed запускаются через Docker Compose. Изображения хранятся в локальном Docker volume; основные данные — в PostgreSQL.

## Запуск через Docker

Нужны Docker Desktop или Docker Engine с Compose. Из корня проекта:

1. Скопируйте `.env.example` в `.env`.
2. Задайте случайные `POSTGRES_PASSWORD` и `BETTER_AUTH_SECRET` (не менее 32 символов). Укажите тот же пароль в `DATABASE_URL`, если планируете запускать команды с хоста. Не публикуйте `.env`.
3. Выполните `docker compose up --build -d`.
4. Откройте `http://localhost:3000` и проверьте `http://localhost:3000/api/v1/health` — ожидается `{"status":"ok","database":"ok"}`.

`DB_PORT` и `WEB_PORT` можно изменить, если порты заняты. При смене `WEB_PORT` обновите `BETTER_AUTH_URL` на фактический URL. При смене `DB_PORT` обновите хостовый `DATABASE_URL`. Внутри Compose приложение подключается к `db:5432` независимо от хостового порта.

Compose дожидается готовности PostgreSQL, применяет миграции, выполняет идемпотентный seed при `SEED_DEMO_DATA=true` и затем запускает приложение. Для запуска без demo-данных установите `SEED_DEMO_DATA=false`. Данные БД и медиа сохраняются в volumes `pgdata` и `media` после перезапуска контейнеров. Миграции хранятся в `drizzle/`.

## Demo-аккаунты

Seed создаёт 20 вымышленных специалистов (`specialist1@demo.mtch.test` … `specialist20@demo.mtch.test`), 4 вымышленные компании (`employer1@demo.mtch.test` … `employer4@demo.mtch.test`), 8 Search Profiles и 4 предложения. Пароль для всех demo-аккаунтов: `DemoPass123!`. Эти учётные данные предназначены только для локальной демонстрации. Для публичного размещения отключите demo seed или замените учётные данные.

## Локальная разработка

Нужны Node.js 22+ и запущенный PostgreSQL. Выполните `npm ci --legacy-peer-deps`, заполните `.env`, затем `npm run db:migrate`, `npm run db:seed` и `npm run dev`. Демо seed выполняется только при `SEED_DEMO_DATA=true`.

Проверки: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run smoke` (последняя команда требует работающий сервер и demo seed). Неизменяемость роли и условий предложения на живой БД проверяется командой `node --env-file-if-exists=.env --import tsx scripts/db-integrity.ts`. Для создания следующей миграции после изменения `src/db/schema.ts` используйте `npm run db:generate`; для ручного SQL — `npx drizzle-kit generate --custom --name=...`. Миграции применяются отдельно через `npm run db:migrate`.

## API и структура

Контракт эндпоинтов находится в [API.md](./API.md). Все бизнес-маршруты начинаются с `/api/v1`; health публичный, остальное требует сессии. Ошибки имеют структуру `{ "error": { "code", "message", "details" } }`.

- `src/app` — страницы и Route Handlers;
- `src/components` — интерфейс и клиентские API-вызовы;
- `src/server` — серверные правила, доступ, matching и файловое хранилище;
- `src/db` и `drizzle` — схема и миграции;
- `scripts` — запуск миграций, идемпотентный seed и API smoke.

Matching детерминирован: навыки 40, профессия 20, уровень 10, опыт 8, зарплата 8, формат 7, занятость 7. Стратегия выделена в `src/server/matching/scorer.ts` и может быть заменена позже. Для ФСП есть `FspProvider` и пустая реализация; интеграция добавляется после получения спецификации, без вымышленных достижений.

## Ограничения и публичный запуск

Загрузка PDF-резюме, AI matching, чат, уведомления и интеграция ФСП в базовый MVP не входят. Перед публичным размещением нужны сервер и домен, HTTPS/reverse proxy, резервное копирование volumes, новые секреты и отказ от известных demo-паролей. Публичный деплой из этого репозитория автоматически не выполняется.
