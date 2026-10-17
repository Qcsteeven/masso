# Передача работы в облачную сессию Claude Code

Состояние на 17.10.2026 (вечер): фазы 0–9 закрыты, чекбоксы фазы 9 отмечены. Результаты — `docs/test-report.md` (испытания §12, нагрузка до 50 сессий, ревью безопасности в 4 круга, «чистая ВМ»), правки документов — `docs/doc-updates.md`, отклонения — `docs/DEVIATIONS.md` (32 строки), развёртывание и сценарий защиты — `README.md`.

## Что осталось проверить на стенде (в облаке невозможно)

1. Linux-ВМ: `make up` и `make sandbox-image` с репозиторными Dockerfile (облако блокирует deb.debian.org и ghcr.io — здесь образы собирались с подменами, см. ниже).
2. Реальный LLM: `scripts/llm_smoke.py external|local`, генерация легенды и подсказок, время ответа (ТЗ 4.7: генерация ≤ 120 с), переключение режима при отказе провайдера.
3. Нагрузка N = 50 на 16 vCPU и с реальным LLM (`scripts/loadtest.py -n 50`, `SANDBOX_MAX_SESSIONS=60`).
4. Вход через браузер с другой машины; блокировка входа за NAT класса (`LOGIN_MAX_FAILURES_PER_IP`).

Не делать без отдельного решения: всё из раздела «Вторая очередь» плана.

## Особенности облачного контейнера

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
