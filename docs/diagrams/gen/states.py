import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from dio import Diagram  # noqa: E402

OUT = Path("/home/lcatharsis/masso/docs/diagrams")
d = Diagram("fig25_session_states")


def state(cid, x, y, w, h, name, body):
    html = (f'<div style="border-bottom:1px solid #000;padding-bottom:3px;margin-bottom:4px"><b>{name}</b></div>'
            f'<span style="font-size:11px">{body}</span>')
    return d.box(cid, x, y, w, h, html, rounded=True, size=13, valign="top", spacing=6, extra="arcSize=18;")


def side(x, y, w, h, html, align="left"):
    d.text(None, x, y, w, h, html, size=11, align=align)


d.dot("init", 40, 140)
state("starting", 180, 100, 220, 80, "starting", "подготовка учебной среды:<br>контейнер и начальный сбой<br>или файлы задания")
state("active", 520, 60, 360, 125, "active",
      "do / отсчёт лимита времени<br>incident_due_at / внесение инцидента<br>"
      "ответы, подсказки, самопроверка,<br>запуск тестов, команды в терминале")
state("checking", 1060, 100, 220, 80, "checking", "AssessmentAgent:<br>проверки, балл, протокол")
state("completed", 1420, 100, 200, 80, "completed", "протокол сформирован,<br>профиль обновлён")
state("paused", 520, 420, 360, 90, "paused",
      "контейнер приостановлен;<br>время паузы не входит в лимит")
state("expired", 520, 680, 360, 90, "expired", "снимок /srv сохранён,<br>контейнер удалён")
state("failed", 1060, 680, 220, 90, "failed", "сессия не продолжается,<br>текст ошибки в sessions.error")
d.final("f1", 1690, 140)
d.final("f2", 950, 725)
d.final("f3", 1350, 725)

d.edge("init", "starting", [(52, 140), (180, 140)])
d.label(116, 124, 124, "POST /api/sessions", size=10)
d.edge("starting", "active", [(400, 140), (520, 140)])
d.label(460, 122, 110, "среда готова", size=10)
d.edge("starting", "failed", [(290, 180), (290, 830), (1170, 830), (1170, 770)])
d.label(700, 830, 220, "ошибка запуска учебной среды", size=10)
d.edge("active", "paused", [(600, 185), (600, 420)])
side(486, 260, 110, 60, "POST /pause<br>или бездействие<br>≥ 15 мин (worker)", align="right")
d.edge("paused", "active", [(800, 420), (800, 185)])
side(806, 240, 250, 76, "POST /resume, подключение терминала<br>или активность (ввод, ответ, подсказка) /<br>started_at и incident_due_at<br>сдвигаются на длительность паузы")
d.edge("active", "checking", [(880, 140), (1060, 140)])
d.label(970, 106, 176, "POST /submit; истёк лимит<br>времени или квота диска<br>(worker, автоотправка)", size=10)
d.edge("paused", "checking", [(880, 450), (1110, 450), (1110, 180)])
d.label(990, 450, 96, "POST /submit", size=10)
d.edge("paused", "failed", [(880, 495), (1160, 495), (1160, 680)])
d.text(None, 886, 500, 270, 34, "удаление среды администратором<br>(из active или paused, cleanup force)", size=10,
       align="left")
d.edge("checking", "completed", [(1280, 140), (1420, 140)])
d.label(1350, 122, 130, "отчёт сформирован", size=10)
d.edge("checking", "failed", [(1220, 180), (1220, 680)])
side(1226, 560, 130, 34, "ошибка<br>проверки")
d.edge("active", "expired", [(520, 170), (480, 170), (480, 725), (520, 725)])
d.edge("paused", "expired", [(700, 510), (700, 680)])
d.label(590, 600, 196, "нет активности 24 ч<br>(worker, снимок /srv)", size=10)
d.edge("completed", "f1", [(1620, 140), (1677, 140)])
d.edge("expired", "f2", [(880, 725), (937, 725)])
d.edge("failed", "f3", [(1280, 725), (1337, 725)])
d.text(None, 40, 860, 1660, 40,
       "Запись сессии создаётся сразу в состоянии starting. Каждый переход записывается в цифровой след "
       "событием status (environment_events).", size=11, align="left", italic=True)
d.save(OUT / "fig25_session_states.drawio", 1740, 910)
print("ok")
