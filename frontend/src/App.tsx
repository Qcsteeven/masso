import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import type { Role } from "./api/types";
import { homeFor, useAuth } from "./auth/AuthContext";
import { AppLayout } from "./components/Layout";
import { Loading } from "./components/ui";
import Login from "./pages/Login";

const page = (loader: () => Promise<{ default: React.ComponentType }>) => {
  const C = lazy(loader);
  return (
    <Suspense fallback={<Loading />}>
      <C />
    </Suspense>
  );
};

function Guard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loading text="Проверка сессии…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.some((r) => user.roles.includes(r))) return <Navigate to={homeFor(user)} replace />;
  return <>{children}</>;
}

function Root() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading text="Проверка сессии…" />;
  return <Navigate to={user ? homeFor(user) : "/login"} replace />;
}

function Shell() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading text="Проверка сессии…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

const g = (roles: Role[], el: ReactNode) => <Guard roles={roles}>{el}</Guard>;

const router = createBrowserRouter([
  { path: "/", element: <Root /> },
  { path: "/login", element: <Login /> },
  { path: "/student/sessions/:id", element: g(["student"], page(() => import("./pages/student/Workspace"))) },
  {
    element: <Shell />,
    children: [
      { path: "/student", element: g(["student"], page(() => import("./pages/student/Home"))) },
      { path: "/student/reports", element: g(["student"], page(() => import("./pages/student/Reports"))) },
      { path: "/student/reports/:sessionId", element: g(["student", "teacher"], page(() => import("./pages/student/Report"))) },
      { path: "/student/skills", element: g(["student"], page(() => import("./pages/student/Skills"))) },
      { path: "/teacher", element: g(["teacher"], page(() => import("./pages/teacher/Group"))) },
      { path: "/teacher/sessions/:sessionId", element: g(["teacher"], page(() => import("./pages/teacher/Trace"))) },
      { path: "/teacher/assignments", element: g(["teacher"], page(() => import("./pages/teacher/Assignments"))) },
      { path: "/teacher/export", element: g(["teacher"], page(() => import("./pages/teacher/Export"))) },
      { path: "/methodist/skills", element: g(["methodist", "admin"], page(() => import("./pages/methodist/SkillGraph"))) },
      { path: "/methodist/templates", element: g(["methodist", "admin"], page(() => import("./pages/methodist/Templates"))) },
      { path: "/methodist/templates/:id", element: g(["methodist", "admin"], page(() => import("./pages/methodist/TemplateEditor"))) },
      { path: "/admin/users", element: g(["admin"], page(() => import("./pages/admin/Users"))) },
      { path: "/admin/llm", element: g(["admin"], page(() => import("./pages/admin/Llm"))) },
      { path: "/admin/audit", element: g(["admin", "sysadmin"], page(() => import("./pages/admin/Audit"))) },
      { path: "/sysadmin", element: g(["sysadmin", "admin"], page(() => import("./pages/sysadmin/Health"))) },
    ],
  },
  { path: "*", element: <Root /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
