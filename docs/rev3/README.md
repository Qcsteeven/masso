# ТЗ и ТП редакции 3

Редакция 3 приводит ТЗ и ТП к реализованному опытному образцу (первая очередь) — без расхождений с кодом на 29.10.2026. Структура документов — как в ред. 2.

| Файл | Что это |
|---|---|
| `TZ.docx`, `TZ.pdf` | Техническое задание, ред. 3 |
| `TP.docx`, `TP.pdf` | Технический проект, ред. 3: 51 рисунок (35 диаграмм draw.io, 16 макетов экранов), разделы с широкими схемами и макетами — на альбомных листах |
| `build/` | Сборка: правка ред. 2 (`docs/rev2/*.docx`) с сохранением оформления |

Что изменено и почему — `docs/doc-updates.md` (правки по журналу `docs/DEVIATIONS.md`) и раздел «Сверка с кодом 29.10.2026» в нём.

Исходники рисунков:
- диаграммы — `docs/diagrams/figNN_*.drawio`, PNG — `docs/diagrams/png/`, генераторы — `docs/diagrams/gen/`;
- макеты — холст Claude Design `docs/mockups/canvas/project/` (интерактивный, со светлой и тёмной темой), PNG — `docs/mockups/png/`, перенос в Figma — `docs/mockups/figma/` (см. `docs/mockups/README.md`).

## Сборка

Нужны python-docx (`uv venv` + `uv pip install python-docx`) и Microsoft Word на Windows (WSL): Word считает страницы для оглавления и строки «На N листах» и сохраняет PDF.

```bash
cd docs/rev3/build
python build_tz.py /tmp/TZ_raw.docx && python finalize.py /tmp/TZ_raw.docx ../TZ.docx ../TZ.pdf
python build_tp.py /tmp/TP_raw.docx && python finalize.py /tmp/TP_raw.docx ../TP.docx ../TP.pdf
```

- `doclib.py` — замена текста абзацев, вставка абзацев и рисунков по образцу, пересборка таблиц, альбомные разделы;
- `build_tz.py`, `build_tp.py`, `tp_content.py` — содержание правок;
- `finalize.py` + `word_pages.ps1` — оглавление, число листов, PDF;
- `pdf_pages.ps1` — постраничные PNG из PDF (Windows.Data.Pdf) для визуальной проверки.
