import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from dio import GRAY, Diagram, c4  # noqa: E402

OUT = Path("/home/lcatharsis/masso/docs/diagrams")


def person(d, cid, x, y, w, h, name, desc):
    d.actor(None, x + w / 2 - 16, y - 50, 32, 46)
    return d.box(cid, x, y, w, h, c4(name, "Пользователь", desc), rounded=True)


def boundary(d, x, y, w, h, title, fill="#FFFFFF", tx=None, tw=None):
    d.box(None, x, y, w, h, "", rounded=True, dashed=True, fill=fill, extra="arcSize=2;")
    d.text(None, tx if tx is not None else x + 14, y + h - 30, tw or (w - 28), 24, title, size=12, align="left")


# ======================= fig26: C4 Context =========================================================================
d = Diagram("fig26_c4_context")
P = [("Обучающийся", "Проходит сценарии трёх видов, запрашивает<br>подсказки и самопроверку, читает теорию"),
     ("Преподаватель", "Назначает сценарии, анализирует цифровой<br>след, корректирует оценки, выгружает отчёты"),
     ("Методист", "Ведёт домены, граф компетенций с теорией,<br>целевые уровни и шаблоны сценариев"),
     ("Администратор", "Управляет пользователями и ролями,<br>режимом LLM и профилями песочниц"),
     ("Системный администратор", "Следит за состоянием стенда, учебными<br>средами, аудитом и событиями безопасности")]
L = ["Проходит сценарии,<br>смотрит протоколы [HTTPS/WSS]", "Анализирует результаты<br>группы [HTTPS]",
     "Настраивает граф<br>и шаблоны [HTTPS]", "Администрирует [HTTPS]", "Контролирует состояние<br>стенда [HTTPS]"]
d.box("sys", 760, 60, 400, 1000,
      c4("МАССО", "Программная система",
         "Генерация, проведение, автоматическая<br>проверка и анализ ситуативных учебных<br>сценариев: учебный сервер, "
         "документный<br>тренажёр, задача на код", size_name=16),
      rounded=True, fill=GRAY, stroke=2, extra="arcSize=3;")
for i, ((n, desc), lab) in enumerate(zip(P, L)):
    y = 110 + 210 * i
    person(d, f"p{i}", 40, y, 340, 100, n, desc)
    d.edge(f"p{i}", "sys", [(380, y + 50), (760, y + 50)], dashed=True)
    d.label(570, y + 50, 200, lab)
EXT = [("ext", 120, "Внешний LLM-провайдер", "Внешняя система",
        "GigaChat API через адаптер gpt2giga или иной<br>OpenAI-совместимый API: легенды, подсказки,<br>эмбеддинги",
        "Генерация и подсказки<br>[HTTPS, JSON]"),
       ("loc", 340, "Локальная LLM", "Внешняя система, опционально",
        "Ollama (контейнер профиля llm) или иной<br>локальный OpenAI-совместимый сервер;<br>резервный режим генерации",
        "Резервная генерация<br>[HTTP, JSON]"),
       ("dock", 560, "Docker Engine стенда", "Внешняя система",
        "Учебные серверы и одноразовые<br>контейнеры запуска кода", "Создание сред, exec<br>[Docker API]")]
for cid, y, n, k, desc, lab in EXT:
    d.box(cid, 1400, y, 420, 130, c4(n, k, desc), dashed=True)
    d.edge("sys", cid, [(1160, y + 65), (1400, y + 65)], dashed=True)
    d.label(1280, y + 65, 200, lab)
d.box("mon", 1400, 780, 420, 120, c4("Система мониторинга организации", "Внешняя система, опционально",
                                      "Опрашивает состояние и метрики"), dashed=True)
d.edge("mon", "sys", [(1400, 840), (1160, 840)], dashed=True)
d.label(1280, 840, 200, "GET /api/health, /metrics<br>[HTTP, внутренние сети]")
d.save(OUT / "fig26_c4_context.drawio", 1860, 1100)

# ======================= fig27: C4 Container =======================================================================
d = Diagram("fig27_c4_container")
boundary(d, 320, 40, 1260, 820, "МАССО [Программная система]", tx=860, tw=400)
d.actor(None, 104, 60, 32, 46)
d.box("users", 20, 110, 200, 120, c4("Пользователи", "Пользователь",
                                     "обучающийся, преподаватель,<br>методист, администратор,<br>системный администратор"))
d.box("fe", 360, 100, 340, 140, c4("Frontend", "Контейнер: nginx 1.27; React 19, TypeScript, Vite",
                                   "SPA ролей, веб-терминал xterm.js, редактор<br>кода CodeMirror 6; прокси /api, /ws, /metrics"))
d.box("be", 860, 90, 400, 150, c4("Backend/API", "Контейнер: Python 3.13, FastAPI, uvicorn",
                                  "REST /api и WebSocket /ws; агенты LangGraph,<br>LLM Gateway, Sandbox Manager, Verification<br>"
                                  "Engine, запуск кода; фоновый worker —<br>задача asyncio того же процесса"))
d.box("g2g", 1340, 100, 200, 130, c4("gpt2giga", "Контейнер, профиль gigachat",
                                     "OpenAI-совместимый<br>адаптер GigaChat;<br>порт не публикуется"), size=12)
d.box("env", 360, 430, 340, 150, c4("Учебные среды", "Контейнеры: образ masso/webstack",
                                    "учебный сервер сессии (nginx, store-api,<br>PostgreSQL); одноразовые контейнеры<br>"
                                    "запуска кода и валидации; сеть отключена"))
d.cyl("db", 860, 420, 320, 170, c4("PostgreSQL", "Контейнер: PostgreSQL 18 + pgvector",
                                   "Пользователи, граф компетенций<br>с теорией, сценарии, сессии,<br>цифровой след, отчёты, журналы"))
d.box("oll", 1340, 430, 200, 150, c4("Ollama", "Контейнер, профиль llm,<br>опционально",
                                     "локальная модель<br>и эмбеддинги"), dashed=True)
d.box("giga", 1660, 100, 300, 130, c4("GigaChat API", "Внешняя система", "облачная модель Сбера"), dashed=True)
d.box("oai", 1660, 280, 300, 120, c4("Внешний LLM-провайдер", "Внешняя система, опционально",
                                     "иной OpenAI-совместимый API"), dashed=True)
d.box("mon", 1660, 640, 300, 120, c4("Система мониторинга", "Внешняя система, опционально",
                                     "мониторинг организации"), dashed=True)
d.box("dock", 360, 920, 340, 110, c4("Docker Engine", "Внешняя система: сервис ОС стенда",
                                     "API контейнеров (/var/run/docker.sock)"), dashed=True)
d.edge("users", "fe", [(220, 170), (360, 170)], dashed=True)
d.label(270, 152, 96, "HTTPS/WSS", size=10)
d.edge("fe", "be", [(700, 165), (860, 165)], dashed=True)
d.label(780, 165, 140, "/api [HTTP],<br>/ws [WebSocket]", size=10)
d.edge("be", "db", [(1020, 240), (1020, 420)], dashed=True)
d.label(1020, 330, 100, "SQL [asyncpg]", size=10)
d.edge("be", "g2g", [(1260, 140), (1340, 140)], dashed=True)
d.label(1300, 124, 60, "HTTP", size=10)
d.edge("g2g", "giga", [(1540, 165), (1660, 165)], dashed=True)
d.label(1600, 148, 110, "HTTPS, OAuth", size=10)
d.edge("be", "oai", [(1260, 215), (1300, 215), (1300, 340), (1660, 340)], dashed=True)
d.label(1480, 340, 150, "HTTPS, проверка<br>сертификата", size=10)
d.edge("be", "oll", [(1230, 240), (1230, 390), (1440, 390), (1440, 430)], dashed=True)
d.label(1340, 390, 90, "HTTP :11434", size=10)
d.edge("mon", "be", [(1660, 700), (1210, 700), (1210, 240)], dashed=True)
d.label(1435, 700, 210, "GET /api/health, /metrics [HTTP]", size=10)
d.edge("be", "dock", [(860, 220), (780, 220), (780, 975), (700, 975)], dashed=True)
d.label(780, 760, 100, "Docker API<br>[unix-сокет]", size=10)
d.edge("dock", "env", [(530, 920), (530, 580)], dashed=True)
d.label(530, 750, 170, "запускает, exec:<br>терминал, сбои, проверки", size=10)
d.save(OUT / "fig27_c4_container.drawio", 2000, 1060)

# ======================= fig28: stages =============================================================================
d = Diagram("fig28_stages")
d.box(None, 40, 30, 600, 960, "", rounded=True, dashed=True, extra="arcSize=2;")
d.box(None, 920, 30, 600, 960, "", rounded=True, dashed=True, extra="arcSize=2;")
d.text(None, 60, 40, 560, 40, "<b>Первая очередь (опытный образец)</b><br>модульный монолит, как реализовано", size=13)
d.text(None, 940, 40, 560, 40, "<b>Вторая очередь (целевая архитектура)</b><br>выделенные сервисы", size=13)


def b(cid, x, y, w, h, name, kind, desc="", dashed=False, fill="#FFFFFF"):
    return d.box(cid, x, y, w, h, c4(name, kind, desc, size_name=12), dashed=dashed, fill=fill)


b("l_fe", 80, 100, 520, 60, "Frontend", "Контейнер: nginx + SPA")
d.box("l_be", 80, 190, 520, 400, "", rounded=True, fill=GRAY, extra="arcSize=3;")
d.text(None, 96, 196, 488, 34, "<b>Backend/API</b><br><span style=\"font-size:10px\">[Контейнер: FastAPI, модульный монолит]</span>",
       size=12)
b("l_api", 110, 240, 460, 60, "REST API, WebSocket, LLM Gateway, worker", "модули того же процесса")
b("l_ag", 110, 320, 460, 60, "Агенты ScenarioAgent, AssessmentAgent, ProfileAgent", "модули app/scenario_agent, …")
b("l_sb", 110, 400, 460, 60, "Sandbox Manager", "модуль app/sandbox")
b("l_ve", 110, 480, 460, 60, "Verification Engine и запуск кода", "модули app/verification, app/coderun")
d.cyl("l_db", 80, 610, 520, 80, c4("PostgreSQL 18 + pgvector", "единственное хранилище", size_name=12))
b("l_env", 80, 710, 520, 70, "Учебные среды", "Docker Engine",
  "network none, cap_drop ALL, read-only, лимиты профиля")
b("l_llm", 80, 800, 520, 60, "gpt2giga, Ollama", "Контейнеры профилей gigachat и llm, опционально", dashed=True)
b("l_mon", 80, 880, 520, 70, "Мониторинг", "эндпоинты /api/health и /metrics",
  "опрашивает система мониторинга организации")

b("r_fe", 960, 100, 520, 60, "Frontend", "Контейнер: nginx + SPA")
b("r_api", 960, 240, 520, 60, "Backend/API: REST, WebSocket, LLM Gateway, worker", "Контейнер")
b("r_ag", 960, 320, 520, 60, "Сервис агентов", "Контейнер: ScenarioAgent, AssessmentAgent, ProfileAgent")
b("r_sb", 960, 400, 520, 60, "Sandbox Manager", "Контейнер: отдельный сервис")
b("r_ve", 960, 480, 520, 60, "Verification Engine", "Контейнер: отдельный сервис, запуск кода")
d.cyl("r_db", 960, 610, 520, 80, c4("PostgreSQL 18 + pgvector", "то же хранилище", size_name=12))
b("r_env", 960, 710, 520, 70, "Учебные среды", "Docker Engine",
  "сетевой allowlist, среда исполнения Sysbox")
b("r_llm", 960, 800, 520, 60, "gpt2giga, Ollama", "те же контейнеры, опционально", dashed=True)
b("r_mon", 960, 880, 520, 70, "Мониторинг", "те же эндпоинты /api/health и /metrics",
  "опрашивает система мониторинга организации")

for l, r, y, lab, solid in [("l_fe", "r_fe", 130, "сохраняется", False),
                            ("l_api", "r_api", 270, "сохраняется", False),
                            ("l_ag", "r_ag", 350, "выделяется в сервис", True),
                            ("l_sb", "r_sb", 430, "выделяется в сервис", True),
                            ("l_ve", "r_ve", 510, "выделяется в сервис", True),
                            ("l_db", "r_db", 650, "сохраняется", False),
                            ("l_env", "r_env", 745, "+ allowlist, Sysbox", False),
                            ("l_llm", "r_llm", 830, "сохраняется", False),
                            ("l_mon", "r_mon", 915, "сохраняется", False)]:
    x0 = 570 if l in ("l_ag", "l_sb", "l_ve", "l_api") else 600
    d.edge(l, r, [(x0, y), (960, y)], dashed=not solid, width=2 if solid else 1)
    d.label(780, y, 170, lab, size=11)
d.save(OUT / "fig28_stages.drawio", 1560, 1010)
print("ok")
