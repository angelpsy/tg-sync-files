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
// Renamed: ISyncService -> IUploadOrchestrator
export interface IUploadOrchestrator {
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

## Telegram: Flow авторизации (Phone → Code → Password)

1. initSession() загружает сохранённый StringSession через IStorageService. Если
   отсутствует — создаётся клиент с пустой сессией.
2. Отправка кода: client.sendCode / high-level метод GramJS на TELEGRAM_PHONE.
3. UI состояния: idle → phone_submitted → code_sent → awaiting_code → (optional)
   awaiting_password → authorized.
4. Пользователь вводит код → backend вызывает client.signIn({ phoneNumber,
   phoneCode }).
5. Если 2FA включён: ловим SESSION_PASSWORD_NEEDED →
   client.checkPassword(password).
6. После авторизации сохраняем новый StringSession (saveTelegramSession).
7. Ошибки (FloodWait, неверный код/пароль) транслируются через WebSocket события
   статуса.

### Реализационные детали

- Кеширование каналов для снижения FloodWait (минимизация getDialogs вызовов).
- Единый RetryManager с экспоненциальным backoff.
- listTopicFiles через messages.GetReplies.
- Инфраструктурный слой не содержит бизнес-правил.

## Smoke CLI (.tmp/scripts/telegramSmoke.ts)

Цель: ручная верификация TelegramService (каналы, топики, загрузка, листинг).

Характеристики:

- Временный dev-инструмент, не участвует в core, хранится строго в .tmp.
- Запуск: pnpm tsx .tmp/scripts/telegramSmoke.ts <flags>
- Флаги: --channels, --create-topic <name>, --list, --volatile, --no-auth.
- Сессия: .tmp/session.json (или volatile in-memory при --volatile).
- Не добавляется в package.json scripts.

## SyncService (обновлено)

Текущая реализация:

- In-memory управление сессиями загрузок (Map). Поля: id, folderPath, channelId,
  topicId, status, uploadedFiles, totalFiles, failedFiles, progress.
- Параллелизм: один активный файл (maxParallelUploads = 1). Параллельная
  загрузка заведомо отключена стратегически (FloodWait mitigation).
- Модель выбора: пользователь явно выбирает конкретную папку (уровень) для
  сопоставления с топиком. Вложенные директории НЕ сканируются рекурсивно и НЕ
  загружаются автоматически; каждая вложенная папка при необходимости будет
  выбрана пользователем отдельно и привязана к своему топику.
- Локальный список файлов формируется только для прямых файлов выбранной папки
  (одноуровневый flat scan). Поддиректории игнорируются (только отображаются в
  UI для возможного выбора пользователем).
- Best-effort получение удалённого списка через
  `TelegramService.listTopicFiles`.
- Файлы, имя которых уже присутствует на стороне Telegram, пропускаются и
  считаются «виртуально» загруженными.
- Политика конфликтов имён (конфигурируемо при старте сессии):
  - `skip` (по умолчанию) — файл считается удовлетворённым и пропускается
  - `rename` — генерируется уникальное имя `name (n).ext`
  - `log_only` — загружается как есть (может создать визуальный дубликат),
    логируется предупреждение
- Fingerprint:
  - Quick (size + mtime) сравнение для пропуска неизменённых
  - Hash стратегия (placeholder): none | on_demand | eager (будет реализована
    позже)
- Дубликаты:
  - Локальные: обнаруживаются по повторяющимся именам в пределах текущей папки
  - Удалённые: по совпадению имени с существующим в топике
- Персистенция статусов: через `SchedulerService.scheduleTask` (generic API).
  Задача `upload-session-persist` сохраняет изменённые сессии каждые N мс. Если
  нет активных (pending/uploading/paused) – задача авто-отменяется.
- Оптимизация: сохраняются только сессии у которых `updatedAt` изменился после
  последней фиксации.
- Частичные сбои: статус COMPLETED + флаг hasFailures=true, FAILED только если
  все попытки неуспешны.
- WebSocket прогресс: (ранее emitUploadProgress) теперь через generic
  `socketService.emit('upload_progress', payload)` на старте, каждом файле,
  пропуске и завершении.

### WebSocket Events (стандартизовано)

Используется единый generic API:

```ts
socketService.emit('upload_start', { uploadId, folderPath, topicId, totalFiles, timestamp });
socketService.emit('upload_progress', { uploadId, fileName, fileIndex, totalFiles, uploadedBytes, totalBytes, speed, eta });
socketService.emit('upload_file_event', { uploadId, fileName, fileIndex, totalFiles, status: 'uploaded'|'skipped'|'renamed'|'failed', timestamp, reason?, error? });
socketService.emit('upload_error', { uploadId, topicId, error, timestamp });
socketService.emit('upload_complete', { uploadId, topicId, totalFiles, uploadedFiles, failedFiles, durationMs, timestamp });
socketService.emit('sync_diff', diffPayload);
socketService.emit('channel_status_update', statusPayload);
```

Правила:

- Только перечисленные в `types/websocket/events.ts` имена.
- Все исходящие сообщения внутри SocketService автоматически получают
  `protocolVersion`.
- Таргетированная отправка: `sendToClient(id, { type, payload })` либо
  (рекомендовано) event-based emit + client-side фильтрация.
- Broadcast не выполняется при отсутствии подключений (оптимизация).

Миграция: старые методы `emitUploadProgress`, `emitUploadStart`,
`emitUploadComplete`, `emitUploadError`, `emitUploadFileEvent`, `emitSyncDiff`,
`emitChannelStatus`, `emitFileSync` удалены ради унификации и устранения
дублирования API.

Запланированные улучшения (roadmap):

- Улучшенный incremental syncFolder (учёт обновлённых / удалённых файлов без
  рекурсии).
- Политика конфликтов имён (skip | rename | log) без overwrite.
- Дополнительные события: upload_start / upload_complete / upload_error
  (отдельно от progress) – расширение SocketService.
- Graceful shutdown (реализовано в SyncService, интегрировать общий
  orchestrator).
- Опциональная стратегия hash (по запросу) для точной детекции изменений (в
  рамках одной папки).

## SchedulerService (обновлено)

- Поддерживает фиксированные хелперы: `scheduleFileScan`, `scheduleCleanup`,
  `scheduleSessionCheck`.
- Добавлен generic метод `scheduleTask(id, name, intervalMs, execute)` и
  `cancelTask(id)`.
- Каждая задача хранит: id, name, intervalMs, isRunning, lastRun, nextRun,
  execute.
- При старте (`start()`) активируются все зарегистрированные задачи, каждая
  выполняется немедленно один раз, затем по интервалу.
- Используется SyncService для персистенции сессий (см. задачу
  `upload-session-persist`).
- План по расширению: pause/resume для отдельных задач, метрики длительности и
  jitter управление.
