import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from dio import Diagram  # noqa: E402

OUT = Path("/home/lcatharsis/masso/docs/diagrams")
d = Diagram("fig35_ui_structure")
H1, H2, H3 = 22, 50, 22
H = H1 + H2 + H3


def node(cid, x, y, w, num, name, route="", rng="", bold=False):
    d.vertex(cid, x, y, w, H, "", "rounded=0;html=1;strokeColor=none;fillColor=none;")
    st = "rounded=0;whiteSpace=wrap;html=1;strokeColor=#000000;fillColor=#FFFFFF;fontFamily=Times New Roman;fontColor=#000000;"
    d.vertex(None, x, y, w, H1, str(num), st + "fontSize=11;")
    body = f"<b>{name}</b>" if bold else name
    if route:
        body += f'<br><span style="font-size:10px">{route}</span>'
    d.vertex(None, x, y + H1, w, H2, body, st + "fontSize=12;")
    d.vertex(None, x, y + H1 + H2, w, H3, rng, st + "fontSize=11;")
    return cid


def line(src, tgt, pts):
    d.edge(src, tgt, pts, end="none")


d.box("login", 880, 40, 300, 60, '<b>Вход</b><br><span style="font-size:10px">/login</span>', rounded=False, size=12)
node("root", 880, 160, 300, 0, "Главное меню", "верхнее меню по ролям, тема, выход", "1–5", bold=True)
line("login", "root", [(1030, 100), (1030, 160)])
RX = [40, 460, 880, 1300, 1720]
roles = [("Обучающийся", "6–13"), ("Преподаватель", "14–17"), ("Методист", "18–21"), ("Администратор", "22–24"),
         ("Системный администратор", "25–26")]
RY = 330
for i, (x, (n, rng)) in enumerate(zip(RX, roles)):
    node(f"r{i}", x, RY, 300, i + 1, n, "", rng, bold=True)
    line("root", f"r{i}", [(1030, 160 + H), (1030, 290), (x + 150, 290), (x + 150, RY)])

STEP = 112
tree = [
    [(6, "Мои назначения", "/student", "", 1), (7, "Рабочая область", "/student/sessions/:id", "8–10", 1),
     (8, "Учебный сервер: терминал", "kind container", "", 2), (9, "Документный тренажёр", "kind document", "", 2),
     (10, "Задача на код: редактор и тесты", "kind code", "", 2), (11, "Протоколы", "/student/reports", "12", 1),
     (12, "Протокол прохождения", "/student/reports/:sessionId", "", 2),
     (13, "Мои навыки: карта компетенций", "/student/skills", "", 1)],
    [(14, "Панель группы", "/teacher (пункт меню «Группы»)", "15", 1),
     (15, "Цифровой след и корректировка оценки", "/teacher/sessions/:sessionId", "", 2),
     (16, "Назначения", "/teacher/assignments", "", 1), (17, "Экспорт отчётов", "/teacher/export", "", 1)],
    [(18, "Граф компетенций: домены, навыки, теория", "/methodist/skills", "", 1),
     (19, "Шаблоны сценариев", "/methodist/templates", "20", 1),
     (20, "Шаблон сценария и отчёт валидации", "/methodist/templates/:id", "", 2),
     (21, "Целевые уровни", "/methodist/targets", "", 1)],
    [(22, "Пользователи и роли", "/admin/users", "", 1), (23, "LLM и песочницы", "/admin/llm", "", 1),
     (24, "Аудит и безопасность", "/admin/audit", "", 1)],
    [(25, "Состояние системы", "/sysadmin", "", 1), (26, "Аудит и безопасность", "/sysadmin/audit", "", 1)],
]
for i, items in enumerate(tree):
    x = RX[i]
    y = RY + H + 40
    parent1 = None
    for num, name, route, rng, lvl in items:
        cid = f"n{num}"
        if lvl == 1:
            node(cid, x + 40, y, 300, num, name, route, rng)
            line(f"r{i}", cid, [(x + 20, RY + H), (x + 20, y + H / 2), (x + 40, y + H / 2)])
            parent1 = (cid, y)
        else:
            node(cid, x + 80, y, 300, num, name, route, rng)
            pid, py = parent1
            line(pid, cid, [(x + 60, py + H), (x + 60, y + H / 2), (x + 80, y + H / 2)])
        y += STEP
d.text(None, 40, RY + H + 40 + STEP * 8 + 10, 2000, 40,
       "Экран 7 открывается из экрана 6 при запуске назначения. Администратор открывает также экраны 18–21 и 25 по маршруту. "
       "Экран 12 доступен преподавателю из экрана 15; экраны 24 и 26 — один экран «Аудит и безопасность».",
       size=11, align="left", italic=True)
d.save(OUT / "fig35_ui_structure.drawio", 2080, RY + H + 40 + STEP * 8 + 60)
print("ok")
