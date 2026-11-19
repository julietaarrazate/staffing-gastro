"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, ApiError, resolveToken } from "@/lib/api";

const HTTP_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://staffya-backend.onrender.com/api/v1";
const WS_BASE_URL = HTTP_API_URL.replace(/^http/, "ws");

const MAX_RETRY_DELAY_MS = 15_000;
/** Una conexión que vivió menos que esto no cuenta como «estable»: si el
 *  servidor acepta y cierra enseguida (tope de conexiones por usuario, límite
 *  de frames), el backoff sigue creciendo en vez de volver a ~1 s. */
export const WS_STABLE_AFTER_MS = 5_000;

/** ¿El access token ya venció (o vence en segundos)? Un token que no se puede
 *  leer cuenta como vigente: el servidor decide. */
export function tokenVencido(jwt: string, ahoraMs = Date.now()): boolean {
  try {
    const payload = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp * 1000 <= ahoraMs + 5_000;
  } catch {
    return false;
  }
}

export type WebSocketStatus = "connecting" | "open" | "closed";

/**
 * Conecta un WebSocket al backend con reconexión automática (backoff exponencial)
 * y entrega cada mensaje JSON recibido a `onMessage`. El token viaja como query
 * param porque un WebSocket de navegador no puede llevar header Authorization.
 *
 * Expone `status` para que la UI pueda avisar de forma discreta cuando la
 * conexión se cae y se está reintentando, y acepta `onOpen` para que el
 * consumidor pueda reaccionar a cada apertura (incluidas las reconexiones,
 * típicamente para recargar por HTTP lo que se pudo haber perdido mientras
 * el socket estaba caído).
 */
export function useWebSocket<T>(
  path: string | null,
  token: string | null,
  onMessage: (data: T) => void,
  onOpen?: () => void
): { status: WebSocketStatus } {
  // Mutar el ref en el cuerpo del render (en vez de en un efecto) hacía que
  // React lo marque como acceso inseguro (`react-hooks/refs`, TECH_DEBT.md
  // T5): con `useLayoutEffect` el ref queda actualizado antes del próximo
  // paint, sin cambiar el comportamiento (sigue siempre "al día" para el
  // efecto de conexión de abajo, que nunca se re-crea por esto).
  const onMessageRef = useRef(onMessage);
  useLayoutEffect(() => {
    onMessageRef.current = onMessage;
  });
  const onOpenRef = useRef(onOpen);
  useLayoutEffect(() => {
    onOpenRef.current = onOpen;
  });

  const [status, setStatus] = useState<WebSocketStatus>("connecting");

  useEffect(() => {
    if (!path || !token) {
      setStatus("closed");
      return;
    }

    let socket: WebSocket | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let closedByCleanup = false;
    let attempt = 0;
    let openedAt: number | null = null;
    // La conexión anterior cerró sin llegar a abrir o sin durar: puede ser un
    // token vencido que el reloj del cliente no ve (reloj atrasado). El próximo
    // intento renueva igual.
    let renewNext = false;

    async function connect() {
      setStatus("connecting");
      // `resolveToken`: cada (re)conexión sale con el access token vigente,
      // no con el que había al montar (el contexto ya no cambia al renovarlo,
      // ver `lib/api.ts`); sin esto, reconectar después de 15 min fallaba.
      let current = resolveToken(token) ?? token!;
      if (renewNext || tokenVencido(current)) {
        renewNext = false;
        // El servidor corta el socket (1008) cuando vence el token con el que
        // se conectó (PRI-04), y el access token sólo se renueva con un pedido
        // HTTP: sin esto, reconectar con el vencido sería rechazado en cada
        // intento hasta que alguna pantalla pidiera algo. Un pedido liviano
        // dispara la renovación; si falla, se intenta igual y el backoff sigue.
        try {
          await api.get("/auth/me", token);
        } catch (err) {
          if (closedByCleanup) return;
          if (err instanceof ApiError && err.status === 401) {
            // La sesión terminó de verdad (el refresh también falló): no hay
            // token con el que reconectar, y seguir pidiendo no sirve.
            setStatus("closed");
            return;
          }
          // Sin red u otro error: se intenta igual y el backoff sigue.
        }
        if (closedByCleanup) return;
        current = resolveToken(token) ?? token!;
      }
      socket = new WebSocket(`${WS_BASE_URL}${path}?token=${encodeURIComponent(current)}`);

      socket.onopen = () => {
        // El backoff NO se reinicia acá sino al cerrarse, y sólo si la
        // conexión duró (ver `WS_STABLE_AFTER_MS`).
        openedAt = Date.now();
        setStatus("open");
        onOpenRef.current?.();
      };

      socket.onmessage = (event) => {
        try {
          onMessageRef.current(JSON.parse(event.data) as T);
        } catch {
          // Frame inválido: lo ignoramos.
        }
      };

      socket.onclose = () => {
        if (closedByCleanup) return;
        setStatus("closed");
        const estable = openedAt !== null && Date.now() - openedAt >= WS_STABLE_AFTER_MS;
        if (estable) attempt = 0;
        renewNext = !estable;
        openedAt = null;
        const delay = Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS);
        attempt += 1;
        retryTimeout = setTimeout(() => void connect(), delay);
      };

      socket.onerror = () => socket?.close();
    }

    void connect();

    return () => {
      closedByCleanup = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      socket?.close();
    };
  }, [path, token]);

  return { status };
}
