# Учебный сервер интернет-магазина

Состав:
- nginx — обратный прокси, порт 8080, конфигурация `/srv/nginx/store.conf`;
- store-api — приложение магазина, порт 8000, код `/srv/app/store_api.py`, настройки `/srv/app/.env`;
- PostgreSQL 15 — база `store`, данные `/srv/pgdata`, порт 5432.

Службы работают под supervisord:
- `supervisorctl status` — состояние служб;
- `supervisorctl restart <служба>` — перезапуск (`nginx`, `store-api`, `postgresql`);
- `supervisorctl tail -f store-api` — журнал службы.

Журналы: `/srv/log/*.log`. Проверка магазина: `curl -i localhost:8080/health`.
Эталонные параметры подключения к БД — `/srv/app/.env.example`.
Проверка конфигурации nginx: `nginx -t -c /srv/nginx/nginx.conf`.
