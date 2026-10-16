import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, refreshToken, setAccessToken, setOnAuthLost } from "../api/client";
import type { Role, UserBrief } from "../api/types";

interface AuthState {
  user: UserBrief | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<UserBrief>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserBrief | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOnAuthLost(() => setUser(null));
    (async () => {
      if (await refreshToken()) {
        try {
          setUser(await api.get<UserBrief>("/api/auth/me"));
        } catch {
          setUser(null);
        }
      }
      setReady(true);
    })();
    return () => setOnAuthLost(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ access_token: string; user: UserBrief }>("/api/auth/login", { email, password });
    setAccessToken(data.access_token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const hasRole = useCallback((...roles: Role[]) => !!user && roles.some((r) => user.roles.includes(r)), [user]);

  const value = useMemo(() => ({ user, ready, login, logout, hasRole }), [user, ready, login, logout, hasRole]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

export function homeFor(user: UserBrief): string {
  if (user.roles.includes("student")) return "/student";
  if (user.roles.includes("teacher")) return "/teacher";
  if (user.roles.includes("methodist")) return "/methodist/skills";
  if (user.roles.includes("admin")) return "/admin/users";
  if (user.roles.includes("sysadmin")) return "/sysadmin";
  return "/login";
}
