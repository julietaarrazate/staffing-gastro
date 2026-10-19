"use client";

import { useEffect, useRef } from "react";
import { TURNSTILE_SITE_KEY, setTurnstileToken } from "@/lib/turnstile";

/**
 * Widget de Cloudflare Turnstile para login y registro (ver `lib/turnstile.ts`).
 * Casi siempre se resuelve solo, sin que la persona haga nada; a veces pide
 * un toque. Sin clave configurada no muestra nada.
 *
 * `resetKey`: cambiarlo pide un token nuevo (cada token sirve una vez; la
 * pantalla lo cambia después de un intento fallido).
 */

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile"));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

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
    loadTurnstile()
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
