import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { ApiError } from "../api/client";
import { homeFor, useAuth } from "../auth/AuthContext";
import { Icon, Logo } from "../components/icons";
import { Banner, Button, FieldRow, Input } from "../components/ui";

const DEMO = import.meta.env.VITE_DEMO === "true";
const DEMO_ROLES = [
  { email: "student1@masso.local", label: "Обучающийся" },
  { email: "teacher@masso.local", label: "Преподаватель" },
  { email: "methodist@masso.local", label: "Методист" },
  { email: "admin@masso.local", label: "Администратор" },
  { email: "ops@masso.local", label: "Сисадмин" },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user)} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(email, password);
      navigate(homeFor(u), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось войти. Повторите попытку.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-wrap">
      <section className="flex flex-[1_1_520px] flex-col justify-between gap-10 bg-nav px-16 py-14 text-[#e7edf3] max-md:px-6">
        <div className="flex items-center gap-3.5">
          <Logo size={44} />
          <div>
            <div className="text-[22px] font-bold tracking-[0.06em]">МАССО</div>
            <div className="text-[13px] text-[#9fb0c1]">учебная диспетчерская</div>
          </div>
        </div>
        <div className="flex max-w-[560px] flex-col gap-5">
          <h1 className="m-0 text-[40px] font-semibold leading-tight max-md:text-3xl">
            Сценарий — как назначение. Среда — как рабочее место. Отчёт — как протокол.
          </h1>
          <p className="m-0 text-base leading-relaxed text-[#b7c4d1]">
            Мультиагентная система ситуативного обучения: индивидуальные кейсы под профиль компетенций, изолированная
            учебная среда, динамические инциденты и автоматическая проверка результата.
          </p>
        </div>
        <div />
      </section>
      <section className="flex min-w-0 flex-[999_1_560px] items-center justify-center px-6 py-12">
        <form onSubmit={submit} aria-labelledby="login-title"
          className="flex w-full max-w-[480px] flex-col gap-5 rounded-xl border border-line bg-surface p-10 max-sm:p-6">
          <div className="flex flex-col gap-1.5">
            <h2 id="login-title" className="m-0 text-[26px] font-semibold">Вход в систему</h2>
            <p className="m-0 text-sm text-muted">Используйте учётную запись, выданную образовательной организацией.</p>
          </div>
          {error && <Banner tone="red" icon="alert" role="alert">{error}</Banner>}
          <FieldRow label="Email">{(id) => (
            <Input id={id} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          )}</FieldRow>
          <FieldRow label="Пароль">{(id) => (
            <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          )}</FieldRow>
          <Button type="submit" variant="primary" loading={busy} className="min-h-12 text-base">
            {busy ? "Проверка учётных данных…" : "Войти"}
          </Button>
          <div className="flex items-center gap-2.5 text-[13px] text-muted">
            <Icon name="shield" size={16} /> Пароль проверяется на сервере; сессия хранится в защищённой cookie.
          </div>
          {DEMO && (
            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <div className="text-sm font-semibold">Демо-версия: войти как</div>
              <div className="flex flex-wrap gap-2">
                {DEMO_ROLES.map((a) => (
                  <Button key={a.email} small type="button" onClick={() => { setEmail(a.email); setPassword("masso-demo"); }}>{a.label}</Button>
                ))}
              </div>
              <p className="m-0 text-[13px] text-muted">Кнопка заполняет email и пароль <code>masso-demo</code>, затем нажмите «Войти».</p>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
