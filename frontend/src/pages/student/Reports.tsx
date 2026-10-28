import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { api } from "../../api/client";
import { type MyReport } from "../../api/types";
import { Page, PageHeader } from "../../components/Layout";
import { Card, Chip, Empty, ErrorBanner, Loading, Table, fmtDateTime } from "../../components/ui";
import { scoreTone } from "./Home";
import { useDomainLabel } from "../../api/domains";

export default function Reports() {
  const domainLabel = useDomainLabel();
  const q = useQuery({ queryKey: ["reports-mine"], queryFn: () => api.get<MyReport[]>("/api/reports/mine") });
  return (
    <>
      <PageHeader title="Протоколы" subtitle="Результаты завершённых сценариев" />
      <Page>
        <Card padded={false}>
          {q.isLoading ? <Loading /> : q.error ? <div className="p-5"><ErrorBanner error={q.error} /></div> : !q.data?.length ? (
            <Empty>Протоколов пока нет: они появляются после отправки сценария на проверку.</Empty>
          ) : (
            <Table>
              <thead><tr><th>Сценарий</th><th>Направление</th><th>Дата</th><th>Результат</th><th>Балл</th></tr></thead>
              <tbody>
                {q.data.map((r) => (
                  <tr key={r.id}>
                    <td><Link to={`/student/reports/${r.session_id}`}>{r.title}</Link></td>
                    <td>{domainLabel(r.domain)}</td>
                    <td className="font-mono">{fmtDateTime(r.created_at)}</td>
                    <td><Chip tone={r.passed ? "green" : "red"}>{r.passed ? "пройден" : "не пройден"}</Chip></td>
                    <td><Chip tone={scoreTone(r.score)}>{r.score ?? "—"}</Chip></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </Page>
    </>
  );
}
