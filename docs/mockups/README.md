# Макеты интерфейса МАССО (ТП ред. 3, рис. 36–51)

Макеты сделаны как холст **Claude Design**: https://claude.ai/artifact/MmBFGAJzt3vprqpKny4etF (приватная ссылка Льва; 24 интерактивных артборда, переходы по меню и кнопкам, тумблер тёмной темы в Tweaks).

Перенос в **Figma**: https://www.figma.com/design/pQb0PmrSXtFYzDmKneddve — редактируемые слои, цвета привязаны к переменным «МАССО · светлая тема» и «МАССО · тёмная тема» (на тарифе Starter у коллекции один режим, поэтому темы — две коллекции), иконки — компоненты на странице «Иконки». Сборка — `figma/`: `extract.mjs` снимает дерево блоков со статических страниц, `gen.mjs` пишет скрипты `figma/calls/*.js` для инструмента `use_figma` (по одному на экран, `99_links.js` — переходы прототипа).
Они повторяют реальную вёрстку SPA (`frontend/src`, оформление «мягкий современный», Д-38): верхнее меню-«пилюли» по роли, переключатель темы, плашка пользователя, карточки с радиусом 20 px, кнопки-«пилюли», формы «подпись 34 % / поле 66 %». Тексты заголовков, кнопок, колонок, статусов и меню взяты из кода страниц. Холст интерактивный: пункты меню, строки таблиц, кнопки «Начать / Продолжить / Открыть», «Выйти» и быстрый вход по ролям на экране входа ведут на соответствующие артборды; тёмная тема — тумблер `dark` в Tweaks каждого артборда.

## Структура

```
docs/mockups/
├── canvas/project/      холст Claude Design
│   ├── canvas.json      артборды (1440 px), ряды по ролям, заголовки рядов
│   └── *.dc.html        24 артборда — исходники макетов (литеральная разметка, токены обеих тем в <helmet>)
├── png/                 снимки для ТП: fig36…fig51_*.png и extra_*.png (1440 px, ×1,5, во всю высоту)
├── static/              те же экраны как обычные HTML (ссылки *.html, рабочий переключатель темы) — для импорта в Figma
└── render.mjs           снимает PNG и пишет static/ из артбордов
```

## Рисунки ТП, артборды и маршруты

| Рис. ТП | Экран | Артборд | PNG | Маршрут SPA |
|---|---|---|---|---|
| 36 | Вход в систему | `Main.dc.html` | `fig36_login.png` | `/login` |
| 37 | Панель обучающегося («Мои назначения») | `StudentHome.dc.html` | `fig37_student-home.png` | `/student` |
| 38 | Рабочая область: сценарий с учебным сервером (терминал) | `WorkspaceContainer.dc.html` | `fig38_workspace-container.png` | `/student/sessions/:id` |
| 39 | Рабочая область: документный сценарий | `WorkspaceDocument.dc.html` | `fig39_workspace-document.png` | `/student/sessions/:id` |
| 40 | Рабочая область: задача на код | `WorkspaceCode.dc.html` | `fig40_workspace-code.png` | `/student/sessions/:id` |
| 41 | Протокол прохождения | `Report.dc.html` | `fig41_report.png` | `/student/reports/:sessionId` |
| 42 | Карта компетенций обучающегося («Мои навыки») | `StudentSkills.dc.html` | `fig42_student-skills.png` | `/student/skills` |
| 43 | Панель группы (с баннером режима LLM) | `TeacherGroup.dc.html` | `fig43_teacher-group.png` | `/teacher` |
| 44 | Цифровой след и корректировка оценки | `TeacherTrace.dc.html` | `fig44_teacher-trace.png` | `/teacher/sessions/:sessionId` |
| 45 | Граф компетенций (методист) | `SkillGraph.dc.html` | `fig45_methodist-skill-graph.png` | `/methodist/skills` |
| 46 | Шаблон сценария и отчёт валидации | `TemplateEditor.dc.html` | `fig46_methodist-template.png` | `/methodist/templates/:id` |
| 47 | Целевые уровни направления | `Targets.dc.html` | `fig47_methodist-targets.png` | `/methodist/targets` |
| 48 | Пользователи и роли | `AdminUsers.dc.html` | `fig48_admin-users.png` | `/admin/users` |
| 49 | LLM и песочницы | `AdminLlm.dc.html` | `fig49_admin-llm.png` | `/admin/llm` |
| 50 | Состояние системы | `SysHealth.dc.html` | `fig50_sysadmin-health.png` | `/sysadmin` |
| 51 | Рабочая область в тёмной теме | `WorkspaceDark.dc.html` (`dark` = true) | `fig51_workspace-dark.png` | `/student/sessions/:id` |
| — | Рабочая область: запрос подсказки | `HintDialog.dc.html` | `extra_hint-dialog.png` | `/student/sessions/:id` |
| — | Протоколы обучающегося | `StudentReports.dc.html` | `extra_student-reports.png` | `/student/reports` |
| — | Назначения группе | `TeacherAssignments.dc.html` | `extra_teacher-assignments.png` | `/teacher/assignments` |
| — | Экспорт отчётов | `TeacherExport.dc.html` | `extra_teacher-export.png` | `/teacher/export` |
| — | Граф компетенций: диалог «Новый домен» | `DomainDialog.dc.html` | `extra_domain-dialog.png` | `/methodist/skills` |
| — | Шаблоны сценариев | `Templates.dc.html` | `extra_methodist-templates.png` | `/methodist/templates` |
| — | Аудит и безопасность (администратор) | `AdminAudit.dc.html` | `extra_admin-audit.png` | `/admin/audit` |
| — | Аудит и безопасность (системный администратор) | `SysAudit.dc.html` | `extra_sysadmin-audit.png` | `/sysadmin/audit` |

## Заполнители

В макетах нет реальных людей, групп и содержимого сценариев — только интерфейс и заполнители:

| Что | Заполнитель |
|---|---|
| Сценарии, шаблоны, навыки, домены | «Сценарий N», «Шаблон N» (`template_N`), «Навык N» (`SKILL.N`), «Домен N» |
| Люди и группы | «Обучающийся N», «Преподаватель N», «Пользователь N», «Группа N», `userN@example.org` |
| Числа, доли, счётчики | `N`, `NN`, `NN %`, «N из N», вес связи `0,N` |
| Дата и время | `ДД.ММ.ГГГГ`, `ДД.ММ`, `ЧЧ:ММ`, `ЧЧ:ММ:СС`, таймер `ММ:СС`, идентификаторы `xxxxxxxx` |
| Тексты | «Текст легенды сценария…», «Текст подсказки…», «Текст теории навыка…», «Текст описания…», «Текст причины…» |
| Терминал и код | команды `$ команда`, `$ команда --параметр`; редактор — каркас `def solve(data):` / `# решение` |

## Токены (`frontend/src/index.css`)

Шрифты: IBM Plex Sans (400/500/600/700) и IBM Plex Mono (400/500); в приложении — `@fontsource`, в макетах — те же гарнитуры из Google Fonts. Радиус карточки 20 px, полей 12 px, кнопки и чипы — «пилюли»; поля и кнопки 44 px (малые 36 px).

| Токен | Светлая | Тёмная |
|---|---|---|
| `bg` фон | `#faf7f2` | `#141210` |
| `surface` карточка | `#ffffff` | `#1e1b18` |
| `sunken` подложка | `#f5f0e8` | `#262220` |
| `line` / `line-soft` | `#ece6dc` / `#f3eee6` | `#2f2a26` / `#282421` |
| `field` рамка поля | `#ddd5c8` | `#443d37` |
| `ink` текст | `#1c1917` | `#f5f2ed` |
| `muted` / `label` | `#78716c` / `#57534e` | `#a8a29e` / `#d6d3d1` |
| `nav` активная «пилюля» / `on-nav` | `#1c1917` / `#faf7f2` | `#f5f2ed` / `#1c1917` |
| `accent` / `accent-dark` / `on-accent` | `#ea580c` / `#c2410c` / `#ffffff` | `#fb923c` / `#fdba74` / `#1c1917` |
| синий фон / текст | `#e8effc` / `#1d4ed8` | `#172340` / `#93b4fd` |
| зелёный фон / текст / знак | `#e6f4ea` / `#166534` / `#16a34a` | `#10291a` / `#86efac` / `#22c55e` |
| янтарный фон / текст / знак | `#ffedd5` / `#9a3412` / `#ea8a0c` | `#3a1f0b` / `#fdba74` / `#f59e0b` |
| красный фон / текст / знак | `#fde8e6` / `#b42318` / `#dc2626` | `#3b1212` / `#fca5a5` / `#ef4444` |
| серый фон / текст | `#f5f0e8` / `#57534e` | `#262220` / `#d6d3d1` |
| терминал / шапка / текст | `#1c1917` / `#292524` / `#e7e5e4` | те же (терминал тёмный в обеих темах) |

Редактор кода: в светлой теме — фон `surface`, номера строк на `sunken`, подсветка CodeMirror по умолчанию; в тёмной — фон `#1c1917` и цвета One Dark.

## Как переснять PNG

Из корня репозитория (нужен установленный Playwright Chromium из `frontend/node_modules`; Google Fonts грузятся из сети):

```
PATH=$HOME/.nvm/versions/node/v22.23.4/bin:$PATH node docs/mockups/render.mjs            # все артборды
PATH=$HOME/.nvm/versions/node/v22.23.4/bin:$PATH node docs/mockups/render.mjs Report     # один артборд
```

Скрипт для каждого артборда убирает строку `support.js` и блок `<script type="text/x-dc">`, разворачивает `<x-dc>` и `<helmet>`, подставляет вместо `{{theme}}` класс `t-light` или `t-dark` (по значению `dark` по умолчанию), ждёт `document.fonts.ready` и снимает страницу во всю высоту (viewport 1440, `deviceScaleFactor` 1,5). Заодно он пишет `static/<Артборд>.html`. Если меняется высота артборда, обновите `h` в `canvas.json` и `$preview.height` в самом `.dc.html`.
