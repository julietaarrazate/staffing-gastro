"use client";

import { useEffect, useState } from "react";

/**
 * La hora de ahora, que se actualiza sola cada `cadaMs` (30 s por defecto)
 * mientras `activo`, y al volver a la pestaña. Sirve para lo que cuenta
 * minutos en pantalla («Empezás en 28 min», la cuenta regresiva de
 * «Urgentes»). Con `activo: false` no hay temporizador: la pantalla no se
 * vuelve a dibujar por el reloj. Con la pestaña oculta el temporizador se
 * detiene (no gasta batería ni dibuja) y al volver toma la hora de ese
 * momento y arranca de nuevo.
 */
export function useAhora(activo: boolean, cadaMs = 30_000): Date {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    let id: number | undefined;
    const parar = () => {
      if (id !== undefined) window.clearInterval(id);
      id = undefined;
    };
    const arrancar = () => {
      parar();
      if (activo) id = window.setInterval(() => setAhora(new Date()), cadaMs);
    };
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible") {
        setAhora(new Date());
        arrancar();
      } else {
        parar();
      }
    };
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    // Al activarse (llegaron las postulaciones) se toma la hora de ese momento.
    if (activo) setAhora(new Date());
    if (document.visibilityState !== "hidden") arrancar();
    return () => {
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      parar();
    };
  }, [activo, cadaMs]);
  return ahora;
}
