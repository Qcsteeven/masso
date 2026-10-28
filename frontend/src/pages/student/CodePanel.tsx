import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ApiError, api } from "../../api/client";
import type { CodeRunOut, CodingPublic } from "../../api/types";
import { CodeEditor } from "../../components/CodeEditor";
import { Icon } from "../../components/icons";
import { Markdown } from "../../components/Markdown";
import { Banner, Button, Card, CardTitle, Chip, ErrorBanner, cx } from "../../components/ui";

// Code task workspace (Д-44): statement, editor with solution.py / test_solution.py, «Запустить тесты».
const FILE_TITLE: Record<string, string> = { "solution.py": "Решение", "test_solution.py": "Мои тесты" };
const show = (v: unknown) => (v === undefined ? "—" : JSON.stringify(v));

export function CodePanel({ sessionId, coding, files, onChange, live, saveState }: {
  sessionId: string; coding: CodingPublic; files: Record<string, string>; onChange: (files: Record<string, string>) => void; live: boolean; saveState: string;
}) {
  const names = Object.keys(coding.files);
  const [file, setFile] = useState(names[0] ?? "solution.py");
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (until <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [until]);
  const run = useMutation({
    mutationFn: () => api.post<CodeRunOut>(`/api/sessions/${sessionId}/run`, { files }),
    onSuccess: (r) => { const t = Date.now(); setNow(t); setUntil(t + r.retry_after_sec * 1000); },
    onError: (e) => { const w = e instanceof ApiError ? Number(e.details?.retry_after_sec) : NaN; if (Number.isFinite(w)) { const t = Date.now(); setNow(t); setUntil(t + w * 1000); } },
  });
  const wait = Math.max(0, Math.ceil((until - now) / 1000));
  const r = run.data;
  const tests = r?.tests;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="flex flex-col gap-2">
        <CardTitle>Условие</CardTitle>
        <div className="text-[15px] leading-relaxed [&_table]:my-2"><Markdown source={coding.statement} /></div>
      </Card>

      <Card padded={false} className="flex min-h-[460px] flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-4 py-2.5">
          <div role="tablist" aria-label="Файлы" className="flex gap-1">
            {names.map((n) => (
              <button key={n} type="button" role="tab" aria-selected={file === n} onClick={() => setFile(n)}
                className={cx("rounded-full px-3.5 py-1.5 font-mono text-[13px] transition-colors",
                  file === n ? "bg-nav text-on-nav" : "text-nav-ink hover:bg-sunken")}>
                {n} <span className="font-sans text-xs opacity-70">· {FILE_TITLE[n] ?? ""}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted" role="status">{saveState}</span>
            <Button small variant="primary" icon="activity" loading={run.isPending} disabled={!live || wait > 0} onClick={() => run.mutate()}>
              {wait > 0 ? `Запуск через ${wait} с` : "Запустить тесты"}
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <CodeEditor key={file} label={`Файл ${file}`} value={files[file] ?? ""} readOnly={!live}
            onChange={(v) => onChange({ ...files, [file]: v })} />
        </div>
      </Card>

      {(r || run.error) && (
        <Card className="flex flex-col gap-3" aria-live="polite">
          <CardTitle aside={r && <span className="text-xs text-muted">баллы не начисляются · итог — при отправке</span>}>Результат запуска</CardTitle>
          {run.error && !(run.error instanceof ApiError && run.error.details?.retry_after_sec) && <ErrorBanner error={run.error} />}
          {r && (
            <>
              <div className="flex flex-col gap-1.5">
                <div className="text-xs font-medium text-muted">Примеры из условия</div>
                {r.examples_error && <Banner tone="red" icon="alert">{r.examples_error}</Banner>}
                {r.examples.map((e) => (
                  <div key={e.call} className={cx("flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl px-3 py-2 font-mono text-[13px]", e.ok ? "bg-green-bg/60" : "bg-red-bg/60")}>
                    <Icon name={e.ok ? "check" : "x"} size={14} className={cx("self-center", e.ok ? "text-green" : "text-red")} />
                    <span>{e.call}</span>
                    <span className="text-muted">ожидается {show(e.expected)}</span>
                    {!e.ok && <span className="text-red-ink">{e.error ? e.error : `получено ${show(e.got)}`}</span>}
                  </div>
                ))}
              </div>
              {tests && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted">
                    Мои тесты
                    {!tests.import_error && <Chip tone={tests.total && tests.passed === tests.total ? "green" : "red"}>{tests.passed} из {tests.total}</Chip>}
                  </div>
                  {tests.import_error && <Banner tone="red" icon="alert">{tests.import_error}</Banner>}
                  {!tests.import_error && !tests.total && <Banner tone="amber" icon="info">Тестов нет: добавьте функции test_... с assert в test_solution.py.</Banner>}
                  {tests.failures.map((f) => (
                    <div key={f.name} className="rounded-xl bg-red-bg/60 px-3 py-2 font-mono text-[13px] text-red-ink">{f.name}: {f.error}</div>
                  ))}
                </div>
              )}
              {r.stdout && (
                <details className="rounded-xl bg-term px-3 py-2 text-term-ink">
                  <summary className="cursor-pointer text-xs">Вывод программы</summary>
                  <pre className="m-0 mt-2 max-h-60 overflow-auto whitespace-pre-wrap font-mono text-xs">{r.stdout}</pre>
                </details>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
