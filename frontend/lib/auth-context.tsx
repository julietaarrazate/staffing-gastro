"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ACCOUNT_SUSPENDED_CODE,
  api,
  ApiError,
  bindSessionToken,
  hasBoundSession,
  isTransientFailure,
  NetworkError,
  renewSessionToken,
  resolveToken,
  setTwoFactorGateHandler,
  setUnauthorizedHandler,
} from "@/lib/api";
import { claimPushForAccount, releasePushFromAccount } from "@/lib/push";
import { isSessionEndReason, type SessionEndReason } from "@/lib/safe-next";
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
  /** No-null cuando la sesión terminó sin que la persona lo pidiera: la
   *  renovación fue rechazada (`vencida`) o la cuenta está suspendida. Las
   *  pantallas protegidas mandan al ingreso con ese motivo y la ruta para
   *  volver (`useRequireAuth`). Se limpia al ingresar. */
  sessionEnded: SessionEndReason | null;
  /** `true` cuando hay una sesión guardada pero el servidor no contesta
   *  (dormido, sin conexión): no se sabe todavía quién es. La cabecera
   *  muestra «Reconectando…» en vez de la de visitante, nadie manda al
   *  ingreso, y se reintenta solo. */
  reconnecting: boolean;
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

// Con una sesión guardada y el servidor sin contestar al abrir, se vuelve a
// probar solo: a los 2, 5 y 10 segundos, y después cada 15, siempre con la
// pestaña a la vista (Render tarda cerca de un minuto en despertar).
const RECONNECT_DELAYS_MS = [2_000, 5_000, 10_000];
const RECONNECT_STEADY_MS = 15_000;

// Cuánto espera un ingreso o una salida a la renovación que quedó en vuelo.
const SETTLE_REFRESH_MS = 15_000;

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
const HAS_SESSION_KEY = "staffya_has_session";
// Por qué se borró la marca, para las otras pestañas: sin esto no distinguen
// «cerró sesión» (van a la landing) de «la sesión venció» (van al ingreso con
// el motivo). Se escribe antes de borrar la marca y se limpia al ingresar.
const SESSION_END_KEY = "staffya_session_end";

function persistAccessToken(access: string) {
  localStorage.setItem("staffya_token", access);
  localStorage.setItem(HAS_SESSION_KEY, "1");
  localStorage.removeItem(SESSION_END_KEY);
}

/** Qué dice el servidor al rechazar una renovación. */
function endReasonFrom(err: unknown): SessionEndReason {
  return err instanceof ApiError && err.status === 403 && err.code === ACCOUNT_SUSPENDED_CODE
    ? "suspendida"
    : "vencida";
}

function clearSession() {
  localStorage.removeItem("staffya_token");
  localStorage.removeItem(HAS_SESSION_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [justLoggedOut, setJustLoggedOut] = useState(false);
  const [sessionEnded, setSessionEnded] = useState<SessionEndReason | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  // Sube cada vez que la sesión cambia de manos (ingreso, salida, fin). Una
  // recuperación que quedó esperando al servidor compara contra esto antes
  // de aplicar su respuesta, para no pisar a quien ingresó mientras tanto.
  const sessionEpoch = useRef(0);
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
    if (next) {
      setJustLoggedOut(false);
      setSessionEnded(null);
    }
  }

  /** La sesión terminó sin que la persona lo pidiera (renovación rechazada,
   * cuenta suspendida): además de borrar lo guardado, el contexto queda sin
   * `token` ni `user`. Antes sólo se borraba lo guardado y las pantallas
   * seguían como si hubiera sesión, mostrando «No autorizado» (U112, U096).
   * `announce: false` cuando el aviso llegó de otra pestaña, que ya lo dejó
   * escrito. */
  function endSession(reason: SessionEndReason, { announce = true } = {}) {
    sessionEpoch.current += 1;
    if (announce) localStorage.setItem(SESSION_END_KEY, reason);
    clearSession();
    clearAllCached();
    impersonatingRef.current = false;
    setImpersonating(null);
    setTwoFactorSetupPending(false);
    setReconnecting(false);
    setJustLoggedOut(false);
    setToken(null);
    setUser(null);
    setSessionEnded(reason);
  }

  // La renovación en vuelo, si hay una. Es una sola a la vez y **nunca se
  // aborta**: el servidor rota la cookie al contestar, y un pedido cortado
  // del lado del navegador puede haberse procesado igual. El próximo saldría
  // con la cookie vieja y el servidor lo toma por un robo: cierra todas las
  // sesiones de la cuenta. Quien no puede esperar deja de esperar
  // (`timeoutMs`), pero el pedido sigue y el siguiente intento lo reusa.
  const refreshInFlight = useRef<Promise<string | null> | null>(null);
  // Ingresos en curso (ver `signIn`): mientras haya uno no arranca ninguna
  // renovación de la sesión anterior.
  const signingIn = useRef(0);

  function tryRefresh(timeoutMs?: number): Promise<string | null> {
    // Sin esta marca no hay (o ya no hay) sesión que renovar — el refresh
    // token real vive sólo en la cookie httpOnly, invisible para JS.
    if (!localStorage.getItem(HAS_SESSION_KEY)) {
      // Con una sesión en curso y sin la marca, la cerraron desde otro lado.
      if (hasBoundSession()) endSession("vencida", { announce: false });
      return Promise.resolve(null);
    }
    if (!refreshInFlight.current) {
      // Hay un ingreso en curso: no se sabe todavía de quién va a ser la
      // sesión. Se contesta como «sin conexión» (no cierra nada).
      if (signingIn.current > 0) {
        return Promise.reject(new NetworkError("No se pudo conectar con el servidor."));
      }
      // La respuesta es de la sesión que había al pedirla. Si mientras tanto
      // cambió de manos (ingreso, salida, cierre desde otra pestaña), no se
      // aplica: ni se guarda el token, ni se renueva, ni se da por vencida
      // la sesión de quien entró después.
      const epoch = sessionEpoch.current;
      const attempt: Promise<string | null> = api
        .post<{ access_token: string }>("/auth/refresh")
        .then(
          (tokens) => {
            if (sessionEpoch.current !== epoch) return null;
            persistAccessToken(tokens.access_token);
            // Con una sesión en curso, sólo se renueva el token vigente; el
            // del contexto queda igual. Sin sesión (restaurando al abrir la
            // app), la renovación ES el arranque de la sesión.
            if (hasBoundSession()) renewSessionToken(tokens.access_token);
            else setToken(tokens.access_token);
            return tokens.access_token;
          },
          (err) => {
            // Un backend que no está (sin red, o 5xx/408/429 mientras Render
            // arranca en frío) NO es un refresh inválido: se propaga para
            // degradar sin cerrar la sesión. Sólo un rechazo real (refresh
            // vencido/revocado, 401/403) termina la sesión.
            if (isTransientFailure(err)) throw err;
            if (sessionEpoch.current !== epoch) return null;
            endSession(endReasonFrom(err));
            return null;
          }
        )
        .finally(() => {
          if (refreshInFlight.current === attempt) refreshInFlight.current = null;
        });
      refreshInFlight.current = attempt;
    }
    const inFlight = refreshInFlight.current;
    if (timeoutMs == null) return inFlight;
    return new Promise<string | null>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new NetworkError("El servidor tardó demasiado en responder.")),
        timeoutMs
      );
      inFlight.then(resolve, reject).finally(() => clearTimeout(timer));
    });
  }

  /** Espera (con tope) a que termine la renovación en vuelo. */
  async function settleRefresh() {
    const inFlight = refreshInFlight.current;
    if (!inFlight) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      inFlight.catch(() => null),
      new Promise((resolve) => {
        timer = setTimeout(resolve, SETTLE_REFRESH_MS);
      }),
    ]);
    clearTimeout(timer);
  }

  /** Todo pedido que abre una sesión pasa por acá. La respuesta de una
   * renovación trae cookie: si la de la sesión anterior llegara después de
   * la del ingreso, el navegador se quedaría con la cookie de la cuenta
   * anterior y la próxima renovación traería su token. Por eso primero se
   * espera a la que esté en vuelo, y mientras dura el ingreso no arranca
   * otra. */
  async function signIn<T>(send: () => Promise<T>): Promise<T> {
    signingIn.current += 1;
    try {
      await settleRefresh();
      return await send();
    } finally {
      signingIn.current -= 1;
    }
  }

  // Ante un 401 con el token de la sesión, `lib/api.ts` renueva y reintenta
  // una vez. Va antes de `restoreSession` para cubrir también el access token
  // guardado que ya venció. Impersonando no se renueva: el refresh traería un
  // token de la admin real, no del usuario que se está viendo.
  useEffect(() => {
    setUnauthorizedHandler(() =>
      impersonatingRef.current
        ? Promise.reject(
            new ApiError(
              401,
              "Se venció el tiempo de «ver como». Volvé a tu cuenta y entrá de nuevo.",
              "impersonation_expired"
            )
          )
        : tryRefresh()
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

  /** Recupera la sesión guardada. `none`: no hay (o ya no sirve); `ok`: hay y
   * se sabe quién es; `transient`: hay, pero el servidor no contestó. No toca
   * `loading` ni `reconnecting`: eso lo decide quien llama. */
  async function restoreOnce(): Promise<"ok" | "none" | "transient"> {
    const epoch = sessionEpoch.current;
    const storedAccess = localStorage.getItem("staffya_token");
    const hasSession = localStorage.getItem(HAS_SESSION_KEY);

    // Sin la marca de sesión no hay (30 días vencidos, cookie borrada, o
    // nunca hubo login) nada que restaurar: a login, sin intentar nada
    // más. Si quedó un access token huérfano, lo limpiamos.
    if (!hasSession) {
      if (storedAccess) clearSession();
      return "none";
    }

    // Con refresh token disponible, intentamos restaurar en silencio:
    // primero probamos el access token si lo tenemos (evita un round-trip
    // extra cuando todavía es válido); si falta o venció, refrescamos.
    // Todo el bloque va bajo un guard de `isTransientFailure`: si el backend
    // no responde o responde 5xx, NO se cierra la sesión (los tokens siguen
    // guardados) y se reintenta solo (ver el efecto de `reconnecting`).
    try {
      if (storedAccess) {
        setToken(storedAccess);
        try {
          const me = await api.get<User>("/auth/me", storedAccess, AUTH_TIMEOUT_MS);
          if (sessionEpoch.current !== epoch) return "ok";
          setUser(me);
          return "ok";
        } catch (err) {
          if (isTransientFailure(err)) throw err;
          // Alguien ingresó o cerró la sesión mientras esto esperaba (o la
          // renovación ya la dio por terminada): no se toca nada más.
          if (sessionEpoch.current !== epoch) return "none";
          // Access token vencido/inválido (ApiError): seguimos al refresh.
        }
      }

      const refreshed = await tryRefresh(AUTH_TIMEOUT_MS);
      if (sessionEpoch.current !== epoch) return refreshed ? "ok" : "none";
      if (!refreshed) {
        // Refresh ausente/realmente vencido (no red): a login.
        clearSession();
        setToken(null);
        return "none";
      }
      try {
        const me = await api.get<User>("/auth/me", refreshed, AUTH_TIMEOUT_MS);
        if (sessionEpoch.current !== epoch) return "ok";
        setUser(me);
        return "ok";
      } catch (err) {
        if (isTransientFailure(err)) throw err;
        if (sessionEpoch.current !== epoch) return "none";
        clearSession();
        setToken(null);
        return "none";
      }
    } catch (err) {
      // Backend dormido/caído: no cerramos sesión.
      if (isTransientFailure(err)) return "transient";
      if (sessionEpoch.current !== epoch) return "none";
      // Cualquier otro error inesperado tampoco debe colgar la app.
      clearSession();
      setToken(null);
      return "none";
    }
  }

  useEffect(() => {
    restoreOnce().then((result) => {
      // Servidor dormido al abrir (U114): la app deja de esperar, pero queda
      // dicho que hay una sesión por confirmar. Antes caía a la cabecera de
      // visitante («Ingresar», «Crear cuenta») con la sesión intacta.
      if (result === "transient") setReconnecting(true);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una vez, al abrir la app
  }, []);

  // Mientras no se sabe quién es, se vuelve a probar solo. Con la pestaña
  // oculta no se pide nada: se retoma al volver a verla o al volver la
  // conexión.
  useEffect(() => {
    if (!reconnecting) return;
    let cancelled = false;
    let running = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function schedule() {
      timer = setTimeout(run, RECONNECT_DELAYS_MS[attempt] ?? RECONNECT_STEADY_MS);
    }
    async function run() {
      if (cancelled || running) return;
      if (document.visibilityState !== "visible") return;
      running = true;
      const result = await restoreOnce();
      running = false;
      if (cancelled) return;
      if (result === "transient") {
        attempt += 1;
        schedule();
      } else {
        setReconnecting(false);
      }
    }
    function onWake() {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      void run();
    }

    schedule();
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `restoreOnce` sólo usa setters estables, refs y localStorage
  }, [reconnecting]);

  // Cerrar sesión en una pestaña cierra las otras (U115). La marca de sesión
  // es de todo el navegador; cuando otra pestaña la borra, ésta deja de tener
  // sesión también, sin volver a llamar al servidor (ya lo hizo la otra). Si
  // la otra dejó escrito un motivo, la sesión terminó sola y acá se cuenta
  // igual; si no, fue «Cerrar sesión».
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.storageArea !== localStorage) return;
      const markGone = event.key === null || (event.key === HAS_SESSION_KEY && event.newValue === null);
      if (!markGone || !hasBoundSession()) return;
      const reason = localStorage.getItem(SESSION_END_KEY);
      if (isSessionEndReason(reason)) {
        endSession(reason, { announce: false });
        return;
      }
      sessionEpoch.current += 1;
      clearAllCached();
      impersonatingRef.current = false;
      setImpersonating(null);
      setTwoFactorSetupPending(false);
      setReconnecting(false);
      setJustLoggedOut(true);
      setToken(null);
      setUser(null);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo setters estables, refs y localStorage
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

  // Las notificaciones de este dispositivo son de la cuenta que tiene la
  // sesión abierta acá. Es el único lugar que lo registra, y cubre todos los
  // ingresos (contraseña, Google, invitado, código de admin) y la sesión
  // recuperada al abrir la app. Una vez por sesión: `token` no cambia cuando
  // se renueva. Impersonando no se registra nada (el dispositivo es de la
  // admin, no de la persona que está viendo), y al volver tampoco: su token
  // es el que ya se registró.
  //
  // Tampoco se adelanta a la verificación en dos pasos de la admin
  // (ADR-0023). Con el alta pendiente no se manda: el backend lo rechazaría,
  // y sale solo cuando `adoptSession` abre la sesión verificada (token
  // nuevo). Si todavía no se sabe que está pendiente, sale y el backend lo
  // rechaza sin consecuencias: el pedido no avisa al candado (ver
  // `backgroundApi`), así que al alta, o al login, la lleva el primer pedido
  // de una pantalla y no este.
  const pushClaimedFor = useRef<string | null>(null);
  const hasUser = user !== null;
  useEffect(() => {
    if (!token) {
      pushClaimedFor.current = null;
      return;
    }
    if (!hasUser || impersonating || impersonatingRef.current) return;
    if (twoFactorSetupPending) return;
    if (pushClaimedFor.current === token) return;
    pushClaimedFor.current = token;
    void claimPushForAccount(token);
  }, [token, hasUser, impersonating, twoFactorSetupPending]);

  /** Abre la sesión con los tokens de una respuesta de login. */
  async function startSession(tokens: SessionTokens) {
    sessionEpoch.current += 1;
    setReconnecting(false);
    persistAccessToken(tokens.access_token);
    setToken(tokens.access_token);
    // Fast path: el usuario viene embebido en la respuesta del login → sin un
    // `GET /auth/me` extra (un round-trip menos al backend al entrar). Fallback
    // al /auth/me sólo si no vino `user` — cubre el skew de deploy (frontend
    // nuevo contra backend viejo que todavía no lo embebe) y no rompe el login.
    setUser(tokens.user ?? (await api.get<User>("/auth/me", tokens.access_token)));
  }

  async function login(email: string, password: string): Promise<LoginOutcome> {
    const data = await signIn(() =>
      api.post<SessionTokens | TwoFactorChallenge>("/auth/login", { email, password })
    );
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
      const { challengeToken } = pendingTwoFactor;
      const result = await signIn(() => twoFactorApi.verify(challengeToken, code));
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
    const data = await signIn(() =>
      api.post<
        | { requires_role: true; email: string; full_name: string }
        | { requires_role?: false; access_token: string; user?: User }
        | TwoFactorChallenge
      >("/auth/google", {
        id_token: idToken,
        role,
        // El rol sólo viaja cuando se crea la cuenta, y `GoogleAuthButton` no
        // deja elegirlo sin marcar términos y privacidad.
        accepted_terms: role !== undefined,
      })
    );

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
    const tokens = await signIn(() =>
      api.post<{ access_token: string; user?: User }>("/auth/guest", { pin, role })
    );
    await startSession(tokens);
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
    // Sin sesión, este dispositivo no recibe los avisos de la cuenta: se da
    // de baja en el servidor antes de soltar el token. Va con el vigente (el
    // `token` del contexto es el de cuando se abrió la sesión y pudo haber
    // vencido) y no se espera: si falla, el cierre sigue y el backend le pasa
    // el dispositivo a la próxima cuenta que entre acá. La suscripción del
    // navegador y el permiso no se tocan (ver `claimPushForAccount`). La
    // respuesta llega con la sesión ya cerrada: por eso tampoco avisa al
    // candado de dos pasos (ver `backgroundApi`).
    const leavingToken = resolveToken(token);
    if (leavingToken) releasePushFromAccount(leavingToken).catch(() => {});
    // TECH_DEBT.md S1: el refresh token viaja como cookie httpOnly — el
    // navegador la manda sola (`credentials: "include"`, lib/api.ts), no hay
    // que leerla ni reenviarla a mano. El backend la revoca server-side y la
    // limpia en la respuesta.
    sessionEpoch.current += 1;
    clearSession();
    clearAllCached();
    setJustLoggedOut(true);
    setSessionEnded(null);
    setReconnecting(false);
    setTwoFactorSetupPending(false);
    setToken(null);
    setUser(null);
    // `replace` (no `push`): que "atrás" después de cerrar sesión no vuelva a
    // una pantalla protegida ya renderizada en el historial. Va a la landing
    // y no a "/login" (Julieta, 2026-10-13): desde la app instalada era la
    // única forma de volver a verla; "Ingresar" está en su encabezado.
    router.replace("/");
    // Si quedó una renovación en vuelo, su respuesta trae una cookie nueva y
    // válida: la salida va después, para que el servidor revoque esa y no la
    // anterior (si no, quedaría una sesión viva en este navegador).
    await settleRefresh();
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
        sessionEnded,
        reconnecting,
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
