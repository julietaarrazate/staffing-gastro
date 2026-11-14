import { turnstileHeaders } from "@/lib/turnstile";

// El backend siempre es el servicio remoto en Render. NEXT_PUBLIC_API_URL
// (inyectado en next.config.ts) permite sobrescribirlo si algún día hiciera
// falta apuntar a otro entorno, pero por defecto no hay localhost.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://staffya-backend.onrender.com/api/v1";

export class ApiError extends Error {
  status: number;
  /** Código estable que manda el backend junto al mensaje (`detail.code`),
   * para los errores que la pantalla tiene que distinguir, como los de la
   * verificación en dos pasos (ADR-0023). */
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Tipos de error de validación (422) que el backend define con mensaje propio
 * en castellano: se muestran tal cual. Los genéricos de Pydantic vienen en
 * inglés y quedan en «Error inesperado». */
const OWN_VALIDATION_TYPES = ["zona_requerida"];

/** `detail` del backend: un texto, o `{code, message}` cuando el error trae
 * un código (los 422 de validación son una lista: sólo se lee el mensaje de
 * los tipos propios, el resto queda genérico). */
export function parseErrorDetail(detail: unknown): { message: string; code?: string } {
  if (typeof detail === "string") return { message: detail };
  if (Array.isArray(detail)) {
    for (const item of detail) {
      const { type, msg } = (item ?? {}) as { type?: unknown; msg?: unknown };
      if (typeof type === "string" && OWN_VALIDATION_TYPES.includes(type) && typeof msg === "string") {
        return { message: msg };
      }
    }
  }
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const { message, code } = detail as { message?: unknown; code?: unknown };
    if (typeof message === "string") {
      return { message, code: typeof code === "string" ? code : undefined };
    }
  }
  return { message: "Error inesperado" };
}

// --- Verificación en dos pasos de la admin (ADR-0023) ----------------------
// Una sesión admin sin la verificación recibe 403 con uno de estos códigos en
// cualquier endpoint. `AuthProvider` registra qué hacer (llevar al alta, o
// cerrar la sesión vieja); acá sólo se avisa, venga de la pantalla que venga.
export const TWO_FACTOR_GATE_CODES = ["two_factor_setup_required", "two_factor_required"] as const;
export type TwoFactorGateCode = (typeof TWO_FACTOR_GATE_CODES)[number];
let onTwoFactorGate: ((code: TwoFactorGateCode) => void) | null = null;

export function setTwoFactorGateHandler(handler: ((code: TwoFactorGateCode) => void) | null) {
  onTwoFactorGate = handler;
}

function isGateCode(code: string | undefined): code is TwoFactorGateCode {
  return (TWO_FACTOR_GATE_CODES as readonly string[]).includes(code ?? "");
}

/** Error de red/timeout: el backend no respondió (dormido, caído, sin
 * conexión) — distinto de un ApiError con status HTTP. Se usa para NO
 * cerrar la sesión cuando el problema es que el server no está, no que el
 * token sea inválido. */
export class NetworkError extends Error {}

/** El backend no está disponible por un rato: sin conexión, timeout, o un
 * 5xx/408/429 (Render responde 502-504 mientras arranca en frío). Eso no dice
 * nada de la validez del token, así que nunca debe cerrar la sesión: sólo
 * una respuesta de auth (401/403) la invalida. */
export function isTransientFailure(err: unknown): boolean {
  if (err instanceof NetworkError) return true;
  if (!(err instanceof ApiError)) return false;
  return err.status >= 500 || err.status === 408 || err.status === 429;
}

// --- Token de la sesión: el que ven las pantallas y el que se manda --------
//
// El access token vence a los 15 minutos y `AuthProvider` lo renueva cada 10.
// Antes, cada renovación cambiaba el `token` del contexto, y como unas 30
// pantallas cargan sus datos en un efecto que depende de `[token]`, todas se
// recargaban cada 10 minutos: los formularios de perfil pisaban lo que la
// persona estaba escribiendo, el chat se reconectaba, y "Va en camino" seguía
// mandando con el token viejo (su intervalo lo había capturado) hasta dar 401
// en silencio.
//
// Ahora son dos valores: `sessionToken` identifica la sesión (es el que
// expone el contexto y no cambia al renovar) y `liveToken` es el vigente.
// Una request que trae el token de la sesión sale con el vigente; una que
// trae cualquier otro token (el de una respuesta de login todavía no
// adoptada, el de la admin al empezar a impersonar) sale tal cual.
let sessionToken: string | null = null;
let liveToken: string | null = null;
let renewOnUnauthorized: (() => Promise<string | null>) | null = null;

/** Cómo terminó el intento de renovar: con token nuevo; sin poder saberlo
 * (el servidor no contestó); con un error propio de quien renueva (viendo
 * como otra persona); o rechazado, que es una sesión que ya no existe. */
type RenewOutcome =
  | { kind: "renewed" }
  | { kind: "transient" }
  | { kind: "error"; error: ApiError }
  | { kind: "ended" };
let renewing: Promise<RenewOutcome> | null = null;

/** Código de un 401 con la sesión terminada: nunca se muestra «No
 * autorizado» (U112). `AuthProvider` ya dejó el contexto sin sesión y la
 * pantalla protegida lleva al ingreso; este texto es lo que alcanza a verse
 * mientras tanto. */
export const SESSION_EXPIRED_CODE = "session_expired";
export const SESSION_EXPIRED_MESSAGE = "Tu sesión venció. Volvé a ingresar.";
/** El backend lo manda en el 403 de una cuenta suspendida (lo suma G6; hasta
 * entonces una cuenta suspendida se trata como sesión vencida). */
export const ACCOUNT_SUSPENDED_CODE = "account_suspended";

/** Arranca (o termina, con `null`) una sesión: login, logout, impersonar. */
export function bindSessionToken(token: string | null) {
  sessionToken = token;
  liveToken = token;
}

/** Renovación del access token de la sesión en curso: no cambia su identidad. */
export function renewSessionToken(token: string) {
  liveToken = token;
}

export function hasBoundSession(): boolean {
  return sessionToken !== null;
}

/** El token con el que hay que salir de verdad (para quien no pasa por
 * `request`, como el WebSocket). */
export function resolveToken(token: string | null | undefined): string | null {
  if (!token) return null;
  return token === sessionToken && liveToken ? liveToken : token;
}

/** Cómo renovar ante un 401 (lo registra `AuthProvider`). Devuelve el token
 * nuevo, o `null` si la sesión ya no existe (refresh vencido o revocado).
 * Si el servidor no contestó, tira ese error (no se sabe nada de la sesión);
 * si tira un `ApiError`, es el que recibe la pantalla. */
export function setUnauthorizedHandler(handler: (() => Promise<string | null>) | null) {
  renewOnUnauthorized = handler;
}

/** Una sola renovación a la vez: diez requests que reciben 401 juntas (la
 * PWA que vuelve de estar suspendida) comparten el mismo refresh. */
function renewOnce(handler: () => Promise<string | null>): Promise<RenewOutcome> {
  if (!renewing) {
    renewing = handler()
      .then(
        (fresh): RenewOutcome => (fresh ? { kind: "renewed" } : { kind: "ended" }),
        (err): RenewOutcome => {
          if (isTransientFailure(err)) return { kind: "transient" };
          if (err instanceof ApiError) return { kind: "error", error: err };
          return { kind: "ended" };
        }
      )
      .finally(() => {
        renewing = null;
      });
  }
  return renewing;
}

async function request<T>(
  path: string,
  options: RequestInit & {
    token?: string | null;
    timeoutMs?: number;
    idempotencyKey?: string;
    /** Interno: ya se reintentó una vez tras un 401. */
    retried?: boolean;
    /** No avisar a `onTwoFactorGate` (ver `backgroundApi`). */
    skipTwoFactorGate?: boolean;
  } = {}
): Promise<T> {
  const {
    token: requested,
    headers,
    timeoutMs,
    idempotencyKey,
    retried,
    skipTwoFactorGate,
    ...rest
  } = options;
  const token = resolveToken(requested);

  // Timeout opcional vía AbortController: sin esto, un backend dormido
  // (cold start de Render) cuelga el fetch indefinidamente. Sólo se aplica
  // cuando el caller pide `timeoutMs` (p. ej. el chequeo de sesión al abrir).
  const controller = timeoutMs != null ? new AbortController() : undefined;
  const timer =
    controller != null ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      signal: controller?.signal,
      // TECH_DEBT.md S1: el refresh token viaja como cookie httpOnly, no en
      // el body — sin esto el navegador no la manda ni la guarda (backend y
      // frontend son sitios distintos en producción, Render/Vercel).
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        // Idempotencia (product/IDEMPOTENCIA_SPEC.md): el llamador genera un
        // UUID por intento de mutación y lo reusa al reintentar (mismo
        // intento = misma key), para que un doble-tap o un reintento de red
        // no dupliquen la acción del lado del backend.
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        // Turnstile (anti-robots) sólo en login y registro; ver lib/turnstile.ts.
        ...turnstileHeaders(path),
        ...headers,
      },
    });
  } catch (err) {
    throw new NetworkError(
      err instanceof Error && err.name === "AbortError"
        ? "El servidor tardó demasiado en responder."
        : "No se pudo conectar con el servidor."
    );
  } finally {
    if (timer != null) clearTimeout(timer);
  }

  // El access token venció (la app estuvo suspendida más de 15 minutos, o
  // el timer de renovación no llegó a correr): se renueva una vez y se
  // reintenta, en vez de mostrar "Not authenticated" hasta el próximo tick.
  // Sólo para el token de la sesión: uno ajeno no se renueva desde acá.
  if (
    res.status === 401 &&
    !retried &&
    requested &&
    requested === sessionToken &&
    renewOnUnauthorized
  ) {
    const outcome = await renewOnce(renewOnUnauthorized);
    if (outcome.kind === "renewed") {
      return request<T>(path, { ...options, retried: true });
    }
    // No se pudo renovar. Lo que nunca sale es el «No autorizado» del
    // servidor: o no hay conexión (y la sesión sigue), o la sesión terminó.
    if (outcome.kind === "transient") {
      throw new NetworkError("No se pudo conectar con el servidor.");
    }
    if (outcome.kind === "error") throw outcome.error;
    throw new ApiError(401, SESSION_EXPIRED_MESSAGE, SESSION_EXPIRED_CODE);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const { message, code } = parseErrorDetail(body?.detail ?? res.statusText);
    if (res.status === 403 && isGateCode(code) && !skipTwoFactorGate) onTwoFactorGate?.(code);
    throw new ApiError(res.status, message, code);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, token?: string | null, timeoutMs?: number) =>
    request<T>(path, { method: "GET", token, timeoutMs }),
  post: <T>(
    path: string,
    body?: unknown,
    token?: string | null,
    timeoutMs?: number,
    idempotencyKey?: string
  ) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
      token,
      timeoutMs,
      idempotencyKey,
    }),
  put: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined, token }),
  patch: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined, token }),
  del: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: "DELETE", body: body ? JSON.stringify(body) : undefined, token }),
};

/** Pedidos que la app hace por su cuenta, sin que una pantalla los pida. Hoy
 * son dos: registrar y dar de baja el push al abrir y cerrar la sesión
 * (`lib/push.ts`). Salen igual que cualquier otro, con una diferencia: si el
 * backend los frena con el candado de dos pasos de la admin, el error le
 * llega a quien llamó pero NO se avisa a `onTwoFactorGate`. Un pedido que la
 * persona no hizo no puede llevarla al alta ni cerrarle la sesión antes de
 * que una pantalla pida algo, y el de la baja contesta cuando la sesión ya se
 * cerró (mandaba al alta, o al login, a alguien que acababa de salir). */
export const backgroundApi = {
  post: <T>(path: string, body: unknown, token: string) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      token,
      skipTwoFactorGate: true,
    }),
  del: <T>(path: string, body: unknown, token: string) =>
    request<T>(path, {
      method: "DELETE",
      body: JSON.stringify(body),
      token,
      skipTwoFactorGate: true,
    }),
};
