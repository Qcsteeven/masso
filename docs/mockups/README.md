# Макеты интерфейса (ТП ред. 2, рис. 33–43)

Эталон внешнего вида — макеты в Claude Design: https://claude.ai/artifact/S5L7mz9Mevzbs8oLVwEyFT (приватная ссылка Льва).

Макеты обобщённые: вместо реальных данных — заполнители (N/NN — числа, ДД.ММ.ГГГГ и ЧЧ:ММ — дата и время, «Название сценария», «Навык 1», «Обучающийся 1»). В реализации на их месте — данные из API.

В репозитории:
- `*.png` — снимки экранов 1440×900 (@2x), по ним агент `ui-checker` сверяет реализацию;
- `source/*.dc.html` — исходная разметка артбордов (статичный HTML + inline-стили; токены ниже).

| Файл | Экран | Маршрут SPA |
|---|---|---|
| login.png | Вход | /login |
| student-home.png | Панель обучающегося | /student |
| student-workspace.png | Рабочая область (легенда, терминал, журнал, подсказки) | /student/sessions/:id |
| student-report.png | Протокол прохождения | /student/reports/:id |
| teacher-group.png | Панель группы (баннер режима LLM) | /teacher |
| teacher-trace.png | Цифровой след и корректировка оценки | /teacher/sessions/:id |
| methodist-skill-graph.png | Граф компетенций | /methodist/skills |
| methodist-template.png | Шаблон сценария и отчёт валидации | /methodist/templates/:id |
| admin-users.png | Пользователи и роли | /admin/users |
| admin-llm.png | LLM и песочницы | /admin/llm |
| sysadmin-health.png | Состояние системы, среды, события безопасности | /sysadmin |

## Токены

- Шрифты: IBM Plex Sans (текст), IBM Plex Mono (время, id, команды). Пакеты `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`.
- Фон `#EEF1F4`, карточки `#FFFFFF` с рамкой `#D5DCE3`, радиус 10 px; боковое меню `#12202C`, активный пункт `#1D5FD1`.
- Текст `#14212E`, вторичный `#556270`.
- Действие (синий) `#1D5FD1`; метки: синий `#E6EEFB/#1747A6`, зелёный `#E3F3EA/#135C34`, жёлтый `#FFF3D1/#7A4F00`, красный `#FCE8E6/#8C1D18`, серый `#EDF0F3/#3B4856`.
- Кнопки и поля высотой 44 px; формы — подпись 34 %, поле 66 %; отчёты — обязательные «Дата начала» и «Дата окончания».
