# Docker Setup for Telegram FileSync

## Быстрый старт

1. **Клонируйте репозиторий и установите зависимости:**
   ```bash
   pnpm install
   ```

2. **Настройте переменные окружения:**
   ```bash
   cp .env.example .env
   # Отредактируйте .env с вашими Telegram API ключами
   ```

3. **Запустите все сервисы с Docker:**
   ```bash
   pnpm docker:up
   ```

4. **Откройте приложение:**
   - Frontend: http://localhost:3000
   - Backend WebSocket: ws://localhost:4000
   - PostgreSQL: localhost:5432

## Доступные Docker команды

```bash
# Запуск всех сервисов (с пересборкой)
pnpm docker:up

# Остановка всех сервисов
pnpm docker:down

# Просмотр логов всех сервисов
pnpm docker:logs

# Полная очистка (удаляет volumes и orphaned контейнеры)
pnpm docker:clean
```

## Архитектура контейнеров

### PostgreSQL (`postgres`)
- **Образ:** `postgres:15-alpine`
- **Порт:** 5432
- **База данных:** `tg_sync_files`
- **Volume:** `postgres_data` для persistance данных

### Backend WebSocket (`backend`)
- **Порт:** 4000
- **Dockerfile:** `backend/Dockerfile`
- **Команда:** `pnpm start:ws`
- **Зависимости:** PostgreSQL (healthcheck)

### Frontend BFF (`frontend`)
- **Порт:** 3000
- **Dockerfile:** `frontend/Dockerfile`
- **Команда:** `pnpm start` (Next.js production)
- **Зависимости:** PostgreSQL, Backend

## Переменные окружения

### Development (.env)
```bash
POSTGRES_HOST=localhost
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=tg_sync_files
WS_ENDPOINT=ws://localhost:4000
```

### Docker (автоматически)
```bash
POSTGRES_HOST=postgres  # имя сервиса в docker-compose
WS_ENDPOINT=ws://backend:4000  # container-to-container
```

**Примечание:** `DATABASE_URL` генерируется автоматически из переменных `POSTGRES_*`

**Обязательные переменные:**
- `POSTGRES_USER` - имя пользователя PostgreSQL
- `POSTGRES_PASSWORD` - пароль пользователя
- `POSTGRES_DB` - имя базы данных

**Опциональные переменные:**
- `POSTGRES_HOST` - хост (по умолчанию: localhost)
- `POSTGRES_PORT` - порт (по умолчанию: 5432)

Если критичные переменные не заданы, приложение выбросит исключение при старте.

## Отладка

### Логи отдельного сервиса
```bash
docker compose logs -f postgres
docker compose logs -f backend
docker compose logs -f frontend
```

### Подключение к контейнеру
```bash
docker compose exec backend sh
docker compose exec frontend sh
docker compose exec postgres psql -U postgres -d tg_sync_files
```

### Проверка состояния сервисов
```bash
docker compose ps
```

## Разработка

Для development режима используйте локальный запуск без Docker:
```bash
pnpm dev
```

Docker setup предназначен для production-ready окружения и тестирования полной интеграции.
