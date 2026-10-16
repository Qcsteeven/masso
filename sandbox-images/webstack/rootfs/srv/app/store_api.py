#!/usr/bin/env python3
"""store-api: minimal shop backend for the training server (stdlib HTTP + psycopg2)."""

import json
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import psycopg2

ENV_FILE = "/srv/app/.env"


def log(level: str, msg: str) -> None:
    print(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {level} store-api: {msg}", flush=True)


def load_env(path: str = ENV_FILE) -> dict[str, str]:
    env: dict[str, str] = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


ENV = load_env()


def connect():  # type: ignore[no-untyped-def]
    return psycopg2.connect(host=ENV.get("DB_HOST", "127.0.0.1"), port=int(ENV.get("DB_PORT", "5432")),
                            dbname=ENV.get("DB_NAME", "store"), user=ENV.get("DB_USER", "store"),
                            password=ENV.get("DB_PASSWORD", ""), connect_timeout=3)


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: object) -> None:
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:  # noqa: N802
        if self.path in ("/health", "/api/health"):
            try:
                with connect() as conn, conn.cursor() as cur:
                    cur.execute("SELECT 1")
                self._send(200, {"status": "ok", "db": "ok"})
            except psycopg2.Error as exc:
                log("ERROR", f"health: database unavailable: {str(exc).strip().splitlines()[0]}")
                self._send(503, {"status": "error", "db": "unavailable"})
        elif self.path in ("/", "/api/products"):
            try:
                with connect() as conn, conn.cursor() as cur:
                    cur.execute("SELECT id, name, price::float, stock FROM products ORDER BY id")
                    rows = [dict(zip(("id", "name", "price", "stock"), r)) for r in cur.fetchall()]
                self._send(200, {"shop": "Интернет-магазин", "products": rows})
            except psycopg2.Error as exc:
                log("ERROR", f"products: {str(exc).strip().splitlines()[0]}")
                self._send(500, {"error": "internal error"})
        else:
            self._send(404, {"error": "not found"})

    def log_message(self, fmt: str, *args: object) -> None:
        log("INFO", fmt % args)


def main() -> None:
    try:
        with connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM products")
    except psycopg2.Error as exc:
        log("ERROR", f"startup: cannot connect to database: {str(exc).strip().splitlines()[0]}")
        sys.exit(1)
    port = int(ENV.get("APP_PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    log("INFO", f"store-api started on 127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
