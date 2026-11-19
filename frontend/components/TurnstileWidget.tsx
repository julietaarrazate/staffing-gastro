"use client";

import { useEffect, useRef } from "react";
import { preconnect, preload } from "react-dom";
import {
  TURNSTILE_ORIGIN,
  TURNSTILE_SCRIPT_SRC,
  TURNSTILE_SITE_KEY,
  cargarTurnstile,
  setTurnstileToken,
} from "@/lib/turnstile";

/**
 * Widget de Cloudflare Turnstile para login y registro (ver `lib/turnstile.ts`).
 * Casi siempre se resuelve solo, sin que la persona haga nada; a veces pide
 * un toque. Sin clave configurada no muestra nada.
 *
 * `resetKey`: cambiarlo pide un token nuevo (cada token sirve una vez; la
 * pantalla lo cambia después de un intento fallido).
 */

export default function TurnstileWidget({
  resetKey = 0,
  onTokenChange,
}: {
  resetKey?: number;
  onTokenChange?: (token: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onChange = useRef(onTokenChange);
  useEffect(() => {
    onChange.current = onTokenChange;
  });

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !containerRef.current) return;
    let cancelled = false;
    const update = (token: string | null) => {
      setTurnstileToken(token);
      onChange.current?.(token);
    };
    cargarTurnstile()
      .then((api) => {
        if (cancelled || !containerRef.current) return;
        widgetId.current = api.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          // Tema explícito de la app (lib/theme.tsx), no el del sistema.
          theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
          language: "es",
          size: "flexible",
          callback: (token: string) => update(token),
          "expired-callback": () => update(null),
          "error-callback": () => update(null),
        });
      })
      .catch(() => update(null));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
      update(null);
    };
  }, []);

  useEffect(() => {
    if (resetKey === 0 || !widgetId.current || !window.turnstile) return;
    setTurnstileToken(null);
    onChange.current?.(null);
    window.turnstile.reset(widgetId.current);
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={containerRef} className="min-h-[65px]" />;
}

/**
 * Pide el script de Turnstile en cuanto se dibuja la pantalla, antes de que
 * el formulario (que va dentro de un `Suspense`) se monte y lo cargue. En una
 * visita directa sale en el HTML del servidor; al llegar navegando, al
 * dibujar la ruta. Va en `/login` y `/register`, fuera del `Suspense`.
 */
export function TurnstileTemprano() {
  if (!TURNSTILE_SITE_KEY) return null;
  // Si la landing ya lo bajó, no hace falta (y Chrome avisaría que la
  // precarga no se usó).
  if (typeof window !== "undefined" && window.turnstile) return null;
  preconnect(TURNSTILE_ORIGIN);
  preload(TURNSTILE_SCRIPT_SRC, { as: "script" });
  return null;
}
