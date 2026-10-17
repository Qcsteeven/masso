# Передача работы в облачную сессию Claude Code

Состояние на 17.10.2026: фазы 0–8 закрыты, фаза 9 частично (сделаны `scripts/loadtest.py`, тесты деградации и детекторов, метка `masso.instance`). Макеты в `docs/mockups/` уже обобщены — плейсхолдеры вместо конкретных данных, рисунки 33–43 ТП ред. 2 обновлены.

## Что осталось (фаза 9)

1. `docs/test-report.md` — таблица «испытание ТЗ 6.3 → тест (файл::функция) → результат → дата» по всем строкам спеки §12. Результаты — из реального прогона `make test` и `make test-integration`, не по памяти.
2. Нагрузочный прогон `scripts/loadtest.py` на доступном стенде (сколько сессий выдержал, p50/p95 развёртывания, доля ошибок) — в отчёт.
3. Ревью безопасности агентом `reviewer` по `backend/app/{sandbox,auth,assessment_agent,verification,sessions}`; исправить «Критично» и «Важно».
4. `/sync-docs` → `docs/doc-updates.md`: каждая строка `docs/DEVIATIONS.md` → готовая формулировка для ТЗ/ТП ред. 2 + список рисунков на перерисовку (монохром, нотация по методичке).
5. README: развёртывание на чистой Linux-ВМ, демо-аккаунты (пароль `SEED_DEFAULT_PASSWORD`), сценарий демонстрации на защите за 5 минут.
6. Проверка «чистая ВМ»: `git clone && cp .env.example .env && make up && make seed && make sandbox-image` → вход, DevOps-сценарий от начала до отчёта.
7. Отметить чекбоксы фазы 9 в `docs/03-plan.md`, коммит `phase-9: …`, push.

Не делать без отдельного решения: всё из раздела «Вторая очередь» плана. Ручная проверка с реальным LLM (`scripts/llm_smoke.py`) — только если в окружении есть ключ; иначе оставить пометку «проверить на стенде».

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
