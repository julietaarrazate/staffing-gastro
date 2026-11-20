"use client";

import { useEffect, useState } from "react";

/**
 * La hora de ahora, que se actualiza sola cada `cadaMs` (30 s por defecto)
 * mientras `activo`, y al volver a la pestaña. Sirve para lo que cuenta
 * minutos en pantalla («Empezás en 28 min»). Con `activo: false` no hay
 * temporizador: la pantalla no se vuelve a dibujar por el reloj.
 */
export function useAhora(activo: boolean, cadaMs = 30_000): Date {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === "visible") setAhora(new Date());
    };
    document.addEventListener("visibilitychange", alVolver);
    // Al activarse (llegaron las postulaciones) se toma la hora de ese momento.
    if (activo) setAhora(new Date());
    const id = activo ? window.setInterval(() => setAhora(new Date()), cadaMs) : undefined;
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      if (id !== undefined) window.clearInterval(id);
    };
  }, [activo, cadaMs]);
  return ahora;
}
