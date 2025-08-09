# Архитектура проекта (Project Architecture)

## Архитектурные принципы

Проект построен на принципах Feature-Sliced Design (FSD) и Clean Architecture:

- **FSD**: разделение кода по фичам, слоям и зонам ответственности. Каждый слой
  (entities, features, shared, widgets, pages) изолирован и не зависит от
  инфраструктуры.
- **Clean Architecture**: ядро (domain, application) не зависит от внешних слоев
  (инфраструктура, UI, API). Все зависимости инвертированы через
  интерфейсы/контракты. Бизнес-логика и use-case'ы не зависят от реализации
  сервисов, БД или Telegram API.
- **SOLID**: каждый сервис/модуль отвечает за одну зону ответственности,
  зависимости внедряются через абстракции, интерфейсы минимальны и разделены.

> **Важно:** Любая бизнес-логика и правила предметной области должны находиться
> только в core/domain слоях. Инфраструктурные детали (работа с Telegram,
> файловой системой, БД) реализуются через адаптеры и не содержат бизнес-правил.

- ## Монорепозиторий
- Root `package.json` управляет зависимостями и скриптами для `/backend` и
  `/frontend` через workspaces.
- Сервисы могут запускаться отдельно или через корневые команды (`npm run dev`,
  `npm run build`).
- Shared DTO и интерфейсы размещать в корневой папке `/types` и импортировать
  через path aliases.

## Основные интерфейсы сервисов (контракты)

Ниже приведены абстрактные контракты (TypeScript-интерфейсы) для ключевых
сервисов backend. Все зависимости между слоями строятся только через эти
интерфейсы.

```ts
/**
 * Контракт сервиса работы с файловой системой
 */
export interface IFSService {
  /** Получить дерево папок и количество файлов */
  scanFolders(): Promise<FolderTree[]>;
  /** Подписка на обновления структуры */
  onUpdate(callback: (tree: FolderTree[]) => void): void;
}

/**
 * Контракт сервиса синхронизации папок и топиков
 */
export interface ISyncService {
  /** Запустить загрузку файлов из папки в топик */
  uploadFolderToTopic(
    folderPath: string,
    topicName: string
  ): Promise<UploadResult>;
  /** Проверить дубликаты файлов */
  checkDuplicates(folderPath: string, topicName: string): Promise<boolean>;
  /** Получить статус загрузки */
  getUploadStatus(topicId: string): Promise<UploadStatus[]>;
}

/**
 * Контракт сервиса работы с Telegram
 */
export interface ITelegramService {
  /** Инициализация сессии */
  initSession(): Promise<void>;
  /** Получить список топиков для канала */
  getTopics(channelId: string): Promise<Topic[]>;
  /** Загрузить файл в топик */
  uploadFileForTopic(topicId: string, file: FileInfo): Promise<void>;
  /** Скачать файлы из топика (все или по фильтру) */
  downloadTopicFiles(
    topicId: string,
    targetPath: string,
    opts?: { pattern?: string; files?: string[] }
  ): Promise<DownloadResult>;
  /** Переименовать топик */
  renameTopic(topicId: string, newName: string): Promise<void>;
}

/**
 * Контракт сервиса хранения связей и сессий
 */
export interface IStorageService {
  /** Получить список каналов */
  getChannels(): Promise<TelegramChannel[]>;
  /** Сохранить/обновить канал */
  saveChannel(channel: TelegramChannel): Promise<void>;
  /** Получить/сохранить связь папка-топик */
  getFolderTopicLinks(): Promise<FolderTopicLink[]>;
  saveFolderTopicLink(link: FolderTopicLink): Promise<void>;
  /** Работа с Telegram-сессией */
  getTelegramSession(): Promise<TelegramSession>;
  saveTelegramSession(session: TelegramSession): Promise<void>;
}
```

/\*\*

- Примеры DTO и структур обмена между слоями (используются во всех сервисах и
  событиях WebSocket) \*/ export interface DownloadRequest { topicId: string;
  targetPath: string; pattern?: string; files?: string[]; } export interface
  FolderTree { path: string; name: string; filesCount: number; children:
  FolderTree[]; }

export interface TelegramChannel { id: string; name: string; telegramId: string;
slug?: string; createdAt: string; }

export interface Topic { id: string; telegramId: string; name: string;
originalPath?: string; channelId: string; createdAt: string; updatedAt: string;
}

export interface FileInfo { name: string; path: string; size: number; mimeType?:
string; }

export interface UploadStatus { id: string; topicId: string; filename: string;
status: 'pending' | 'uploading' | 'done' | 'failed'; createdAt: string;
updatedAt: string; error?: string; }

export interface UploadResult { topicId: string; total: number; uploaded:
number; failed: number; statuses: UploadStatus[]; }

export interface DownloadResult { topicId: string; total: number; downloaded:
number; skipped: number; statuses: DownloadStatus[]; }

export interface DownloadStatus { filename: string; status: 'pending' |
'downloading' | 'done' | 'skipped' | 'failed'; error?: string; }

export interface FolderTopicLink { folderPath: string; topicId: string;
channelId: string; }

export interface TelegramSession { id: string; sessionData: any; createdAt:
string; updatedAt: string; }

> **Реализации сервисов должны зависеть только от этих интерфейсов.**

## Контракты событий WebSocket и REST

Ниже приведены основные форматы событий и REST-ответов, которые используются для
обмена между UI и backend:

### WebSocket события (Socket.IO)

```ts
// Local => TG (загрузка файлов)
interface UploadStartEvent {
  topicId: string;
  topicName: string;
  total: number;
}

interface UploadProgressEvent {
  topicId: string;
  uploaded: number;
  total: number;
  statuses: UploadStatus[];
}

interface UploadDoneEvent {
  topicId: string;
  statuses: UploadStatus[];
}

interface UploadErrorEvent {
  topicId: string;
  error: string;
}

// TG => Local (выгрузка файлов)
interface DownloadStartEvent {
  topicId: string;
  total: number;
  pattern?: string;
  files?: string[];
}

interface DownloadProgressEvent {
  topicId: string;
  downloaded: number;
  total: number;
  statuses: DownloadStatus[];
  pattern?: string;
  files?: string[];
}

interface DownloadDoneEvent {
  topicId: string;
  statuses: DownloadStatus[];
  pattern?: string;
  files?: string[];
}

interface DownloadErrorEvent {
  topicId: string;
  error: string;
  pattern?: string;
  files?: string[];
}

// Общие события
interface StatusEvent {
  type:
    | 'telegram-unavailable'
    | 'fs-unavailable'
    | 'conflict'
    | 'session-expired';
  message: string;
}
```

### REST API (примеры)

- `GET /api/folders` → FolderTree[]
- `GET /api/channels` → TelegramChannel[]
- `GET /api/topics?channelId=...` → Topic[]
- `POST /api/upload` { folderPath, topicName } → UploadResult
- `POST /api/download` { topicId, targetPath, pattern?, files? } →
  DownloadResult
  - Если указан pattern — выгружаются только файлы, подходящие под паттерн
    (например, \*.pdf)
  - Если указан files — выгружаются только файлы из списка
  - Если не указано ни то, ни другое — выгружаются все файлы

---

## Sequence Diagrams

```mermaid
sequenceDiagram
    participant UI
    participant BFF as Next.js BFF
    participant Sync as SyncService
    participant Telegram as TelegramService
    participant WS as SocketService

    UI->>BFF: POST /api/upload { folderPath, topicName }
    BFF->>Sync: uploadFolderToTopic(folderPath, topicName)
    Sync->>StorageService: getFolderTopicLinks()
    Sync->>SyncService: scanFolders()
    Sync->>TelegramService: uploadFileForTopic(file)
    alt success
        Sync->>WS: emit upload:progress
    else error
        Sync->>SyncService: retry with exponential backoff
        Sync->>WS: emit upload:error
    end
    Sync-->>BFF: UploadResult
    BFF-->>UI: 200 OK { UploadResult }
```

```mermaid
sequenceDiagram
    participant UI
    participant BFF as Next.js BFF
    participant Sync as SyncService
    participant Telegram as TelegramService
    participant WS as SocketService

    UI->>BFF: POST /api/download { topicId, targetPath }
    BFF->>Sync: downloadTopicFiles(topicId, targetPath)
    Sync->>TelegramService: downloadTopicFiles(...)
    alt success
        Sync->>WS: emit download:progress
    else error
        Sync->>SyncService: retry with exponential backoff
        Sync->>WS: emit download:error
    end
    Sync-->>BFF: DownloadResult
    BFF-->>UI: 200 OK { DownloadResult }
```

## Error Handling and Retry Policies

- При недоступности Telegram API или операций с FS:
  - Повтор с экспоненциальным бэкоффом: начальная задержка 10 секунд,
    максимальная 1 час, без ограничения числа попыток
  - WS-события: `upload:retry`, `download:retry`, `status:unavailable`
  - UI отображает состояние «Ожидание сервера» и предоставляет кнопки «Пауза» и
    «Остановить»
- По команде WS `upload:pause` / `download:pause` — загрузка приостанавливается
- По команде WS `upload:stop` / `download:stop` — операция останавливается и
  требует ручного возобновления
- По успешному выполнению операций: `upload:done`, `download:done`
- REST API возвращает стандартные HTTP-коды:
  - 200 — успешный ответ
  - 4xx — ошибки клиента `{ code: string; message: string }`
  - 5xx — ошибки сервера `{ code: string; message: string }`

## Зависимости между сервисами и слоями

| Сервис/Слой     | Зависит от               | Зависимость через |
| --------------- | ------------------------ | ----------------- |
| UI (Next.js)    | API Gateway              | REST/WebSocket    |
| API Gateway     | FSService, SyncService   | Интерфейсы        |
| FSService       | chokidar, Node.js fs     | Адаптер           |
| SyncService     | TelegramService, Storage | Интерфейсы        |
| TelegramService | GramJS, MTProto          | Адаптер           |
| StorageService  | Prisma, PostgreSQL       | Адаптер           |
| Все сервисы     | DTO/контракты            | TypeScript        |

> **Важно:** Ни один инфраструктурный слой (fs, telegram, storage, ws) не должен
> содержать бизнес-логику или правила предметной области. Только
> core/domain/application определяют use-case'ы и правила.

---

- Все зависимости между слоями внедряются только через абстракции (интерфейсы,
  контракты).
- Реализации сервисов не должны зависеть друг от друга напрямую — только через
  интерфейсы.
- Бизнес-логика (use-case'ы, правила предметной области) всегда находится в
  core/domain/application слоях.
- Инфраструктурные детали (работа с Telegram, файловой системой, БД, WebSocket)
  реализуются через адаптеры, не содержат бизнес-правил и не зависят от core.
- Каждый сервис/модуль отвечает только за одну зону ответственности (Single
  Responsibility Principle).
- Интерфейсы должны быть минимальными и разделёнными (Interface Segregation
  Principle).
- Для тестирования используйте мок-реализации интерфейсов, не подменяя
  production-код.

---

## Комментарии к docker-compose и структуре проекта

- В docker-compose все переменные окружения должны храниться в .env и не
  попадать в git.
- Для production/dev окружений используйте отдельные файлы .env и
  docker-compose.override.yml.
- Volume ./watch_dir:/app/watch_dir — это директория, которую будет сканировать
  FSService (настраивается через .env).
- backend/data — папка для временных/служебных данных backend (например, кэш,
  логи, временные файлы).
- Структура backend разделена по слоям: core/domain, application/use-cases,
  infrastructure/adapters, services (feature-sliced).
- В папке ws/ — слой коммуникации (WebSocket, Socket.IO), не содержит
  бизнес-логики.
- Вся логика UI (Next.js) разделена по FSD: entities, features, widgets, pages,
  shared.

---

```
┌────────────────────────────────────────────────────────────────────┐
│                            🧑 Пользователь                          │
│                                                                    │
│    ┌────────────┐         WebSocket/SSE        ┌────────────┐     │
│    │   UI (Next.js + Tailwind + shadcn) ─────▶ │  API Gateway│     │
│    └────────────┘                              └─────┬──────┘     │
│                                                     │            │
└─────────────────────────────────────────────────────┼────────────┘
                                                      │
                                    REST/Events       │
                                                      ▼
       ┌─────────────────────────────────────────────────────────────┐
       │                         🧠 Backend                           │
       │                                                             │
       │  ┌──────────────┐       ┌──────────────┐      ┌──────────┐  │
       │  │ FSService    │──────▶│ SyncService  │◀─────│ DB (Prisma│  │
       │  │ (watcher)    │       │              │      │ Postgres) │  │
       │  └──────────────┘       └──────────────┘      └──────────┘  │
       │                             ▲   ▲                ▲          │
       │         Telegram API        │   │                │          │
       │                             │   │                │          │
       │  ┌─────────────────────┐    │   └────────────────┘          │
       │  │ TelegramService     │────┘                              │
       │  │ (GramJS client)     │                                   │
       │  └─────────────────────┘                                   │
       └─────────────────────────────────────────────────────────────┘
```

📡 Связи и коммуникации между слоями

| Откуда          | Куда            | Протокол / API               | Описание                                        |
| --------------- | --------------- | ---------------------------- | ----------------------------------------------- |
| UI              | API Gateway     | HTTP + WebSocket (socket.io) | Запросы, подписки на события                    |
| API Gateway     | FSService       | Внутренние вызовы (Node)     | Инициация сканирования, обновление дерева       |
| API Gateway     | SyncService     | Вызовы (Node/TS-интерфейсы)  | Загрузка/выгрузка файлов                        |
| SyncService     | TelegramService | Promise API / GramJS API     | Работа с топиками и сообщениями                 |
| Все сервисы     | DB              | Prisma (PostgreSQL)          | Работа с данными: топики, каналы, файлы, сессии |
| TelegramService | Telegram API    | MTProto (GramJS)             | Работа с Telegram user session                  |

docker-compose.yml

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:15
    container_name: tgstore_postgres
    restart: always
    environment:
      POSTGRES_USER: tguser
      POSTGRES_PASSWORD: tgpass
      POSTGRES_DB: tgstorage
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    container_name: tgstore_backend
    depends_on:
  pattern?: string;
  files?: string[];
      - postgres
    environment:
      - DATABASE_URL=postgresql://tguser:tgpass@postgres:5432/tgstorage
      - TELEGRAM_API_ID=...
      - TELEGRAM_API_HASH=...
      - TELEGRAM_CHANNEL_IDS=[...]
    volumes:
      - ./backend/data:/app/data
      - ./watch_dir:/app/watch_dir
    ports:
      - "4000:4000"

  frontend:
    build: ./frontend
    container_name: tgstore_frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  pgdata:
```

Пример структуры проекта

```
tgstore/
├── backend/
│   ├── prisma/
│   ├── services/
│   │   ├── fs/
│   │   ├── sync/
│   │   ├── telegram/
│   ├── ws/
│   └── index.ts
├── frontend/
├── .env
└── docker-compose.yml
```
