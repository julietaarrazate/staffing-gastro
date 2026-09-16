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

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AvailableNowStatus } from "@/lib/types";
import { getCurrentPosition } from "@/lib/geolocation";

export interface AvailableNow {
  /** `true` mientras sigue vigente (según el backend, no un timer local). */
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

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api
      .get<AvailableNowStatus>("/workers/me/available-now", token)
      .then((result) => {
        if (!cancelled) setStatus(result);
      })
      .catch(() => {
        // Sin perfil todavía, o backend caído: se queda apagado por
        // default — no bloquea el resto de la pantalla por esto.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const start = useCallback(async () => {
    if (!token) return;
    setError(null);
    setLoading(true);
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
