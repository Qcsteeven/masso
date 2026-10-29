"""Fig. 1: ER diagram of the subject area (conceptual names, matching the PostgreSQL tables)."""

from common import FONT, FS, Doc, lines_html, tw

W = 236
GAPX = 112
HEADER = 28
ROW = 20
OUT = "/home/lcatharsis/masso/docs/diagrams/fig01_er.drawio"

E = {
    # key: (title, attributes, col, row)
    "target": ("Целевой уровень", ["Требуемый уровень в направлении"], 0, 0),
    "domain": ("Предметная область", ["Код", "Название", "Описание"], 1, 0),
    "tpl": ("Шаблон сценария", ["Код и название", "Вид: сервер, документ или код", "Спецификация (JSON)",
                                "Версия и статус", "Отчет валидации"], 2, 0),
    "acc": ("Принятое решение", ["След решения (команды, ответы)", "Эмбеддинг решения", "Дата одобрения"], 4, 1),
    "us": ("Уровень навыка", ["Уровень", "Дата подтверждения", "Серия успехов",
                                           "Число успехов и неудач"], 0, 1),
    "skill": ("Навык", ["Код и название", "Описание", "Теория (Markdown)", "Максимальный уровень", "Статус"], 1, 1),
    "run": ("Запуск сценария", ["Сгенерированная спецификация", "Режим генерации", "Эмбеддинг легенды",
                                "Отчет валидации", "Статус"], 2, 1),
    "asg": ("Назначение", ["Группа или обучающийся", "Срок выполнения"], 3, 1),
    "role": ("Роль", ["Код", "Название", "Права доступа"], 0, 2),
    "user": ("Пользователь", ["ФИО", "Электронная почта", "Учебная группа", "Статус", "Последний вход"], 1, 2),
    "sess": ("Учебная сессия", ["Вид и статус", "Начало, пауза, завершение", "Лимит времени", "Срок инцидента",
                                "Ответ: документы или файлы кода", "Идентификатор трассировки"], 2, 2),
    "ev": ("Событие сессии", ["Тип события", "Важность", "Содержимое", "Время"], 3, 2),
    "hint": ("Подсказка", ["Номер", "Вопрос", "Текст и источник", "Штраф"], 4, 2),
    "audit": ("Журнал аудита", ["Действие", "Объект", "Значения до и после", "Причина"], 0, 3),
    "sec": ("Событие безопасности", ["Вид нарушения", "Важность", "Детали", "Время"], 1, 3),
    "res": ("Результат проверки", ["Результаты проверок", "Базовый и итоговый балл", "Статус: пройдена или нет",
                                   "Ошибки", "Экспертная оценка и причина"], 2, 3),
    "rep": ("Отчет", ["Содержимое протокола", "Дата формирования"], 3, 3),
}
GAPY = [96, 104, 100]  # vertical gaps after rows 0, 1, 2


def height(k):
    return HEADER + ROW * len(E[k][1]) + 4


rows_h = [max(height(k) for k in E if E[k][3] == r) for r in range(4)]
row_top = [20.0]
for r in range(3):
    row_top.append(row_top[-1] + rows_h[r] + GAPY[r])


def box(k):
    _, _, c, r = E[k]
    return 20 + c * (W + GAPX), row_top[r], W, height(k)


def P(k, side, f=0.5):
    x, y, w, h = box(k)
    return {"top": (x + w * f, y), "bottom": (x + w * f, y + h), "left": (x, y + h * f if f != 0.5 else y + 36),
            "right": (x + w, y + h * f if f != 0.5 else y + 36)}[side]


def Py(k, side, dy):
    x, y, w, h = box(k)
    return (x if side == "left" else x + w, y + dy)


doc = Doc("fig01_er")
ids = {}
for k, (title, attrs, c, r) in E.items():
    x, y, w, h = box(k)
    st = (f"swimlane;fontStyle=1;align=center;verticalAlign=middle;childLayout=stackLayout;horizontal=1;"
          f"startSize={HEADER};horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;"
          f"marginBottom=0;html=1;whiteSpace=wrap;strokeColor=#000000;fillColor=#FFFFFF;fontColor=#000000;"
          f"fontFamily={FONT};fontSize={FS + 1};swimlaneFillColor=#FFFFFF;")
    cid = doc.vertex(x, y, w, h, lines_html([title]), st)
    ids[k] = cid
    for i, a in enumerate(attrs):
        doc.vertex(0, HEADER + 2 + i * ROW, w, ROW, lines_html([a]),
                   f"text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;html=1;"
                   f"whiteSpace=nowrap;fontFamily={FONT};fontSize={FS};fontColor=#000000;", parent=cid)

MARK = {"1": "ERmandOne", "0..1": "ERzeroToOne", "0..N": "ERzeroToMany", "1..N": "ERoneToMany"}


def rel(a, b, ma, mb, pts, label, lpos, sp, tp):
    st = (f"edgeStyle=none;rounded=0;html=1;endArrow={MARK[mb]};startArrow={MARK[ma]};endFill=0;startFill=0;"
          f"endSize=11;startSize=11;strokeColor=#000000;")
    doc.edge(st, pts, sp=sp, tp=tp)
    lx, ly, al = lpos
    doc.text(lx, ly, label.split("\n"), align=al, bg=True)


def mid(a, b):
    return (a + b) / 2


# helpers for rows/gaps
ab = row_top[1] - GAPY[0]  # bottom of row 0 area
bc = row_top[2] - GAPY[1]
cd = row_top[3] - GAPY[2]

# 1 domain — target
s, t = Py("domain", "left", 40), Py("target", "right", 40)
rel("domain", "target", "1", "0..N", [], "Задает", (mid(s[0], t[0]), s[1] - 18, "center"), s, t)
# 4 domain — template
s, t = Py("domain", "right", 40), Py("tpl", "left", 40)
rel("domain", "tpl", "1", "0..N", [], "Относится", (mid(s[0], t[0]), s[1] - 18, "center"), s, t)
# 3 domain — skill
s, t = P("domain", "bottom"), P("skill", "top")
rel("domain", "skill", "1", "0..N", [], "Содержит", (s[0] + 5, box("domain")[1] + box("domain")[3] + 10, "left"), s, t)
# 2 skill — target
s, t = P("skill", "top", 0.18), P("target", "bottom", 0.75)
y = ab + 34
rel("skill", "target", "1", "0..N", [(s[0], y), (t[0], y)], "Нормируется", (mid(s[0], t[0]), y - 18, "center"), s, t)
# 5 template — skill (M:N, template_skills)
s, t = P("tpl", "bottom", 0.18), P("skill", "top", 0.82)
y = ab + 34
rel("tpl", "skill", "0..N", "1..N", [(s[0], y), (t[0], y)], "Развивает (вес)", (mid(s[0], t[0]), y - 18, "center"), s, t)
# 9 template — run
s, t = P("tpl", "bottom"), P("run", "top")
rel("tpl", "run", "1", "0..N", [], "Генерирует", (s[0] + 5, ab + 44, "left"), s, t)
# 12 template — accepted
s = Py("tpl", "right", 52)
t = P("acc", "top")
rel("tpl", "acc", "1", "0..N", [(t[0], s[1])], "Пополняет базу решений", (t[0] - 120, s[1] - 18, "center"), s, t)
# 10 template — assignment
s = Py("tpl", "right", 112)
t = P("asg", "top")
rel("tpl", "asg", "1", "0..N", [(t[0], s[1])], "Назначается", (mid(s[0], t[0]), s[1] - 18, "center"), s, t)
# 6 skill — user skill
s, t = Py("skill", "left", 40), Py("us", "right", 40)
rel("skill", "us", "1", "0..N", [], "Оценивается", (mid(s[0], t[0]), s[1] - 18, "center"), s, t)
# 8 skill self-loop REQUIRES
x, yb, w, h = box("skill")
s, t = (x + w, yb + 62), (x + w, yb + 104)
rel("skill", "skill", "0..N", "0..N", [(x + w + 28, s[1]), (x + w + 28, t[1])], "Требует\n(вес)",
    (x + w + 32, mid(s[1], t[1]) - 15, "left"), s, t)
# 7 user — user skill
s, t = P("user", "top", 0.25), P("us", "bottom")
y = bc + 30
rel("user", "us", "1", "0..N", [(s[0], y), (t[0], y)], "Владеет", (mid(s[0], t[0]), y - 18, "center"), s, t)
# 11 user — assignment
s, t = P("user", "top", 0.75), P("asg", "bottom")
y = bc + 30
rel("user", "asg", "0..1", "0..N", [(s[0], y), (t[0], y)], "Получает (лично или группой)",
    (t[0] - 100, y - 18, "center"), s, t)
# 16 run — session
s, t = P("run", "bottom"), P("sess", "top")
rel("run", "sess", "1", "0..N", [], "Запускается как", (s[0] - 5, bc + 38, "right"), s, t)
# 13 session — accepted
s, t = P("sess", "top", 0.86), P("acc", "bottom")
y = bc + 62
rel("sess", "acc", "1", "0..1", [(s[0], y), (t[0], y)], "Признано альтернативным", (t[0] - 100, y - 18, "center"), s, t)
# 14 role — user (M:N, user_roles)
s, t = Py("role", "right", 40), Py("user", "left", 40)
rel("role", "user", "1..N", "0..N", [], "Имеет роль", (mid(s[0], t[0]), s[1] - 18, "center"), s, t)
# 15 user — session
s, t = Py("user", "right", 40), Py("sess", "left", 40)
rel("user", "sess", "1", "0..N", [], "Проходит", (mid(s[0], t[0]), s[1] - 18, "center"), s, t)
# 20 session — events
s, t = Py("sess", "right", 40), Py("ev", "left", 40)
rel("sess", "ev", "1", "0..N", [], "Порождает", (mid(s[0], t[0]), s[1] - 18, "center"), s, t)
# 17 user — audit
s, t = P("user", "bottom", 0.18), P("audit", "top")
y = cd + 28
rel("user", "audit", "0..1", "0..N", [(s[0], y), (t[0], y)], "Выполняет", (mid(s[0], t[0]), y - 18, "center"), s, t)
# 18 user — security events
s, t = P("user", "bottom", 0.6), P("sec", "top", 0.6)
rel("user", "sec", "0..1", "0..N", [], "Совершает", (s[0] - 5, cd + 40, "right"), s, t)
# 19 session — security events
s, t = P("sess", "bottom", 0.18), P("sec", "top", 0.88)
y = cd + 28
rel("sess", "sec", "0..1", "0..N", [(s[0], y), (t[0], y)], "Фиксирует", (mid(s[0], t[0]), y - 18, "center"), s, t)
# 22 session — result
s, t = P("sess", "bottom"), P("res", "top")
rel("sess", "res", "1", "0..1", [], "Проверяется", (s[0] - 5, cd + 40, "right"), s, t)
# 23 session — report
s, t = P("sess", "bottom", 0.72), P("rep", "top")
y = cd + 62
rel("sess", "rep", "1", "0..1", [(s[0], y), (t[0], y)], "Оформляется", (mid(s[0], t[0]) + 40, y - 18, "center"), s, t)
# 21 session — hints
s, t = P("sess", "bottom", 0.9), P("hint", "bottom")
y = cd + 28
rel("sess", "hint", "1", "0..N", [(s[0], y), (t[0], y)], "Получает (не более 3)", (t[0] - 90, y - 18, "center"), s, t)

doc.save(OUT)
print("built fig01_er")
