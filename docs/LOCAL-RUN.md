# Локальный запуск МАССО

Пошаговая инструкция для своего компьютера: Windows 10/11 через WSL2 (основной вариант) или Linux. Время — 20–40 минут, большая часть уходит на первую сборку образов.

## 0. Что понадобится

| | Минимум | Комфортно |
|---|---|---|
| ОЗУ | 8 ГБ (из них 6 ГБ отдать WSL) | 16 ГБ |
| Диск | 20 ГБ свободно | 30 ГБ |
| Процессор | 4 ядра | 8 ядер |
| Интернет | нужен при первой сборке (образы Docker, пакеты Python/Node/Debian) | |

Порт 80 должен быть свободен. Если он занят, см. раздел «Если что-то пошло не так».

## 1. Подготовка Windows (на Linux — сразу к шагу 2)

1. **WSL2 и Ubuntu.** В PowerShell от имени администратора выполните `wsl --install -d Ubuntu`, перезагрузите компьютер, откройте «Ubuntu» из меню «Пуск» и задайте имя пользователя и пароль.
2. **Память для WSL.** Создайте файл `C:\Users\<вы>\.wslconfig`:
   ```ini
   [wsl2]
   memory=6GB
   processors=4
   ```
   Затем в PowerShell выполните `wsl --shutdown` и снова откройте Ubuntu.
3. **Docker.** Выберите один из двух вариантов.
   - **Docker Desktop (проще).** Установите его с https://www.docker.com/products/docker-desktop/. В Settings → Resources → WSL Integration включите Ubuntu, нажмите Apply & Restart. Docker Desktop должен быть запущен, пока работает МАССО.
   - **Docker Engine внутри Ubuntu (без Docker Desktop).** В терминале Ubuntu:
     ```bash
     curl -fsSL https://get.docker.com | sudo sh
     sudo usermod -aG docker $USER
     ```
     В PowerShell выполните `wsl --shutdown`, снова откройте Ubuntu и запустите демон: `sudo service docker start`. Эту команду придётся повторять после каждого перезапуска WSL — либо включите systemd: добавьте в `/etc/wsl.conf` блок `[boot]` со строкой `systemd=true`.

Дальше все команды выполняются **в терминале Ubuntu**, не в PowerShell.

## 2. Инструменты

```bash
sudo apt update && sudo apt install -y git make curl openssl
docker version && docker compose version     # обе команды должны напечатать версии
```

Если `docker` пишет `permission denied … docker.sock`, перезайдите в терминал после `usermod` (или выполните `newgrp docker`).

## 3. Код и настройки

Клонируйте **в домашний каталог Ubuntu** (`~`), а не в `/mnt/c/...`: на диске Windows сборка идёт в разы медленнее.

```bash
cd ~
git clone https://github.com/Qcsteeven/masso.git
cd masso
cp .env.example .env
```

Задайте секреты (одна команда, ничего вручную не редактировать):

```bash
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/; s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 12)/" .env
```

- **Без LLM.** Остальные строки `.env` можно не трогать: система переключится в шаблонный режим и будет работать на утверждённых вариантах сценариев.
- **С LLM.** Впишите ключ и модель OpenAI-совместимого провайдера в `LLM_EXTERNAL_API_KEY` и `LLM_EXTERNAL_CHAT_MODEL`. Для GigaChat — раздел 5б. Если LLM подключаете после первого `make seed`, выполните `make up && make seed`: сид перенесёт новые `LLM_*` в настройки провайдеров.
- **Пароль базы задавайте до первого запуска.** База создаётся при первом `make up`. Если потом поменять `POSTGRES_PASSWORD`, backend не подключится — придётся пересоздать базу (раздел 7).

## 4. Сборка и запуск

```bash
make up              # первый раз 5–15 минут: сборка backend и frontend, запуск db, backend, frontend
make seed            # роли, демо-пользователи, граф навыков, 3 шаблона сценариев
make sandbox-image   # образ «учебного сервера» для DevOps-сценария, 2–5 минут
curl -s localhost/api/health
```

Ответ `/api/health` должен содержать `"db":"ok"`. Если `make seed` сразу после `make up` пишет об отсутствии таблиц, backend ещё применяет миграции — повторите через 10–20 секунд.

## 5. Вход и что посмотреть

Откройте в браузере Windows **http://localhost**. Пароль у всех демо-аккаунтов — `masso-demo`.

| Роль | Email |
|---|---|
| Обучающийся | `demonov.la@masso.local` (ещё `ivanov.as`, `petrova.md`, `kim.ea`, `orlova.dp`, `zakharov.ni` @masso.local) |
| Преподаватель | `teacher@masso.local` |
| Методист | `methodist@masso.local` |
| Администратор | `admin@masso.local` |
| Системный администратор | `ops@masso.local` |

Короткий маршрут:

1. **Преподаватель.** «Назначения» → назначить «Восстановление веб-сервиса после сбоя» группе ИСИб-23-1.
2. **Обучающийся.** «Начать» у этого сценария. В терминале:
   ```bash
   supervisorctl status
   tail -n 5 /srv/log/store-api.log
   diff /srv/app/.env.example /srv/app/.env
   sed -i 's/^DB_USER=.*/DB_USER=store/; s/^DB_PASSWORD=.*/DB_PASSWORD=Sh0p-2026-store/' /srv/app/.env && supervisorctl restart store-api
   curl -s localhost:8080/health
   ```
   Через 2–5 минут придёт инцидент — 1–2 случайных из пула (прокси на неверный порт, смена порта приложения, остановка базы, ошибка в конфигурации nginx); исправления — в `README.md`, раздел 3, таблица инцидентов. Кнопка «Проверить выполнение» под критериями показывает, что уже выполнено (баллы не снимаются).
   Затем «Завершить и отправить на проверку» → откроется протокол с баллом.
3. **Преподаватель.** «Группы» → выбрать период → «След» у сессии: команды, инцидент, подсказки. Подтвердите или скорректируйте оценку с причиной.
4. **Администратор и системный администратор.** «LLM и песочницы» — переключение режима; «Состояние системы» — учебные среды и события безопасности.

Полный сценарий демонстрации на 5 минут — в `README.md`, раздел 3.

## 5а. Защищённый режим (HTTPS), если нужно показать

Обычный `make up` — тестовый режим по HTTP; в ТЗ для эксплуатации требуется HTTPS. Показать его локально:

```bash
make tls-selfsigned   # самоподписанный сертификат в ./certs (не для эксплуатации)
make up-tls           # HTTPS на 443, HTTP перенаправляется на HTTPS
```

Откройте https://localhost — браузер предупредит о самоподписанном сертификате, это ожидаемо («Дополнительно» → «Перейти»). Терминал работает через WSS, cookie входа — с флагом Secure. Вернуться к обычному режиму: `make down && make up`.

## 5б. GigaChat (если нужен реальный LLM)

GigaChat подключается через прокси gpt2giga — он уже описан в `docker-compose.yml` (профиль `gigachat`) и сам обновляет OAuth-токен. Нужен ключ авторизации из личного кабинета GigaChat API (developers.sber.ru → проект GigaChat API → «Ключ авторизации»).

1. Откройте `.env` в редакторе (`nano .env`) и задайте строки (ключ вписываете только вы, в репозиторий он не попадает):
   ```ini
   COMPOSE_PROFILES=gigachat
   GIGACHAT_CREDENTIALS=<ключ авторизации>
   GIGACHAT_SCOPE=GIGACHAT_API_PERS
   GIGACHAT_VERIFY_SSL_CERTS=False
   LLM_EXTERNAL_BASE_URL=http://gpt2giga:8090/v1
   LLM_EXTERNAL_CHAT_MODEL=GigaChat-2-Max
   LLM_EXTERNAL_JSON_MODE=false
   LLM_EXTERNAL_EMBED_MODEL=
   LLM_GENERATION_MODE=external
   ```
   Ключ доступа backend к прокси — любая случайная строка: `sed -i "s/^LLM_EXTERNAL_API_KEY=.*/LLM_EXTERNAL_API_KEY=$(openssl rand -hex 24)/" .env`.
2. `make up && make seed`.
3. Проверка: `docker compose exec -T backend python - external < scripts/llm_smoke.py` — должно напечатать «Провайдер: external», легенду, строку «Вызов external: ok=True, токены …» и «Эмбеддинги: hash, размерность 1024».

`GIGACHAT_VERIFY_SSL_CERTS=False` допустим только в тестовом режиме. В защищённом режиме (`make up-tls`) проверка сертификата GigaChat включается автоматически — положите корневой сертификат НУЦ Минцифры в `certs/russian_trusted_root_ca.pem` (команда — README, раздел 1, «GigaChat»). Если GigaChat недоступен, генерация переходит на утверждённые варианты, начатые сессии продолжаются.

## 6. Остановка и повторный запуск

```bash
make down    # остановить (данные в базе сохраняются)
make up      # запустить снова (пересобирает только изменённое)
make logs    # журналы всех контейнеров, выход — Ctrl+C
```

После перезагрузки Windows: откройте Ubuntu, при варианте с Docker Engine выполните `sudo service docker start`, затем `cd ~/masso && make up`.

## 7. Если что-то пошло не так

| Симптом | Что сделать |
|---|---|
| `make: command not found` | `sudo apt install -y make` |
| `Cannot connect to the Docker daemon` | Docker Desktop не запущен или не включена WSL Integration для Ubuntu; при Docker Engine — `sudo service docker start` |
| `permission denied while trying to connect to the Docker daemon socket` | `sudo usermod -aG docker $USER`, затем перезайти в терминал |
| `Bind for 0.0.0.0:80 failed: port is already allocated` | Порт 80 занят (IIS, Skype, другой сервер). Запускайте `HTTP_PORT=8080 make up` и открывайте http://localhost:8080 |
| Сборка падает на `apt-get`, `pip`/`uv` или `pnpm install` с ошибкой сети | Проверьте интернет/VPN/прокси и повторите `make up` — уже скачанное не перекачивается |
| `make seed` — `relation … does not exist` | Миграции ещё идут: подождать 20 секунд и повторить |
| При старте сценария «Не удалось создать учебную среду» | Не собран образ песочницы: `make sandbox-image` |
| Учебная среда стартует, но сразу падает, в журнале `bad interpreter: /bin/bash^M` | Репозиторий склонирован в Windows с CRLF. Удалите его, клонируйте заново в Ubuntu (шаг 3), затем `make sandbox-image` |
| Backend перезапускается, в `make logs` — `password authentication failed` | `POSTGRES_PASSWORD` поменяли после первого запуска. Пересоздать базу (все данные удалятся): `docker compose down -v && make up && make seed` |
| Всё очень медленно | Проверьте, что проект лежит в `~`, а не в `/mnt/c`; добавьте WSL памяти в `.wslconfig` |
| Вход «Слишком много неудачных попыток» | 10 неверных паролей за 15 минут с одного адреса — подождите 15 минут |

Полный сброс к чистому состоянию: `docker compose down -v && make up && make seed`.

## 8. Для разработки и тестов (необязательно)

Нужны дополнительно `uv` (https://docs.astral.sh/uv/) и Node.js 22 с `pnpm` (`corepack enable`).

```bash
make dev-db                                  # PostgreSQL для тестов на порту 5433
cd backend && uv sync && cd ../frontend && pnpm install && cd ..
make check                                   # линтеры, типы, unit- и API-тесты (≈ 2 мин)
make test-integration                        # тесты с реальным Docker и песочницей (≈ 5 мин, нужен make sandbox-image)
cd frontend && pnpm exec playwright install chromium && cd ..
E2E_BASE_URL=http://localhost make e2e       # сквозные тесты в браузере по запущенной системе
```

Проверка реального LLM, если ключ задан в `.env`: `docker compose exec -T backend python - external < scripts/llm_smoke.py` (раздел 5б).
