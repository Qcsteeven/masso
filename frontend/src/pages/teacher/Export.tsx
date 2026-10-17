import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { download } from "../../api/client";
import { Page, PageHeader } from "../../components/Layout";
import { defaultPeriod, periodError, periodQuery } from "../../components/period";
import { Banner, Button, Card, CardTitle, ErrorBanner, FieldRow, Input, Select } from "../../components/ui";
import { useGroups } from "./Group";

export default function Export() {
  const groups = useGroups();
  const [f, setF] = useState({ ...defaultPeriod(), group: "", format: "csv" as "csv" | "json" });
  const group = f.group || groups.data?.[0] || "";
  const [touched, setTouched] = useState(false);
  const invalid = periodError(f);
  const run = useMutation({
    mutationFn: () => download("/api/reports/export", { group, format: f.format, ...periodQuery(f) }, `masso-${group}-${f.from}-${f.to}.${f.format}`),
  });
  return (
    <>
      <PageHeader title="Экспорт отчётов" subtitle="Выгрузка результатов группы за период" />
      <Page>
        <Card className="max-w-3xl">
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); setTouched(true); if (!invalid) run.mutate(); }}>
            <CardTitle>Параметры отчёта</CardTitle>
            <FieldRow label="Группа" required>
              {(id) => (
                <Select id={id} value={group} onChange={(e) => setF({ ...f, group: e.target.value })}>
                  {(groups.data ?? []).map((g) => <option key={g} value={g}>{g}</option>)}
                </Select>
              )}
            </FieldRow>
            <FieldRow label="Дата начала" required>{(id) => <Input id={id} type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />}</FieldRow>
            <FieldRow label="Дата окончания" required>{(id) => <Input id={id} type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />}</FieldRow>
            <FieldRow label="Формат">
              {(id) => (
                <Select id={id} value={f.format} onChange={(e) => setF({ ...f, format: e.target.value as "csv" | "json" })}>
                  <option value="csv">CSV (Excel, разделитель «;»)</option>
                  <option value="json">JSON</option>
                </Select>
              )}
            </FieldRow>
            {touched && invalid && <Banner tone="red" icon="alert" role="alert">{invalid}</Banner>}
            <ErrorBanner error={run.error} />
            {run.isPending && <Banner tone="blue" icon="spinner">Формирование отчёта…</Banner>}
            {run.isSuccess && <Banner tone="green" icon="check">Отчёт сформирован и загружен.</Banner>}
            <Button type="submit" variant="primary" icon="download" className="self-end" loading={run.isPending}>Сформировать</Button>
          </form>
        </Card>
      </Page>
    </>
  );
}
