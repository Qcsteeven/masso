import { useState } from "react";
import type { AnswerForm, DocumentPublic } from "../../api/types";
import { Markdown } from "../../components/Markdown";
import { Button, Card, CardTitle, Chip, FieldRow, Input, Select, Textarea, cx } from "../../components/ui";

export type Answers = Record<string, unknown>;
interface Finding { section: string; defect_type: string; comment: string; proposed_text: string }

export function DocumentViewer({ documents, changed }: { documents: DocumentPublic[]; changed: Set<string> }) {
  const [active, setActive] = useState(documents[0]?.id);
  const doc = documents.find((d) => d.id === active) ?? documents[0];
  if (!doc) return null;
  return (
    <Card padded={false} className="flex min-h-0 flex-col">
      <div role="tablist" aria-label="Документы" className="flex flex-wrap gap-1 border-b border-line px-3 pt-3">
        {documents.map((d) => (
          <button key={d.id} type="button" role="tab" aria-selected={d.id === doc.id} onClick={() => setActive(d.id)}
            className={cx("-mb-px flex min-h-10 items-center gap-2 rounded-t-lg border border-b-0 px-3 text-sm",
              d.id === doc.id ? "border-line bg-surface font-semibold" : "border-transparent text-muted hover:text-ink")}>
            {d.title}
            {changed.has(d.id) && <Chip tone="amber">изменён</Chip>}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="max-h-[60vh] overflow-auto p-5">
        <Markdown source={doc.markdown} />
      </div>
    </Card>
  );
}

export function AnswerFormCard({ form, defectTypes, answers, onChange, disabled, saveState }: {
  form: AnswerForm;
  defectTypes: Record<string, string>;
  answers: Answers;
  onChange: (a: Answers) => void;
  disabled: boolean;
  saveState: string;
}) {
  const set = (k: string, v: unknown) => onChange({ ...answers, [k]: v });
  return (
    <Card className="flex flex-col gap-4">
      <CardTitle aside={<span className="text-xs text-muted" aria-live="polite">{saveState}</span>}>Ответ</CardTitle>
      {form.type === "findings" ? (
        <Findings form={form} defectTypes={defectTypes} value={(answers.findings as Finding[] | undefined) ?? []}
          onChange={(f) => set("findings", f)} disabled={disabled} />
      ) : (
        <div className="flex flex-col gap-3">
          <FieldRow label={form.fields.document_with_error} required>
            {(id) => (
              <Select id={id} disabled={disabled} value={String(answers.document_with_error ?? "")} onChange={(e) => set("document_with_error", e.target.value)}>
                <option value="">— выберите документ —</option>
                {Object.entries(form.documents).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            )}
          </FieldRow>
          {(["correct_sum", "discrepancy"] as const).map((k) => (
            <FieldRow key={k} label={form.fields[k]} required>
              {(id) => (
                <Input id={id} disabled={disabled} inputMode="decimal" value={String(answers[k] ?? "")}
                  onChange={(e) => set(k, e.target.value.replace(",", "."))} placeholder="0.00" />
              )}
            </FieldRow>
          ))}
          <FieldRow label={form.fields.explanation} top>
            {(id) => <Textarea id={id} rows={4} disabled={disabled} value={String(answers.explanation ?? "")} onChange={(e) => set("explanation", e.target.value)} />}
          </FieldRow>
        </div>
      )}
    </Card>
  );
}

function Findings({ form, defectTypes, value, onChange, disabled }: {
  form: Extract<AnswerForm, { type: "findings" }>;
  defectTypes: Record<string, string>;
  value: Finding[];
  onChange: (f: Finding[]) => void;
  disabled: boolean;
}) {
  const upd = (i: number, patch: Partial<Finding>) => onChange(value.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <div className="flex flex-col gap-4">
      {!value.length && <p className="m-0 text-sm text-muted">Добавьте найденные несоответствия: раздел, тип и предлагаемую редакцию.</p>}
      {value.map((f, i) => (
        <fieldset key={i} className="flex flex-col gap-3 rounded-xl border border-line p-4">
          <legend className="px-1 text-sm font-semibold">Несоответствие {i + 1}</legend>
          <FieldRow label={form.fields.section} required>
            {(id) => (
              <Select id={id} disabled={disabled} value={f.section} onChange={(e) => upd(i, { section: e.target.value })}>
                <option value="">— раздел —</option>
                {Object.entries(form.sections).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            )}
          </FieldRow>
          <FieldRow label={form.fields.defect_type} required>
            {(id) => (
              <Select id={id} disabled={disabled} value={f.defect_type} onChange={(e) => upd(i, { defect_type: e.target.value })}>
                <option value="">— тип —</option>
                {Object.entries(defectTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            )}
          </FieldRow>
          <FieldRow label={form.fields.comment} top>
            {(id) => <Textarea id={id} rows={2} disabled={disabled} value={f.comment} onChange={(e) => upd(i, { comment: e.target.value })} />}
          </FieldRow>
          <FieldRow label={form.fields.proposed_text} top>
            {(id) => <Textarea id={id} rows={2} disabled={disabled} value={f.proposed_text} onChange={(e) => upd(i, { proposed_text: e.target.value })} />}
          </FieldRow>
          <div className="flex justify-end">
            <Button small variant="danger" icon="x" disabled={disabled} onClick={() => onChange(value.filter((_, j) => j !== i))}>Удалить</Button>
          </div>
        </fieldset>
      ))}
      <Button icon="target" disabled={disabled} className="self-start"
        onClick={() => onChange([...value, { section: "", defect_type: "", comment: "", proposed_text: "" }])}>
        Добавить несоответствие
      </Button>
    </div>
  );
}
