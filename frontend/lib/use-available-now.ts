"use client";

/**
 * "Disponible ahora" (ADR-0014): el trabajador prende su posición real por
 * una ventana corta (`AVAILABLE_NOW_TTL`, 4h en el backend), para que el
 * comercio mida la distancia desde dónde está buscando AHORA y no desde su
 * domicilio.
 *
 * Distinto de `useEnRouteSharing` ("va en camino") en lo esencial:
 * - **Una sola captura, no seguimiento.** `start()` pide la posición UNA
 *   vez y la manda — nunca un intervalo. Julieta y el ADR fueron explícitos:
 *   seguir la posición de alguien que todavía no está trabajando es
 *   vigilancia, no el producto.
 * - **Persiste entre sesiones.** "Va en camino" se apaga solo al desmontar
 *   la pantalla; acá el estado vive en el backend (`available_now_until`) y
 *   sobrevive a cerrar la app — por eso el hook arranca leyendo el estado
 *   real (`GET`), no en `false` a ciegas.
 *
 * El backend tiene sus propios guards (TTL, `is_available`) — ver
 * `WorkerProfile.go_available_now`. Éste es el lado de la persona: que sepa
 * hasta cuándo sigue prendido y pueda apagarlo.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { AvailableNowStatus } from "@/lib/types";
import { getCurrentPosition } from "@/lib/geolocation";

export interface AvailableNow {
  /**
   * `true` mientras sigue vigente: lo que dijo el backend, apagado por un reloj
   * local al llegar `until` (si la pantalla queda abierta, el servidor ya lo
   * apagó) y releído al volver a primer plano.
   */
  active: boolean;
  /** ISO de cuándo vence, para mostrar "hasta las 22:30". */
  until: string | null;
  /** `true` mientras se resuelve la carga inicial o una acción. */
  loading: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function useAvailableNow(token: string | null): AvailableNow {
  const [status, setStatus] = useState<AvailableNowStatus>({ active: false, until: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Último pedido gana: una lectura vieja no pisa a una acción más nueva.
  const latestRead = useRef(0);
  const readStatus = useCallback(async () => {
    if (!token) return;
    const mine = ++latestRead.current;
    try {
      const result = await api.get<AvailableNowStatus>("/workers/me/available-now", token);
      if (mine === latestRead.current) setStatus(result);
    } catch {
      // Sin perfil todavía, o backend caído: se deja lo que ya se veía (o
      // apagado, al montar) — no bloquea el resto de la pantalla por esto.
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void readStatus().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token, readStatus]);

  // Reloj local: al llegar `until` se apaga solo, sin esperar a un pedido.
  const until = status.active ? status.until : null;
  useEffect(() => {
    if (!until) return;
    const expiresAt = Date.parse(until);
    if (Number.isNaN(expiresAt)) return;
    const turnOff = () => setStatus((prev) => (prev.until === until ? { active: false, until: null } : prev));
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      turnOff();
      return;
    }
    const timer = setTimeout(turnOff, remaining);
    return () => clearTimeout(timer);
  }, [until]);

  // Al volver a primer plano: los timers de una pestaña oculta se frenan (o la
  // PWA estuvo suspendida) y el servidor pudo haberlo apagado o prendido desde
  // otro lado. Se compara con la hora y se vuelve a pedir el estado real.
  useEffect(() => {
    if (!token) return;
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      setStatus((prev) =>
        prev.until && Date.parse(prev.until) <= Date.now() ? { active: false, until: null } : prev
      );
      void readStatus();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [token, readStatus]);

  const start = useCallback(async () => {
    if (!token) return;
    setError(null);
    setLoading(true);
    latestRead.current += 1;
    try {
      const position = await getCurrentPosition();
      const result = await api.post<AvailableNowStatus>(
        "/workers/me/available-now",
        { latitude: position.latitude, longitude: position.longitude },
        token
      );
      setStatus(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo activar");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const stop = useCallback(async () => {
    if (!token) return;
    setError(null);
    setLoading(true);
    latestRead.current += 1;
    try {
      await api.del("/workers/me/available-now", undefined, token);
      setStatus({ active: false, until: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desactivar");
    } finally {
      setLoading(false);
    }
  }, [token]);

  return { active: status.active, until: status.until, loading, error, start, stop };
}
