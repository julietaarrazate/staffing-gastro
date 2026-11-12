"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cuánto tarda la pantalla en "asentarse" después de una acción: el instante
 * en que lo que quedó bajo el dedo todavía no se puede tocar.
 *
 * Un segundo cubre a quien vuelve a tocar porque «no pasó nada» (el segundo
 * toque llega entre medio segundo y un segundo después) y a quien ya venía
 * bajando el dedo cuando la pantalla cambió. Es lo que tarda una persona en
 * leer el botón nuevo, así que a quien toca a propósito no lo frena.
 */
export const TAP_SETTLE_MS = 1000;

export interface TapGuard {
  /**
   * `true` mientras corre una acción o la pantalla se está asentando. Va al
   * `disabled` de los botones que disparan acciones, para que se vea que
   * todavía no se pueden tocar (y un lector de pantalla lo anuncie).
   */
  locked: boolean;
  /**
   * Corre `action` salvo que haya otra en curso o la pantalla se esté
   * asentando; en ese caso no hace nada y resuelve `false`. Cuando `action`
   * termina (bien o con error) empieza el asentamiento. Si `action` falla,
   * el error le llega a quien llamó.
   */
  run: (action: () => void | Promise<void>) => Promise<boolean>;
}

/**
 * Guarda contra el toque que cae en el mismo lugar justo después de una
 * acción.
 *
 * En una lista de tarjetas con el botón siempre en el mismo sitio, cuando
 * una acción termina la lista se redibuja y bajo el dedo queda OTRO botón:
 * el paso siguiente de la misma tarjeta («Cerrar turno» pasa a ser «Marcar
 * como pagado») o el de la tarjeta que subió a ocupar ese lugar. Quien toca
 * dos veces, por apuro o porque la primera tardó, dispara sin querer una
 * acción que no eligió. Deshabilitar los botones sólo mientras la acción
 * está en curso no alcanza: el segundo toque llega cuando ya terminó.
 *
 * Con la guarda, toda acción deja un instante de asentamiento
 * (`TAP_SETTLE_MS`) en el que ninguna otra arranca. Vale igual para las
 * acciones inmediatas que cambian lo que hay en pantalla, como abrir un
 * diálogo de confirmación: su botón de confirmar no acepta el segundo toque
 * de un doble toque.
 *
 * Uso (una guarda por pantalla, compartida por todos sus botones de acción):
 *
 * ```tsx
 * const tapGuard = useTapGuard();
 *
 * function cerrar(id: string) {
 *   return tapGuard.run(async () => {
 *     await api.post(`/shifts/${id}/finish`, undefined, token);
 *     await recargarLista();
 *   });
 * }
 *
 * <Button disabled={tapGuard.locked} onClick={() => cerrar(turno.id)}>Cerrar turno</Button>
 * ```
 *
 * El `disabled` es lo que se ve; lo que decide es `run`, que consulta un
 * `ref` y por eso no depende de que React ya haya repintado el botón.
 *
 * No reemplaza a la confirmación de una acción que no se puede deshacer ni a
 * la idempotencia (`lib/idempotency.ts`, que cubre el mismo pedido repetido):
 * esto cubre el pedido DISTINTO que nadie quiso mandar.
 */
export function useTapGuard(settleMs: number = TAP_SETTLE_MS): TapGuard {
  const [locked, setLocked] = useState(false);
  // La verdad es el ref: `run` lo consulta en el momento del toque. El estado
  // es su copia para pintar.
  const lockedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, []);

  const run = useCallback(
    async (action: () => void | Promise<void>): Promise<boolean> => {
      if (lockedRef.current) return false;
      lockedRef.current = true;
      setLocked(true);
      try {
        await action();
      } finally {
        // Si la pantalla ya no está no hay nada que soltar ni timer que dejar.
        if (mountedRef.current) {
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            lockedRef.current = false;
            setLocked(false);
          }, settleMs);
        }
      }
      return true;
    },
    [settleMs]
  );

  return { locked, run };
}
