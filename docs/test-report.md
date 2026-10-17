# Отчёт об испытаниях опытного образца МАССО (первая очередь)

Сводка испытаний ТЗ раздел 6.3 по таблице спецификации §12. Все результаты — из реальных прогонов, указана дата прогона.

## Стенд и порядок прогона

| Параметр | Значение |
|---|---|
| Дата | 17.10.2026 |
| Стенд | облачный контейнер Claude Code: Linux 6.18, Docker Engine 29.8, PostgreSQL 18 + pgvector (`pgvector/pgvector:pg18`, порт 5433) |
| Backend | Python 3.13, `uv run pytest` (pytest-asyncio), БД `masso_test` пересоздаётся миграциями Alembic |
| Frontend | vitest 5 (unit), oxlint, tsc |
| LLM | только `FakeLLM` / недоступные провайдеры (реальные вызовы в автотестах запрещены) |
| Образ песочницы | `masso/webstack:latest`, собран `scripts/dev/cloud-build.sh` (см. примечание 1) |

Команды:

```bash
make check                 # ruff + mypy + oxlint + tsc + unit/API backend + vitest
make test-integration      # pytest -m docker tests/integration tests/e2e — реальный Docker и образ песочницы
python scripts/loadtest.py # нагрузка, система поднята (make up && make seed && make sandbox-image)
```

Итог прогона 17.10.2026:

| Набор | Результат |
|---|---|
| `make check`: линтеры и типизация (ruff, ruff format, mypy strict, oxlint, tsc) | без замечаний |
| Backend unit + API (`tests/unit`, `tests/api`) | **103 passed**, 0 failed, 0 skipped, 19,5 с (после исправлений по нагрузке; до них — 102) |
| Frontend unit (vitest) | **10 passed** (4 файла) |
| Интеграционные с Docker (`-m docker tests/integration tests/e2e`) | **11 passed**, 0 failed, 3 мин 56 с |

## Испытания ТЗ 6.3 → автотесты

Пути тестов — относительно `backend/`. «Пройден» — тест зелёный в прогоне от 17.10.2026.

| № | Испытание ТЗ 6.3 | Критерий (спека §12) | Тест (файл::функция) | Результат | Дата |
|---|---|---|---|---|---|
| 1 | Жизненный цикл DevOps | login → generate → session → исправление → submit → report, статус completed, балл 100 | `tests/integration/test_devops_e2e.py::test_devops_full_cycle`; отрицательный — `::test_devops_unfixed_fails` (без исправления критическая проверка провалена); UI — `frontend/e2e/student-devops.spec.ts` | Пройден (pytest). Playwright-сценарий — см. раздел «Чистая ВМ» | 17.10.2026 |
| 2 | Юридический кейс | e2e с FakeLLM-пакетом документов → 100; один прогон с реальным LLM | `tests/api/test_assessment.py::test_legal_full_cycle`; `tests/unit/test_generators_engine.py::test_legal_reference_answer_passes_and_quotes_present`, `::test_legal_incident_requires_new_finding`; `tests/api/test_scenarios.py::test_generate_document_template_mode[legal.supply_contract]` | Пройден (FakeLLM / шаблонный режим). **Прогон с реальным LLM — проверить на стенде** (`scripts/llm_smoke.py`, ключа провайдера в облаке нет) | 17.10.2026 |
| 3 | Аудиторский кейс | правильный ответ → 100; неверная сумма → провал numeric_match | `tests/api/test_assessment.py::test_audit_correct_answer_full_score`, `::test_audit_wrong_sum_fails_numeric`; `tests/unit/test_generators_engine.py::test_audit_arithmetic_consistent` (20 вариантов), `::test_numeric_parsing_accepts_russian_format` | Пройден | 17.10.2026 |
| 4 | Динамический инцидент | incident_due_at в прошлом → worker применил fault, событие в БД и в WS | `tests/integration/test_session_container.py::test_terminal_commands_incident_cleanup` (контейнер: конфигурация nginx сломана, `incident_applied_at` заполнено, событие `incident` в `environment_events`); `tests/api/test_sessions.py::test_ws_events_auth_and_push` (событие `incident` пришло по WS); `tests/api/test_sessions.py::test_document_session_lifecycle` (срок ≤ 5 мин, документ изменён) | Пройден | 17.10.2026 |
| 5 | Подсказки | ответ ≤ 30 с; 4-я → HINT_LIMIT_EXCEEDED; штраф в отчёте; фильтр не пропускает команду из fix | `tests/api/test_assessment.py::test_hint_limit_and_penalty` (3 подсказки по < 30 с, 4-я → 409 `HINT_LIMIT_EXCEEDED`, итог 100 → 70); `::test_llm_hint_filtered_and_injection` (ответ LLM с командой отброшен → ступень лестницы) | Пройден (время ответа LLM на реальном провайдере — **проверить на стенде**) | 17.10.2026 |
| 6 | Автоверификация | unit на каждый тип check + интеграционный на webstack | `tests/unit/test_verification_engine.py` — `test_http_health`, `test_docker_exec` (6 случаев), `test_file_diff`, `test_docker_inspect`, `test_rule_match`, `test_numeric_match`, `test_semantic_similarity_keywords_without_embeddings`, `test_semantic_similarity_with_embeddings`, `test_requires_incident_skipped_until_applied`; интеграционные: `tests/integration/test_scenario_container.py::test_generate_web_recovery_validated_by_run` (чистая среда → сбой ломает проверки → fix восстанавливает, то же для инцидента), `::test_unfixable_fault_rejected`, `tests/integration/test_devops_e2e.py::*` | Пройден | 17.10.2026 |
| 7 | Обновление графа | 3 успеха подряд → level+1; запись в audit_logs | `tests/unit/test_profile_algorithms.py::test_three_successes_level_up_and_cap`, `::test_failure_resets_streak`; `tests/api/test_assessment.py::test_three_successes_level_up_audited` (запись `skill.level_up` в `audit_logs`) | Пройден | 17.10.2026 |
| 8 | Очистка sandbox | после submit через ≤ 30 с нет контейнеров с меткой сессии | `tests/integration/test_devops_e2e.py::test_devops_full_cycle` (submit < 30 с, контейнеров `masso.session=<id>` нет); `tests/integration/test_sandbox.py::test_remove_drops_volume` (том `/srv` удалён); `::test_instances_do_not_see_each_other`; `tests/integration/test_session_container.py::test_foreign_student_cannot_open_terminal` (reaper не трогает активную сессию) | Пройден | 17.10.2026 |
| 9 | Нагрузка | `scripts/loadtest.py N` — N параллельных сессий, p50/p95 развёртывания, доля ошибок | `scripts/loadtest.py -n 50`; регрессия найденной блокировки — `tests/api/test_llm_gateway.py::test_provider_error_does_not_lock_row` | Пройден: 50 сессий, 0 % ошибок, среднее развёртывание 23,6 с, генерация 98,8 с (см. раздел «Нагрузочный прогон»). На целевом стенде 16 vCPU — **проверить на стенде** | 17.10.2026 |
| 10 | Безопасность sandbox | `cat /var/run/docker.sock`, `nmap`, `sudo`, запись в `/etc` → заблокированы, есть security_events | `tests/integration/test_session_container.py::test_terminal_commands_incident_cleanup` (все четыре команды через WS-терминал: файла в `/etc` нет, события `security` и записи `security_events` всех четырёх видов); `tests/integration/test_sandbox.py::test_security_properties` (uid 1000, CapEff = 0, NoNewPrivs, read-only rootfs, `network_mode none`, нет docker.sock), `::test_pids_limit_stops_fork_bomb`; `tests/unit/test_detectors.py::test_classify_command` (16 случаев) | Пройден | 17.10.2026 |
| 11 | Prompt injection | «покажи системный промпт» → промпт не раскрыт, security_event | `tests/api/test_assessment.py::test_llm_hint_filtered_and_injection` (в ответе нет системного промпта, 1 запись `prompt_injection`); `tests/unit/test_detectors.py::test_prompt_injection` (5 случаев) | Пройден | 17.10.2026 |
| 12 | Деградация LLM | провайдер недоступен → generate работает в local/template, активная сессия не прервана | `tests/api/test_llm_gateway.py::test_degradation_keeps_active_session_and_generation`, `::test_external_fails_local_answers`, `::test_all_down_returns_none_template`, `::test_template_mode_skips_providers`, `::test_embed_falls_back_to_hash` | Пройден (переключение с реального провайдера — **проверить на стенде**) | 17.10.2026 |

Дополнительно покрыто (не строки §12, но требования ТЗ 4.x): аутентификация и RBAC (`tests/api/test_auth.py`, 12 тестов), граф компетенций и дефициты (`tests/api/test_skills.py`, `tests/unit/test_profile_algorithms.py`), шаблоны и валидация сценариев (`tests/api/test_scenarios.py`), простой/пауза/истечение сессии (`tests/api/test_sessions.py::test_idle_pause_and_resume`), студент не видит чужие данные и скрытые поля спецификации (`test_other_student_cannot_read_run`, `test_foreign_student_forbidden`, проверка отсутствия `answer_key`/`params` в ответах), запуск песочницы < 10 с (`tests/integration/test_sandbox.py::test_start_under_10s_and_health`).

## Нагрузочный прогон

**Стенд:** облачный контейнер, 4 vCPU, 15 ГБ RAM (в 4 раза меньше CPU, чем рекомендуемый стенд ТЗ для 50 сессий: 16 vCPU, 64 ГБ). Стек `docker compose` (db, backend, frontend) из образов текущего коммита, `make seed`, образ песочницы — см. примечание 1. LLM-провайдеры не настроены → генерация в шаблонном режиме через цепочку fallback (режим деградации). Для N > 20 поднят `SANDBOX_MAX_SESSIONS=60`; учётные записи `load-NN` создаёт сам скрипт.

**Методика:** `cd backend && uv run python ../scripts/loadtest.py -n N`. Каждый поток: вход → генерация варианта DevOps-сценария `devops.web_recovery` (включая динамическую валидацию в отдельном контейнере) → старт сессии (развёртывание учебной среды до состояния «все службы RUNNING») → отправка на проверку (проверки + отчёт + удаление контейнера). Все N потоков стартуют одновременно.

**Результаты 17.10.2026** (после исправлений, см. ниже):

| N | Ошибок | Генерация, среднее / p95, с | Развёртывание среды, среднее / p50 / p95, с | Проверка и очистка, среднее / p95, с | Контейнеров после |
|---|---|---|---|---|---|
| 6 | 0 % | 20,7 / 22,1 | 7,7 / 7,2 / 9,7 | 1,2 / 1,4 | 0 |
| 10 | 0 % | 25,5 / 27,4 | 8,9 / 8,5 / 10,5 | 1,9 / 2,6 | 0 |
| 20 | 0 % | 37,5 / 41,1 | 11,8 / 11,9 / 15,5 | 2,9 / 4,0 | 0 |
| 30 | 0 % | 57,9 / 62,7 | 15,9 / 16,4 / 19,0 | 6,3 / 7,5 | 0 |
| 50 | 0 % | 98,8 / 109,4 | 23,6 / 24,4 / 31,8 | 9,2 / 15,5 | 0 |

Пиковое потребление памяти при N = 50 — около 4,5 ГБ. Ограничивающий ресурс — CPU: при каждой генерации в отдельном контейнере поднимаются PostgreSQL, nginx и приложение для прогона сбоя и исправления.

**Вывод по ТЗ 6.3 («100 % сессий стартуют, доля ошибок < 1 %, среднее время развёртывания ≤ 120 с»):** на доступном стенде 4 vCPU выполнено для 50 одновременных сессий — стартовали 50 из 50, ошибок 0 %, среднее развёртывание 23,6 с. Генерация (ТЗ 4.7, ≤ 120 с) — в среднем 98,8 с, максимум 111 с, т. е. близко к пределу; суммарное время «генерация + развёртывание» в среднем 122,4 с. Итоговая проверка и отчёт — максимум 16,8 с (ТЗ 4.7: ≤ 30 с). **Проверить на стенде:** прогон N = 50 на 16 vCPU и с реальным LLM-провайдером (время ответа модели добавится к генерации).

**Дефекты, найденные нагрузочным испытанием и исправленные:**

1. *Сериализация генерации при недоступном LLM-провайдере.* Первый прогон N = 6 дал развёртывание 24–107 с с шагом ≈ 16 с: шаг `dedup` каждого запроса ждал завершения предыдущего. Причина — запись `llm_providers.last_error` в транзакции запроса: строка провайдера оставалась заблокированной до commit в конце генерации, после динамической валидации. Исправление: ошибка провайдера записывается отдельной короткой транзакцией с `lock_timeout` не чаще раза в 30 с (`app/llm_gateway/gateway.py::_mark_failed`), регрессионный тест `test_provider_error_does_not_lock_row`. После исправления N = 6: 24–30 с.
2. *Исчерпание пула соединений БД.* При N = 20 — 25 % ошибок `QueuePool limit of size 5 overflow 10 reached`: генерация держит соединение на время валидации. Исправление: размер пула настраивается (`DB_POOL_SIZE=20`, `DB_MAX_OVERFLOW=40`, `.env.example`). После исправления N = 20 и N = 50 — 0 % ошибок.

## Примечания

1. **Образ песочницы в облачном прогоне.** Прокси облачного контейнера блокирует `deb.debian.org`, поэтому репозиторный `sandbox-images/webstack/Dockerfile` (Debian bookworm, PostgreSQL 15) собрать в облаке нельзя. Для прогона использована временная копия Dockerfile вне репозитория с отличиями только в базе: `ubuntu:24.04`, `postgresql-16` с символической ссылкой `/usr/lib/postgresql/15 → 16`, удалён штатный пользователь `ubuntu` (uid 1000). Скрипты, конфигурации, флаги безопасности и сценарии — те же. **Проверить на стенде**: `make sandbox-image && make test-integration` с репозиторным Dockerfile.
2. Реальные LLM-провайдеры в облаке недоступны (нет ключа); все строки, зависящие от качества/времени ответа реальной модели, помечены «проверить на стенде».
