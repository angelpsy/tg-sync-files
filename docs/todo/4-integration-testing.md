# 4. Интеграция и тестирование

## 4.1. Интеграционные тесты

- [ ] Настроить Jest + Supertest + Testing Library с Docker Compose тестовой БД
- [ ] Моки внешних зависимостей:
  - [ ] Mock GramJS с локальным эмулятором
  - [ ] nock для HTTP-вызовов
  - [ ] Собственные stub-сервисы
- [ ] Написать тесты для сервисов: StorageService, SyncService, FSService, API
      handlers

## 4.2. End-to-End тестирование

- [ ] Настроить Playwright для e2e-тестов
- [ ] Описать сценарии успешные: сканирование, загрузка, выгрузка,
      переименование, обновления
- [ ] Описать сценарии ошибок: конфликты, ошибки FS, потеря WS, недоступность
      Telegram
- [ ] Настроить нагрузочное тестирование с помощью Artillery

## 4.3. Мануальное тестирование

- [ ] Чек-лист UI/UX: responsive, accessibility, edge cases
- [ ] Совместимость: OS, браузеры, версии Node.js

## 4.4. Мониторинг и логирование

- [x] Настроить Pino (универсальный логгер), уровни логирования per-service,
      ErrorHandler
  - [x] Поддержка Node.js и Browser environments
  - [x] Per-service configuration через ENV переменные (LOG_LEVEL_FS,
        LOG_LEVEL_TELEGRAM, etc.)
  - [x] Structured JSON logging с красивым development форматом
- [ ] Собрать метрики и логи:
  - [ ] Время выполнения запросов
  - [ ] Потребление памяти и CPU
  - [ ] Логи WebSocket событий
- [ ] Расширить логгер дополнительными транспортами:
  - [ ] File transport для production (через Pino ecosystem)
  - [ ] Remote logging для браузера (отправка на backend)
  - [ ] Metrics collection (интеграция с Prometheus/OpenTelemetry)
