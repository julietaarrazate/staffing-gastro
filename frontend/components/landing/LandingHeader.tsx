"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { LogoMark } from "@/components/Logo";
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

  return (
    <header className="safe-top sticky top-0 z-40 border-b border-line/70 bg-card/80 backdrop-blur-xl backdrop-saturate-150">
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
              "hidden h-10 items-center overflow-hidden whitespace-nowrap rounded-full bg-primary text-night transition-[max-width,opacity,padding] duration-400 active:scale-95 sm:inline-flex",
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
