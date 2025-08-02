# 3. Frontend (Next.js BFF + UI)

## 3.1. Инициализация Next.js проекта как BFF
- [ ] Инициализировать Next.js в `/frontend` (TS, App Router)
- [ ] Установить shadcn/ui, TailwindCSS
- [ ] Настроить ESLint/Prettier из корневых конфигов
- [ ] Установить NextAuth.js и настроить custom provider (StringSession в cookie)

## 3.2. Next.js API Routes (BFF)
- [ ] Создать `/frontend/src/app/api/topics/route.ts`
- [ ] `/files`, `/folders`, `/sync`, `/download`
- [ ] Импорт handlers из `backend/src/index.ts`
- [ ] Адаптеры запрос/ответ, валидация, логирование

## 3.3. WebSocket клиент
- [ ] Хук `useSocket` для подключения
- [ ] Реализовать глобальное состояние и аутентификацию через React Context + hooks
- [ ] Обработчики событий: `upload:*`, `download:*`, `fs:update`, `status`
- [ ] Реконнект, обработка ошибок

## 3.4. Shared слой (FSD)
- [ ] `/frontend/src/shared/api` — HTTP & WS клиенты, типы
- [ ] Добавить контекст AuthenticationContext и StateContext в `/frontend/src/shared/lib`
- [ ] `/frontend/src/shared/ui` — shadcn/ui базовые компоненты
- [ ] `/frontend/src/shared/lib` — утилиты и хуки

## 3.5. Entities слой (FSD)
- [ ] `/frontend/src/entities/topic`, `/file`, `/folder`
- [ ] Модели, API, компоненты, хуки

## 3.6. Features слой (FSD)
- [ ] `/frontend/src/features/sync-files`, `/manage-topics`, `/download-files`, `/file-system`
- [ ] Компоненты, прогресс, настройки, хуки

## 3.7. Widgets слой (FSD)
- [ ] `/frontend/src/widgets/topics-dashboard`, `/file-explorer`, `/sync-status`

## 3.8. Pages слой (FSD)
- [ ] `/frontend/src/app` страницы: dashboard, topics, sync, files, settings
- [ ] Использовать React, shadcn/ui для UI, TailwindCSS

## 3.9. Статические ресурсы и стили
- [ ] Настроить глобальные стили TailwindCSS
- [ ] Оптимизировать изображений, favicon, шрифты
