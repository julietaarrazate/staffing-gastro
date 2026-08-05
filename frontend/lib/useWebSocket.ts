"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const HTTP_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://staffya-backend.onrender.com/api/v1";
const WS_BASE_URL = HTTP_API_URL.replace(/^http/, "ws");

const MAX_RETRY_DELAY_MS = 15_000;

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

    function connect() {
      setStatus("connecting");
      socket = new WebSocket(`${WS_BASE_URL}${path}?token=${encodeURIComponent(token!)}`);

      socket.onopen = () => {
        attempt = 0;
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
        const delay = Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS);
        attempt += 1;
        retryTimeout = setTimeout(connect, delay);
      };

      socket.onerror = () => socket?.close();
    }

    connect();

    return () => {
      closedByCleanup = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      socket?.close();
    };
  }, [path, token]);

  return { status };
}
