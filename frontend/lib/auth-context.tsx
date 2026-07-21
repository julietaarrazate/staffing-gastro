"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, NetworkError } from "@/lib/api";
import { User } from "@/lib/types";

/** Resultado de `loginWithGoogle`: o bien ya se completó la sesión, o el
 * email es nuevo y hace falta elegir rol para terminar de crear la cuenta
 * (ver `POST /auth/google` en el backend, docs/ACCESO_MODERNO.md). */
export type GoogleLoginResult =
  | { requiresRole: true; email: string; fullName: string }
  | { requiresRole: false };

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
  /** `role` sólo hace falta si el email es nuevo (ver `GoogleLoginResult`);
   * se ignora si el email ya tiene cuenta. */
  loginWithGoogle: (
    idToken: string,
    role?: "worker" | "employer"
  ) => Promise<GoogleLoginResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

// El access token vence a los 15 minutos (ver `access_token_expire_minutes`
// en el backend); lo renovamos antes con el refresh token (30 días) para que
// la sesión se mantenga abierta mientras la app esté en uso.
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

// Tope para el chequeo de sesión al abrir la app: si el backend no responde
// en este tiempo (cold start de Render, backend caído), no colgamos la app en
// blanco — se degrada a mostrar el landing/login sin cerrar la sesión.
const AUTH_TIMEOUT_MS = 12 * 1000;

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

  async function tryRefresh(timeoutMs?: number): Promise<string | null> {
    const refreshToken = localStorage.getItem("staffya_refresh");
    if (!refreshToken) return null;
    try {
      const tokens = await api.post<{ access_token: string; refresh_token: string }>(
        "/auth/refresh",
        { refresh_token: refreshToken },
        null,
        timeoutMs
      );
      persistTokens(tokens.access_token, tokens.refresh_token);
      setToken(tokens.access_token);
      return tokens.access_token;
    } catch (err) {
      // Un fallo de red (backend caído/dormido) NO es un refresh inválido:
      // se propaga para degradar sin cerrar la sesión. Sólo un ApiError real
      // (refresh vencido/revocado) devuelve null → login.
      if (err instanceof NetworkError) throw err;
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
      // Todo el bloque va bajo un guard de NetworkError: si el backend no
      // responde, se degrada a app deslogueada SIN cerrar la sesión (los
      // tokens siguen guardados y un reload reintenta cuando el server
      // despierte) — en vez de quedar en blanco esperando para siempre.
      try {
        if (storedAccess) {
          setToken(storedAccess);
          try {
            setUser(await api.get<User>("/auth/me", storedAccess, AUTH_TIMEOUT_MS));
            setLoading(false);
            return;
          } catch (err) {
            if (err instanceof NetworkError) throw err;
            // Access token vencido/inválido (ApiError): seguimos al refresh.
          }
        }

        const refreshed = await tryRefresh(AUTH_TIMEOUT_MS);
        if (!refreshed) {
          // Refresh ausente/realmente vencido (no red): a login.
          clearTokens();
          setToken(null);
          setLoading(false);
          return;
        }
        try {
          setUser(await api.get<User>("/auth/me", refreshed, AUTH_TIMEOUT_MS));
        } catch (err) {
          if (err instanceof NetworkError) throw err;
          clearTokens();
          setToken(null);
        }
        setLoading(false);
      } catch (err) {
        // Backend dormido/caído: no cerramos sesión, sólo dejamos de cargar.
        if (!(err instanceof NetworkError)) {
          // Cualquier otro error inesperado tampoco debe colgar la app.
          clearTokens();
          setToken(null);
        }
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      // El refresh periódico puede tirar NetworkError (backend momentáneamente
      // caído); lo tragamos — el próximo tick reintenta.
      tryRefresh().catch(() => {});
    }, REFRESH_INTERVAL_MS);
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

  async function loginWithGoogle(
    idToken: string,
    role?: "worker" | "employer"
  ): Promise<GoogleLoginResult> {
    const data = await api.post<
      | { requires_role: true; email: string; full_name: string }
      | { requires_role?: false; access_token: string; refresh_token: string }
    >("/auth/google", { id_token: idToken, role });

    if ("requires_role" in data && data.requires_role) {
      return { requiresRole: true, email: data.email, fullName: data.full_name };
    }

    const tokens = data as { access_token: string; refresh_token: string };
    persistTokens(tokens.access_token, tokens.refresh_token);
    setToken(tokens.access_token);
    setUser(await api.get<User>("/auth/me", tokens.access_token));
    return { requiresRole: false };
  }

  function logout() {
    clearTokens();
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, loginWithGoogle, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
