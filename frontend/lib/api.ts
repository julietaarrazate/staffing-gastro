// El backend siempre es el servicio remoto en Render. NEXT_PUBLIC_API_URL
// (inyectado en next.config.ts) permite sobrescribirlo si algún día hiciera
// falta apuntar a otro entorno, pero por defecto no hay localhost.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://staffya-backend.onrender.com/api/v1";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Error de red/timeout: el backend no respondió (dormido, caído, sin
 * conexión) — distinto de un ApiError con status HTTP. Se usa para NO
 * cerrar la sesión cuando el problema es que el server no está, no que el
 * token sea inválido. */
export class NetworkError extends Error {}

async function request<T>(
  path: string,
  options: RequestInit & {
    token?: string | null;
    timeoutMs?: number;
    idempotencyKey?: string;
  } = {}
): Promise<T> {
  const { token, headers, timeoutMs, idempotencyKey, ...rest } = options;

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

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail ?? res.statusText;
    throw new ApiError(res.status, typeof detail === "string" ? detail : "Error inesperado");
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
