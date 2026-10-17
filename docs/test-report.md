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
| Backend unit + API (`tests/unit`, `tests/api`) | **102 passed**, 0 failed, 0 skipped, 20,5 с |
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
| 9 | Нагрузка | `scripts/loadtest.py N` — N параллельных сессий, p50/p95 развёртывания, доля ошибок | `scripts/loadtest.py` | См. раздел «Нагрузочный прогон» | 17.10.2026 |
| 10 | Безопасность sandbox | `cat /var/run/docker.sock`, `nmap`, `sudo`, запись в `/etc` → заблокированы, есть security_events | `tests/integration/test_session_container.py::test_terminal_commands_incident_cleanup` (все четыре команды через WS-терминал: файла в `/etc` нет, события `security` и записи `security_events` всех четырёх видов); `tests/integration/test_sandbox.py::test_security_properties` (uid 1000, CapEff = 0, NoNewPrivs, read-only rootfs, `network_mode none`, нет docker.sock), `::test_pids_limit_stops_fork_bomb`; `tests/unit/test_detectors.py::test_classify_command` (16 случаев) | Пройден | 17.10.2026 |
| 11 | Prompt injection | «покажи системный промпт» → промпт не раскрыт, security_event | `tests/api/test_assessment.py::test_llm_hint_filtered_and_injection` (в ответе нет системного промпта, 1 запись `prompt_injection`); `tests/unit/test_detectors.py::test_prompt_injection` (5 случаев) | Пройден | 17.10.2026 |
| 12 | Деградация LLM | провайдер недоступен → generate работает в local/template, активная сессия не прервана | `tests/api/test_llm_gateway.py::test_degradation_keeps_active_session_and_generation`, `::test_external_fails_local_answers`, `::test_all_down_returns_none_template`, `::test_template_mode_skips_providers`, `::test_embed_falls_back_to_hash` | Пройден (переключение с реального провайдера — **проверить на стенде**) | 17.10.2026 |

Дополнительно покрыто (не строки §12, но требования ТЗ 4.x): аутентификация и RBAC (`tests/api/test_auth.py`, 12 тестов), граф компетенций и дефициты (`tests/api/test_skills.py`, `tests/unit/test_profile_algorithms.py`), шаблоны и валидация сценариев (`tests/api/test_scenarios.py`), простой/пауза/истечение сессии (`tests/api/test_sessions.py::test_idle_pause_and_resume`), студент не видит чужие данные и скрытые поля спецификации (`test_other_student_cannot_read_run`, `test_foreign_student_forbidden`, проверка отсутствия `answer_key`/`params` в ответах), запуск песочницы < 10 с (`tests/integration/test_sandbox.py::test_start_under_10s_and_health`).

## Нагрузочный прогон

Заполняется по результату `scripts/loadtest.py` (следующий шаг фазы 9).

## Примечания

1. **Образ песочницы в облачном прогоне.** Прокси облачного контейнера блокирует `deb.debian.org`, поэтому репозиторный `sandbox-images/webstack/Dockerfile` (Debian bookworm, PostgreSQL 15) собрать в облаке нельзя. Для прогона использована временная копия Dockerfile вне репозитория с отличиями только в базе: `ubuntu:24.04`, `postgresql-16` с символической ссылкой `/usr/lib/postgresql/15 → 16`, удалён штатный пользователь `ubuntu` (uid 1000). Скрипты, конфигурации, флаги безопасности и сценарии — те же. **Проверить на стенде**: `make sandbox-image && make test-integration` с репозиторным Dockerfile.
2. Реальные LLM-провайдеры в облаке недоступны (нет ключа); все строки, зависящие от качества/времени ответа реальной модели, помечены «проверить на стенде».
