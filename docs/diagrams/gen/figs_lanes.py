import sys

from lanes import Lanes

OUT = "/home/lcatharsis/masso/docs/diagrams/"
FIGS = {}


def fig(fn):
    FIGS[fn.__name__] = fn
    return fn


@fig
def fig02_auth():
    L = Lanes("fig02_auth", ["Пользователь", "Frontend (SPA)", "Backend: Auth/RBAC", "PostgreSQL"])
    L.start("s", 0, 0, "Открыта форма входа")
    L.task("t1", 0, 1, "Ввести email и пароль")
    L.task("t2", 1, 2, "POST /api/auth/login")
    L.task("t3", 2, 3, "Проверить лимит неудачных попыток")
    L.task("d1", 3, 3, "Чтение security_events (login_failed за 15 мин)")
    L.gw("g1", 2, 4, "Лимит превышен?", qpos="below")
    L.task("e1", 1, 4, "401: «Повторите через 15 минут»")
    L.end("x1", 0, 4, "Вход отклонен", lpos="right")
    L.task("t4", 2, 5, "Найти учетную запись, проверить хеш пароля")
    L.task("d2", 3, 5, "Чтение users, user_roles")
    L.gw("g2", 2, 6, "Пароль верен, статус active?")
    L.task("d3", 3, 6, "INSERT security_events (login_failed)")
    L.task("e2", 1, 7, "401: «Неверный email или пароль»")
    L.end("x2", 0, 7, "Вход отклонен", lpos="right")
    L.task("t5", 2, 7, "Выдать access JWT (15 мин) и refresh-cookie HttpOnly (7 дней)")
    L.task("d4", 3, 8, "UPDATE users.last_login_at; INSERT refresh_tokens")
    L.task("t6", 1, 9, "Открыть разделы по ролям")
    L.end("x3", 0, 9, "Сеанс создан", lpos="right")
    L.flow("s", "t1")
    L.flow("t1", "t2")
    L.flow("t2", "t3")
    L.flow("t3", "d1")
    L.flow("d1", "g1")
    L.flow("g1", "e1", "Да", out="top", inn="bottom")
    L.flow("e1", "x1", out="top", inn="bottom")
    L.flow("g1", "t4", "Нет")
    L.flow("t4", "d2")
    L.flow("d2", "g2")
    L.flow("g2", "d3", "Нет", out="bottom", inn="top")
    L.flow("d3", "e2")
    L.flow("e2", "x2", out="top", inn="bottom")
    L.flow("g2", "t5", "Да")
    L.flow("t5", "d4")
    L.flow("d4", "t6")
    L.flow("t6", "x3", out="top", inn="bottom")
    L.extra = 80
    L.build(OUT + "fig02_auth.drawio")



@fig
def fig03_profile():
    L = Lanes("fig03_profile", ["Обучающийся", "Frontend (SPA)", "ProfileAgent (/api/skills)", "PostgreSQL"], cw=160)
    L.start("s", 0, 0, "Нужен план обучения")
    L.task("t1", 0, 1, "Открыть панель или «Мои навыки», выбрать направление")
    L.task("t2", 1, 2, "GET /api/skills/ recommendations ?domain")
    L.task("d1", 3, 3, "Чтение track_targets, user_skills, skill_requires")
    L.task("t3", 2, 4, "Разрыв уровней, давность (> 30 дней), число зависимых навыков")
    L.task("t4", 2, 5, "Приоритет дефицита: критический, высокий, средний, низкий")
    L.task("d2", 3, 6, "Чтение опубликованных шаблонов, template_skills, пройденных за 7 дней")
    L.task("t5", 2, 7, "Ранжировать: Σ вес навыка × приоритет")
    L.task("t6", 1, 8, "Дефициты, рекомендации; карта компетенций с теорией")
    L.task("t7", 0, 9, "Изучить теорию навыка или выбрать сценарий")
    L.end("e", 0, 10, "Следующий шаг выбран", lpos="below")
    for a, b in [("s", "t1"), ("t1", "t2"), ("t2", "d1"), ("d1", "t3"), ("t3", "t4"), ("t4", "d2"), ("d2", "t5"),
                 ("t5", "t6"), ("t6", "t7"), ("t7", "e")]:
        L.flow(a, b)
    L.extra = 30
    L.build(OUT + "fig03_profile.drawio")


@fig
def fig04_generate():
    L = Lanes("fig04_generate", ["Обучающийся или методист", "Backend: /api/scenarios", "ScenarioAgent", "LLM Gateway",
                                 "Sandbox Manager", "PostgreSQL + pgvector"], cw=158, lane_h=[145, 118, 150, 110, 128, 118])
    L.start("s", 0, 0, "Нужен вариант сценария")
    L.task("t1", 0, 1, "Выбрать опубликованный шаблон")
    L.gw("g1", 1, 2, "Можно генерировать?", qpos="below")
    L.end("x1", 0, 2, "Отказ: 422 или 503", lpos="right")
    L.task("t2", 2, 3, "Параметры, начальный сбой, 1–2 инцидента из пула; для кода — вариант задачи")
    L.task("t3", 3, 4, "Легенда: external → local → template")
    L.task("t4", 2, 5, "Статическая проверка: схема, решение не раскрыто")
    L.task("d1", 5, 5, "Сходство легенды с прошлыми запусками (pgvector)")
    L.gw("g2", 2, 6, "Сходство ≥ 0,90?", qpos="below")
    L.gw("g3", 2, 7, "Вид сценария?", qpos="above")
    L.task("t5", 2, 8, "Документ: эталонный ответ проходит, пустой — нет")
    L.task("t6", 4, 8, "Прогон в контейнере validation: сбои и инциденты; для кода — эталон и типичные ошибки")
    L.task("d2", 5, 9, "INSERT scenario_runs: published или rejected, отчет валидации")
    L.gw("g4", 1, 10, "Путь решения подтвержден?", qpos="below")
    L.end("x2", 0, 10, "Отказ: 422 SCENARIO_NOT_VALID", lpos="right")
    L.end("x3", 1, 11, "Вариант готов", lpos="below")
    L.flow("s", "t1")
    L.flow("t1", "g1")
    L.flow("g1", "x1", "Нет", out="top", inn="bottom")
    L.flow("g1", "t2", "Да")
    L.flow("t2", "t3")
    L.flow("t3", "t4")
    L.flow("t4", "d1", out="bottom", inn="top")
    L.flow("d1", "g2")
    top2 = L.lane_top(2) + 10
    L.flow("g2", "t2", "Да, не более 2 раз", out="top", inn="top",
           via=[(L.cx(6), top2), (L.cx(3), top2)], lpos=(L.cx(6) + 6, top2 + 4))
    L.flow("g2", "g3", "Нет")
    L.flow("g3", "t5", "документ")
    L.flow("g3", "t6", "сервер, код", out="bottom", inn="left")
    L.flow("t5", "d2")
    L.flow("t6", "d2")
    L.flow("d2", "g4")
    L.flow("g4", "x2", "Нет", out="top", inn="bottom")
    L.flow("g4", "x3", "Да")
    L.extra = 60
    L.build(OUT + "fig04_generate.drawio")


@fig
def fig05_launch():
    L = Lanes("fig05_launch", ["Обучающийся", "Frontend (SPA)", "Backend: Session API", "Sandbox Manager, Docker",
                               "PostgreSQL"], cw=172, tw_=146, lane_h=[135, 118, 130, 150, 118])
    L.start("s", 0, 0, "Вариант сценария готов")
    L.task("t1", 0, 1, "Начать выполнение")
    L.task("t2", 1, 2, "POST /api/sessions {run_id}")
    L.gw("g1", 2, 3, "Сервер уже запущен или среды заняты?", qpos="below", qw=150)
    L.task("e1", 1, 3, "409 (сервер уже запущен) или 503 (среды заняты)")
    L.end("x1", 0, 3, "Запуск отложен", lpos="right")
    L.task("d1", 4, 4, "INSERT sessions (starting, trace_id)")
    L.gw("g2", 2, 5, "Вид сценария?", qpos="aboveleft")
    L.task("t3", 2, 6, "Документы варианта или заготовки файлов в documents_state")
    L.task("t4", 3, 6, "Контейнер: student, без сети, read-only, лимиты, метки masso.*; начальный сбой")
    L.gw("g3", 3, 7, "Среда запущена?", qpos="below")
    L.task("e2", 2, 7, "status failed, удалить контейнер")
    L.task("e3", 1, 7, "409 SESSION_NOT_READY")
    L.end("x2", 0, 7, "Запуск не удался", lpos="right")
    L.task("d2", 4, 8, "UPDATE sessions: active, started_at, incident_due_at (+2…5 мин)")
    L.task("t5", 1, 9, "ws-token; WS событий; терминал (сервер) или редактор")
    L.task("t6", 0, 10, "Работать; «Пауза» / «Продолжить» — пауза не входит в лимит")
    L.end("x3", 0, 11, "Сессия активна", lpos="below")
    L.flow("s", "t1")
    L.flow("t1", "t2")
    L.flow("t2", "g1")
    L.flow("g1", "e1", "Да", out="top", inn="bottom")
    L.flow("e1", "x1", out="top", inn="bottom")
    L.flow("g1", "d1", "Нет")
    L.flow("d1", "g2")
    L.flow("g2", "t3", "документ\nили код")
    L.flow("g2", "t4", "сервер", out="bottom", inn="left")
    L.flow("t4", "g3")
    L.flow("g3", "e2", "Нет", out="top", inn="bottom")
    L.flow("e2", "e3", out="top", inn="bottom")
    L.flow("e3", "x2", out="top", inn="bottom")
    L.flow("g3", "d2", "Да")
    t2y = L.lane_top(2) + 10
    L.flow("t3", "d2", out="top", inn="left",
           via=[(L.cx(6), t2y), (L.cx(8) - L.cw / 2, t2y), (L.cx(8) - L.cw / 2, L.lane_mid(4))])
    L.flow("d2", "t5")
    L.flow("t5", "t6")
    L.flow("t6", "x3")
    L.extra = 40
    L.build(OUT + "fig05_launch.drawio")


@fig
def fig06_assess():
    L = Lanes("fig06_assess", ["Обучающийся", "AssessmentAgent", "Verification Engine", "Worker", "PostgreSQL"],
              cw=158, lane_h=[130, 155, 130, 150, 110])
    L.start("s", 0, 0, "Сессия активна")
    L.gw("p", 0, 1, "", par=True)
    L.task("t1", 0, 2, "Выполнять задание: терминал, документы или редактор кода")
    L.gw("g1", 0, 3, "Нужна подсказка?", qpos="above")
    L.task("h", 1, 3, "Подсказка: ≤ 3, −10 %; LLM или ступень лестницы; injection — нарушение")
    L.gw("g2", 0, 4, "Проверить выполнение?", qpos="above")
    L.task("c", 2, 4, "Самопроверка: названия критериев и результат; ≤ 1 раз в 30 с")
    L.task("t2", 0, 5, "Завершить и отправить")
    L.task("w1", 3, 1, "Каждые 5 с: команды из журнала, нарушения")
    L.task("w3", 3, 2, "Наступил срок — инцидент варианта, WS-уведомление; следующий через 2–5 мин")
    L.gw("w4", 3, 3, "Время вышло или диск превышен?", qpos="above")
    L.task("w5", 3, 4, "Бездействие: 15 мин — пауза, 24 ч — expired")
    L.task("a1", 1, 6, "Собрать след: события, подсказки, нарушения")
    L.task("a2", 2, 7, "Проверки: сервер — в контейнере, документ — по ключу, код — в песочнице")
    L.task("a3", 1, 8, "Балл: веса, критическая ≤ 49, −10 % за подсказку, −10 за нарушение")
    L.task("a4", 1, 9, "ProfileAgent: user_skills; уровень +1 после 3 успехов, audit skill.level_up")
    L.task("d1", 4, 10, "INSERT verification_results, reports; затем удалить среду")
    L.end("e", 0, 11, "Протокол получен", lpos="below")
    L.flow("s", "p")
    L.flow("p", "t1")
    L.flow("p", "w1", out="bottom", inn="top")
    L.flow("t1", "g1")
    L.flow("g1", "h", "Да", out="bottom", inn="top")
    L.flow("h", "t1", out="left", inn="bottom")
    L.flow("g1", "g2", "Нет")
    L.flow("g2", "c", "Да", out="bottom", inn="top")
    L.flow("c", "t1", out="left", inn="bottom")
    L.flow("g2", "t2", "Нет")
    L.flow("t2", "a1")
    L.flow("w1", "w3")
    L.flow("w3", "w4")
    bot3 = L.lane_top(3) + L.lane_h[3] - 18
    L.flow("w4", "w5", "Нет")
    top3 = L.lane_top(3) + 10
    L.flow("w5", "w1", out="top", inn="top", via=[(L.cx(4), top3), (L.cx(1), top3)])
    xm = L.cx(6) - L.cw / 2
    L.flow("w4", "a1", "Да: автоотправка", out="bottom", inn="left",
           via=[(L.cx(3), bot3), (xm, bot3), (xm, L.lane_mid(1))], lpos=(L.cx(3) + 6, bot3 - 17))
    L.flow("a1", "a2")
    L.flow("a2", "a3")
    L.flow("a3", "a4")
    L.flow("a4", "d1")
    L.flow("d1", "e")
    L.extra = 20
    L.build(OUT + "fig06_assess.drawio")


@fig
def fig07_reports():
    L = Lanes("fig07_reports", ["Преподаватель", "Frontend (SPA)", "Backend: reports, verification",
                                "PostgreSQL"], cw=158, lane_h=[130, 120, 150, 120])
    L.start("s", 0, 0, "Нужен анализ группы")
    L.task("t1", 0, 1, "Выбрать группу, дату начала и окончания")
    L.gw("g1", 1, 2, "Период задан?", qpos="below")
    L.task("t0", 0, 2, "Указать период (иначе ответ 422)", dy=12)
    L.task("t2", 2, 3, "GET /api/reports: сессии за период, агрегаты, проблемные навыки")
    L.task("d1", 3, 4, "Чтение sessions, users, verification_results, hints")
    L.task("t3", 1, 5, "Панель группы")
    L.task("t4", 0, 6, "Открыть сессию (строка таблицы)")
    L.task("t5", 1, 7, "Цифровой след: фильтр по типу и важности; проверки, балл")
    L.gw("g2", 0, 8, "Нужна корректировка?", qpos="above")
    L.task("t6", 2, 8, "PATCH /api/verification: подтвердить или изменить с причиной")
    L.task("d2", 3, 9, "UPDATE verification_results, reports; audit_logs; accepted_solutions")
    L.task("t7", 0, 10, "Экспорт CSV/JSON за период")
    L.end("e", 0, 11, "Отчет принят", lpos="below")
    L.flow("s", "t1")
    L.flow("t1", "g1")
    L.flow("g1", "t0", "Нет", out="top", inn="bottom")
    top0 = L.lane_top(0) + 10
    L.flow("t0", "t1", out="top", inn="top", via=[(L.cx(2), top0), (L.cx(1), top0)])
    L.flow("g1", "t2", "Да")
    L.flow("t2", "d1")
    L.flow("d1", "t3")
    L.flow("t3", "t4")
    L.flow("t4", "t5")
    L.flow("t5", "g2")
    L.flow("g2", "t6", "Да", out="bottom", inn="top")
    L.flow("t6", "d2")
    L.flow("d2", "t7")
    L.flow("g2", "t7", "Нет")
    L.flow("t7", "e")
    L.extra = 20
    L.build(OUT + "fig07_reports.drawio")


@fig
def fig08_admin():
    L = Lanes("fig08_admin", ["Администратор", "Frontend (SPA)", "Backend: admin, users",
                              "Worker и инфраструктура", "PostgreSQL"], cw=158, lane_h=[145, 118, 140, 150, 140])
    L.start("s", 0, 0, "Открыта панель администратора")
    L.task("t1", 0, 1, "Пользователи и роли, LLM, песочницы, журнал, состояние")
    L.task("t2", 1, 2, "PATCH / PUT / POST изменения с причиной")
    L.task("t3", 2, 3, "Проверить роль admin, валидировать данные")
    L.gw("g1", 2, 4, "Данные допустимы?", qpos="below")
    L.task("e1", 1, 4, "Ошибка 403 или 422")
    L.end("x1", 0, 4, "Изменения отклонены", lpos="right")
    L.task("d1", 4, 5, "UPDATE users, user_roles, llm_providers, llm_settings, sandbox_profiles; INSERT audit_logs")
    L.task("t4", 1, 6, "Показать результат; отзыв сессий — revoke refresh_tokens")
    L.end("x2", 0, 7, "Изменения применены", lpos="below")
    L.start("w0", 3, 0, "Тик worker (5 с)", lpos="below")
    L.task("w1", 3, 1, "Reaper: контейнеры без сессии своей установки (masso.instance)")
    L.task("w2", 3, 2, "Пауза, expired, автоотправка, квота диска, хранение журналов")
    L.task("w3", 3, 3, "Состояние для /api/admin/health и /metrics")
    L.end("w4", 3, 4, "Состояние доступно", lpos="below")
    L.flow("s", "t1")
    L.flow("t1", "t2")
    L.flow("t2", "t3")
    L.flow("t3", "g1")
    L.flow("g1", "e1", "Нет", out="top", inn="bottom")
    L.flow("e1", "x1", out="top", inn="bottom")
    L.flow("g1", "d1", "Да")
    L.flow("d1", "t4")
    L.flow("t4", "x2")
    L.flow("w0", "w1")
    L.flow("w1", "w2")
    L.flow("w2", "w3")
    L.flow("w3", "w4")
    L.extra = 40
    L.build(OUT + "fig08_admin.drawio")


if __name__ == "__main__":
    for nme in sys.argv[1:] or list(FIGS):
        FIGS[nme]()
        print("built", nme)
