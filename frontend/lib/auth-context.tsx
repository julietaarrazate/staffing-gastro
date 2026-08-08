"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, NetworkError } from "@/lib/api";
import { User } from "@/lib/types";

/** Resultado de `loginWithGoogle`: o bien ya se completó la sesión, o el
 * email es nuevo y hace falta elegir rol para terminar de crear la cuenta
 * (ver `POST /auth/google` en el backend, docs/reference/ACCESO_MODERNO.md). */
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
  /** Acceso de invitado para la beta ("Explorar sin cuenta"): entra sin
   * registrarse validando un PIN (ver `POST /auth/guest`). */
  loginAsGuest: (pin: string, role: "worker" | "employer") => Promise<void>;
  logout: () => Promise<void>;
  /** No-null mientras una admin está "viendo como" otro usuario (ver
   * `impersonate`). Sólo expone los datos de la admin real, para el banner. */
  impersonating: { adminUser: User } | null;
  /** "Ver como": una admin entra a la cuenta de `userId` sin conocer su
   * contraseña (`POST /admin/users/{id}/impersonate`). La sesión de admin
   * queda en memoria (no en localStorage) para volver con `stopImpersonating`;
   * si se recarga la página mientras se impersona, se vuelve a la cuenta admin
   * automáticamente — es la conducta más segura por diseño (nunca persiste el
   * token impersonado). */
  impersonate: (userId: string) => Promise<void>;
  stopImpersonating: () => void;
  /** Cambia el nombre del usuario autenticado (único dato de identidad
   *  editable desde el perfil — ni el registro por email ni el acceso con
   *  Google dejaban forma de corregirlo, Julieta 2026-07-30). */
  updateFullName: (fullName: string) => Promise<void>;
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

// TECH_DEBT.md S1: el refresh token viaja como cookie httpOnly (nunca en el
// body de la respuesta ni en localStorage) — un XSS ya no puede leerlo ni
// exfiltrarlo. El navegador la adjunta solo en cada request a `/auth/*`
// (`credentials: "include"`, ver lib/api.ts); acá sólo queda el access token
// (15 min, exposición chica) y una marca SIN secreto para saber si vale la
// pena intentar `/auth/refresh` al abrir la app — sin ella, cada visita
// anónima a la landing dispararía un refresh al pedo (la cookie httpOnly no
// se puede leer desde JS para decidirlo de otra forma).
function persistAccessToken(access: string) {
  localStorage.setItem("staffya_token", access);
  localStorage.setItem("staffya_has_session", "1");
}

function clearSession() {
  localStorage.removeItem("staffya_token");
  localStorage.removeItem("staffya_has_session");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Snapshot de la sesión admin real mientras se está impersonando otro
  // usuario. Vive sólo en memoria (nunca en localStorage) a propósito.
  const [impersonating, setImpersonating] = useState<
    { adminToken: string; adminUser: User } | null
  >(null);

  async function tryRefresh(timeoutMs?: number): Promise<string | null> {
    // Sin esta marca no hay (o ya no hay) sesión que renovar — el refresh
    // token real vive sólo en la cookie httpOnly, invisible para JS.
    if (!localStorage.getItem("staffya_has_session")) return null;
    try {
      const tokens = await api.post<{ access_token: string }>(
        "/auth/refresh",
        undefined,
        null,
        timeoutMs
      );
      persistAccessToken(tokens.access_token);
      setToken(tokens.access_token);
      return tokens.access_token;
    } catch (err) {
      // Un fallo de red (backend caído/dormido) NO es un refresh inválido:
      // se propaga para degradar sin cerrar la sesión. Sólo un ApiError real
      // (refresh vencido/revocado) devuelve null → login.
      if (err instanceof NetworkError) throw err;
      clearSession();
      return null;
    }
  }

  useEffect(() => {
    async function restoreSession() {
      const storedAccess = localStorage.getItem("staffya_token");
      const hasSession = localStorage.getItem("staffya_has_session");

      // Sin la marca de sesión no hay (30 días vencidos, cookie borrada, o
      // nunca hubo login) nada que restaurar: a login, sin intentar nada
      // más. Si quedó un access token huérfano, lo limpiamos.
      if (!hasSession) {
        if (storedAccess) clearSession();
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
          clearSession();
          setToken(null);
          setLoading(false);
          return;
        }
        try {
          setUser(await api.get<User>("/auth/me", refreshed, AUTH_TIMEOUT_MS));
        } catch (err) {
          if (err instanceof NetworkError) throw err;
          clearSession();
          setToken(null);
        }
        setLoading(false);
      } catch (err) {
        // Backend dormido/caído: no cerramos sesión, sólo dejamos de cargar.
        if (!(err instanceof NetworkError)) {
          // Cualquier otro error inesperado tampoco debe colgar la app.
          clearSession();
          setToken(null);
        }
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  useEffect(() => {
    // Durante una impersonación el `token` activo es del usuario impersonado
    // (sin refresh_token propio, ver `impersonate`): el auto-refresh periódico
    // no debe correr, o pisaría ese token con uno nuevo del admin real.
    if (!token || impersonating) return;
    const interval = setInterval(() => {
      // El refresh periódico puede tirar NetworkError (backend momentáneamente
      // caído); lo tragamos — el próximo tick reintenta.
      tryRefresh().catch(() => {});
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, impersonating]);

  async function login(email: string, password: string) {
    const tokens = await api.post<{
      access_token: string;
      user?: User;
    }>("/auth/login", { email, password });
    persistAccessToken(tokens.access_token);
    setToken(tokens.access_token);
    // Fast path: el usuario viene embebido en la respuesta del login → sin un
    // `GET /auth/me` extra (un round-trip menos al backend al entrar). Fallback
    // al /auth/me sólo si no vino `user` — cubre el skew de deploy (frontend
    // nuevo contra backend viejo que todavía no lo embebe) y no rompe el login.
    setUser(tokens.user ?? (await api.get<User>("/auth/me", tokens.access_token)));
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
      | { requires_role?: false; access_token: string; user?: User }
    >("/auth/google", { id_token: idToken, role });

    if ("requires_role" in data && data.requires_role) {
      return { requiresRole: true, email: data.email, fullName: data.full_name };
    }

    const tokens = data as { access_token: string; user?: User };
    persistAccessToken(tokens.access_token);
    setToken(tokens.access_token);
    // Usuario embebido (mismo contrato que /auth/login); fallback a /auth/me si
    // no vino, por el mismo motivo de skew de deploy.
    setUser(tokens.user ?? (await api.get<User>("/auth/me", tokens.access_token)));
    return { requiresRole: false };
  }

  async function loginAsGuest(pin: string, role: "worker" | "employer") {
    const tokens = await api.post<{
      access_token: string;
      user?: User;
    }>("/auth/guest", { pin, role });
    persistAccessToken(tokens.access_token);
    setToken(tokens.access_token);
    setUser(tokens.user ?? (await api.get<User>("/auth/me", tokens.access_token)));
  }

  async function impersonate(userId: string) {
    if (!token || !user || impersonating) return;
    const data = await api.post<{ access_token: string; user: User }>(
      `/admin/users/${userId}/impersonate`,
      undefined,
      token
    );
    setImpersonating({ adminToken: token, adminUser: user });
    setToken(data.access_token);
    setUser(data.user);
  }

  function stopImpersonating() {
    if (!impersonating) return;
    setToken(impersonating.adminToken);
    setUser(impersonating.adminUser);
    setImpersonating(null);
    router.replace("/admin");
  }

  async function updateFullName(fullName: string) {
    if (!token) return;
    const updated = await api.patch<User>("/auth/me", { full_name: fullName }, token);
    setUser(updated);
  }

  async function logout() {
    // Si se cierra sesión mientras se está impersonando, no hay que revocar
    // la cookie de la ADMIN real (la impersonación nunca tuvo una propia, ver
    // `impersonate` más abajo — sigue siendo la de la admin, sin tocar): eso
    // sería cerrarle la sesión a la admin por error. "Cerrar sesión" en este
    // estado significa simplemente volver a la cuenta admin.
    if (impersonating) {
      stopImpersonating();
      return;
    }
    // TECH_DEBT.md S1: el refresh token viaja como cookie httpOnly — el
    // navegador la manda sola (`credentials: "include"`, lib/api.ts), no hay
    // que leerla ni reenviarla a mano. El backend la revoca server-side y la
    // limpia en la respuesta.
    clearSession();
    setToken(null);
    setUser(null);
    // `replace` (no `push`): que "atrás" después de cerrar sesión no vuelva a
    // una pantalla protegida ya renderizada en el historial.
    router.replace("/login");
    try {
      await api.post("/auth/logout");
    } catch {
      // Best-effort: el usuario ya quedó deslogueado localmente. Si el
      // backend no respondió (red caída, sin conexión), el refresh token
      // sigue siendo válido server-side hasta que expire solo — no vale
      // la pena bloquear ni mostrarle un error por esto.
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        loginWithGoogle,
        loginAsGuest,
        logout,
        updateFullName,
        impersonating: impersonating ? { adminUser: impersonating.adminUser } : null,
        impersonate,
        stopImpersonating,
      }}
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
