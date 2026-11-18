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
 * - **Apagar es apagar también para el comercio (U072).** «Dejar de
 *   compartir» no sólo deja de mandar posiciones: le pide al servidor que
 *   borre la última (`DELETE /shifts/{id}/en-route`), así el comercio deja de
 *   verla. Sólo se da por borrada cuando el servidor lo confirma: si el
 *   pedido no sale (sin red, el servidor ocupado) se reintenta solo unas
 *   veces y, si no, se dice. La persona no puede quedarse creyendo que ya no
 *   la ven. El borrado espera al reporte que esté en la red, y un reporte que
 *   todavía esperaba el GPS ya no sale: si no, llegaría después del borrado y
 *   volvería a guardar la posición. Salir de la pantalla sin apagar sólo deja
 *   de mandar: la última posición queda, con su hora, hasta la llegada o
 *   hasta que se borre desde acá (`clearLast`).
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

/** Fallos seguidos antes de avisar que la ubicación no está llegando. */
const FAILURES_BEFORE_WARNING = 3;

/** Reintentos del pedido de borrado si no sale, y cada cuánto. */
const STOP_RETRIES = 4;
const STOP_RETRY_MS = 4_000;

export const STOP_FAILED_MESSAGE =
  "No pudimos borrar tu última ubicación: el comercio todavía la ve. Revisá tu conexión y tocá «Borrar mi última ubicación».";

/**
 * ¿El servidor dijo que seguir no tiene sentido? Un 4xx (el turno ya no está
 * en viaje, se salió de la ventana, ya no es suyo). Un choque con otra
 * escritura (409), el límite de pedidos (429) o un error del servidor (5xx)
 * son pasajeros: se reintentan como una falla de red.
 */
function isDefinitive(err: unknown): err is ApiError {
  return (
    err instanceof ApiError &&
    err.status >= 400 &&
    err.status < 500 &&
    err.status !== 409 &&
    err.status !== 429
  );
}

export interface EnRouteSharing {
  /** `true` mientras se está compartiendo la posición. */
  sharing: boolean;
  /** Mensaje si el navegador negó el permiso o falló el envío. */
  error: string | null;
  /** `true` mientras se resuelve el primer envío (feedback del botón). */
  starting: boolean;
  start: () => Promise<void>;
  /** Deja de compartir y borra la última posición en el servidor. */
  stop: () => void;
  /** Borra la última posición en el servidor (sin estar compartiendo acá). */
  clearLast: () => void;
  /** `true` mientras el pedido de borrado está saliendo o reintentando. */
  clearing: boolean;
  /** `true` desde que el servidor confirmó que ya no guarda una posición. */
  cleared: boolean;
  /**
   * `true` si desde esta pantalla se mandó una posición que el servidor
   * todavía puede estar guardando: se compartió y el borrado no se confirmó.
   */
  mayBeVisible: boolean;
}

export function useEnRouteSharing(
  shiftId: string,
  token: string | null
): EnRouteSharing {
  const [sharing, setSharing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [mayBeVisible, setMayBeVisible] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ¿Se sigue compartiendo? Lo miran los reportes que ya arrancaron: uno que
  // estaba esperando el GPS cuando la persona apagó no llega a mandarse.
  const activeRef = useRef(false);
  // El reporte que está en la red ahora mismo, si hay uno. El borrado lo
  // espera: si saliera antes, ese reporte llegaría después y volvería a
  // guardar la posición sin que nadie lo sepa (revisión del 2026-11-18).
  const inFlightRef = useRef<Promise<unknown> | null>(null);
  // Cada borrado pedido invalida al anterior (y lo invalida volver a prender).
  const clearRunRef = useRef(0);
  const mountedRef = useRef(true);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancelClear = useCallback(() => {
    clearRunRef.current += 1;
    if (stopRetryRef.current !== null) {
      clearTimeout(stopRetryRef.current);
      stopRetryRef.current = null;
    }
  }, []);

  /**
   * Pide al servidor que borre la última posición. Sólo se da por borrada
   * cuando el servidor lo confirma (200) o dice que el turno ya no es de esta
   * persona (404). Cualquier otra cosa (sin red, 409, 429, 5xx, sesión
   * vencida) se reintenta y, si no sale, se avisa: la posición sigue ahí.
   */
  const clearLast = useCallback(() => {
    if (!token) return;
    cancelClear();
    const run = clearRunRef.current;
    const current = () => run === clearRunRef.current;
    const set = (fn: () => void) => {
      if (mountedRef.current && current()) fn();
    };
    set(() => {
      setClearing(true);
      setError(null);
    });
    let attempt = 0;
    const send = async () => {
      // Primero que termine el reporte que ya estaba en la red.
      await inFlightRef.current?.catch(() => {});
      if (!current()) return;
      attempt += 1;
      try {
        await api.del(`/shifts/${shiftId}/en-route`, undefined, token);
      } catch (err) {
        if (!current()) return;
        if (!(err instanceof ApiError && err.status === 404)) {
          if (attempt <= STOP_RETRIES) {
            stopRetryRef.current = setTimeout(send, STOP_RETRY_MS);
          } else {
            set(() => {
              setClearing(false);
              setMayBeVisible(true);
              setError(STOP_FAILED_MESSAGE);
            });
          }
          return;
        }
      }
      set(() => {
        setClearing(false);
        setCleared(true);
        setMayBeVisible(false);
        setError(null);
      });
    };
    void send();
  }, [shiftId, token, cancelClear]);

  const stop = useCallback(() => {
    activeRef.current = false;
    clearTimer();
    setSharing(false);
    clearLast();
  }, [clearTimer, clearLast]);

  /** Manda la posición de ahora. Devuelve `false` si ya se había apagado. */
  const report = useCallback(async (): Promise<boolean> => {
    if (!token) return false;
    const position = await getCurrentPosition();
    // Se apagó mientras el GPS contestaba: este reporte ya no sale.
    if (!activeRef.current) return false;
    const sent = api.post(
      `/shifts/${shiftId}/en-route`,
      { latitude: position.latitude, longitude: position.longitude },
      token
    );
    inFlightRef.current = sent;
    try {
      await sent;
    } finally {
      if (inFlightRef.current === sent) inFlightRef.current = null;
    }
    if (mountedRef.current) setMayBeVisible(true);
    return true;
  }, [shiftId, token]);

  const start = useCallback(async () => {
    if (!token) return;
    setError(null);
    setStarting(true);
    // Vuelve a compartir: un borrado que todavía estaba reintentando ya no va.
    cancelClear();
    setClearing(false);
    setCleared(false);
    activeRef.current = true;
    try {
      // El primer envío va antes de arrancar el intervalo: si el permiso está
      // denegado o el backend rechaza (fuera de ventana, turno ya no
      // confirmado), se ve el error de una en vez de quedar "compartiendo" sin
      // que llegue nada.
      if (!(await report())) return;
      setSharing(true);
      clearTimer();
      let failures = 0;
      timerRef.current = setInterval(() => {
        report()
          .then((sent) => {
            if (!sent) return;
            failures = 0;
            setError(null);
          })
          .catch((err) => {
            if (!activeRef.current) return;
            // El backend rechazó (el turno ya no está en viaje, se salió de la
            // ventana): seguir mandando no tiene sentido. Se corta y se dice.
            // La última posición que se mandó puede seguir guardada: la
            // tarjeta ofrece borrarla (`mayBeVisible`).
            if (isDefinitive(err)) {
              activeRef.current = false;
              clearTimer();
              setSharing(false);
              setError(err.message);
              return;
            }
            // Un fallo suelto (túnel, señal perdida, el servidor ocupado) no
            // corta el viaje: el próximo tick reintenta. Varios seguidos sí se
            // avisan — antes la pantalla seguía diciendo "compartiendo" sin
            // que llegara nada.
            failures += 1;
            if (failures >= FAILURES_BEFORE_WARNING) {
              setError("No pudimos enviar tu ubicación hace unos minutos. Seguimos intentando.");
            }
          });
      }, REPORT_INTERVAL_MS);
    } catch (err) {
      activeRef.current = false;
      setSharing(false);
      setError(err instanceof Error ? err.message : "No se pudo compartir tu ubicación");
    } finally {
      setStarting(false);
    }
  }, [token, report, clearTimer, cancelClear]);

  // Al desmontar deja de reportar. Sin esto, salir de la pantalla dejaría el
  // intervalo vivo mandando la posición desde cualquier otra parte de la app.
  // Un borrado que la persona pidió y todavía está reintentando NO se cancela:
  // sigue hasta salir, aunque ya no haya pantalla que lo muestre.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeRef.current = false;
      clearTimer();
    };
  }, [clearTimer]);

  return { sharing, error, starting, start, stop, clearLast, clearing, cleared, mayBeVisible };
}
