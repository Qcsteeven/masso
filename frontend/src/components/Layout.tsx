import { NavLink, Outlet, useNavigate } from "react-router";
import type { Role } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Icon, Logo, type IconName } from "./icons";
import { cx } from "./ui";
import { useTheme } from "../theme";
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
    { to: "/sysadmin/audit", label: "Аудит и безопасность", icon: "shield" },
  ] },
];

export function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const dark = theme === "dark";
  return (
    <button type="button" onClick={toggle} aria-label={dark ? "Светлая тема" : "Тёмная тема"} title={dark ? "Светлая тема" : "Тёмная тема"}
      className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-label shadow-card transition-colors hover:text-accent">
      <Icon name={dark ? "sun" : "moon"} size={18} />
    </button>
  );
}

function initialsOf(fullName: string): string {
  const parts = fullName.split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const sections = NAV.filter((s) => user.roles.includes(s.role));
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3 px-6 py-3 max-sm:px-3">
          <nav aria-label="Основное меню" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1 shadow-card">
            <span className="flex shrink-0 items-center gap-2 pl-1.5 pr-3 text-[15px] font-semibold tracking-[0.04em]"><Logo size={30} />МАССО</span>
            {sections.map((s, n) => (
              <div key={s.role} role="group" aria-label={s.title} className={cx("flex shrink-0 items-center gap-1", n > 0 && "border-l border-line pl-1")}>
                {s.items.map((i) => (
                  <NavLink key={i.to} to={i.to} end={i.end}
                    className={({ isActive }) => cx("flex min-h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm no-underline transition-colors",
                      isActive ? "bg-nav !text-on-nav" : "!text-nav-ink hover:bg-nav-hover hover:!text-ink")}>
                    <Icon name={i.icon} size={17} />{i.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <ThemeToggle />
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-surface p-1 pl-1 shadow-card">
            <span aria-hidden title={user.full_name} className="grid size-8 place-items-center rounded-full bg-amber-bg text-xs font-semibold text-amber-ink">{initialsOf(user.full_name)}</span>
            <span className="max-w-[180px] truncate px-2 text-sm max-lg:hidden">{user.full_name}</span>
            <button type="button" aria-label="Выйти" title="Выйти" onClick={async () => { await logout(); navigate("/login"); }}
              className="grid size-8 place-items-center rounded-full text-label transition-colors hover:bg-nav-hover hover:text-ink">
              <Icon name="logout" size={17} />
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col">
        {user.roles.includes("teacher") && <LlmModeBanner />}
        <Outlet />
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, crumbs }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; crumbs?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 px-8 pb-1 pt-6 max-sm:px-4">
      <div className="min-w-0">
        {crumbs && <div className="mb-1 text-[13px] text-muted">{crumbs}</div>}
        <h1 className="m-0 text-[28px] font-semibold leading-tight tracking-tight">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <main className={cx("flex flex-col gap-5 px-8 pb-10 pt-5 max-sm:px-4", className)}>{children}</main>;
}
