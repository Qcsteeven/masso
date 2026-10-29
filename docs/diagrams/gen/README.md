# Генераторы диаграмм ТП (ред. 3)

Рисунки 1–35 ТП — файлы `docs/diagrams/figNN_*.drawio` (открываются в draw.io / diagrams.net). Они сгенерированы этими скриптами по фактам из кода (таблицы БД, эндпоинты, статусы), затем экспортированы в `docs/diagrams/png/`.

| Скрипт | Рисунки |
|---|---|
| `fig01.py`, `figs_lanes.py`, `lanes.py` | 1 (ER), 2–8 (To-Be, дорожки) |
| `figs_seq.py`, `seq.py` | 9–19 (последовательности) |
| `models.py`, `physical.py`, `facts.py` | 20–24 (модели данных) |
| `states.py` | 25 (состояния сессии) |
| `c4.py`, `c4b.py` | 26–31 (C4, этапы) |
| `dfd.py` | 32–34 (DFD) |
| `ui.py` | 35 (структура интерфейса) |
| `dio.py`, `common.py` | общая разметка draw.io |

Повторный запуск скрипта перезаписывает соответствующие `.drawio`; ручные правки в draw.io после этого теряются.

Экспорт в PNG (2x, белый фон): `bash exp.sh fig12_session fig19_code_task …`. Нужен draw.io viewer рядом с `export.mjs` (не хранится в git):

```bash
curl -sSfL -o docs/diagrams/gen/viewer-static.min.js https://cdn.jsdelivr.net/gh/jgraph/drawio@v26.0.9/src/main/webapp/js/viewer-static.min.js
```

и Playwright Chromium из `frontend/node_modules`.
