import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from dio import GRAY, Diagram, c4  # noqa: E402

OUT = Path("/home/lcatharsis/masso/docs/diagrams")


def comp(name, pkg, body, uses=None):
    s = (f'<b><span style="font-size:12px">{name}</span></b><br><span style="font-size:10px">[Компонент: {pkg}]</span>'
         f'<br><span style="font-size:10px">{body}</span>')
    if uses:
        s += f'<br><i><span style="font-size:10px">→ {uses}</span></i>'
    return s


# ======================= fig29: C4 Component Backend/API ============================================================
d = Diagram("fig29_c4_component_backend")
X = [60, 490, 920, 1350]
WC = 400
d.box(None, 30, 170, 1750, 890, "", rounded=True, dashed=True, extra="arcSize=1;")
d.text(None, 1350, 1030, 420, 24, "Backend/API [Контейнер: Python 3.13, FastAPI]", size=12, align="left")
d.box("fe", 700, 20, 440, 100, c4("Frontend", "Контейнер: nginx + React SPA",
                                  "запросы REST и WebSocket проксирует nginx"))
d.vertex("bnd", 30, 170, 1750, 890, "", "rounded=0;html=1;strokeColor=none;fillColor=none;")
d.edge("fe", "bnd", [(820, 120), (820, 170)], dashed=True)
d.text(None, 640, 132, 176, 24, "REST /api [HTTPS]", size=10, align="right")
d.edge("fe", "bnd", [(1020, 120), (1020, 170)], dashed=True)
d.text(None, 1026, 132, 220, 24, "WebSocket /ws [WSS]", size=10, align="left")

R = {
    1: (200, 150, [
        ("auth", "app/auth", "POST /auth/login, /auth/refresh, /auth/logout;<br>GET /auth/me; JWT и refresh-cookie, argon2,<br>"
         "проверка ролей (deps.py), блокировка подбора пароля", "audit"),
        ("users", "app/users", "GET, POST /users; PATCH /users/{id};<br>PUT /users/{id}/roles;<br>"
         "POST /users/{id}/revoke-sessions; GET /users/{id}/audit", "audit"),
        ("skills", "app/skills", "GET /skills/graph, /skills/me, /skills/recommendations;<br>"
         "GET, POST /skills/domains; PATCH /skills/domains/{code};<br>POST /skills, /skills/import; PATCH /skills/{id};<br>"
         "PUT /skills/targets", "profile_agent, audit"),
        ("scenarios", "app/scenarios", "GET, POST /scenarios/templates; GET, PATCH …/{id};<br>"
         "POST …/{id}/validate, /publish, /archive; GET /spec-schema;<br>POST /scenarios/generate; GET /scenarios/runs/{id};<br>"
         "POST, GET /scenarios/assignments; GET …/assignments/me", "scenario_agent, audit"),
    ]),
    2: (380, 150, [
        ("sessions", "app/sessions", "POST /sessions; GET /sessions/mine, /sessions/{id};<br>"
         "POST /sessions/{id}/pause, /resume, /answers, /run,<br>/ws-token; WS /ws/sessions/{id}/terminal, /events",
         "sandbox, coderun, events, audit"),
        ("assessment_agent", "app/assessment_agent", "POST /sessions/{id}/hints, /self-check, /submit;<br>"
         "граф LangGraph AssessmentAgent (рисунок 30)", "verification, profile_agent, llm_gateway, sandbox"),
        ("reports", "app/reports", "GET /reports, /reports/export, /reports/mine,<br>"
         "/reports/by-session/{id}, /reports/{id},<br>/reports/groups/list", None),
        ("events", "app/events", "GET /events, /events/export;<br>запись цифрового следа и шина событий<br>"
         "сессии в процессе (bus) для WebSocket", None),
    ]),
    3: (560, 150, [
        ("admin", "app/admin", "GET, PATCH /admin/sandbox/profiles; GET /admin/audit,<br>/admin/security-events, "
         "/admin/logs/export, /admin/health,<br>/admin/background, /admin/openapi.json;<br>"
         "POST /admin/sandboxes/{id}/cleanup", "sandbox, audit"),
        ("verification", "app/verification", "GET, PATCH /verification/{session_id};<br>Verification Engine: docker_inspect, "
         "docker_exec,<br>http_health, file_diff, rule_match, semantic_similarity,<br>numeric_match, code_cases, "
         "code_student_tests", "sandbox, coderun"),
        ("scenario_agent", "app/scenario_agent", "ScenarioAgent — граф LangGraph генерации<br>"
         "и валидации варианта (рисунок 30)", "llm_gateway, sandbox, coderun"),
        ("profile_agent", "app/profile_agent", "ProfileAgent — сервис: дефициты навыков,<br>"
         "рекомендации, обновление уровней", None),
    ]),
    4: (740, 130, [
        ("coderun", "app/coderun", "Запуск кода: одноразовый контейнер песочницы,<br>скрытые тесты по группам, "
         "тесты обучающегося<br>на эталоне и на мутантах", "sandbox"),
        ("worker", "app/worker.py", "Фоновый worker — задача asyncio того же процесса:<br>incidents, commands, idle, "
         "reaper, retention,<br>time_limit, quota", "sessions, assessment_agent"),
        ("audit", "app/audit", "Запись audit_logs и security_events;<br>agent_logs пишет llm_gateway", None),
        ("health", "main.py, app/health.py", "Служебные эндпоинты:<br>GET /api/health, /metrics", None),
    ]),
    5: (900, 120, [
        ("db", "app/db.py", "Доступ к данным: SQLAlchemy 2 async, asyncpg;<br>модели таблиц в пакетах модулей", None),
        ("llm_gateway", "app/llm_gateway", "GET /admin/llm/providers, /admin/llm/health, /llm/status;<br>"
         "PATCH /admin/llm/providers/{id}; POST /admin/llm/switch-mode;<br>fallback external → local → template", "audit"),
        ("sandbox", "app/sandbox", "Sandbox Manager (aiodocker): создание, exec, pause,<br>снимок, удаление; метки "
         "masso.session/user/kind/<br>instance; профили и лимиты", None),
    ]),
}
for row, (y, h, items) in R.items():
    for i, (name, pkg, body, uses) in enumerate(items):
        d.box(name, X[i], y, WC, h, comp(name, pkg, body, uses), valign="middle", size=11)
d.text(None, 1350, 900, 400, 110,
       "Все модули работают с таблицами через «Доступ к данным» (db). Стрелкой «→» в блоке указаны модули, "
       "которые он вызывает через сервисные интерфейсы.", size=11, align="left", italic=True)
d.cyl("pg", 60, 1120, 400, 100, c4("PostgreSQL 18 + pgvector", "Контейнер", size_name=12))
d.box("llm", 490, 1120, 400, 100, c4("LLM-провайдеры", "Контейнеры и внешние системы",
                                      "gpt2giga → GigaChat API, внешний OpenAI-совместимый<br>API, Ollama"), dashed=True)
d.box("dock", 920, 1120, 400, 100, c4("Docker Engine", "Внешняя система", "учебные среды и контейнеры запуска кода"),
      dashed=True)
d.edge("db", "pg", [(260, 1020), (260, 1120)], dashed=True)
d.label(260, 1090, 100, "SQL [asyncpg]", size=10)
d.edge("llm_gateway", "llm", [(690, 1020), (690, 1120)], dashed=True)
d.label(690, 1090, 230, "HTTP(S), OpenAI-совместимый API", size=10)
d.edge("sandbox", "dock", [(1120, 1020), (1120, 1120)], dashed=True)
d.label(1120, 1090, 160, "Docker API [unix-сокет]", size=10)
d.save(OUT / "fig29_c4_component_backend.drawio", 1810, 1240)

# ======================= fig30: agents and LLM Gateway =============================================================
d = Diagram("fig30_c4_component_agents")


def node(cid, x, y, name, body, w=210, h=90):
    return d.box(cid, x, y, w, h, f'<b>{name}</b><br><span style="font-size:10px">{body}</span>', size=12,
                 extra="arcSize=14;")


d.box(None, 30, 30, 1940, 310, "", rounded=True, dashed=True, extra="arcSize=2;")
d.text(None, 46, 306, 700, 24, "ScenarioAgent [Компонент: граф LangGraph, app/scenario_agent/graph.py]", size=12,
       align="left")
d.dot("s0", 60, 145, 10)
NX = [100, 350, 600, 850, 1100, 1350]
node("sp", NX[0], 100, "select_params", "параметры по seed; пул инцидентов<br>(incidents_pick); вариант задачи<br>на код")
node("gl", NX[1], 100, "generate_legend", "легенда по брифу шаблона<br>→ LLM Gateway; без LLM —<br>утверждённый вариант")
node("as", NX[2], 100, "assemble_spec", "сборка спецификации<br>варианта")
node("sv", NX[3], 100, "static_validate", "схема Pydantic и правила:<br>подсказки без элементов<br>решения, веса проверок")
node("dd", NX[4], 100, "dedup", "эмбеддинг легенды → LLM<br>Gateway; сходство с прошлыми<br>вариантами (pgvector)")
node("dv", NX[5], 100, "dynamic_validate", "прогон: сбой ломает проверки,<br>эталон восстанавливает<br>→ Sandbox Manager, запуск кода")
node("rj", NX[3], 235, "reject", "status = rejected", h=50)
d.final("s1", 1640, 145)
for a, b, x0, x1 in [("s0", "sp", 70, 100), ("sp", "gl", 310, 350), ("gl", "as", 560, 600), ("as", "sv", 810, 850)]:
    d.edge(a, b, [(x0, 145), (x1, 145)])
d.edge("sv", "dd", [(1060, 145), (1100, 145)])
d.label(1080, 128, 60, "[ok]", size=10)
d.edge("dd", "dv", [(1310, 145), (1350, 145)])
d.edge("dv", "s1", [(1560, 145), (1627, 145)])
d.label(1594, 124, 76, "published<br>| rejected", size=10)
d.edge("sv", "rj", [(955, 190), (955, 235)])
d.text(None, 961, 198, 150, 30, "[ошибки схемы<br>или правил]", size=10, align="left")
d.edge("rj", "s1", [(1060, 260), (1640, 260), (1640, 158)])
d.edge("dd", "sp", [(1205, 100), (1205, 62), (205, 62), (205, 100)])
d.label(705, 62, 420, "[сходство ≥ 0.90 и попыток ≤ 2] — повтор с новым seed", size=10)
d.text(None, 1700, 90, 260, 110,
       "Порог сходства 0.90 считается среди прошлых запусков того же шаблона у того же обучающегося; "
       "результат сохраняется в scenario_runs.", size=10, align="left", italic=True)

d.box(None, 30, 380, 1940, 290, "", rounded=True, dashed=True, extra="arcSize=2;")
d.text(None, 1180, 636, 760, 24, "AssessmentAgent [Компонент: граф LangGraph, app/assessment_agent/graph.py]",
       size=12, align="left")
d.dot("a0", 60, 470, 10)
node("ct", NX[0], 425, "collect_trace", "подсказки, нарушения,<br>инциденты, команды<br>→ PostgreSQL")
node("rc", NX[1], 425, "run_checks", "проверки сценария<br>→ Verification Engine<br>(среда, ответ или код)")
node("sc", NX[2], 425, "score", "балл: веса проверок,<br>штрафы подсказок<br>и нарушений")
node("up", NX[3], 425, "update_profile", "уровни навыков<br>→ ProfileAgent.apply_result")
node("br", NX[4], 425, "build_report", "verification_results<br>и reports → PostgreSQL")
node("cl", NX[5], 425, "cleanup", "удаление учебной среды<br>→ Sandbox Manager")
d.final("a1", 1640, 470)
prev, px = "a0", 70
for cid, x in zip(["ct", "rc", "sc", "up", "br", "cl"], NX):
    d.edge(prev, cid, [(px, 470), (x, 470)])
    prev, px = cid, x + 210
d.edge("cl", "a1", [(1560, 470), (1627, 470)])
d.box("hint", 100, 545, 700, 70,
      "<b>request_hint()</b> <span style=\"font-size:10px\">[сервисный метод вне графа, hints.py]</span><br>"
      "<span style=\"font-size:10px\">не более 3 подсказок; фильтр prompt injection → security_events; тихий прогон "
      "проверок;<br>ответ LLM → LLM Gateway с фильтром элементов решения; без LLM — ступень лестницы</span>",
      size=12)
d.box("self", 850, 545, 710, 70,
      "<b>self_check()</b> <span style=\"font-size:10px\">[сервисный метод вне графа, selfcheck.py]</span><br>"
      "<span style=\"font-size:10px\">проверки на текущем состоянии среды не чаще раза в 30 с; только названия "
      "критериев<br>и результат, без баллов; событие check с self_check в цифровом следе</span>", size=12)

d.box("gw", 100, 740, 520, 150,
      c4("LLM Gateway", "Компонент: app/llm_gateway",
         "complete_json(): ответ по схеме Pydantic, один повтор;<br>embed(): эмбеддинги провайдера или hash-эмбеддинги;"
         "<br>каждый вызов — в agent_logs; ошибка провайдера —<br>отдельной транзакцией не чаще раза в 30 с"))
d.edge("hint", "gw", [(360, 615), (360, 740)], dashed=True)
d.label(360, 690, 210, "подсказки, эмбеддинги", size=10)
d.box("ext", 720, 740, 330, 100, c4("external", "провайдер, приоритет 1",
                                     "gpt2giga → GigaChat API или иной<br>OpenAI-совместимый API [HTTPS]"), dashed=True)
d.box("loc", 1150, 740, 330, 100, c4("local", "провайдер, приоритет 2",
                                      "Ollama или иной локальный<br>OpenAI-совместимый сервер [HTTP]"), dashed=True)
d.box("tpl", 1580, 740, 330, 100, c4("template", "приоритет 3, без LLM",
                                      "утверждённые варианты легенд,<br>лестница подсказок"), dashed=True)
d.edge("gw", "ext", [(620, 790), (720, 790)])
d.label(670, 772, 90, "режим<br>external", size=10)
d.edge("ext", "loc", [(1050, 790), (1150, 790)])
d.label(1100, 772, 96, "ошибка или<br>недоступен", size=10)
d.edge("loc", "tpl", [(1480, 790), (1580, 790)])
d.label(1530, 772, 96, "ошибка или<br>недоступен", size=10)
d.text(None, 720, 850, 1200, 44,
       "Режим генерации задаёт администратор (llm_settings.generation_mode): external — цепочка external → local → "
       "template; local — local → template; template — только шаблонный путь. ScenarioAgent вызывает LLM Gateway "
       "из узлов generate_legend и dedup.", size=10, align="left", italic=True)
d.save(OUT / "fig30_c4_component_agents.drawio", 2000, 910)

# ======================= fig31: C4 Deployment =====================================================================
d = Diagram("fig31_c4_deployment")
d.box(None, 420, 30, 1300, 790, "", rounded=False, fill=GRAY)
d.text(None, 440, 40, 1260, 30,
       "<b>Сервер учебного стенда [Linux VM: Ubuntu 24.04 / Debian 12, Docker Engine 27+, Docker Compose v2+]</b>",
       size=13, align="left")
d.box("br", 20, 100, 280, 130, c4("Рабочее место пользователя", "Chromium / Firefox, экран от 1366×768"),
      rounded=False, fill=GRAY)
d.box("mon", 20, 620, 280, 110, c4("Система мониторинга", "Внешняя система, опционально"), dashed=True)
d.box("fe", 470, 100, 360, 160, c4("frontend", "Docker-контейнер: nginx 1.27 + SPA",
                                   "TLS-терминация: HTTPS/WSS :443, HTTP :80 → 301<br>(docker-compose.tls.yml);<br>"
                                   "тестовый режим: HTTP :80 на localhost;<br>прокси /api, /ws, /metrics"))
d.box("be", 930, 100, 360, 160, c4("backend", "Docker-контейнер: Python 3.13, uvicorn :8000",
                                   "FastAPI, агенты, фоновый worker;<br>/var/run/docker.sock; том snapshots<br>"
                                   "(снимки /srv при истечении сессии)"))
d.box("g2g", 1380, 100, 300, 130, c4("gpt2giga", "Docker-контейнер, профиль gigachat",
                                     ":8090 без публикации порта;<br>OAuth-токен GigaChat, корневой<br>"
                                     "сертификат НУЦ Минцифры"), dashed=True)
d.cyl("db", 930, 380, 360, 140, c4("db", "pgvector/pgvector:pg18, :5432", "том pgdata"))
d.box("oll", 1380, 380, 300, 130, c4("ollama", "Docker-контейнер, профиль llm,<br>опционально",
                                     ":11434; том ollama"), dashed=True)
for k in (2, 1):
    d.box(None, 470 + 10 * k, 380 + 10 * k, 360, 150, "", rounded=True)
d.box("env", 470, 380, 360, 150, c4("Учебные среды", "Docker-контейнеры masso/webstack × N",
                                    "user student, cap_drop ALL, no-new-privileges,<br>read-only, network none, лимиты "
                                    "профиля;<br>метки masso.session/user/kind/instance;<br>"
                                    "одноразовые контейнеры запуска кода"))
d.box("dock", 470, 630, 360, 90, c4("Docker Engine", "Сервис ОС"))
d.box("bak", 930, 620, 360, 110, c4("Резервное копирование", "cron + pg_dump на хосте",
                                    "ежедневно, хранение 30 дней"))
d.text(None, 470, 760, 1220, 40,
       "Docker-сокет внутрь учебных сред не пробрасывается, порты учебных сред на хост не публикуются. "
       "Тома: pgdata, snapshots, ollama.", size=11, align="left", italic=True)
d.box("giga", 1880, 100, 300, 130, c4("GigaChat API", "Внешняя система"), dashed=True)
d.box("oai", 1880, 260, 300, 100, c4("Внешний LLM-провайдер", "Внешняя система, опционально",
                                     "иной OpenAI-совместимый API"), dashed=True)
d.edge("br", "fe", [(300, 165), (470, 165)], dashed=True)
d.label(360, 136, 110, "HTTPS/WSS<br>(TLS 1.2+)", size=10)
d.edge("fe", "be", [(830, 165), (930, 165)], dashed=True)
d.label(880, 165, 94, "/api, /ws<br>[HTTP :8000]", size=10)
d.edge("be", "db", [(1110, 260), (1110, 380)], dashed=True)
d.label(1110, 320, 80, "SQL :5432", size=10)
d.edge("be", "g2g", [(1290, 140), (1380, 140)], dashed=True)
d.label(1335, 124, 80, "HTTP :8090", size=10)
d.edge("g2g", "giga", [(1680, 165), (1880, 165)], dashed=True)
d.label(1800, 165, 150, "HTTPS, проверка<br>сертификата", size=10)
d.edge("be", "oai", [(1290, 215), (1330, 215), (1330, 300), (1880, 300)], dashed=True)
d.label(1800, 300, 150, "HTTPS, проверка<br>сертификата", size=10)
d.edge("be", "oll", [(1260, 260), (1260, 335), (1530, 335), (1530, 380)], dashed=True)
d.label(1440, 335, 90, "HTTP :11434", size=10)
d.edge("be", "dock", [(930, 240), (880, 240), (880, 675), (830, 675)], dashed=True)
d.label(880, 580, 86, "Docker API<br>[unix-сокет]", size=10)
d.edge("dock", "env", [(650, 630), (650, 550)], dashed=True)
d.label(650, 595, 100, "создаёт, exec", size=10)
d.edge("bak", "db", [(1110, 620), (1110, 520)], dashed=True)
d.label(1110, 570, 70, "pg_dump", size=10)
d.edge("mon", "fe", [(300, 675), (445, 675), (445, 230), (470, 230)], dashed=True)
d.label(360, 650, 110, "GET /metrics<br>(внутр. сети)", size=10)
d.save(OUT / "fig31_c4_deployment.drawio", 2200, 840)
print("ok")
