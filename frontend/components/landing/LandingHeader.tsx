"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { LogoMark } from "@/components/Logo";

/**
 * Encabezado propio de la landing (el Navbar global no se muestra en "/" sin
 * sesión). Siempre claro: hasta el 2026-10-12 cambiaba de color con cada
 * tramo de la historia y en escritorio arrancaba oscuro encima del hero claro
 * (auditoría de la landing).
 *
 * El botón "Pedir personal" aparece cuando el del hero salió de la pantalla y
 * después ya no se esconde. "Para trabajar" lleva a la sección de quien
 * trabaja; en el celular no entra al lado del botón, y ahí el camino del
 * trabajador es el link del hero.
 */
export default function LandingHeader({ heroCtaId }: { heroCtaId: string }) {
  const [ctaVisible, setCtaVisible] = useState(false);

  useEffect(() => {
    const heroCta = document.getElementById(heroCtaId);
    if (!heroCta || typeof IntersectionObserver === "undefined") {
      setCtaVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setCtaVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 }
    );
    io.observe(heroCta);
    return () => io.disconnect();
  }, [heroCtaId]);

  return (
    <header className="safe-top sticky top-0 z-40 border-b border-line bg-background">
      <div className="flex h-[var(--lh)] items-center justify-between gap-3 px-4 sm:px-6 lg:px-12">
        <Link href="/" aria-label="Oído, inicio" className="inline-flex shrink-0 items-center gap-2">
          <LogoMark size={28} />
          <span className="font-serif text-xl font-semibold tracking-tight text-ink">oído</span>
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-1 text-sm font-semibold">
          <Link
            href="/#trabajar"
            className="hidden h-11 items-center px-3 text-ink transition-colors duration-200 hover:text-primary-text sm:inline-flex"
          >
            Para trabajar
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center px-3 text-ink transition-colors duration-200 hover:text-primary-text"
          >
            Ingresar
          </Link>
          <Link
            href="/register?rol=comercio"
            data-cta="header"
            tabIndex={ctaVisible ? undefined : -1}
            aria-hidden={ctaVisible ? undefined : true}
            // Escondido no ocupa lugar (max-w-0): si no, "Ingresar" quedaba
            // flotando en el medio del encabezado.
            className={cn(
              "inline-flex h-10 items-center overflow-hidden whitespace-nowrap rounded-[var(--radius-btn)] bg-primary text-night transition-[max-width,opacity,padding] duration-400 active:scale-95",
              ctaVisible ? "max-w-[12rem] px-3.5 opacity-100" : "pointer-events-none max-w-0 px-0 opacity-0"
            )}
          >
            Pedir personal
          </Link>
        </nav>
      </div>
    </header>
  );
}
