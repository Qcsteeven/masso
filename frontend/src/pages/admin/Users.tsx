import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api } from "../../api/client";
import type { Role } from "../../api/types";
import { Page, PageHeader } from "../../components/Layout";
import { Banner, Button, Card, CardTitle, Chip, Empty, ErrorBanner, FieldRow, Filter, Input, Loading, Select, Table, cx, fmtDateTime } from "../../components/ui";

interface UserOut { id: string; email: string; full_name: string; group_code: string | null; status: "active" | "blocked"; roles: Role[]; last_login_at: string | null; created_at: string }
interface AuditRow { id: string; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; reason: string | null; created_at: string }

export const ROLE_LABEL: Record<Role, string> = { student: "обучающийся", teacher: "преподаватель", methodist: "методист", admin: "администратор", sysadmin: "системный администратор" };
const ROLES = Object.keys(ROLE_LABEL) as Role[];
const ACTION_LABEL: Record<string, string> = {
  "user.create": "Создана учётная запись", "user.update": "Изменены данные учётной записи", "user.roles": "Изменены роли",
  "user.revoke_sessions": "Сброшены сессии",
};
const PAGE = 20;

function auditText(a: AuditRow): string {
  const base = ACTION_LABEL[a.action] ?? a.action;
  if (a.action === "user.roles" && a.after) return `${base}: ${((a.after.roles as Role[]) ?? []).map((r) => ROLE_LABEL[r]).join(", ")}`;
  if (a.action === "user.update" && a.after?.status && a.before?.status !== a.after.status) return `${base}: статус «${a.after.status === "blocked" ? "заблокирован" : "активен"}»`;
  return base;
}

export default function Users() {
  const qc = useQueryClient();
  const [f, setF] = useState({ q: "", role: "", group: "", status: "" });
  const [offset, setOffset] = useState(0);
  const list = useQuery({
    queryKey: ["users", f, offset],
    queryFn: () => api.get<{ items: UserOut[]; total: number }>("/api/users", { ...f, limit: PAGE, offset }),
    placeholderData: keepPreviousData,
  });
  const [sel, setSel] = useState<UserOut | null>(null);
  const [edit, setEdit] = useState<{ group_code: string; status: string; roles: Role[]; reason: string } | null>(null);
  const audit = useQuery({ queryKey: ["user-audit", sel?.id], queryFn: () => api.get<AuditRow[]>(`/api/users/${sel!.id}/audit`), enabled: !!sel });
  const pick = (u: UserOut) => { setSel(u); setEdit({ group_code: u.group_code ?? "", status: u.status, roles: [...u.roles], reason: "" }); save.reset(); revoke.reset(); };
  const refresh = () => { qc.invalidateQueries({ queryKey: ["users"] }); qc.invalidateQueries({ queryKey: ["user-audit", sel?.id] }); };
  const save = useMutation({
    mutationFn: async () => {
      let u = sel!;
      if (edit!.group_code !== (u.group_code ?? "") || edit!.status !== u.status)
        u = await api.patch<UserOut>(`/api/users/${u.id}`, { group_code: edit!.group_code || null, status: edit!.status, reason: edit!.reason || null });
      if ([...edit!.roles].sort().join() !== [...u.roles].sort().join())
        u = await api.put<UserOut>(`/api/users/${u.id}/roles`, { roles: edit!.roles, reason: edit!.reason || null });
      return u;
    },
    onSuccess: (u) => { setSel(u); refresh(); },
  });
  const revoke = useMutation({ mutationFn: () => api.post<{ revoked: number }>(`/api/users/${sel!.id}/revoke-sessions`), onSuccess: refresh });
  const dlg = useRef<HTMLDialogElement>(null);
  const [nu, setNu] = useState({ email: "", full_name: "", password: "", group_code: "", roles: ["student"] as Role[] });
  const create = useMutation({
    mutationFn: () => api.post<UserOut>("/api/users", { ...nu, group_code: nu.group_code || null }),
    onSuccess: (u) => { dlg.current?.close(); refresh(); pick(u); setNu({ email: "", full_name: "", password: "", group_code: "", roles: ["student"] }); },
  });
  const total = list.data?.total ?? 0;

  return (
    <>
      <PageHeader title="Пользователи и роли" subtitle="Учётные записи, группы, роли и блокировки"
        actions={<Button variant="primary" onClick={() => dlg.current?.showModal()}>+ Пользователь</Button>} />
      <Page>
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-5">
            <Card className="flex flex-wrap items-end gap-4">
              <div className="min-w-60 flex-1"><Filter label="Поиск"><Input placeholder="ФИО или email" value={f.q} onChange={(e) => { setF({ ...f, q: e.target.value }); setOffset(0); }} /></Filter></div>
              <Filter label="Роль"><Select value={f.role} onChange={(e) => { setF({ ...f, role: e.target.value }); setOffset(0); }}><option value="">Все роли</option>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Filter>
              <Filter label="Группа"><Input className="w-36" placeholder="Все группы" value={f.group} onChange={(e) => { setF({ ...f, group: e.target.value }); setOffset(0); }} /></Filter>
              <Filter label="Статус"><Select value={f.status} onChange={(e) => { setF({ ...f, status: e.target.value }); setOffset(0); }}><option value="">Любой</option><option value="active">активен</option><option value="blocked">заблокирован</option></Select></Filter>
            </Card>
            <Card padded={false}>
              <ErrorBanner error={list.error} />
              {list.isLoading ? <Loading /> : !list.data?.items.length ? <Empty>Пользователи не найдены.</Empty> : (
                <Table>
                  <thead><tr><th>Пользователь</th><th>Группа</th><th>Роли</th><th>Статус</th><th>Последний вход</th></tr></thead>
                  <tbody>
                    {list.data.items.map((u) => (
                      <tr key={u.id} className={cx("cursor-pointer hover:bg-bg", sel?.id === u.id && "bg-blue-bg/50")} onClick={() => pick(u)}>
                        <td><button type="button" className="text-left" onClick={() => pick(u)}><div className="font-semibold">{u.full_name}</div><div className="font-mono text-xs text-muted">{u.email}</div></button></td>
                        <td className="whitespace-nowrap">{u.group_code ?? "—"}</td>
                        <td><div className="flex flex-wrap gap-1">{u.roles.map((r) => <Chip key={r} tone="blue">{ROLE_LABEL[r]}</Chip>)}</div></td>
                        <td><Chip tone={u.status === "active" ? "green" : "red"}>{u.status === "active" ? "активен" : "заблокирован"}</Chip></td>
                        <td className="font-mono">{fmtDateTime(u.last_login_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              <div className="flex items-center justify-between gap-3 p-4">
                <span className="text-sm text-muted">Показано {Math.min(total, offset + 1)}–{Math.min(total, offset + PAGE)} из {total}</span>
                <div className="flex gap-2">
                  <Button small disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Назад</Button>
                  <Button small disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>Далее</Button>
                </div>
              </div>
            </Card>
          </div>
          <div className="flex flex-col gap-5">
            <Card>
              {!sel || !edit ? <p className="m-0 text-sm text-muted">Выберите пользователя в списке.</p> : (
                <form className="flex flex-col gap-3.5" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
                  <CardTitle>{sel.full_name}</CardTitle>
                  <FieldRow label="Email">{(id) => <Input id={id} readOnly value={sel.email} />}</FieldRow>
                  <FieldRow label="Группа">{(id) => <Input id={id} value={edit.group_code} onChange={(e) => setEdit({ ...edit, group_code: e.target.value })} />}</FieldRow>
                  <FieldRow label="Статус">{(id) => <Select id={id} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><option value="active">Активен</option><option value="blocked">Заблокирован</option></Select>}</FieldRow>
                  <fieldset className="grid grid-cols-[34%_66%] border-0 p-0">
                    <legend className="float-left w-[34%] pt-1 text-sm text-label">Роли</legend>
                    <div className="flex flex-col gap-2">
                      {ROLES.map((r) => (
                        <label key={r} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" className="size-4" checked={edit.roles.includes(r)}
                            onChange={(e) => setEdit({ ...edit, roles: e.target.checked ? [...edit.roles, r] : edit.roles.filter((x) => x !== r) })} />
                          {ROLE_LABEL[r][0].toUpperCase() + ROLE_LABEL[r].slice(1)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <FieldRow label="Причина">{(id) => <Input id={id} placeholder="для журнала аудита" value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} />}</FieldRow>
                  <ErrorBanner error={save.error || revoke.error} />
                  {save.isSuccess && <Banner tone="green" icon="check">Изменения сохранены и записаны в журнал аудита.</Banner>}
                  {revoke.data && <Banner tone="green" icon="check">Сброшено сессий: {revoke.data.revoked}. Пользователь войдёт заново.</Banner>}
                  <div className="grid grid-cols-2 gap-2.5">
                    <Button type="submit" variant="primary" disabled={!edit.roles.length} loading={save.isPending}>Сохранить</Button>
                    <Button variant="danger" loading={revoke.isPending} onClick={() => revoke.mutate()}>Сбросить сессии</Button>
                  </div>
                </form>
              )}
            </Card>
            {sel && (
              <Card className="flex flex-col gap-2">
                <CardTitle>Изменения учётной записи</CardTitle>
                {audit.isLoading ? <Loading /> : !audit.data?.length ? <p className="m-0 text-sm text-muted">Изменений нет.</p> : audit.data.map((a) => (
                  <div key={a.id} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 border-t border-line-soft py-2 text-sm">
                    <span className="font-mono text-xs text-muted">{fmtDateTime(a.created_at)}</span>
                    <span>{auditText(a)}{a.reason ? <span className="text-muted"> — {a.reason}</span> : null}</span>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </div>
      </Page>
      <dialog ref={dlg} aria-labelledby="nu-title" className="m-auto w-[min(94vw,560px)] rounded-card border border-line p-0 backdrop:bg-black/40">
        <form className="flex flex-col gap-4 p-6" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <h2 id="nu-title" className="m-0 text-lg font-semibold">Новый пользователь</h2>
          <FieldRow label="ФИО" required>{(id) => <Input id={id} required value={nu.full_name} onChange={(e) => setNu({ ...nu, full_name: e.target.value })} />}</FieldRow>
          <FieldRow label="Email" required>{(id) => <Input id={id} type="email" required value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} />}</FieldRow>
          <FieldRow label="Начальный пароль" required>{(id) => <Input id={id} type="password" required minLength={8} autoComplete="new-password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />}</FieldRow>
          <FieldRow label="Группа">{(id) => <Input id={id} value={nu.group_code} onChange={(e) => setNu({ ...nu, group_code: e.target.value })} />}</FieldRow>
          <FieldRow label="Роль" required>{(id) => <Select id={id} value={nu.roles[0]} onChange={(e) => setNu({ ...nu, roles: [e.target.value as Role] })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>}</FieldRow>
          <ErrorBanner error={create.error} />
          <div className="flex justify-end gap-2.5">
            <Button onClick={() => dlg.current?.close()}>Отмена</Button>
            <Button type="submit" variant="primary" loading={create.isPending}>Создать</Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
