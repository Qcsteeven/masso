# МАССО — команды разработки. Требуются: docker compose, uv, pnpm.
SHELL := /bin/bash
COMPOSE := docker compose
BACK := cd backend &&
FRONT := cd frontend &&
TEST_DATABASE_URL ?= postgresql+asyncpg://masso:masso@localhost:5433/masso_test

TLS := -f docker-compose.yml -f docker-compose.tls.yml

.PHONY: up up-tls tls-selfsigned check-tls down logs migrate seed sandbox-image dev-db dev-back dev-front test test-back test-front test-integration lint typecheck check e2e fmt

up:            ## собрать и поднять систему (http://localhost)
	$(COMPOSE) up -d --build

up-tls:        ## эксплуатационный режим: HTTPS/WSS на 443, редирект с 80 (сертификат в ./certs)
	$(COMPOSE) $(TLS) up -d --build

tls-selfsigned: ## самоподписанный сертификат в ./certs для проверки HTTPS-режима (не для эксплуатации)
	mkdir -p certs && openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj "/CN=localhost" \
	  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" -keyout certs/privkey.pem -out certs/fullchain.pem

check-tls:     ## проверка HTTPS-режима: редирект, TLS 1.2/1.3, HSTS, Secure-cookie
	scripts/check_tls.sh

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f --tail=200

migrate:       ## миграции в контейнере backend
	$(COMPOSE) exec backend alembic upgrade head

seed:          ## идемпотентный сид: роли, пользователи, граф, шаблоны
	$(COMPOSE) exec backend python -m app.seed

sandbox-image: ## образ учебного сервера для DevOps-сценариев
	docker build -t masso/webstack:latest sandbox-images/webstack

dev-db:        ## отдельный PostgreSQL+pgvector для разработки и тестов (порт 5433)
	docker run -d --name masso-devdb -e POSTGRES_USER=masso -e POSTGRES_PASSWORD=masso -e POSTGRES_DB=masso \
	  -p 5433:5432 pgvector/pgvector:pg18 || docker start masso-devdb

dev-back:
	$(BACK) uv run alembic upgrade head && uv run python -m app.seed && uv run uvicorn app.main:app --reload --port 8000

dev-front:
	$(FRONT) pnpm dev

test-back:     ## unit + API-тесты (API-тесты пропускаются без PostgreSQL)
	$(BACK) TEST_DATABASE_URL=$(TEST_DATABASE_URL) uv run pytest tests/unit tests/api

test-front:
	$(FRONT) pnpm test

test: test-back test-front

test-integration: ## тесты с реальным Docker и образом песочницы
	$(BACK) TEST_DATABASE_URL=$(TEST_DATABASE_URL) uv run pytest -m docker tests/integration tests/e2e

lint:
	$(BACK) uv run ruff check . && uv run ruff format --check .
	$(FRONT) pnpm lint

typecheck:
	$(BACK) uv run mypy
	$(FRONT) pnpm typecheck

check: lint typecheck test ## всё перед коммитом

fmt:
	$(BACK) uv run ruff check --fix . && uv run ruff format .

e2e:           ## Playwright, система должна быть поднята (make up && make seed)
	$(FRONT) pnpm test:e2e
