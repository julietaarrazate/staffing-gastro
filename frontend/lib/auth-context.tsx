"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  ApiError,
  bindSessionToken,
  hasBoundSession,
  isTransientFailure,
  renewSessionToken,
  setTwoFactorGateHandler,
  setUnauthorizedHandler,
} from "@/lib/api";
import { clearAllCached } from "@/lib/screen-cache";
import {
  isTwoFactorChallenge,
  TWO_FACTOR_CODES,
  TWO_FACTOR_PAGE,
  twoFactorApi,
  type SessionTokens,
  type TwoFactorChallenge,
  type TwoFactorVerified,
} from "@/lib/two-factor";
import { User } from "@/lib/types";

/** Resultado de `loginWithGoogle`: o bien ya se completó la sesión, o el
 * email es nuevo y hace falta elegir rol para terminar de crear la cuenta
 * (ver `POST /auth/google` en el backend, docs/reference/ACCESO_MODERNO.md). */
export type GoogleLoginResult =
  | { requiresRole: true; email: string; fullName: string }
  | { requiresRole: false; twoFactor: boolean };

/** Resultado de `login`: `twoFactor` = la cuenta es admin con la
 * verificación en dos pasos y falta el código (`pendingTwoFactor`). */
export type LoginOutcome = { twoFactor: boolean };

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginOutcome>;
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
  /** `true` después de "Cerrar sesión" hasta el próximo ingreso. Las
   *  pantallas protegidas (`useRequireAuth`) mandan entonces a la landing y
   *  no a "/login", para no pisar la salida (ver `logout`). */
  justLoggedOut: boolean;
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
  /** Login de una admin a mitad de camino: la contraseña (o Google) ya
   * pasó y falta el código de la app (ADR-0023). Vive en memoria. */
  pendingTwoFactor: { challengeToken: string } | null;
  /** Manda el código (de la app o de recuperación) y, si sirve, abre la
   * sesión. Si el desafío venció, lo descarta y tira el error. */
  completeTwoFactor: (code: string) => Promise<TwoFactorVerified>;
  cancelTwoFactor: () => void;
  /** `true` cuando el backend dijo que esta admin todavía no activó la
   * verificación: el panel sólo muestra el alta. */
  twoFactorSetupPending: boolean;
  setTwoFactorSetupPending: (pending: boolean) => void;
  /** Adopta la sesión verificada que devuelve el alta de la verificación. */
  adoptSession: (tokens: SessionTokens) => Promise<void>;
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
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [justLoggedOut, setJustLoggedOut] = useState(false);
  // Snapshot de la sesión admin real mientras se está impersonando otro
  // usuario. Vive sólo en memoria (nunca en localStorage) a propósito.
  const [impersonating, setImpersonating] = useState<
    { adminToken: string; adminUser: User } | null
  >(null);
  // Lo lee el manejador de 401 (registrado una sola vez), que no ve el estado.
  const impersonatingRef = useRef(false);
  const [pendingTwoFactor, setPendingTwoFactor] = useState<{ challengeToken: string } | null>(
    null
  );
  const [twoFactorSetupPending, setTwoFactorSetupPending] = useState(false);
  // Varias pantallas reciben el mismo 403 a la vez: se actúa una sola vez.
  const leavingForReauth = useRef(false);

  /** Cambia de SESIÓN (login, logout, impersonar): el `token` del contexto
   * sólo cambia acá. Renovar el access token no pasa por acá (ver
   * `tryRefresh` y `lib/api.ts`), así que no recarga las pantallas. */
  function setToken(next: string | null) {
    bindSessionToken(next);
    setTokenState(next);
    if (next) setJustLoggedOut(false);
  }

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
      // Con una sesión en curso, sólo se renueva el token vigente; el del
      // contexto queda igual. Sin sesión (restaurando al abrir la app), la
      // renovación ES el arranque de la sesión.
      if (hasBoundSession()) renewSessionToken(tokens.access_token);
      else setToken(tokens.access_token);
      return tokens.access_token;
    } catch (err) {
      // Un backend que no está (sin red, timeout, o 5xx/408/429 mientras
      // Render arranca en frío) NO es un refresh inválido: se propaga para
      // degradar sin cerrar la sesión. Sólo un rechazo real (refresh
      // vencido/revocado, 401/403) devuelve null → login.
      if (isTransientFailure(err)) throw err;
      clearSession();
      return null;
    }
  }

  // Ante un 401 con el token de la sesión, `lib/api.ts` renueva y reintenta
  // una vez. Va antes de `restoreSession` para cubrir también el access token
  // guardado que ya venció. Impersonando no se renueva: el refresh traería un
  // token de la admin real, no del usuario que se está viendo.
  useEffect(() => {
    setUnauthorizedHandler(() =>
      impersonatingRef.current ? Promise.resolve(null) : tryRefresh()
    );
    return () => setUnauthorizedHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tryRefresh` sólo usa setters estables y localStorage
  }, []);

  // Verificación en dos pasos (ADR-0023). Una sesión admin sin activarla
  // recibe 403 `two_factor_setup_required` en todo menos el alta: se la
  // lleva al alta. Una sesión de antes de activarla (otro dispositivo)
  // recibe `two_factor_required`: se cierra y se vuelve a ingresar.
  useEffect(() => {
    setTwoFactorGateHandler((code) => {
      if (code === TWO_FACTOR_CODES.setupRequired) {
        setTwoFactorSetupPending(true);
        if (window.location.pathname !== TWO_FACTOR_PAGE) router.replace(TWO_FACTOR_PAGE);
        return;
      }
      if (leavingForReauth.current) return;
      leavingForReauth.current = true;
      clearSession();
      clearAllCached();
      bindSessionToken(null);
      api.post("/auth/logout").catch(() => {});
      // Recarga completa: el guard de las pantallas protegidas no le gana
      // al mensaje, y no queda nada de la sesión vieja en memoria.
      window.location.replace(
        `/login?message=${encodeURIComponent("Volvé a ingresar con el código de tu app autenticadora.")}`
      );
    });
    return () => setTwoFactorGateHandler(null);
  }, [router]);

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
      // Todo el bloque va bajo un guard de `isTransientFailure`: si el backend
      // no responde o responde 5xx, se degrada a app deslogueada SIN cerrar la sesión (los
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
            if (isTransientFailure(err)) throw err;
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
          if (isTransientFailure(err)) throw err;
          clearSession();
          setToken(null);
        }
        setLoading(false);
      } catch (err) {
        // Backend dormido/caído: no cerramos sesión, sólo dejamos de cargar.
        if (!isTransientFailure(err)) {
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

  /** Abre la sesión con los tokens de una respuesta de login. */
  async function startSession(tokens: SessionTokens) {
    persistAccessToken(tokens.access_token);
    setToken(tokens.access_token);
    // Fast path: el usuario viene embebido en la respuesta del login → sin un
    // `GET /auth/me` extra (un round-trip menos al backend al entrar). Fallback
    // al /auth/me sólo si no vino `user` — cubre el skew de deploy (frontend
    // nuevo contra backend viejo que todavía no lo embebe) y no rompe el login.
    setUser(tokens.user ?? (await api.get<User>("/auth/me", tokens.access_token)));
  }

  async function login(email: string, password: string): Promise<LoginOutcome> {
    const data = await api.post<SessionTokens | TwoFactorChallenge>("/auth/login", {
      email,
      password,
    });
    if (isTwoFactorChallenge(data)) {
      setPendingTwoFactor({ challengeToken: data.challenge_token });
      return { twoFactor: true };
    }
    await startSession(data);
    return { twoFactor: false };
  }

  async function completeTwoFactor(code: string): Promise<TwoFactorVerified> {
    if (!pendingTwoFactor) {
      throw new ApiError(401, "El ingreso venció. Volvé a poner tu contraseña.", TWO_FACTOR_CODES.challengeInvalid);
    }
    try {
      const result = await twoFactorApi.verify(pendingTwoFactor.challengeToken, code);
      setPendingTwoFactor(null);
      setTwoFactorSetupPending(false);
      await startSession(result);
      return result;
    } catch (err) {
      if (err instanceof ApiError && err.code === TWO_FACTOR_CODES.challengeInvalid) {
        setPendingTwoFactor(null);
      }
      throw err;
    }
  }

  function cancelTwoFactor() {
    setPendingTwoFactor(null);
  }

  async function adoptSession(tokens: SessionTokens) {
    leavingForReauth.current = false;
    setTwoFactorSetupPending(false);
    await startSession(tokens);
  }

  async function register(
    email: string,
    password: string,
    full_name: string,
    role: "worker" | "employer"
  ) {
    // La pantalla de registro sólo llega acá con el checkbox de términos
    // marcado, y el backend guarda la constancia (versión, medio y fecha).
    await api.post<User>("/auth/register", {
      email,
      password,
      full_name,
      role,
      accepted_terms: true,
    });
    await login(email, password);
  }

  async function loginWithGoogle(
    idToken: string,
    role?: "worker" | "employer"
  ): Promise<GoogleLoginResult> {
    const data = await api.post<
      | { requires_role: true; email: string; full_name: string }
      | { requires_role?: false; access_token: string; user?: User }
      | TwoFactorChallenge
    >("/auth/google", {
      id_token: idToken,
      role,
      // El rol sólo viaja cuando se crea la cuenta, y `GoogleAuthButton` no
      // deja elegirlo sin marcar términos y privacidad.
      accepted_terms: role !== undefined,
    });

    if ("requires_role" in data && data.requires_role) {
      return { requiresRole: true, email: data.email, fullName: data.full_name };
    }
    // Admin con la verificación en dos pasos: falta el código (ADR-0023).
    if (isTwoFactorChallenge(data)) {
      setPendingTwoFactor({ challengeToken: data.challenge_token });
      return { requiresRole: false, twoFactor: true };
    }

    // Usuario embebido (mismo contrato que /auth/login); fallback a /auth/me si
    // no vino, por el mismo motivo de skew de deploy.
    await startSession(data as SessionTokens);
    return { requiresRole: false, twoFactor: false };
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
    impersonatingRef.current = true;
    // Las pantallas pintan primero lo cacheado: sin esto, se veía un instante
    // el feed o el perfil de la admin como si fueran del usuario impersonado.
    clearAllCached();
    setToken(data.access_token);
    setUser(data.user);
  }

  function stopImpersonating() {
    if (!impersonating) return;
    impersonatingRef.current = false;
    clearAllCached();
    // El token de la admin pudo haber vencido durante la impersonación (el
    // auto-refresh estaba apagado): la primera request da 401 y se renueva.
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
    clearAllCached();
    setJustLoggedOut(true);
    setTwoFactorSetupPending(false);
    setToken(null);
    setUser(null);
    // `replace` (no `push`): que "atrás" después de cerrar sesión no vuelva a
    // una pantalla protegida ya renderizada en el historial. Va a la landing
    // y no a "/login" (Julieta, 2026-10-13): desde la app instalada era la
    // única forma de volver a verla; "Ingresar" está en su encabezado.
    router.replace("/");
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
        justLoggedOut,
        updateFullName,
        impersonating: impersonating ? { adminUser: impersonating.adminUser } : null,
        impersonate,
        stopImpersonating,
        pendingTwoFactor,
        completeTwoFactor,
        cancelTwoFactor,
        twoFactorSetupPending,
        setTwoFactorSetupPending,
        adoptSession,
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
