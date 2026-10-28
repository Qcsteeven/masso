# Передача работы

Состояние на 28.10.2026: фазы 0–9 закрыты, система проверена на локальном стенде. Результаты — `docs/test-report.md` (испытания §12, нагрузка до 50 сессий, ревью безопасности в 4 круга, «чистая ВМ»), правки документов — `docs/doc-updates.md`, отклонения — `docs/DEVIATIONS.md` (34 строки), развёртывание и сценарий защиты — `README.md`.

## Проверка на локальном стенде (28.10.2026)

Windows + WSL2 (Ubuntu 24.04, Docker Desktop 29.2, 12 vCPU, 15,5 ГБ): `make up`/`make sandbox-image` с репозиторными Dockerfile, все наборы тестов, GigaChat через прокси gpt2giga, HTTPS-режим, нагрузка N = 5/10/20 (и N = 3 с GigaChat), сценарий защиты в браузере — `docs/test-report.md`, «Проверка на локальном стенде». Найдено и исправлено 6 проблем (там же), отклонение Д-34.

## Что осталось

1. Нагрузка N = 50 на 16 vCPU (`SANDBOX_MAX_SESSIONS=60`); с GigaChat — только с ключом юрлица (у физлица один одновременный запрос, `GIGACHAT_MAX_CONCURRENCY`).
2. Вход через браузер с другой машины по адресу ВМ; блокировка входа за NAT класса (`LOGIN_MAX_FAILURES_PER_IP`).
3. HTTPS с настоящим сертификатом для доменного имени сервера.
4. Эмбеддинги GigaChat (платный пакет): проверить размерность (`fit_dim` приводит к 1024) и качество дедупликации.
5. Ручной проход сценария защиты пользователем и замечания по удобству.

Не делать без отдельного решения: всё из раздела «Вторая очередь» плана.

## Особенности облачного контейнера (только для облачной сессии; на своей машине не нужны)

- Docker-демон не запущен: `(dockerd > /tmp/dockerd.log 2>&1 &)`, затем подождать `docker info`.
- Docker Hub отвечает 429 (лимит анонимных скачиваний). Брать базовые образы с зеркала и перетэгировать:
  ```bash
  for i in library/python:3.13-slim library/node:22-alpine library/nginx:1.27-alpine library/debian:bookworm-slim; do
    docker pull -q mirror.gcr.io/$i && docker tag mirror.gcr.io/$i ${i#library/}; done
  docker pull -q mirror.gcr.io/pgvector/pgvector:pg18 && docker tag mirror.gcr.io/pgvector/pgvector:pg18 pgvector/pgvector:pg18
  ```
- Сеть внутри `docker build` идёт только через прокси агента с его CA. Для сборки образов использовать `scripts/dev/cloud-build.sh <контекст> <тег>` — он подставляет CA и прокси после каждого `FROM`; репозиторные Dockerfile не менять.
- Dev-БД для тестов: `docker run -d --name masso-devdb -e POSTGRES_USER=masso -e POSTGRES_PASSWORD=masso -e POSTGRES_DB=masso -p 5433:5432 pgvector/pgvector:pg18`; тесты берут `TEST_DATABASE_URL` по умолчанию `…localhost:5433/masso_test`.
- uv: выполнять с `env -u UV_NATIVE_TLS uv …` (иначе шумное предупреждение).
- Стек целиком: собрать `masso-backend`, `masso-frontend`, `masso/webstack` через `cloud-build.sh`, затем `docker compose` с override, где у backend/frontend `image:` вместо `build:`.
- Debian-зеркала заблокированы прокси: образ песочницы собирать временной копией Dockerfile вне репозитория — `FROM ubuntu:24.04`, `postgresql-16` + `ln -s /usr/lib/postgresql/16 /usr/lib/postgresql/15`, `userdel -r ubuntu` перед созданием student (точная sed-подстановка — в истории сессии и test-report, примечание 1); передать третьим аргументом в `cloud-build.sh`.
- ghcr.io заблокирован: перед сборкой backend собрать локальный образ `ghcr.io/astral-sh/uv:0.11` из `FROM scratch` + `COPY uv /uv` (бинарник `~/.local/bin/uv`).
- Playwright: `PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux*/chrome` (версия пакета ждёт другую сборку Chromium).
- Тесты, которые идут параллельно (например, у субагента), запускать на отдельной БД (`…/masso_test2`): фикстура пересоздаёт схему и ломает соседний прогон («cache lookup failed for type»).
