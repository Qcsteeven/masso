import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";
import { cx } from "../../components/ui";
import { openSessionSocket } from "./ws";

type Conn = "connecting" | "open" | "closed";

/** xterm.js bridged to `docker exec bash -l` in the sandbox (binary frames, JSON resize). */
export function Terminal({ sessionId, enabled }: { sessionId: string; enabled: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [conn, setConn] = useState<Conn>("connecting");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !host.current) return;
    let disposed = false;
    let ws: WebSocket | null = null;
    const term = new XTerm({
      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
      fontSize: 14,
      cursorBlink: true,
      theme: { background: "#0f1a24", foreground: "#d7e0e8", cursor: "#d7e0e8", green: "#6fd09a", red: "#f28b82", yellow: "#f2c46d" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host.current);
    fit.fit();
    const enc = new TextEncoder();
    const sendResize = () => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
    };
    const ro = new ResizeObserver(() => { try { fit.fit(); sendResize(); } catch { /* detached */ } });
    ro.observe(host.current);
    const dataSub = term.onData((d) => { if (ws?.readyState === WebSocket.OPEN) ws.send(enc.encode(d)); });
    setConn("connecting");
    openSessionSocket(sessionId, "terminal").then((sock) => {
      if (disposed) { sock.close(); return; }
      ws = sock;
      ws.binaryType = "arraybuffer";
      ws.onopen = () => { setConn("open"); sendResize(); term.focus(); };
      ws.onmessage = (e) => term.write(typeof e.data === "string" ? e.data : new Uint8Array(e.data as ArrayBuffer));
      ws.onclose = () => {
        if (disposed) return;
        setConn("closed");
        term.write("\r\n\x1b[33m[соединение с учебной средой закрыто]\x1b[0m\r\n");
      };
    }).catch(() => !disposed && setConn("closed"));
    return () => {
      disposed = true;
      dataSub.dispose();
      ro.disconnect();
      ws?.close();
      term.dispose();
    };
  }, [sessionId, enabled, attempt]);

  return (
    <section aria-label="Терминал учебной среды" className="flex h-[calc(100vh-150px)] min-h-[420px] min-w-0 flex-col overflow-hidden rounded-card bg-term">
      <div className="flex items-center justify-between gap-3 bg-term-bar px-4 py-2.5 font-mono text-[13px] text-[#c3cfdb]">
        <span>student@masso-srv: /srv</span>
        <span className="flex items-center gap-2 font-sans">
          <span className={cx("size-2 rounded-full", conn === "open" ? "bg-[#6fd09a]" : conn === "connecting" ? "bg-[#f2c46d]" : "bg-[#f28b82]")} />
          {conn === "open" ? "WebSocket подключён" : conn === "connecting" ? "Подключение…" : "Нет соединения"}
          {conn === "closed" && enabled && (
            <button type="button" className="ml-2 rounded border border-[#3b5468] px-2 py-0.5 text-xs hover:bg-[#21384b]" onClick={() => setAttempt((a) => a + 1)}>
              Переподключить
            </button>
          )}
        </span>
      </div>
      {enabled ? (
        <div className="relative min-h-0 flex-1">
          {/* absolute box: xterm's own size must not feed back into the layout (resize loop) */}
          <div ref={host} className="absolute inset-3" />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-[#c3cfdb]">Терминал недоступен: учебная среда не запущена.</div>
      )}
    </section>
  );
}
