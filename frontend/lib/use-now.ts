"use client";

import { useEffect, useState } from "react";

/**
 * La hora actual en ms, releída cada `intervalMs` mientras la pestaña está a
 * la vista. Con la pestaña oculta no re-renderiza nada (un reloj que nadie ve
 * no tiene por qué dibujar la pantalla); al volver a verla se actualiza en el
 * acto, así que lo que se ve nunca queda más viejo que antes.
 * `enabled: false` apaga el reloj (queda con la hora de la última lectura).
 */
export function useNow(intervalMs: number, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState === "visible") setNow((prev) => (Date.now() - prev < 1000 ? prev : Date.now()));
    };
    // Al prenderse (o cambiar el intervalo) se relee ya: la hora guardada puede
    // venir de mucho antes.
    tick();
    const id = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [intervalMs, enabled]);
  return now;
}
