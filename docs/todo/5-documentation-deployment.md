# 5. Документация и деплой

## 5.1. Техническая документация
- [ ] OpenAPI/Swagger спецификация в `docs/openapi.yaml`
- [ ] JSDoc/TSDoc для публичных интерфейсов и методов
- [ ] Процедуры: добавление фич, тестирование, деплой
- [ ] Настроить swagger-cli + redocly для валидации и генерации документации

## 5.2. Пользовательская документация
- [ ] README.md: обзор, установка, использование, FAQ
- [ ] Руководство пользователя: Telegram API, настройка каналов, примеры
- [ ] Инструкция по деплою: dev и prod c Docker

## 5.3. CI/CD и codegen
- [ ] GitHub Actions: lint, format, type-check, tests, codegen, deploy (последовательные шаги)
- [ ] Параллельные jobs для backend и frontend
- [ ] Генерация TS SDK из OpenAPI (openapi-generator)
- [ ] Интеграция codegen в CI

## 5.4. Production развертывание
- [ ] Один Dockerfile с несколькими стадиями
- [ ] Отдельные Dockerfile для dev и prod
- [ ] Env для prod, Docker multi-stage, nginx reverse proxy, SSL
- [ ] Orchestration: Docker Compose, health checks, networking
- [ ] GitHub Actions: parallel jobs, E2E, deploy, rollback, monitoring

## 5.5. Финальная проверка MVP
- [ ] Соответствие спецификации, все сценарии, code review, performance, security, docs

## 5.6. Reverse Proxy и SSL
- [ ] nginx + certbot в контейнере
- [ ] Использовать внешние прокси (Traefik)

## 5.7. Runbook и документация операций
- [ ] Markdown runbook в репозитории
- [ ] Confluence / Wiki
- [ ] PDF с шагами восстановления
