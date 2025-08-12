# 3. Frontend (Next.js BFF + UI, WS-first)

Ниже — детальный пошаговый план реализации UI c приоритетом
WebSocket-коммуникации, основанный на документах specification и architecture.

## 3.1. Bootstrap и базовая инфраструктура

- [x] Next.js App Router в `/frontend` (TypeScript)
- [x] TailwindCSS базовая настройка, токены и глобальные стили
- [x] Установить shadcn/ui и сгенерировать базовые компоненты (Button, Card,
      Badge, Tabs, Alert)
- [ ] ESLint/Prettier в монорепо выровнять (исключить конфликт плагина `import`,
      включить `eslint-config-next` локально)

Примечание: Для авторизации NextAuth не нужен. Аутентификация Telegram
выполняется по WebSocket (phone/code/password), без HTTP-cookie-сессии.

Acceptance:

- Dev и prod сборки проходят; базовые компоненты доступны; линтер без
  блокирующих ошибок.

## 3.2. BFF по HTTP (минимум) — WS-first

- [x] `/app/api/health` — версия + uptime
- [ ] Read-only SSR endpoints для гидратации (например, список каналов)
- [ ] Проксирование/интеграция с backend-хендлерами по мере необходимости

Примечание: Все бизнес-операции (scan/upload/download/rename/link, а также auth)
— через WebSocket. `/app/api/download` не требуется: «download» в терминах
приложения — выгрузка из Telegram на локальный диск сервера (через backend и
FS), а не отдача файла браузеру. Если когда-либо потребуется скачивание файла в
браузер, добавим отдельный HTTP-роут позже.

Acceptance:

- Health доступен. Остальные роуты заглушены или возвращают корректные ошибки.

## 3.3. WebSocket клиент и протокол

- [x] `shared/api/ws/client.ts`: Socket.IO клиент (базовый), опции, постоянные
      подписки с ребиндингом при reconnect
- [x] `shared/api/ws/protocol.ts`: handshake с `WS_PROTOCOL_VERSION` (из
      `types/websocket/events.ts`), capability flags, версия клиента
- [x] `shared/api/ws/events.ts`: типизированные on/emit по `EventPayloadMap`
- [ ] Heartbeat/ping-pong; idle-timeout; reconnection policy (exponential
      backoff + jitter)
- [ ] Rate limit UI: счётчики drop/second, отображение предупреждений
- [ ] Auth по WS: команды и события
  - Команды UI → Backend: `auth_init { phone }`, `auth_code { code }`, (опц.)
    `auth_password { password }`
  - Ответы Backend → UI: `auth_pending_code`, `auth_pending_password`,
    `auth_success { maskedPhone }`, `auth_error { code, message }`

Acceptance:

- При запуске UI устанавливается соединение; при отключении — авто-реконнект;
  `protocolVersion` совпадает; события типизированы.

## 3.4. Shared слой (FSD)

- [x] Скелет каталогов: `/frontend/shared`, `/frontend/entities`,
      `/frontend/features`, `/frontend/widgets`
- [x] `/shared/api/ws` — клиент и протокол (базовые)
- [x] `/shared/api/http` — health (минимум)
- [x] `/shared/lib/providers/SocketProvider` — контекст соединения
- [ ] `/shared/lib/notifications` — toasts/alerts для ошибок и статусов
- [ ] `/shared/ui` — базовые компоненты (shadcn/ui) и компоновки

Acceptance:

- Доступны хелперы/провайдер для подключения и UI-нотификации ошибок.

## 3.5. Entities слой (FSD)

- [x] `entities/folder`: модели (FolderTree), хуки на чтение (из WS
      `folder_tree_update`), отображение дерева + diff/highlight изменений
- [ ] `entities/topic`: модели (Topic), хуки на чтение и переименование,
      валидации имён
- [ ] `entities/channel`: список каналов и их статус (`channel_status_update`)
- [ ] (Опц.) `entities/session`: состояние авторизации (isAuthorized,
      maskedPhone), derived state

Acceptance:

- Entities предоставляют типы, селекторы и базовые UI-компоненты без
  бизнес-логики.

## 3.6. Features слой (FSD)

- [ ] `features/link-folder-to-topic`: выбор папки и топика, отправка команды
      link, валидация конфликтов
- [ ] `features/upload-folder`: отправка команды upload, прогресс/ошибки по
      `upload_*`, управление pause/stop
- [ ] `features/download-topic`: выбор targetPath, optional pattern/files,
      слежение за `download_*`
- [ ] `features/rename-topic`: смена имени и синхронизация с Telegram/БД
- [ ] `features/auth-phone-code`: ввод номера телефона, обработка
      `auth_pending_code`, ввод кода, обработка успеха/ошибок; (опц.) пароль 2FA

Acceptance:

- Каждая фича инкапсулирует команду WS и обрабатывает соответствующие события,
  отдавая простой компонент + контроллер-хуки.

## 3.7. Widgets слой (FSD)

- [x] `widgets/ws-status`: индикатор соединения (базовый); счётчики — позже
- [x] `widgets/event-feed`: лента последних событий (`file_sync_*`, `upload_*`,
      `channel_status_update`)
- [x] `widgets/folder-tree`: обзор локальной ФС, раскрытие/сворачивание,
      подсветка обновлений, управление скрытием файлов (per-folder и глобально)
- [x] `widgets/topics-dashboard`: список топиков и краткие статусы (заготовка)

Acceptance:

- Виджеты собирают entities+features, не содержат доменной логики, легко
  переиспользуются.

## 3.8. Pages (App Router)

- [x] `/` Dashboard: ws-status, event-feed, быстрые действия (MVP)
- [ ] `/local-to-tg` (Local => TG): folder-tree + link + upload
- [ ] `/tg-to-local` (TG => Local): topics + download
- [ ] `/settings`: каналы, базовая директория
- [ ] `/auth`: auth-phone-code flow

Acceptance:

- Навигация работает; основные сценарии MVP покрыты через WS.

## 3.9. UI/стили и доступность

- [x] Tailwind глобальные стили и токены
- [ ] Установка shadcn/ui и настройка темы
- [ ] A11y: доступные компоненты, фокус-стили, контрасты
- [ ] Иконки, favicon, базовые шрифты (Inter)

Acceptance:

- UI соответствует базовым стандартам доступности; темing корректен.

<!-- Раздел тестирования снят: тесты будут добавлены позже -->

## 3.11. Инструменты разработчика

- [ ] Dev панель WS: ручная отправка тестовых команд (dev-only)
- [ ] Локальные логи/метрики в UI (Pino консоль, counters)

Acceptance:

- Ускоряет отладку WS и визуализацию состояния.

<!-- HTTP-эндпоинтов не планируется: раздел про OpenAPI SDK/CI для SDK убран. CI остаётся общим на уровне репозитория. -->
