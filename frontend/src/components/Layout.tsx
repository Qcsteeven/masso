import { NavLink, Outlet, useNavigate } from "react-router";
import type { Role } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Icon, Logo, type IconName } from "./icons";
import { cx } from "./ui";
import { LlmModeBanner } from "./LlmModeBanner";

interface NavItem { to: string; label: string; icon: IconName; end?: boolean }

const NAV: { role: Role; title: string; items: NavItem[] }[] = [
  { role: "student", title: "Обучающийся", items: [
    { to: "/student", label: "Мои назначения", icon: "home", end: true },
    { to: "/student/reports", label: "Протоколы", icon: "report" },
    { to: "/student/skills", label: "Мои навыки", icon: "graph" },
  ] },
  { role: "teacher", title: "Преподаватель", items: [
    { to: "/teacher", label: "Группы", icon: "users", end: true },
    { to: "/teacher/assignments", label: "Назначения", icon: "template" },
    { to: "/teacher/export", label: "Экспорт отчётов", icon: "download" },
  ] },
  { role: "methodist", title: "Методист", items: [
    { to: "/methodist/skills", label: "Граф компетенций", icon: "graph" },
    { to: "/methodist/templates", label: "Шаблоны сценариев", icon: "template" },
    { to: "/methodist/targets", label: "Целевые уровни", icon: "target" },
  ] },
  { role: "admin", title: "Администратор", items: [
    { to: "/admin/users", label: "Пользователи и роли", icon: "users" },
    { to: "/admin/llm", label: "LLM и песочницы", icon: "chip" },
    { to: "/admin/audit", label: "Аудит и безопасность", icon: "shield" },
  ] },
  { role: "sysadmin", title: "Системный администратор", items: [
    { to: "/sysadmin", label: "Состояние системы", icon: "activity", end: true },
  ] },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const sections = NAV.filter((s) => user.roles.includes(s.role));
  return (
    <div className="flex min-h-screen flex-wrap">
      <nav aria-label="Основное меню" className="flex flex-[1_1_232px] flex-col gap-0.5 bg-nav px-3 py-5 text-nav-ink md:max-w-[260px]">
        <div className="flex items-center gap-2.5 px-2.5 pb-5 text-[17px] font-bold tracking-[0.06em] text-white"><Logo />МАССО</div>
        {sections.map((s) => (
          <div key={s.role} className="flex flex-col gap-0.5">
            <div className="px-3 pb-1.5 pt-4 text-[11px] uppercase tracking-[0.1em] text-nav-label">{s.title}</div>
            {s.items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end}
                className={({ isActive }) => cx("flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm no-underline",
                  isActive ? "bg-accent !text-white" : "!text-nav-ink hover:bg-nav-hover hover:!text-white")}>
                <Icon name={i.icon} />{i.label}
              </NavLink>
            ))}
          </div>
        ))}
        <div className="grow" />
        <div className="px-3 pb-2 pt-4 text-xs text-nav-label">{user.full_name}</div>
        <button type="button" onClick={async () => { await logout(); navigate("/login"); }}
          className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm text-nav-ink hover:bg-nav-hover hover:text-white">
          <Icon name="logout" />Выйти
        </button>
      </nav>
      <div className="flex min-w-0 flex-[999_1_560px] flex-col">
        {user.roles.includes("teacher") && <LlmModeBanner />}
        <Outlet />
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, crumbs }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; crumbs?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-surface px-8 py-3.5">
      <div className="min-w-0">
        {crumbs && <div className="text-[13px] text-muted">{crumbs}</div>}
        <h1 className="m-0 text-[22px] font-semibold">{title}</h1>
        {subtitle && <div className="text-[13px] text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}

const ROLE_LABEL: Record<Role, string> = {
  student: "обучающийся", teacher: "преподаватель", methodist: "методист", admin: "администратор", sysadmin: "системный администратор",
};

export function UserBadge() {
  const { user } = useAuth();
  if (!user) return null;
  const parts = user.full_name.split(/\s+/);
  const initials = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (
    <div className="flex items-center gap-3">
      <div className="text-right leading-tight">
        <div className="text-sm font-semibold">{user.full_name}</div>
        <div className="text-xs text-muted">{user.roles.map((r) => ROLE_LABEL[r]).join(", ")}</div>
      </div>
      <span aria-hidden className="grid size-10 place-items-center rounded-full bg-blue-bg text-sm font-semibold text-blue-ink">{initials}</span>
    </div>
  );
}

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <main className={cx("flex flex-col gap-5 px-8 pb-8 pt-5", className)}>{children}</main>;
}
