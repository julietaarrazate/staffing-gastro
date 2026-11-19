"use client";

import { useEffect } from "react";
import { precargarTurnstile } from "@/lib/turnstile";

const ENLACE_DE_INGRESO = 'a[href^="/login"], a[href^="/register"]';
const SEÑALES = ["pointerover", "pointerdown", "focusin"] as const;

/**
 * Baja de antemano el script de la verificación anti-robots (Turnstile), así
 * el tilde ya está en camino cuando se abre «Entrar» o «Crear cuenta»: apenas
 * la persona apunta, toca o enfoca uno de esos links, o cuando la landing ya
 * cargó y el navegador quedó libre. Sólo baja `api.js` (sin verificación ni
 * cookies; Cloudflare ya sirve la app). Medido el 2026-11-19 en
 * docs/reference/RENDIMIENTO.md. No dibuja nada.
 */
export default function PrecargaIngreso() {
  useEffect(() => {
    const alApuntar = (e: Event) => {
      if (!(e.target instanceof Element) || !e.target.closest(ENLACE_DE_INGRESO)) return;
      precargarTurnstile();
      dejar();
    };
    const dejar = () => SEÑALES.forEach((s) => document.removeEventListener(s, alApuntar, true));
    SEÑALES.forEach((s) => document.addEventListener(s, alApuntar, { capture: true, passive: true }));
    // Y si nadie apuntó todavía, con la landing ya cargada y el navegador
    // libre (como Sentry en `instrumentation-client.ts`): en el celular el
    // toque llega sin aviso previo. No compite con lo que se ve primero.
    let idle: number | undefined;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const enReposo = () => {
      if ("requestIdleCallback" in window) idle = window.requestIdleCallback(precargarTurnstile, { timeout: 4000 });
      else espera = setTimeout(precargarTurnstile, 1500);
    };
    if (document.readyState === "complete") enReposo();
    else window.addEventListener("load", enReposo, { once: true });
    return () => {
      dejar();
      window.removeEventListener("load", enReposo);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (espera !== undefined) clearTimeout(espera);
    };
  }, []);
  return null;
}
