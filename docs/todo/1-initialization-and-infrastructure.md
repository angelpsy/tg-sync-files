# 1. Инициализация и инфраструктура

## 1.1. Настройка проекта и репозитория

- [x] Создать Git-репозиторий с .gitignore (Node.js, Next.js, .env)
- [x] Монорепозиторий: pnpm workspaces (root package.json + workspaces backend,
      frontend); root-скрипты делегируют сервисные
- [x] Создать структуру папок:
  - [x] `/backend` — core сервисы, WebSocket сервер (отдельный процесс)
  - [x] `/frontend` — Next.js приложение + API Routes (BFF для REST)
  - [x] `/docs` — документация (уже есть)
  - [x] `/.env.example` — пример переменных окружения
  - [x] `/docker-compose.yml` — для SQLite, backend WebSocket, frontend BFF
  - [x] Next.js App Router структура инициализирована
  - [x] Tailwind CSS v4 настроен
  - [x] TypeScript конфигурация для frontend
- [x] Создать базовые конфигурационные файлы:
  - [x] `.eslintrc.js` — базовый ESLint конфиг для всего проекта
  - [x] `.prettierrc` — единый Prettier конфиг
  - [x] `.editorconfig` — настройки редактора
  - [x] `commitlint.config.js` — правила для conventional commits
  - [x] `.husky/` — папка с git hooks
  - [x] `.eslintrc.js` в корне должен покрывать весь проект; отдельного
        `eslint-configs` не нужно
- [x] Definition of Done: репозиторий и структура созданы, все базовые конфиги
      присутствуют и проходят начальную валидацию

## 1.2. Настройка окружения и переменных

- [x] Создать `.env.example` с переменными:
  - [x] `DATABASE_URL` — строка подключения к SQLite
  - [x] `TELEGRAM_API_ID` — API ID из my.telegram.org
  - [x] `TELEGRAM_API_HASH` — API Hash из my.telegram.org
  - [x] `TELEGRAM_CHANNEL_IDS` — JSON массив ID каналов
  - [x] `WATCH_DIR` — базовая директория для сканирования
  - [x] `BACKEND_WS_PORT` — порт backend WebSocket сервера (по умолчанию 4000)
  - [x] `FRONTEND_PORT` — порт frontend сервера (по умолчанию 3000)
  - [x] `WS_ENDPOINT` — URL для подключения к WebSocket серверу
        (ws://localhost:4000)
  - [ ] Использовать `dotenv-schema` для валидации `.env` (схема
        `env.schema.json`)
  - [x] `TELEGRAM_CHANNEL_IDS` передается как строка с запятыми, а не
        JSON-массив
- [x] Definition of Done: `.env.example` готов и переменные загружаются в
      приложение без ошибок

## 1.3. Docker и контейнеризация

- [x] Написать `docker-compose.yml` с сервисами:
  - [x] SQLite (файл БД и volume для данных)
  - [x] Backend WebSocket (Node.js, Dockerfile, отдельный процесс на порту 4000)
  - [x] Frontend + BFF (Next.js, Dockerfile, REST API Routes на порту 3000)
  - [x] Использовать default bridge сеть и прямой маппинг портов 3000, 4000 (без
        custom network)
- [x] Создать `Dockerfile` для backend:
  - [x] Node.js образ, установка зависимостей, копирование кода
  - [x] Команда запуска WebSocket сервера (`npm run start:ws`)
  - [x] Экспорт handlers как npm пакет для frontend
- [x] Создать `Dockerfile` для frontend:
  - [x] Node.js образ, установка зависимостей backend и frontend
  - [x] Сборка Next.js с включёнными API Routes
  - [x] Команда запуска Next.js сервера (только BFF API, без WebSocket)
- [x] Definition of Done: `docker-compose up` запускает все контейнеры без
      ошибок

## 1.4. Node.js и TypeScript

- [x] Создать `.nvmrc` с Node.js версии 24+
- [x] Настроить `tsconfig.base.json` в корне (target ES2024, модуль CommonJS для
      Node, ESNext для браузера)
- [x] Установить последнюю версию TypeScript в корне и в сервисах
- [x] Definition of Done: `nvm use`, `tsc --noEmit` проходят без ошибок для Node
      и браузерной конфигурации
