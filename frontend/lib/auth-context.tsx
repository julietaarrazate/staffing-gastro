"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "@/lib/api";
import { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    full_name: string,
    role: "worker" | "employer"
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

// El access token vence a los 15 minutos (ver `access_token_expire_minutes`
// en el backend); lo renovamos antes con el refresh token (30 días) para que
// la sesión se mantenga abierta mientras la app esté en uso.
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

function persistTokens(access: string, refresh: string) {
  localStorage.setItem("staffya_token", access);
  localStorage.setItem("staffya_refresh", refresh);
}

function clearTokens() {
  localStorage.removeItem("staffya_token");
  localStorage.removeItem("staffya_refresh");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function tryRefresh(): Promise<string | null> {
    const refreshToken = localStorage.getItem("staffya_refresh");
    if (!refreshToken) return null;
    try {
      const tokens = await api.post<{ access_token: string; refresh_token: string }>(
        "/auth/refresh",
        { refresh_token: refreshToken }
      );
      persistTokens(tokens.access_token, tokens.refresh_token);
      setToken(tokens.access_token);
      return tokens.access_token;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    async function restoreSession() {
      const storedAccess = localStorage.getItem("staffya_token");
      const storedRefresh = localStorage.getItem("staffya_refresh");

      // Sin refresh token no hay sesión que restaurar (30 días vencidos, o
      // nunca hubo login): a login, sin intentar nada más. Si quedó un
      // access token huérfano (sin su refresh), lo limpiamos.
      if (!storedRefresh) {
        if (storedAccess) clearTokens();
        setLoading(false);
        return;
      }

      // Con refresh token disponible, intentamos restaurar en silencio:
      // primero probamos el access token si lo tenemos (evita un round-trip
      // extra cuando todavía es válido); si falta o venció, refrescamos.
      if (storedAccess) {
        setToken(storedAccess);
        try {
          setUser(await api.get<User>("/auth/me", storedAccess));
          setLoading(false);
          return;
        } catch {
          // Access token vencido/ inválido: seguimos al refresh de abajo.
        }
      }

      const refreshed = await tryRefresh();
      if (!refreshed) {
        // Sólo acá (refresh ausente/realmente vencido) mandamos a login.
        clearTokens();
        setToken(null);
        setLoading(false);
        return;
      }
      try {
        setUser(await api.get<User>("/auth/me", refreshed));
      } catch {
        clearTokens();
        setToken(null);
      }
      setLoading(false);
    }

    restoreSession();
  }, []);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(tryRefresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function login(email: string, password: string) {
    const tokens = await api.post<{ access_token: string; refresh_token: string }>(
      "/auth/login",
      { email, password }
    );
    persistTokens(tokens.access_token, tokens.refresh_token);
    setToken(tokens.access_token);
    const me = await api.get<User>("/auth/me", tokens.access_token);
    setUser(me);
  }

  async function register(
    email: string,
    password: string,
    full_name: string,
    role: "worker" | "employer"
  ) {
    await api.post<User>("/auth/register", { email, password, full_name, role });
    await login(email, password);
  }

  function logout() {
    clearTokens();
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
