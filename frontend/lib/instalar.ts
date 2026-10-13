"use client";

import { useEffect, useState } from "react";

/**
 * Instalar Oído en la pantalla de inicio del celular (la web app, sin pasar
 * por una tienda). Instalada, Oído abre como una app y en iPhone es la única
 * forma de recibir avisos.
 *
 * - Android (Chrome y similares): el navegador avisa que se puede instalar
 *   con el evento `beforeinstallprompt`; lo guardamos y el botón "Instalar"
 *   abre la ventana nativa. El evento puede llegar antes de que React monte,
 *   por eso lo atrapa también `INSTALAR_SCRIPT` (lib/instalar-script.ts, va
 *   en el HTML de la landing) y lo deja en `window.__oidoInstalar`.
 * - iPhone: no hay botón posible; se explica Compartir → Agregar a inicio.
 * - Ya instalada (abierta desde el ícono): no se ofrece nada.
 */

type EventoInstalar = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __oidoInstalar?: EventoInstalar | null;
  }
}

export type Plataforma = "iphone" | "android" | "compu";

export function detectarPlataforma(ua: string, tactil: boolean): Plataforma {
  // iPadOS se presenta como Mac; lo delata la pantalla táctil.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && tactil)) return "iphone";
  if (/Android/.test(ua)) return "android";
  return "compu";
}

export function estaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export interface EstadoInstalar {
  /** `null` hasta montar (el HTML del servidor no sabe en qué aparato está). */
  plataforma: Plataforma | null;
  instalada: boolean;
  /** Android con la ventana nativa disponible: el botón instala directo. */
  puedeInstalarDirecto: boolean;
  instalar: () => Promise<boolean>;
}

export function useInstalar(): EstadoInstalar {
  const [plataforma, setPlataforma] = useState<Plataforma | null>(null);
  const [instalada, setInstalada] = useState(false);
  const [evento, setEvento] = useState<EventoInstalar | null>(null);

  useEffect(() => {
    setPlataforma(detectarPlataforma(navigator.userAgent, navigator.maxTouchPoints > 1));
    setInstalada(estaInstalada());
    const tomar = () => setEvento(window.__oidoInstalar ?? null);
    tomar();
    const alInstalar = () => {
      window.__oidoInstalar = null;
      setEvento(null);
      setInstalada(true);
    };
    window.addEventListener("oido-instalar", tomar);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("oido-instalar", tomar);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  async function instalar(): Promise<boolean> {
    if (!evento) return false;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    // El evento sirve una sola vez, se acepte o no.
    window.__oidoInstalar = null;
    setEvento(null);
    if (outcome === "accepted") setInstalada(true);
    return outcome === "accepted";
  }

  return { plataforma, instalada, puedeInstalarDirecto: evento != null, instalar };
}
