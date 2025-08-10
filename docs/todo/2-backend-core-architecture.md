# 2. Backend: Core и архитектура

## 2.0. Подготовка и настройки

- [x] ~~Установить tsyringe~~ Уже установлен, использовать простую DI через
      конструкторы (SOLID принципы)
- [x] Добавить недостающие скрипты в `backend/package.json` (уже добавлены)
- [x] Добавить недостающие зависимости:
  - [x] `pino` для универсального логирования (Node.js + Browser)
  - [x] `zod` для валидации
  - [x] `file-type` для определения MIME типов
  - [x] `crypto` (встроенный в Node.js) для хэширования файлов
- [x] ~~Глобальный ErrorHandler в Express~~ Обработка ошибок в WebSocket сервере
      (`/backend/src/infrastructure/ws/errorHandler.ts`)
- [x] Создать конфигурацию retry в `/backend/src/config/retryConfig.ts` с
      экспоненциальным backoff и поддержкой pause/stop
- [x] Настроить универсальное логирование (Pino) в `/shared/logger.ts` с
      поддержкой Node.js и Browser

## 2.1. Создание интерфейсов и контрактов

- [x] Выносить все public DTO/интерфейсы в корневую папку `/types`
- [x] Расширить существующие типы в `/types/index.ts` и создать доменные
      интерфейсы:
  - `IFSService`, `ISyncService`, `ITelegramService`, `IStorageService`,
    `ISocketService`, `ISchedulerService`
- [x] Создать папку `/backend/src/core/interfaces/` для внутренних интерфейсов
- [x] Описать следующие интерфейсы с методами и типами данных:
  - **IFSService:**
    - `scanFolders(): Promise<FolderTree[]>` — возвращает дерево папок и
      количество файлов
    - `watchFolder(path: string): void` — запуск file watcher
    - `stopWatching(): void` — остановка watcher
    - `onUpdate(callback: (tree: FolderTree[]) => void): void` — подписка на
      события обновления
    - `forceScan(): Promise<FolderTree[]>` — принудительное сканирование
  - **ISyncService:**
    - `uploadFolderToTopic(folderPath: string, topicName: string): Promise<UploadResult>`
    - `checkDuplicates(folderPath: string, topicName: string): Promise<boolean>`
    - `getUploadStatus(topicId: string): Promise<UploadStatus>`
    - `pauseUpload(uploadId: string): Promise<void>`
    - `resumeUpload(uploadId: string): Promise<void>`
  - **ITelegramService:**
    - `initSession(): Promise<void>`
    - `getChannels(): Promise<TelegramChannel[]>`
    - `getTopics(channelId: string): Promise<Topic[]>`
    - `createTopic(channelId: string, name: string): Promise<Topic>`
    - `uploadFileForTopic(topicId: string, file: FileInfo): Promise<void>`
    - `downloadTopicFiles(topicId: string, targetPath: string, opts?: DownloadOptions): Promise<DownloadResult>`
    - `renameTopic(topicId: string, newName: string): Promise<void>`
  - **IStorageService:**
    - `getChannels(): Promise<TelegramChannel[]>`
    - `saveChannel(channel: TelegramChannel): Promise<void>`
    - `getFolderTopicLinks(): Promise<FolderTopicLink[]>`
    - `saveFolderTopicLink(link: FolderTopicLink): Promise<void>`
    - `getUploadSessions(): Promise<UploadSession[]>`
    - `saveUploadSession(session: UploadSession): Promise<void>`
    - `getTelegramSession(): Promise<TelegramSession | null>`
    - `saveTelegramSession(session: TelegramSession): Promise<void>`
  - **ISocketService:**
    - `emitFileSync(event: FileSyncEvent): void`
    - `emitUploadProgress(progress: UploadProgress): void`
    - `emitChannelStatus(status: ChannelStatus): void`
    - `onClientConnect(handler: (clientId: string) => void): void`
  - **ISchedulerService:**
    - `start(): void`, `stop(): void`
    - `scheduleFileScan(intervalMs: number): void`
    - `scheduleCleanup(intervalMs: number): void`
    - `scheduleSessionCheck(intervalMs: number): void`
- [x] Дополнить типы в `/types/index.ts`:
  - [x] `FolderTree`, `FileInfo`, `UploadResult`, `UploadStatus`
  - [x] `Topic`, `TelegramChannel`, `DownloadOptions`, `DownloadResult`
  - [x] `FolderTopicLink`, `UploadSession`, `TelegramSession`
  - [x] `UploadProgress`, `ChannelStatus` (для WebSocket событий)

## 2.2. FSService

- [x] Создать `/backend/src/infrastructure/fs/FSService.ts`
- [x] Реализовать сканирование и watcher (chokidar) - только реакция на события
      FS
- [x] Определить опции watcher: глубина сканирования, игнорируемые папки, файлы
- [x] Обновление дерева при изменениях файловой системы
- [x] Отправка событий через `ISocketService` при обнаружении изменений
- [x] Метод `forceScan()` для принудительного обновления по требованию

## 2.3. StorageService

- [x] Создать `/backend/src/infrastructure/storage/StorageService.ts`
- [x] Методы для работы с Channels, FolderTopicLinks, TelegramSession
- [x] Прописать схему Prisma и naming conventions in `schema.prisma`
- [x] Выбрать формат хранения `StringSession` (binary vs base64) в БД

## 2.4. TelegramService

- [x] Создать `/backend/src/infrastructure/telegram/TelegramService.ts`
- [x] Инициализация сессии через GramJS
- [x] Методы:
  - `getTopics`
  - `uploadFile` (переименовано с `uploadFileForTopic`)
  - `listTopicFiles`
  - `downloadTopicFiles`
  - `renameTopic`
- [x] Задокументировать flow авторизации (Phone → Code → Password) и
      взаимодействие UI (перенесено в `docs/architecture.md`)
- [x] Задокументировать временный smoke CLI (`.tmp/scripts/telegramSmoke.ts`) и
      его границы (перенесено в `docs/architecture.md`)
- [x] Реализовать retry с экспоненциальной задержкой (параметры в конфиге)

## 2.5. SyncService

- [ ] Создать `/backend/src/core/services/SyncService.ts`
- [ ] In-memory статус загрузки
- [ ] Методы: `uploadFolderToTopic`, `checkDuplicates`, `getUploadStatus`
- [ ] Определить максимальное число параллельных загрузок и политику блокировок

## 2.6. WebSocket слой

- [x] ~~Создать Socket.IO сервер~~ Базовая реализация уже есть в
      `/backend/src/ws-server.ts`
- [ ] Рефакторинг `/backend/src/infrastructure/ws/SocketService.ts`:
  - [ ] Выделить SocketService из ws-server.ts
  - [ ] Типизированные события вместо generic strings
  - [ ] Proper error handling и reconnection logic
- [ ] Стандартизовать WebSocket события:
  - `file_sync_start`, `file_sync_progress`, `file_sync_complete`,
    `file_sync_error`
  - `upload_start`, `upload_progress`, `upload_complete`, `upload_error`
  - `download_start`, `download_progress`, `download_complete`, `download_error`
  - `folder_tree_update`, `channel_status_update`
- [ ] Добавить middleware для аутентификации и rate limiting

## 2.7. Backend API и интеграция

- [ ] ~~BFF handlers в backend~~ Создать типизированные API контракты в
      `/types/api.ts`
- [ ] Создать `/backend/src/core/ServiceRegistry.ts` для управления
      зависимостями
- [ ] Интерфейс `IBackendServices.ts` для экспорта сервисов в frontend
- [ ] REST API endpoints через WebSocket для frontend (command pattern)

## 2.8. Композиция приложения

- [ ] `/backend/src/lib.ts` с `createBackendServices` и сервис-фабрикой
- [ ] `/backend/src/index.ts` экспорты интерфейсов и типов для frontend
- [x] Создать `/backend/src/core/services/SchedulerService.ts`:
  - [x] Периодическое сканирование FS (каждые 60 сек)
  - [x] Cleanup временных файлов
  - [x] Проверка состояния Telegram сессии
  - [x] Использовать cron-like планировщик или простые setTimeout
- [ ] Graceful shutdown для всех сервисов (WebSocket, DB connections, file
      watchers, scheduler)
- [ ] Environment validation и конфигурационный слой
- [ ] Health check endpoints для мониторинга

## 2.9. Дополнительные задачи (пропущенные ранее)

- [x] Создать Prisma схему в `backend/prisma/schema.prisma`:
  - [x] Модели: Channel, Topic, FileRecord, UploadSession, TelegramSession
  - [x] Связи между моделями
  - [x] Индексы для производительности
- [ ] Настроить миграции Prisma и seed данные
- [ ] Создать утилиты для работы с файлами:
  - [ ] Хэширование файлов (для дедупликации)
  - [ ] MIME type detection
  - [ ] File size validation
- [x] Создать middleware для обработки ошибок и универсального логирования
      (Pino)
- [ ] Настроить тестирование сервисов (unit + integration tests)
