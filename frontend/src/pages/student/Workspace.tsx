import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ApiError, api } from "../../api/client";
import { DOMAIN_LABEL, type AnswerForm, type HintOut, type ScenarioPublic, type SessionEvent, type SessionView, type SubmitOut } from "../../api/types";
import { Icon, type IconName } from "../../components/icons";
import { ThemeToggle } from "../../components/Layout";
import { Banner, Button, Card, CardTitle, Chip, ErrorBanner, Loading, Textarea, cx, fmtTime, type Tone } from "../../components/ui";
import { AnswerFormCard, DocumentViewer, type Answers } from "./DocumentTrainer";
import { Terminal } from "./Terminal";
import { openSessionSocket } from "./ws";
import { TheoryCard } from "../../components/Theory";

const STATUS_CHIP: Record<string, { label: string; tone: Tone }> = {
  starting: { label: "запуск среды", tone: "blue" },
  active: { label: "среда готова", tone: "green" },
  paused: { label: "на паузе", tone: "amber" },
  checking: { label: "проверка", tone: "blue" },
  submitted: { label: "проверка", tone: "blue" },
  completed: { label: "завершена", tone: "green" },
  failed: { label: "ошибка", tone: "red" },
  expired: { label: "истекла", tone: "grey" },
};

const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

function useCountdown(remaining: number | null, running: boolean): number | null {
  const [left, setLeft] = useState<number | null>(remaining);
  useEffect(() => {
    if (remaining == null) return;
    const at = Date.now();
    const update = () => setLeft(running ? Math.max(0, remaining - Math.floor((Date.now() - at) / 1000)) : remaining);
    const first = setTimeout(update, 0);
    const t = running ? setInterval(update, 1000) : undefined;
    return () => { clearTimeout(first); clearInterval(t); };
  }, [remaining, running]);
  return left ?? remaining;
}

/** Live session events over WebSocket (reconnects with a fresh token). */
function useSessionEvents(sessionId: string, enabled: boolean, onEvent: (e: SessionEvent) => void) {
  const [connected, setConnected] = useState(false);
  const cb = useRef(onEvent);
  useEffect(() => { cb.current = onEvent; }, [onEvent]);
  useEffect(() => {
    if (!enabled) return;
    let ws: WebSocket | null = null;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      openSessionSocket(sessionId, "events").then((sock) => {
        if (stop) { sock.close(); return; }
        ws = sock;
        ws.onopen = () => setConnected(true);
        ws.onmessage = (m) => {
          try {
            const raw = JSON.parse(String(m.data)) as Omit<SessionEvent, "type"> & { type: string };
            // the server names live check events check_status
            const e = { ...raw, type: raw.type === "check_status" ? "check" : raw.type } as SessionEvent;
            if (e.type !== "ping") cb.current(e);
          } catch { /* ignore malformed */ }
        };
        ws.onclose = () => { setConnected(false); if (!stop) timer = setTimeout(connect, 3000); };
      }).catch(() => { if (!stop) timer = setTimeout(connect, 5000); });
    };
    connect();
    return () => { stop = true; clearTimeout(timer); ws?.close(); };
  }, [sessionId, enabled]);
  return connected;
}

const EVENT_VIEW: Record<string, { icon: IconName; title: (p: Record<string, unknown>) => string; tone: string }> = {
  hint: { icon: "bulb", title: (p) => `Подсказка ${String(p.number ?? "")} из 3`, tone: "text-accent" },
  incident: { icon: "alert", title: () => "Инцидент", tone: "text-amber-ink" },
  security: { icon: "shield", title: () => "Ограничение среды", tone: "text-red-ink" },
  warning: { icon: "alert", title: () => "Предупреждение", tone: "text-amber-ink" },
  check: { icon: "check", title: (p) => (p.self_check ? `Самопроверка: ${String(p.passed)} из ${String(p.total)}` : p.passed ? "Проверка пройдена" : "Проверка не пройдена"), tone: "text-green" },
  status: { icon: "check", title: (p) => STATUS_TITLE[String(p.status)] ?? "Статус сессии", tone: "text-green" },
};
const STATUS_TITLE: Record<string, string> = {
  starting: "Запуск среды", active: "Среда готова", paused: "Пауза", checking: "Отправлено на проверку",
  completed: "Проверка завершена", failed: "Ошибка", expired: "Сессия истекла",
};

const isForm = (f: ScenarioPublic["answer_form"]): f is AnswerForm => "type" in f;

interface SelfCheck { results: { title: string; passed: boolean; skipped: boolean }[]; passed: number; total: number; retry_after_sec: number; at: string }

function eventText(e: SessionEvent): string {
  const p = e.payload;
  if (e.type === "hint") return String(p.text ?? "");
  if (e.type === "check") return p.self_check ? "Баллы не снимаются." : String(p.title ?? "");
  return String(p.message ?? "");
}

export default function Workspace() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["session", id], queryFn: () => api.get<SessionView>(`/api/sessions/${id}`), staleTime: 0 });
  const s = q.data;
  const live = !!s && (s.status === "active" || s.status === "paused");
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [changedDocs, setChangedDocs] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [saveState, setSaveState] = useState("");
  const dirty = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [question, setQuestion] = useState("");
  const [askOpen, setAskOpen] = useState(false);

  useEffect(() => {
    if (s) {
      setEvents(s.events);
      if (answers === null) setAnswers(s.answers ?? {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s]);

  const onEvent = useCallback((e: SessionEvent) => {
    if (e.type === "status" && !e.payload.message) return; // greeting frame on connect
    setEvents((prev) => [...prev, { ...e, created_at: e.created_at ?? new Date().toISOString() }]);
    if (e.type === "incident" && e.payload.document) {
      setChangedDocs((prev) => new Set(prev).add(String(e.payload.document)));
      qc.invalidateQueries({ queryKey: ["session", id] });
    }
    if (e.type === "status") {
      qc.invalidateQueries({ queryKey: ["session", id] });
      if (e.payload.status === "completed") navigate(`/student/reports/${id}`);
    }
  }, [id, qc, navigate]);
  const wsConnected = useSessionEvents(id, live || s?.status === "starting" || s?.status === "checking", onEvent);

  const remaining = useCountdown(s?.remaining_sec ?? null, s?.status === "active");

  const save = useMutation({
    mutationFn: (a: Answers) => api.post<{ answers: Answers }>(`/api/sessions/${id}/answers`, { answers: a }),
    onMutate: () => setSaveState("Сохранение…"),
    onSuccess: () => { dirty.current = false; setSaveState(`Сохранено в ${fmtTime(new Date().toISOString())}`); },
    onError: () => setSaveState("Не удалось сохранить"),
  });
  // Autosave the document answer 1.5 s after the last change.
  useEffect(() => {
    if (!dirty.current || !answers || !live) return;
    const t = setTimeout(() => save.mutate(answers), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, live]);

  const hint = useMutation({
    mutationFn: () => api.post<HintOut>(`/api/sessions/${id}/hints`, { question }),
    onSuccess: () => { setQuestion(""); setAskOpen(false); qc.invalidateQueries({ queryKey: ["session", id] }); },
  });
  const [lastSelf, setLastSelf] = useState<SelfCheck | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cooldownUntil]);
  const selfCheck = useMutation({
    mutationFn: () => api.post<SelfCheck>(`/api/sessions/${id}/self-check`),
    onSuccess: (r) => { const now = Date.now(); setLastSelf({ ...r, at: new Date(now).toISOString() }); setTick(now); setCooldownUntil(now + r.retry_after_sec * 1000); },
    onError: (err) => {
      const wait = err instanceof ApiError ? Number(err.details?.retry_after_sec) : NaN;
      if (Number.isFinite(wait)) { const now = Date.now(); setTick(now); setCooldownUntil(now + wait * 1000); }
    },
  });
  const pause = useMutation({
    mutationFn: () => api.post(`/api/sessions/${id}/${s?.status === "paused" ? "resume" : "pause"}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session", id] }),
  });
  const submit = useMutation({
    mutationFn: async () => {
      if (s?.kind === "document" && answers && dirty.current) await api.post(`/api/sessions/${id}/answers`, { answers });
      return api.post<SubmitOut>(`/api/sessions/${id}/submit`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignments-me"] });
      qc.invalidateQueries({ queryKey: ["reports-mine"] });
      navigate(`/student/reports/${id}`);
    },
  });

  if (q.isLoading) return <Loading text="Загрузка сессии…" />;
  if (q.error || !s) return <div className="p-8"><ErrorBanner error={q.error} /><Link to="/student">К назначениям</Link></div>;
  const sc = s.scenario;
  const hintsLeft = Math.max(0, s.hints_max - s.hints_used);
  const st = STATUS_CHIP[s.status] ?? { label: s.status, tone: "grey" as Tone };
  const finished = !live && s.status !== "starting";
  const log = events.filter((e) => e.type !== "answer").slice().reverse();
  const lastSelfEvent = log.find((e) => e.type === "check" && e.payload.self_check);
  const selfResult: SelfCheck | null = lastSelf ?? (lastSelfEvent ? { ...(lastSelfEvent.payload as unknown as SelfCheck), at: lastSelfEvent.created_at ?? new Date().toISOString() } : null);
  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - tick) / 1000));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-x-5 gap-y-3 bg-bg/85 px-6 py-3 backdrop-blur-md max-sm:px-3">
        <Link to="/student" className="flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm !text-nav-ink no-underline shadow-card transition-colors hover:!text-ink">
          <Icon name="back" size={16} />К назначениям
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-xs text-muted">
            сессия {s.id.slice(0, 8)} · {DOMAIN_LABEL[sc.domain] ?? sc.domain} · сложность {sc.difficulty} из 5
          </div>
          <h1 className="m-0 truncate text-xl font-semibold tracking-tight">{sc.title}</h1>
        </div>
        <Chip tone={st.tone}><span className="size-1.5 rounded-full bg-current" />{st.label}</Chip>
        <div className="flex items-baseline gap-2" aria-label="Оставшееся время">
          <Icon name="clock" size={18} className="self-center" />
          <span role="timer" className={cx("font-mono text-2xl", remaining != null && remaining < 300 && "text-amber-ink")}>
            {remaining != null ? mmss(remaining) : "--:--"}
          </span>
          <span className="text-xs text-muted">из {mmss(s.time_limit_min * 60)}</span>
        </div>
        {live && (
          <Button icon={s.status === "paused" ? "activity" : "clock"}
            loading={pause.isPending} onClick={() => pause.mutate()}>
            {s.status === "paused" ? "Продолжить" : "Пауза"}
          </Button>
        )}
        <Button variant="primary" disabled={!live} loading={submit.isPending} onClick={() => dialog.current?.showModal()}>
          Завершить и отправить на проверку
        </Button>
        <ThemeToggle />
      </header>

      <div className="flex flex-col gap-3 px-6 pt-4 empty:hidden">
        {s.status === "starting" && <Banner tone="blue" icon="spinner">Подготовка учебной среды… Обычно это занимает до минуты.</Banner>}
        {s.status === "paused" && <Banner tone="amber" icon="clock">Сессия на паузе, таймер остановлен. Продолжите работу или введите команду в терминале.</Banner>}
        {(s.status === "checking" || submit.isPending) && <Banner tone="blue" icon="spinner">Выполняются проверки и расчёт балла…</Banner>}
        {finished && s.status === "completed" && <Banner tone="green" icon="check">Сессия завершена. <Link to={`/student/reports/${id}`}>Открыть протокол</Link></Banner>}
        {(s.status === "failed" || s.status === "expired") && <Banner tone="red" icon="alert" role="alert">{STATUS_TITLE[s.status]}. Обратитесь к преподавателю, если считаете это ошибкой.</Banner>}
        <ErrorBanner error={submit.error || pause.error} />
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 px-6 pb-6 pt-2 max-sm:px-3 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4 self-start">
        <Card className="flex flex-col gap-4">
          <CardTitle>Легенда</CardTitle>
          <p className="m-0 whitespace-pre-line text-[15px] leading-relaxed">{sc.legend}</p>
          <div>
            <div className="mb-2 text-xs font-medium text-muted">Критерии оценивания</div>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {sc.criteria.map((c) => {
                const final = [...events].reverse().find((e) => e.type === "check" && !e.payload.self_check && e.payload.title === c);
                const mid = selfResult?.results.find((r) => r.title === c);
                const res = final ? { passed: !!final.payload.passed, skipped: !!final.payload.skipped } : mid;
                return (
                  <li key={c} className="flex items-start gap-2 text-sm" title={res?.skipped ? "Проверка включится после инцидента" : undefined}>
                    <span aria-hidden className={cx("mt-0.5 grid size-4 shrink-0 place-items-center rounded border transition-colors",
                      !res ? "border-label" : res.skipped ? "border-field bg-sunken text-muted" : res.passed ? "border-green bg-green text-white" : "border-red bg-red text-white")}>
                      {res && <Icon name={res.skipped ? "clock" : res.passed ? "check" : "x"} size={12} />}
                    </span>
                    {c}
                  </li>
                );
              })}
            </ul>
            {live && (
              <div className="mt-3 flex flex-col gap-1.5">
                <Button small icon="check" loading={selfCheck.isPending} disabled={s.status !== "active" || cooldownLeft > 0} onClick={() => selfCheck.mutate()}>
                  {cooldownLeft > 0 ? `Проверить снова через ${cooldownLeft} с` : "Проверить выполнение"}
                </Button>
                <span className="text-xs text-muted" role="status">
                  {selfResult
                    ? `Проверено в ${fmtTime(selfResult.at)}: выполнено ${selfResult.passed} из ${selfResult.total}. Баллы не снимаются.`
                    : "Промежуточная проверка критериев, баллы не снимаются. Итог считается при отправке."}
                </span>
              </div>
            )}
            {!live && !finished && <ErrorBanner error={selfCheck.error} />}
            {live && <ErrorBanner error={selfCheck.error && !(selfCheck.error instanceof ApiError && selfCheck.error.details?.retry_after_sec) ? selfCheck.error : null} />}
          </div>
          <div className="border-t border-line-soft pt-3">
            <div className="mb-1.5 text-xs font-medium text-muted">Ограничения среды</div>
            <p className="m-0 text-[13px] text-muted">{sc.constraints || "Пользователь без прав администратора · сеть отключена · запись только в рабочий каталог · лимиты профиля среды"}</p>
          </div>
        </Card>
        <TheoryCard domain={sc.domain} codes={sc.skills ?? []} title="Теория"
          intro="Справка по навыкам этого сценария. Читать можно в любой момент — баллы за неё не снимаются." />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {s.kind === "container" ? (
            <Terminal sessionId={id} enabled={live} />
          ) : (
            <>
              <DocumentViewer documents={sc.documents} changed={changedDocs} />
              {isForm(sc.answer_form) && answers && (
                <AnswerFormCard form={sc.answer_form} defectTypes={sc.defect_types} answers={answers} disabled={!live} saveState={saveState}
                  onChange={(a) => { dirty.current = true; setAnswers(a); }} />
              )}
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2 xl:col-span-1">
          <Card className="flex max-h-[60vh] min-h-[280px] flex-col gap-3">
            <CardTitle aside={<span className="text-xs text-muted">{wsConnected ? "обновляется в реальном времени" : "нет связи, переподключение…"}</span>}>
              Журнал событий
            </CardTitle>
            <ol aria-live="polite" className="m-0 flex list-none flex-col overflow-auto p-0">
              {!log.length && <li className="py-3 text-sm text-muted">Событий пока нет.</li>}
              {log.map((e, i) => {
                const v = EVENT_VIEW[e.type] ?? EVENT_VIEW.status;
                const failed = e.type === "check" && !e.payload.passed;
                return (
                  <li key={e.id ?? `${e.created_at}-${i}`} className="flex gap-3 border-t border-line-soft py-3 first:border-0">
                    <Icon name={failed ? "x" : v.icon} size={18} className={cx("mt-0.5 shrink-0", failed ? "text-red-ink" : v.tone)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <b className="text-sm">{v.title(e.payload)}</b>
                        <span className="font-mono text-xs text-muted">{e.created_at ? new Date(e.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                      </div>
                      <div className="text-sm leading-snug">{eventText(e)}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
          <Card className="flex flex-col gap-3">
            <CardTitle aside={<Chip tone={hintsLeft ? "amber" : "grey"}>осталось {hintsLeft} из {s.hints_max}</Chip>}>Подсказки</CardTitle>
            <p className="m-0 text-[13px] text-muted">
              Каждая подсказка снижает итоговый балл на 10 %. Подсказка указывает область проблемы, но не содержит готовой команды.
            </p>
            {askOpen && (
              <Textarea aria-label="Вопрос к подсказке (необязательно)" rows={3} maxLength={500} placeholder="Что именно непонятно? (необязательно)"
                value={question} onChange={(e) => setQuestion(e.target.value)} />
            )}
            <ErrorBanner error={hint.error} />
            <div className="flex gap-2">
              <Button className="flex-1" icon="bulb" disabled={!live || !hintsLeft} loading={hint.isPending}
                onClick={() => (askOpen ? hint.mutate() : setAskOpen(true))}>
                {askOpen ? "Получить подсказку" : "Запросить подсказку"}
              </Button>
              {askOpen && <Button variant="ghost" onClick={() => setAskOpen(false)}>Отмена</Button>}
            </div>
          </Card>
        </div>
      </div>

      <dialog ref={dialog} aria-labelledby="submit-title" className="m-auto w-[min(92vw,480px)] rounded-card border border-line p-0 shadow-card backdrop:bg-black/40 backdrop:backdrop-blur-sm">
        <div className="flex flex-col gap-4 p-6">
          <h2 id="submit-title" className="m-0 text-lg font-semibold">Завершить и отправить на проверку?</h2>
          <p className="m-0 text-sm text-muted">
            После отправки изменить решение будет нельзя. Будут выполнены проверки по критериям, рассчитан балл
            с учётом подсказок ({s.hints_used}) и нарушений, учебная среда будет удалена.
          </p>
          <div className="flex justify-end gap-2.5">
            <Button onClick={() => dialog.current?.close()}>Вернуться к работе</Button>
            <Button variant="primary" autoFocus onClick={() => { dialog.current?.close(); submit.mutate(); }}>Отправить</Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
