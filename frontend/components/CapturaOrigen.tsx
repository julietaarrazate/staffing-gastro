"use client";

import { useEffect } from "react";
import { capturarOrigen } from "@/lib/origen-alta";

/**
 * Guarda de qué enlace llegó la persona (`?ref=`, `utm_*`) al abrir la app,
 * para mandarlo cuando cree su cuenta (`lib/origen-alta.ts`). Va en el layout
 * raíz: corre una vez, con la URL de entrada, sea la página que sea.
 */
export default function CapturaOrigen() {
  useEffect(() => {
    capturarOrigen(window.location.search);
  }, []);
  return null;
}
