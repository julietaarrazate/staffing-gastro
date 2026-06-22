"use client";

import { useEffect, useRef } from "react";

const HTTP_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://staffya-backend.onrender.com/api/v1";
const WS_BASE_URL = HTTP_API_URL.replace(/^http/, "ws");

const MAX_RETRY_DELAY_MS = 15_000;

/**
 * Conecta un WebSocket al backend con reconexión automática (backoff exponencial)
 * y entrega cada mensaje JSON recibido a `onMessage`. El token viaja como query
 * param porque un WebSocket de navegador no puede llevar header Authorization.
 */
export function useWebSocket<T>(
  path: string | null,
  token: string | null,
  onMessage: (data: T) => void
) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!path || !token) return;

    let socket: WebSocket | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let closedByCleanup = false;
    let attempt = 0;

    function connect() {
      socket = new WebSocket(`${WS_BASE_URL}${path}?token=${encodeURIComponent(token!)}`);

      socket.onmessage = (event) => {
        try {
          onMessageRef.current(JSON.parse(event.data) as T);
        } catch {
          // Frame inválido: lo ignoramos.
        }
      };

      socket.onclose = () => {
        if (closedByCleanup) return;
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
}
