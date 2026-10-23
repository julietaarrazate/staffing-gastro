"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import Filete from "./Filete";
import { useHeroAtras } from "./useHeroAtras";

/**
 * Encabezado propio de la landing (el Navbar global no se muestra en "/" sin
 * sesión), esmerilado como el de la app. "Ingresar" y "Crear cuenta" siempre
 * a la vista (Julieta, 2026-10-13: faltaba cómo crear la cuenta). Siempre claro: hasta el 2026-10-12 cambiaba de color con cada
 * tramo de la historia y en escritorio arrancaba oscuro encima del hero claro
 * (auditoría de la landing).
 *
 * El botón "Necesito personal" aparece cuando el del hero salió de la pantalla y
 * después ya no se esconde. En el celular no va (desde el 2026-10-18 tampoco
 * hay barra fija abajo: Julieta la sentía molesta). "Para trabajar" lleva a la sección de quien
 * trabaja; en el celular no entra al lado del botón, y ahí el camino del
 * trabajador es el link del hero.
 */
export default function LandingHeader({ heroCtaId }: { heroCtaId: string }) {
  const ctaVisible = useHeroAtras(heroCtaId);
  // Arriba de todo el encabezado es transparente y el cielo del inicio llega
  // hasta el borde; al bajar aparece el blanco esmerilado (2026-10-23).
  const [arriba, setArriba] = useState(true);
  useEffect(() => {
    const medir = () => setArriba(window.scrollY < 8);
    medir();
    window.addEventListener("scroll", medir, { passive: true });
    return () => window.removeEventListener("scroll", medir);
  }, []);

  return (
    <header
      className={cn(
        "safe-top sticky top-0 z-40 border-b transition-[background-color,border-color] duration-200 motion-reduce:transition-none",
        arriba ? "border-transparent bg-transparent" : "border-line/70 bg-card/80 backdrop-blur-xl backdrop-saturate-150"
      )}
    >
      <div className="flex h-[var(--lh)] items-center justify-between gap-3 px-4 sm:px-6 lg:px-12">
        {/* La marca es una sola (2026-10-19): el "oído" fileteado de la
            miniatura y del final, acá sin adornos. El isotipo queda como
            ícono de la app (pantalla de inicio, pestaña del navegador). */}
        <Link href="/" aria-label="Oído, inicio" className="inline-flex shrink-0 items-center">
          <Filete palabra="oído" tam="marca" className="h-10 w-auto sm:h-12" />
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
            // Al tocarlo se tiñe de celeste y se hunde, como en el Navbar de
            // la app: que se vea cuál se eligió (Julieta, 2026-10-13).
            className="inline-flex h-10 items-center rounded-full px-3 text-ink transition duration-150 hover:text-primary-text active:scale-95 active:bg-secondary active:text-on-brand"
          >
            Ingresar
          </Link>
          <Link
            href="/register"
            data-cta="header-crear-cuenta"
            className="inline-flex h-10 items-center whitespace-nowrap rounded-full px-3.5 text-ink ring-[1.5px] ring-ink/70 ring-inset transition duration-150 hover:bg-surface active:scale-95 active:bg-secondary active:text-on-brand active:ring-transparent"
          >
            Crear cuenta
          </Link>
          <Link
            href="/register?rol=comercio"
            data-cta="header"
            tabIndex={ctaVisible ? undefined : -1}
            aria-hidden={ctaVisible ? undefined : true}
            // Escondido no ocupa lugar (max-w-0): si no, "Ingresar" quedaba
            // flotando en el medio del encabezado.
            className={cn(
              "hidden h-10 items-center overflow-hidden whitespace-nowrap rounded-full bg-ink text-card transition-[max-width,opacity,padding] duration-400 active:scale-95 sm:inline-flex",
              ctaVisible ? "max-w-[12rem] px-3.5 opacity-100" : "pointer-events-none max-w-0 px-0 opacity-0"
            )}
          >
            Necesito personal
          </Link>
        </nav>
      </div>
    </header>
  );
}
