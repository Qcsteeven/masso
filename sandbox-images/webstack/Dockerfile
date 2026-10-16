# Учебный сервер для DevOps-сценариев (спека §5, §7): nginx :8080 → store-api :8000 → PostgreSQL :5432,
# всё под supervisord от пользователя student. Изменяемые данные — только в /srv (анонимный том),
# корневая ФС монтируется только для чтения. Команды сбоев/проверок в образ не кладутся.
FROM debian:bookworm-slim

RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      nginx-light postgresql-15 postgresql-client-15 python3 python3-psycopg2 supervisor \
      procps less nano vim-tiny curl iproute2 bash-completion \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd -g 1000 student && useradd -m -u 1000 -g 1000 -s /bin/bash student \
 && rm -f /etc/nginx/sites-enabled/default

COPY rootfs/ /
ENV PATH="/usr/lib/postgresql/15/bin:${PATH}" PGHOST=/srv/run PGUSER=student PGDATABASE=postgres

RUN mkdir -p /srv/run /srv/log /srv/nginx/tmp /srv/pgdata /tmp/.masso \
 && chown -R student:student /srv \
 && chmod 0755 /usr/local/bin/masso-init /usr/local/bin/masso-start \
 && su student -c "/usr/local/bin/masso-init" \
 && chmod 0644 /etc/bash.bashrc

USER student
WORKDIR /srv
EXPOSE 8080
CMD ["/usr/local/bin/masso-start"]
