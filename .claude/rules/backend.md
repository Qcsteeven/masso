---
paths:
  - "backend/**/*.py"
---

# Backend

- Структура модуля: `router.py` (FastAPI), `schemas.py` (Pydantic, отдельно `*Public` для студента), `service.py` (логика), `models.py` (SQLAlchemy). Роутер не ходит в БД напрямую — только через сервис.
- Доступ: каждый роутер объявляет `Depends(require_roles(...))`; проверки «своё/своя группа» — в сервисе, с тестом.
- Ошибки: бросай `AppError(code, message_ru, details)`; коды — только из спеки §10. Не возвращай трассировки и внутренние пути клиенту.
- Время — `datetime.now(UTC)`, в БД `timestamptz`. Для тестов времени — инъекция часов (`Clock`), не `sleep`.
- Изменения оценок, ролей, LLM-режима, шаблонов — запись в `audit_logs` в той же транзакции.
- События сессии всегда с `session_id`, `scenario_id`, `user_id`, `trace_id`.
- Тесты: `tests/unit` без Docker и сети; `tests/integration` помечены `@pytest.mark.docker`; LLM в тестах — только `FakeLLM`.
