import { describe, expect, it } from "vitest";
import { applyIncident, exec, newServer, runChecks } from "./server";

const FILES = {
  "/srv/app/.env.example": "DB_HOST=127.0.0.1\nDB_PORT=5432\nDB_NAME=store\nDB_USER=store\nDB_PASSWORD=Sh0p-2026-store\nAPP_PORT=8000\n",
  "/srv/nginx/store.conf": "upstream store_api {\n    server 127.0.0.1:8000;\n}\nserver {\n    listen 8080;\n    location / {\n        proxy_pass http://store_api;\n    }\n}\n",
  "/srv/docs/README.md": "# Учебный сервер\n",
};

const passed = (s: ReturnType<typeof newServer>) => Object.fromEntries(runChecks(s).map((c) => [c.id, c.passed]));

describe("demo training server", () => {
  it("runs the README defence script from the broken state to all checks passed", () => {
    const s = newServer(FILES, "db_wrong_user");
    expect(exec(s, "supervisorctl status").out).toMatch(/store-api\s+BACKOFF/);
    expect(exec(s, "tail -n 5 /srv/log/store-api.log").out).toContain('password authentication failed for user "shop"');
    expect(exec(s, "diff /srv/app/.env.example /srv/app/.env").out).toContain("> DB_USER=shop");
    expect(passed(s).health).toBe(false);

    exec(s, "sed -i 's/^DB_USER=.*/DB_USER=store/; s/^DB_PASSWORD=.*/DB_PASSWORD=Sh0p-2026-store/' /srv/app/.env && supervisorctl restart store-api");
    expect(exec(s, "supervisorctl status store-api").out).toMatch(/RUNNING/);
    expect(exec(s, "curl -s localhost:8080/health").out).toBe('{"status": "ok", "db": "ok"}');

    applyIncident(s);
    expect(exec(s, "curl -s -o /dev/null -w '%{http_code}\\n' localhost:8080/health").out).toBe("502");
    expect(passed(s).health).toBe(false);
    exec(s, "sed -i 's/127.0.0.1:8001/127.0.0.1:8000/' /srv/nginx/store.conf && supervisorctl restart nginx");
    expect(Object.values(passed(s)).every(Boolean)).toBe(true);
  });

  it("does not start the app while the password is wrong, and && stops the chain", () => {
    const s = newServer(FILES, "db_wrong_password");
    expect(exec(s, "supervisorctl restart store-api").out).toContain("ERROR");
    expect(exec(s, "false_cmd && echo never").out).not.toContain("never");
    expect(exec(s, "cat /srv/app/.env | grep DB_PASSWORD").out).toBe("DB_PASSWORD=Shop-2026-store");
  });

  it("blocks and reports attacks like the real sandbox", () => {
    const s = newServer(FILES, "db_wrong_user");
    expect(exec(s, "sudo -i")).toEqual({ out: "bash: sudo: command not found", security: "privilege_escalation" });
    expect(exec(s, "touch /etc/pwned")).toMatchObject({ out: expect.stringContaining("Read-only file system"), security: "forbidden_file" });
    expect(exec(s, "cat /var/run/docker.sock").security).toBe("sandbox_escape");
    expect(exec(s, "nmap -sS 10.0.0.0/24").security).toBe("network_scan");
    expect(exec(s, "ls /srv/app").security).toBeUndefined();
  });

  it("fails password_auth when the student switches PostgreSQL to trust", () => {
    const s = newServer(FILES, "db_wrong_user");
    exec(s, "sed -i 's/scram-sha-256/trust/' /srv/pgdata/pg_hba.conf");
    expect(passed(s).password_auth).toBe(false);
  });

  it("reports a broken nginx config", () => {
    const s = newServer(FILES, "db_wrong_user");
    exec(s, "sed -i 's/^}$//' /srv/nginx/store.conf");
    expect(exec(s, "nginx -t").out).toContain("test failed");
    expect(passed(s).nginx_config).toBe(false);
  });
});
