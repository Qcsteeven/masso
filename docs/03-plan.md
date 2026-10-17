# План реализации МАССО (первая очередь)

Каждая фаза — отдельная сессия Claude Code: `/clear` → `/phase N`. Фаза заканчивается зелёным `make check`, отмеченными чекбоксами «Готово, когда» и коммитом `phase-N: …`. Порядок важен: фазы 0–7 дают работающий backend, проверяемый через API и тесты; UI — в фазе 8.

Ссылки вида «§6» — на разделы `docs/02-mvp-spec.md`.

---

## Фаза 0. Каркас и инструменты

**Цель:** репозиторий, в котором `make up` поднимает пустую систему, а `make check` гоняет все проверки.

- Структура каталогов по §1.2. `backend/` на uv (Python 3.13), `frontend/` на pnpm + Vite + React + TS + Tailwind + shadcn/ui.
- `docker-compose.yml`: `db` (pgvector, healthcheck, volume), `backend` (uvicorn, монтирует docker.sock, зависит от db), `frontend` (multi-stage: build → nginx, проксирует `/api` и `/ws` на backend). Профиль `llm` с Ollama — опционально.
- Backend: `config.py` (pydantic-settings), `errors.py` (единый конверт ответа и коды §10, middleware `request_id`), `/api/health`, `/metrics`, логирование JSON.
- Frontend: роутер, layout с меню, страница входа-заглушка, клиент API (TanStack Query) с обработкой конверта ошибок.
- `Makefile`: `up`, `down`, `logs`, `migrate`, `seed`, `test`, `test-integration`, `lint`, `typecheck`, `check` (= lint + typecheck + unit-тесты back и front), `e2e`.
- `.env.example`, `.gitignore`, README «как запустить».

**Готово, когда:**
- [x] `make up` → `curl localhost/api/health` отдаёт `{"status":"success",...}`, SPA открывается
- [x] `make check` зелёный (пусть даже на 2–3 тестах)
- [x] ruff, mypy, eslint, tsc настроены и запускаются хуком/командой

## Фаза 1. Данные, аутентификация, RBAC, аудит

**Цель:** все таблицы §3, вход/выход, роли, журнал аудита.

- SQLAlchemy-модели и Alembic-миграция для всех таблиц §3 (включая pgvector extension).
- Seed (`make seed`): 5 ролей; пользователи по одному на роль + 6 студентов в группе ИСИб-23-1 (пароли из `.env`); домены devops/legal/audit/security.
- `/api/auth/*`: argon2-хеши, JWT access (15 мин) в теле/заголовке + refresh в HttpOnly-cookie (7 дней, ротация), logout отзывает refresh.
- Зависимость `require_roles(...)`; проверка «своё/чужое» для студента и «своя группа» для преподавателя.
- `/api/users` (admin), `audit_logs` пишется для изменения ролей, статуса, оценок, LLM-режима.

**Готово, когда:**
- [x] Тесты: неверный пароль → AUTH_INVALID_CREDENTIALS; студент на admin-эндпоинте → AUTH_FORBIDDEN; refresh ротирует токен
- [x] Смена роли создаёт запись в audit_logs с before/after
- [x] `make migrate && make seed` идемпотентны

## Фаза 2. Граф компетенций и ProfileAgent

**Цель:** §6 «Дефициты», «Рекомендации», «Обновление профиля».

- Seed графа: 12–20 навыков DevOps (Linux CLI, логи, Docker-основы, nginx, PostgreSQL-клиенты…) + 5–8 для legal и audit, связи REQUIRES с весами, track_targets.
- `/api/skills/graph`, CRUD, `/import` (JSON и CSV, валидация циклов — граф должен быть ацикличен), `/me`, `/recommendations`.
- `profile_agent/service.py`: `deficits(user, domain)`, `recommendations(user, domain)`, `apply_result(user, template, passed)` — чистые функции + SQL (recursive CTE для транзитивных зависимых).

**Готово, когда:**
- [x] Unit-тесты алгоритма на фикстурах: разрыв ≥2, давность 30 дней, critical при >3 зависимых, 3 успеха подряд → level+1, cap по level_max
- [x] Импорт графа с циклом отклоняется с VALIDATION_ERROR

## Фаза 3. LLM Gateway

**Цель:** §8 — один интерфейс к внешнему/локальному/шаблонному режиму.

- Клиент `openai` с `base_url` из `llm_providers`; `complete_json(schema)` с валидацией и одним ретраем; `embed()`.
- Цепочка fallback по `generation_mode`; таймауты; учёт 429; запись в `agent_logs`.
- `/api/admin/llm/*`: список провайдеров, health (пинг `/models`), `switch-mode {mode, reason}` → audit + событие для преподавателей.
- `FakeLLM` и фикстура pytest, подменяющая gateway.

**Готово, когда:**
- [x] Тест: основной провайдер бросает ошибку → ответ получен от local; оба недоступны → режим template без исключения
- [x] Невалидный JSON от модели → ретрай с текстом ошибки → валидный объект
- [ ] Ручная проверка с реальным провайдером (`scripts/llm_smoke.py`) — вывод приложить в DEVIATIONS/отчёт — **проверить на стенде**: в облачной сессии ключей провайдера нет

## Фаза 4. Песочница: образ webstack и Sandbox Manager

**Цель:** §5 (шаблон 1, образ) и §7.

- `sandbox-images/webstack/Dockerfile`: Debian slim, nginx, python-приложение `store-api` (`/health` → 200 только при живом коннекте к БД), PostgreSQL, supervisord; пользователь `student`; всё изменяемое в `/srv`; `PROMPT_COMMAND`-логгер команд в `/tmp/.masso/cmd.log`; инструменты для студента: `less`, `nano`, `vim-tiny`, `curl`, `ps`, `ss`.
- `sandbox/manager.py`: create (все флаги §7, профили из `sandbox_profiles`), exec (stdout/exit code, timeout), pause/unpause, snapshot `/srv`, remove, list_by_label, reaper.
- `make sandbox-image` собирает образ.

**Готово, когда:**
- [x] Интеграционный тест (маркер `docker`): контейнер стартует < 10 с, `/health` = 200 через exec
- [x] Тест безопасности: `id` → не root; запись в `/etc` → ошибка; `cat /var/run/docker.sock` → нет файла; `curl` наружу → нет сети; fork-бомба упирается в pids_limit
- [x] Удаление контейнера убирает и анонимный том

## Фаза 5. Сценарии и ScenarioAgent

**Цель:** §4, §5, §9 (граф генерации и валидации).

- Pydantic `ScenarioSpec` (discriminated union container/document), `ScenarioPublic` без скрытых полей.
- 3 шаблона в `backend/seed/templates/`: `web_recovery` (container), `supply_contract` (document, LLM), `invoice_reconciliation` (document, числа генерирует код). Для каждого — пул из 3 предгенерированных вариантов для template-режима.
- LangGraph-граф ScenarioAgent §9: параметры → легенда → сборка → статическая валидация → dedup (pgvector ≥ 0.90) → динамическая валидация → publish/reject; `validation_report` в БД.
- `/api/scenarios/*`, назначения группе.

**Готово, когда:**
- [x] Для `web_recovery` dynamic_validate доказывает: после сбоя checks падают, после fix — проходят (и для инцидента)
- [x] Шаблон с заведомо нерешаемым сбоем (fix не чинит) получает status=rejected
- [x] Генерация в template-режиме работает с выключенным LLM; время генерации < 120 с (замер в тесте)
- [x] Студенческий `GET /runs/{id}` не содержит checks/faults/answer_key (тест)

## Фаза 6. Сессии, терминал, цифровой след, worker

**Цель:** жизненный цикл сессии, WebSocket-терминал, события, инциденты, бездействие.

- `/api/sessions`: создание (песочница или пакет документов), статусы §3, ws-token, pause/resume, ответы тренажёра.
- WS terminal: мост xterm ↔ `docker exec` TTY от `student` (aiodocker; если интерактивный exec капризничает — docker-py в thread executor), resize, закрытие.
- WS events: статусы, инциденты, подсказки, предупреждения.
- Сбор команд из `cmd.log` → `environment_events(type=command)`; детектор подозрительных команд → security_events.
- `worker.py`: инциденты по `incident_due_at`, пауза 15 мин / истечение 24 ч, очистка, жнец, retention.

**Готово, когда:**
- [x] Интеграционный тест WS: отправить `echo hi\n` → получить `hi`; команда появилась в environment_events
- [x] Инцидент применяется к due-времени и приходит в WS events
- [x] Бездействие (время подменяется в тесте) → paused → действие → active
- [x] Чужой студент не может открыть WS сессии (токен привязан к user/session)

## Фаза 7. AssessmentAgent: подсказки, проверка, оценка, отчёт

**Цель:** §4.1, §6 «Балл», «Подсказки», §9 (граф пост-обработки).

- Verification Engine: реализации всех типов check §4.1.
- Подсказки: лимит 3, штраф, пост-фильтр, fallback на лестницу, время ответа.
- Граф: collect_trace → run_checks → score → update_profile → build_report → cleanup (≤ 30 с).
- `/api/verification/*` (корректировка преподавателем с причиной → audit), `/api/reports/*` (обязательный период, CSV/JSON).
- Prompt-injection детектор на вход подсказок и ответов.

**Готово, когда:**
- [x] e2e (pytest, без UI): полный цикл для всех трёх шаблонов → отчёт с баллом, checks, подсказками; профиль обновлён
- [x] 4-я подсказка → HINT_LIMIT_EXCEEDED; подсказка не содержит команды из fix (тест с FakeLLM, который «пытается» её выдать)
- [x] После submit контейнера нет через ≤ 30 с
- [x] Корректировка без причины → VALIDATION_ERROR

## Фаза 8. Интерфейс

**Цель:** §11, внешний вид по `docs/mockups/`. Делать по ролям, после каждой — проверка агентом `ui-checker`.

- 8a. Вход + layout + студент: панель, рабочая область (xterm/тренажёр, таймер, журнал, подсказки, отправка), отчёт.
- 8b. Преподаватель: панель группы с фильтрами, цифровой след, корректировка, экспорт.
- 8c. Методист: граф (@xyflow/react) + импорт; шаблоны (редактор спецификации, валидация, публикация).
- 8d. Администратор: пользователи/роли, LLM и инфраструктура (переключение режима), аудит/security, страница «Состояние системы» для sysadmin.

**Готово, когда:**
- [x] `ui-checker` прошёл каждую роль: нет ошибок в консоли, ключевые элементы макетов на месте, скриншоты в `.artifacts/ui/` (`frontend/e2e/roles.spec.ts`)
- [x] Playwright e2e: студент проходит DevOps-сценарий в браузере (вводит команды в терминал) и видит отчёт (`frontend/e2e/student-devops.spec.ts`, балл 100)
- [x] Навигация с клавиатуры по основным действиям (`frontend/e2e/keyboard.spec.ts`)

## Фаза 9. Испытания и документация

**Цель:** ТЗ раздел 6 закрыт тестами и отчётом; ТЗ/ТП синхронизированы с кодом.

- Добить недостающие тесты по таблице §12; `scripts/loadtest.py` (N параллельных сессий, p50/p95 развёртывания, доля ошибок) — прогнать на стенде.
- `docs/test-report.md`: требование ТЗ → тест → результат → дата.
- Ревью безопасности: агент `reviewer` по всему коду sandbox/auth/assessment.
- `/sync-docs` → `docs/doc-updates.md` (правки ТЗ/ТП «было/стало/почему» + список рисунков на перерисовку).
- README: развёртывание на чистой Linux-ВМ, демо-аккаунты, сценарий демонстрации на защите (5 минут).

**Готово, когда:**
- [ ] Все строки §12 имеют результат в test-report.md
- [ ] Чистая ВМ: `git clone && cp .env.example .env && make up && make seed` → демо работает
- [ ] doc-updates.md покрывает все записи DEVIATIONS.md

---

## Вторая очередь (не делать без отдельного решения)

Neo4j, ChromaDB, Redis, Kubernetes, Grafana, ИБ-шаблон с allowlist-сетью, Sysbox для docker внутри песочницы, сохранение альтернативных решений в базу знаний, 2FA.
