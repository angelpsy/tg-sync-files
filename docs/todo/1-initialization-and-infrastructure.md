# 1. Инициализация и инфраструктура

## 1.1. Настройка проекта и репозитория
- [x] Создать Git-репозиторий с .gitignore (Node.js, Next.js, .env)
- [x] Монорепозиторий: pnpm workspaces (root package.json + workspaces backend, frontend); root-скрипты делегируют сервисные
- [ ] Создать структуру папок:
  - [x] `/backend` — core сервисы, WebSocket сервер (отдельный процесс)
  - [x] `/frontend` — Next.js приложение + API Routes (BFF для REST)  
  - [x] `/docs` — документация (уже есть)
  - [x] `/.env.example` — пример переменных окружения
  - [ ] `/docker-compose.yml` — для PostgreSQL, backend WebSocket, frontend BFF
  - [ ] `/eslint-configs/` — shared конфигурации линтеров (опционально)
-  - [ ] Удалить `/eslint-configs/`, корневой `.eslintrc.js` покрывает все сервисы
- [ ] Создать базовые конфигурационные файлы:
  - [ ] `.eslintrc.js` — базовый ESLint конфиг для всего проекта
  - [ ] `.prettierrc` — единый Prettier конфиг
  - [ ] `.editorconfig` — настройки редактора
  - [ ] `commitlint.config.js` — правила для conventional commits
  - [ ] `.husky/` — папка с git hooks
  - [ ] `.eslintrc.js` в корне должен покрывать весь проект; отдельного `eslint-configs` не нужно
- [ ] Definition of Done: репозиторий и структура созданы, все базовые конфиги присутствуют и проходят начальную валидацию

## 1.2. Настройка окружения и переменных
- [ ] Создать `.env.example` с переменными:
  - [ ] `DATABASE_URL` — строка подключения к PostgreSQL
  - [ ] `TELEGRAM_API_ID` — API ID из my.telegram.org
  - [ ] `TELEGRAM_API_HASH` — API Hash из my.telegram.org
  - [ ] `TELEGRAM_CHANNEL_IDS` — JSON массив ID каналов
  - [ ] `WATCH_DIR` — базовая директория для сканирования
  - [ ] `BACKEND_WS_PORT` — порт backend WebSocket сервера (по умолчанию 4000)
  - [ ] `FRONTEND_PORT` — порт frontend сервера (по умолчанию 3000)
  - [ ] `WS_ENDPOINT` — URL для подключения к WebSocket серверу (ws://localhost:4000)
  - [ ] Использовать `dotenv-schema` для валидации `.env` (схема `env.schema.json`)
  - [ ] `TELEGRAM_CHANNEL_IDS` передается как строка с запятыми, а не JSON-массив
- [ ] Definition of Done: `.env.example` готов и переменные загружаются в приложение без ошибок

## 1.3. Docker и контейнеризация
- [ ] Написать `docker-compose.yml` с сервисами:
  - [ ] PostgreSQL (версия 15, переменные окружения, volume для данных)
  - [ ] Backend WebSocket (Node.js, Dockerfile, отдельный процесс на порту 4000)
  - [ ] Frontend + BFF (Next.js, Dockerfile, REST API Routes на порту 3000)
  -   - [ ] Использовать default bridge сеть и прямой маппинг портов 3000, 4000 (без custom network)
- [ ] Создать `Dockerfile` для backend:
  - [ ] Node.js образ, установка зависимостей, копирование кода
  - [ ] Команда запуска WebSocket сервера (`npm run start:ws`)
  - [ ] Экспорт handlers как npm пакет для frontend
- [ ] Создать `Dockerfile` для frontend:
  - [ ] Node.js образ, установка зависимостей backend и frontend
  - [ ] Сборка Next.js с включёнными API Routes
  - [ ] Команда запуска Next.js сервера (только BFF API, без WebSocket)
- [ ] Definition of Done: `docker-compose up` запускает все контейнеры без ошибок

## 1.4. Node.js и TypeScript
- [ ] Создать `.nvmrc` с Node.js версии 24+
- [ ] Настроить `tsconfig.base.json` в корне (target ES2024, модуль CommonJS для Node, ESNext для браузера)
- [ ] Установить последнюю версию TypeScript в корне и в сервисах
- [ ] Definition of Done: `nvm use`, `tsc --noEmit` проходят без ошибок для Node и браузерной конфигурации
