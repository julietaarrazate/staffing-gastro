"use client";

/**
 * "Va en camino": el trabajador comparte dónde está mientras viaja a un turno
 * confirmado, para que el comercio vea que está llegando.
 *
 * Reglas de diseño, y por qué:
 *
 * - **Se activa a mano, nunca solo.** Compartir la propia ubicación es una
 *   decisión de la persona, no un efecto colateral de aceptar un turno. El hook
 *   arranca apagado y sólo empieza cuando alguien toca el botón.
 * - **Se apaga a mano, y también solo.** Además del botón, se corta al
 *   desmontar y cuando el turno deja de estar "en viaje" — nada queda
 *   reportando de fondo si el usuario navega a otra pantalla.
 * - **No se recuerda entre sesiones.** No hay `localStorage` acá a propósito:
 *   si la persona cierra la app, deja de compartir. Un consentimiento que
 *   sobrevive a que cierres la app es un consentimiento que la gente olvida
 *   que dio.
 * - **Intervalo largo (60s).** Alcanza de sobra para "está llegando" y gasta
 *   mucho menos batería que un `watchPosition` continuo, que en un viaje de
 *   40 minutos se nota. El comercio no necesita precisión de segundos.
 *
 * El backend tiene sus propios guards (estado del turno, ventana de 2h, sólo
 * el trabajador asignado) — ver `Shift.report_en_route_location`. Éste es el
 * lado de la persona: que sepa que está compartiendo y pueda dejar de hacerlo.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { getCurrentPosition } from "@/lib/geolocation";

/** Cada cuánto se manda la posición mientras dura el viaje. */
const REPORT_INTERVAL_MS = 60_000;

/** Fallos de red seguidos antes de avisar que la ubicación no está llegando. */
const FAILURES_BEFORE_WARNING = 3;

export interface EnRouteSharing {
  /** `true` mientras se está compartiendo la posición. */
  sharing: boolean;
  /** Mensaje si el navegador negó el permiso o falló el envío. */
  error: string | null;
  /** `true` mientras se resuelve el primer envío (feedback del botón). */
  starting: boolean;
  start: () => Promise<void>;
  stop: () => void;
}

export function useEnRouteSharing(
  shiftId: string,
  token: string | null
): EnRouteSharing {
  const [sharing, setSharing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    setSharing(false);
  }, [clearTimer]);

  const report = useCallback(async () => {
    if (!token) return;
    const position = await getCurrentPosition();
    await api.post(
      `/shifts/${shiftId}/en-route`,
      { latitude: position.latitude, longitude: position.longitude },
      token
    );
  }, [shiftId, token]);

  const start = useCallback(async () => {
    if (!token) return;
    setError(null);
    setStarting(true);
    try {
      // El primer envío va antes de arrancar el intervalo: si el permiso está
      // denegado o el backend rechaza (fuera de ventana, turno ya no
      // confirmado), se ve el error de una en vez de quedar "compartiendo" sin
      // que llegue nada.
      await report();
      setSharing(true);
      clearTimer();
      let failures = 0;
      timerRef.current = setInterval(() => {
        report()
          .then(() => {
            failures = 0;
            setError(null);
          })
          .catch((err) => {
            // El backend rechazó (el turno ya no está en viaje, se salió de la
            // ventana): seguir mandando no tiene sentido. Se corta y se dice.
            if (err instanceof ApiError) {
              clearTimer();
              setSharing(false);
              setError(err.message);
              return;
            }
            // Un fallo de red suelto (túnel, señal perdida) no corta el viaje:
            // el próximo tick reintenta. Varios seguidos sí se avisan — antes
            // la pantalla seguía diciendo "compartiendo" sin que llegara nada.
            failures += 1;
            if (failures >= FAILURES_BEFORE_WARNING) {
              setError("No pudimos enviar tu ubicación hace unos minutos. Seguimos intentando.");
            }
          });
      }, REPORT_INTERVAL_MS);
    } catch (err) {
      setSharing(false);
      setError(err instanceof Error ? err.message : "No se pudo compartir tu ubicación");
    } finally {
      setStarting(false);
    }
  }, [token, report, clearTimer]);

  // Al desmontar deja de reportar. Sin esto, salir de la pantalla dejaría el
  // intervalo vivo mandando la posición desde cualquier otra parte de la app.
  useEffect(() => clearTimer, [clearTimer]);

  return { sharing, error, starting, start, stop };
}
