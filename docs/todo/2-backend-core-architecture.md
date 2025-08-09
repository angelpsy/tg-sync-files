# 2. Backend: Core и архитектура

## 2.0. Подготовка и настройки

- [ ] Установить tsyringe: `npm install tsyringe reflect-metadata` и настроить
      DI в `/backend/src/core/container.ts`
- [ ] Добавить скрипты в `backend/package.json`:
  - `"prisma:migrate:dev": "prisma migrate dev"`
  - `"prisma:migrate:prod": "prisma migrate deploy"`
  - `"prisma:db:push": "prisma db push"` (dev)
  - `"prisma:migrate:prod": "prisma migrate deploy"`
- [ ] Реализовать глобальный ErrorHandler в Express
      (`/backend/src/infrastructure/api/errorHandler.ts`) и обработку в
      SocketService
- [ ] Создать конфигурацию retry в `/backend/src/config/retryConfig.ts` с
      экспоненциальным backoff и поддержкой pause/stop

## 2.1. Создание интерфейсов и контрактов

- [ ] Выносить все public DTO/интерфейсы в корневую папку `/types`
- [ ] Описать интерфейсы IFSService, ISyncService, ITelegramService,
      IStorageService, ISocketService в `/types`
- [ ] Создать папку `/backend/src/core/interfaces/`
- [ ] Описать следующие интерфейсы с методами и типами данных:
  - IFSService:
    - `scanFolders(): Promise<FolderTree[]>` — возвращает дерево папок и
      количество файлов
    - `onUpdate(callback: (tree: FolderTree[]) => void): void` — подписка на
      события обновления
  - ISyncService:
    - `uploadFolderToTopic(folderPath: string, topicName: string): Promise<UploadResult>`
    - `checkDuplicates(folderPath: string, topicName: string): Promise<boolean>`
    - `getUploadStatus(topicId: string): Promise<UploadStatus[]>`
  - ITelegramService:
    - `initSession(): Promise<void>`
    - `getTopics(channelId: string): Promise<Topic[]>`
    - `uploadFileForTopic(topicId: string, file: FileInfo): Promise<void>`
    - `downloadTopicFiles(topicId: string, targetPath: string, opts?: { pattern?: string; files?: string[] }): Promise<DownloadResult>`
    - `renameTopic(topicId: string, newName: string): Promise<void>`
  - IStorageService:
    - `getChannels(): Promise<TelegramChannel[]>`
    - `saveChannel(channel: TelegramChannel): Promise<void>`
    - `getFolderTopicLinks(): Promise<FolderTopicLink[]>`
    - `saveFolderTopicLink(link: FolderTopicLink): Promise<void>`
    - `getTelegramSession(): Promise<TelegramSession>`
    - `saveTelegramSession(session: TelegramSession): Promise<void>`
  - ISocketService:
    - `emit(event: string, payload: any): void`
    - `on(event: string, handler: (payload: any) => void): void`
- [ ] Создать DTO и типы:
  - [ ] `types/FolderTree.ts`, `types/TelegramChannel.ts`
  - [ ] `types/Topic.ts`, `types/FileInfo.ts`
  - [ ] `types/UploadStatus.ts`, `types/UploadResult.ts`
  - [ ] `types/DownloadResult.ts`, `types/DownloadRequest.ts`
  - [ ] `types/Events.ts`

## 2.2. FSService

- [ ] Создать `/backend/src/infrastructure/fs/FSService.ts`
- [ ] Реализовать сканирование и watcher (chokidar)
- [ ] Определить опции watcher: глубина сканирования, игнорируемые папки
- [ ] Обновление дерева, отправка событий через `ISocketService`
- [ ] Автообновление каждые 60 сек

## 2.3. StorageService

- [ ] Создать `/backend/src/infrastructure/storage/StorageService.ts`
- [ ] Методы для работы с Channels, FolderTopicLinks, TelegramSession
- [ ] Прописать схему Prisma и naming conventions в `schema.prisma`
- [ ] Выбрать формат хранения `StringSession` (binary vs base64) в БД

## 2.4. TelegramService

- [ ] Создать `/backend/src/infrastructure/telegram/TelegramService.ts`
- [ ] Инициализация сессии через GramJS
- [ ] Методы: `getTopics`, `uploadFileForTopic`, `downloadTopicFiles`,
      `renameTopic`
- [ ] Задокументировать flow авторизации (Phone → Code → Password) и
      взаимодействие UI
- [ ] Реализовать retry с экспоненциальной задержкой (параметры в конфиге)

## 2.5. SyncService

- [ ] Создать `/backend/src/core/services/SyncService.ts`
- [ ] In-memory статус загрузки
- [ ] Методы: `uploadFolderToTopic`, `checkDuplicates`, `getUploadStatus`
- [ ] Определить максимальное число параллельных загрузок и политику блокировок

## 2.6. WebSocket слой

- [ ] Создать `/backend/src/infrastructure/ws/SocketService.ts`
- [ ] Express + Socket.IO сервер на порту 4000
- [ ] События: `upload:start`, `upload:progress`, `upload:done`, `upload:error`,
      `download:*`, `fs:update`, `status`
- [ ] Entry point `/backend/src/ws-server.ts`

## 2.7. Backend Core Services

- [ ] Создать `/backend/src/application/handlers/` для BFF handlers
- [ ] `createHandlers()` для экспорта в Next.js
- [ ] Интерфейс `IBackendAPI.ts`

## 2.8. Композиция приложения

- [ ] `/backend/src/lib.ts` с `createBackendServices` и `createAPIHandlers`
- [ ] `/backend/src/index.ts` экспорты handlers и типов
- [ ] Graceful shutdown для всех сервисов
