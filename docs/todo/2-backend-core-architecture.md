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
      - **ISocketService:** -
        `emit<E extends EventName>(event: E, payload: EventPayloadMap[E]): void` -
        `broadcast(message: IWSMessage<T>) / sendToClient(id, message)`
        (низкоуровневые) -
        `on/offConnection|Disconnection|Message|ClientConnect` - Wrapper-методы
        удалены; использовать стандартизованные имена событий
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

- [x] Создать `/backend/src/core/services/SyncService.ts`
- [x] In-memory статус загрузок (Map sessionId -> session)
- [x] Методы: `uploadFolderToTopic`, `startUpload`, `pauseUpload`,
      `resumeUpload`, `cancelUpload`, `getUploadProgress`, `getUploadResult`,
      `checkDuplicates`
- [x] Локальная и удалённая (через `listTopicFiles`) проверка дубликатов (по
      имени файла)
- [x] Skip уже существующих в топике файлов (имя совпадает) – учитываются как
      загруженные
- [x] Ограничение параллелизма: `maxParallelUploads = 1` (расширяемо)
- [x] Периодическая персистенция сессий через `SchedulerService.scheduleTask`
      (отказ от внутреннего setInterval)
- [x] Оптимизация персистенции: сохраняются только изменённые сессии
      (`updatedAt` > lastPersisted)
- [x] Авто-отмена задачи персистенции при отсутствии активных сессий
- [x] Инкрементальный `syncFolder` (MVP: новые локальные файлы по имени →
      догрузка; без удалений / обновлений / рекурсий) Ограничения: нет
      рекурсивного обхода, нет выявления обновлённых/удалённых, linkId временно
      трактуется как topicId.
- [x] Расширенная семантика статусов: добавлено поле `hasFailures` в
      UploadResult (COMPLETED + hasFailures=true при частичных сбоях, FAILED
      только если 0 успешных)
- [x] WebSocket события прогресса (минимальная интеграция через
      `emitUploadProgress` при старте/каждом файле/финале)
- [x] Graceful shutdown: метод shutdown() (flush + cancel persistence)
      реализован в SyncService
- [ ] Конфигурируемый `maxParallelUploads` > 1 (очередь + ограничитель) – TODO

## 2.5.1. Roadmap этапы (последовательность реализации)

1. Инкрементальный syncFolder (diff локальных/удалённых файлов)
   - [x] Плоский уровень выбранной папки
   - [x] new / updated / removed / unchanged классификация по size+mtime
   - [x] remoteOnlyFiles (файлы есть в Telegram, нет локально и в records)
   - [x] Hash-refinement: если hash совпал – file переклассифицируется из
         updated в unchanged
2. Расширенная семантика статусов (hasFailures) – выполнено (будет заменено
   PARTIAL статусом).
3. WebSocket события
   - [x] upload_start / upload_progress / upload_complete / upload_error
   - [x] file-level: uploaded | skipped | renamed | failed (с reason)
   - [x] sync_diff (включая remoteOnlyFiles)
   - [ ] upload_partial (будет после ввода статуса PARTIAL)
4. Graceful shutdown (SyncService) – выполнено (глобальная интеграция позже).
5. Fingerprint (mtime+size → hash опционально)
   - [x] quick fingerprint + FileRecord upsert
   - [x] hash стратегия подключена
6. Политика конфликтов имён (skip | rename | log_only) – выполнено + счётчики.
7. Hash стратегия (none | on_demand | eager) – выполнено.
8. PARTIAL статус
   - [x] Добавлен EUploadStatus.PARTIAL (domain + DB enum + маппинги)
   - [x] Логика присвоения: есть и удовлетворённые (uploaded/ skipped) и ошибки
         → PARTIAL
   - [x] UploadResult.status теперь PARTIAL вместо COMPLETED+hasFailures
   - [x] hasFailures помечен как deprecated (обратная совместимость)
   - [ ] Обновить consumer-код frontend на использование status === 'partial'

### 2.5.2. Post-MVP хвосты SyncService

Must have:

1. Prisma enum обновить (PARTIAL) + миграция.
2. Persist новых полей UploadSession / UploadResult (realUploaded, skipped,
   conflicts\*, status PARTIAL) в StorageService (и схема, если нужно) – или
   явно зафиксировать, что они вычисляются только in-memory.
3. Очистка завершённых сессий из памяти (LRU / TTL, напр. >24h) чтобы не расти
   бесконечно.
4. Удалить устаревшие TODO в конце `SyncService.ts` (часть уже реализована).
5. Конфигурируемый `maxParallelUploads` > 1: очередь + ограничение
   параллельности.
6. Retry / backoff на уровне SyncService для uploadFile (если TelegramService не
   гарантирует внутренние ретраи) с лимитом попыток и классификацией ошибок.
7. Тесты (unit):
   - buildFingerprint/hash strategies
   - conflict rename генерация
   - skip unchanged (fingerprint + hash refinement)
   - статусная логика (COMPLETED / PARTIAL / FAILED edge cases)

Nice to have: 8. Разделить skipped на `skippedRemoteDuplicates` и
`skippedUnchanged` в метриках и результатах. 9. Добавить `conflictsTotal`
(агрегация) и, возможно, `renamedFiles[]` список. 10. Hash-based rename
detection (обнаружение переименований: hash совпал, имя новое → классифицировать
отдельно вместо removed+new). 11. Политика для `remoteOnlyFiles` (отдельный
enum: IGNORE | LOG | DELETE_REMOTE) – сейчас только выдаём в diff. 12. TTL /
size ограничение для `fingerprintCache` (например max entries или max MB) +
периодическая очистка. 13. Расширить upload_complete payload: средняя скорость,
длительность по файлам (если будем собирать). 14. API для получения списка
активных / недавних сессий (`listSessions(): IUploadResult[] | summaries`). 15.
Восстановление незавершённых сессий при старте (read persisted sessions →
рестарт только PENDING/UPLOADING → перевод в FAILED/ PARTIAL?). 16. Более
детализированные логи конфликтов (structured: {policy, action, originalName,
finalName}). 17. Метрика распределения причин ошибок (network / telegram_rate /
size_limit ...). 18. Возможность аварийного прерывания текущего файла (graceful
abort) при cancel. 19. Опциональная проверка свободного места / ограничений
перед стартом (preflight). 20. CLI / административный метод для принудительной
очистки старых FileRecord для неиспользуемых топиков.

Deferred / возможно позже: 21. Batch upsert FileRecord (снизить I/O) – копить и
писать пачками. 22. Переход на потоковую загрузку с мониторингом скорости (если
Telegram API позволит) для нюансной оценки ETA. 23. Статистика по хэшу:
выявление дубликатов с разными именами в одном топике (dedupe report).

## 2.6. WebSocket слой

Ограничения MVP (приняты):

- Нет аутентификации / авторизации (deferred)
- Нет rooms / namespaces (deferred)
- Нет тестов на данном этапе (будут позже общим пакетом)

### 2.6.1. Состояние

- [x] Базовый Socket.IO сервер (создание/инициализация)
- [x] Минимальные доменные emit\* методы (upload_progress, sync_diff и т.д.)

### 2.6.2. MVP Must Have (реализовать в ближайших итерациях)

1. [x] Реестр событий: `EventNames` + `EventPayloadMap`
       (`/types/websocket/events.ts`) – введён
2. [x] `protocolVersion` в `IWSMessage` + `WS_PROTOCOL_VERSION = 1` – добавлено
3. [x] Generic `emit(event, payload)` в `SocketService` – реализовано, старые
       emit\* пока совместимы
4. [ ] Валидация входящих сообщений (zod) – отложено (нет inbound команд сейчас)
5. [x] Методы отписки: `offConnection`, `offDisconnection`, `offMessage`,
       `offClientConnect` – есть
6. [x] Обработчики в `Set` – предотвращает дубли
7. [x] Метрики: connections (через engine), `messagesIn/out`, `errors`,
       `rateLimitDrops` – собраны
8. [x] `getStats()` – реализован
9. [x] Rate limiting (скользящее окно) – реализован (banAfter поддержка)
10. [x] Error handling: `connection_error` + try/catch; socket.on('error') в
        планах (минимум есть)
11. [x] Graceful shutdown: `draining=true` + закрытие; (очистку Set рассмотрим
        позже)
12. [x] Пределы: `maxHttpBufferSize` + базовая защита (до валидации payload)
13. [x] Skip пустых broadcast – проверка отсутствия клиентов
14. [x] Консистентные имена событий – миграция legacy
        ('file_sync_event','channel_status') завершена; wrappers помечены
        deprecated

### 2.6.3. Стандартизованные имена событий (MVP)

- file_sync_start / file_sync_progress / file_sync_complete / file_sync_error
- upload_start / upload_progress / upload_complete / upload_error /
  upload_file_event
- sync_diff
- folder_tree_update
- channel_status_update

### 2.6.4. Post-MVP (после стабилизации базового функционала)

A. [ ] Heartbeat watchdog поверх встроенного ping (доп. таймаут неактивности) B.
[ ] Correlation / trace id в `IWSMessage` (передача цепочки) C. [ ]
Acknowledgements (поддержка callback ack для критичных операций) D. [ ]
Backpressure очередь (ограничение объёма исходящих сообщений, drop/pause) E. [ ]
Экспорт метрик (Prometheus /metrics адаптер) F. [ ] Rooms / namespaces (deferred
явно) G. [ ] Auth middleware (JWT / токен) — deferred H. [ ] Пер-событийная
латентность (timestamping + расчёт p95) I. [ ] Correlated reconnect logic (state
restore при reconnect клиента)

### 2.6.5. Не будет (Out of scope сейчас)

- Полноценная авторизация ролей
- Мультиплексированные каналы / сложная маршрутизация
- Расширенные тесты производительности (позже)

### 2.6.6. Примечания по реализации

- Реестр событий позволит статически типизировать `emit` и `onMessage`.
- Rate limiter можно реализовать кольцевым буфером timestamps на сокет.
- Graceful drain: перед shutdown помечаем draining, отклоняем новые connection,
  закрываем существующие после отправки финальных сообщений.
- Метрики интегрировать с `SchedulerService` (периодический лог snapshot).

## 2.7. Backend API и интеграция (упрощено)

Решение: для MVP используем только WebSocket (command + events). Отдельный REST
слой исключён.

Out of scope сейчас:

- REST / BFF endpoints
- OpenAPI спецификация (перенесено до появления внешнего API)

Оставшиеся потенциальные задачи (позже, если потребуется):

- [ ] ServiceRegistry (объединение сервисов для фронтенда через один snapshot по
      WS)
- [ ] IBackendServices.ts (типизированная агрегация для SDK генерации в будущем)
- [ ] metrics / health (возможный лёгкий HTTP позже, но не часть текущего плана)

## 2.8. Композиция приложения

- [x] `/backend/src/lib.ts` с `createBackendServices` и сервис-фабрикой
- [x] `/backend/src/index.ts` экспорты интерфейсов и типов для frontend
- [x] Создать `/backend/src/core/services/SchedulerService.ts`:
  - [x] Периодическое сканирование FS (каждые 60 сек)
  - [x] Cleanup временных файлов
  - [x] Проверка состояния Telegram сессии
  - [x] Использовать cron-like планировщик или простые setTimeout
- [x] Graceful shutdown для всех сервисов (WebSocket, DB connections, file
      watchers, scheduler)
- [x] Environment validation и конфигурационный слой (`config/env.ts` + zod)
- [x] Health check endpoint (`/health` on WS HTTP server)

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
