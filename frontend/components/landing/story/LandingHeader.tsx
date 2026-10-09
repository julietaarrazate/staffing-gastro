"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { LogoMark } from "@/components/Logo";
import type { Tone } from "./Stage";
import { RelojFijo } from "./RelojDelTurno";
import { useReloj } from "./relojStore";

/** Colores del encabezado según lo que tiene debajo. */
const TONES: Record<Tone, { bar: string; word: string; link: string; cta: string }> = {
  light: {
    bar: "bg-background border-line",
    word: "text-ink",
    link: "text-ink hover:text-primary-text",
    cta: "bg-primary text-night",
  },
  paper: {
    bar: "bg-paper border-transparent",
    word: "text-ink",
    link: "text-ink hover:text-primary-text",
    cta: "bg-primary text-night",
  },
  night: {
    bar: "bg-night border-transparent",
    word: "text-white",
    link: "text-manteca hover:text-white",
    cta: "bg-primary text-night",
  },
  amber: {
    bar: "bg-primary border-transparent",
    word: "text-night",
    link: "text-night hover:underline",
    cta: "bg-night text-white",
  },
  forest: {
    bar: "bg-secondary border-transparent",
    word: "text-on-brand",
    link: "text-on-brand-label hover:text-on-brand",
    cta: "bg-primary text-night",
  },
};

/**
 * Encabezado propio de la landing (el Navbar global no se muestra en "/" sin
 * sesión). Se pinta del color del tramo que tiene debajo, así la historia no
 * queda con una barra blanca encima de la noche o del ámbar.
 *
 * El botón "Necesito personal" aparece recién cuando los del hero salieron de
 * la pantalla, y se esconde en los tramos que ya tienen su propio botón
 * (`data-hide-cta`). Es el mismo botón principal de toda la página (ámbar con
 * texto en tinta) sobre cualquier fondo; sólo sobre la banda ámbar se invierte
 * a tinta. Hasta el 2026-10-08 iba en tinta o en crema según el tramo: tres
 * rellenos para el mismo botón.
 */
export default function LandingHeader({ heroCtaId, reloj = false }: { heroCtaId: string; reloj?: boolean }) {
  const [tone, setTone] = useState<Tone>("light");
  const [ctaVisible, setCtaVisible] = useState(false);
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const bar = barRef.current;
      if (!bar) return;
      // Se mira 24px debajo del encabezado y no el primer píxel: al final de
      // la página, en escritorio, el resultado terminaba 8px debajo del
      // encabezado y lo dejaba del color de marca encima de los precios.
      const y = bar.getBoundingClientRect().bottom + 24;
      const sections = document.querySelectorAll<HTMLElement>("[data-landing] [data-tone]");
      let found: HTMLElement | null = null;
      // La sección más interna que cubre la línea de abajo del encabezado:
      // un tramo puede tener otro adentro (la noche del hero).
      sections.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top <= y && r.bottom > y) found = el;
      });
      const el = found as HTMLElement | null;
      setTone(((el?.dataset.tone as Tone) ?? "light"));
      const heroCta = document.getElementById(heroCtaId);
      const heroGone = heroCta ? heroCta.getBoundingClientRect().bottom < y : true;
      const hiddenHere = el?.closest("[data-hide-cta]") != null;
      setCtaVisible(heroGone && !hiddenHere);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    // El tono de una escena cambia por dentro (la noche que tapa el hero): se
    // escucha también el cambio del atributo.
    const mo = new MutationObserver(onScroll);
    const root = document.querySelector("[data-landing]");
    if (root) mo.observe(root, { attributes: true, subtree: true, attributeFilter: ["data-tone", "data-hide-cta"] });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      mo.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [heroCtaId]);

  const t = TONES[tone];
  // Con la franja del reloj abajo, la línea va debajo de la franja, no entre
  // las dos.
  const strip = useReloj() != null && reloj;

  return (
    <header
      ref={barRef}
      className={cn(
        "safe-top sticky top-0 z-40 border-b transition-colors duration-400",
        t.bar,
        strip && "border-transparent"
      )}
    >
      <div className="flex h-[var(--lh)] items-center justify-between gap-3 px-4 sm:px-6 lg:px-12">
        <Link href="/" aria-label="Oído, inicio" className="inline-flex shrink-0 items-center gap-2">
          <LogoMark size={28} />
          <span className={cn("font-display text-xl font-semibold tracking-tight transition-colors duration-400", t.word)}>
            oído
          </span>
        </Link>
        <nav aria-label="Cuenta" className="flex items-center gap-1 text-sm font-semibold">
          <Link
            href="/login"
            className={cn("inline-flex h-11 items-center px-3 transition-colors duration-400", t.link)}
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
              "inline-flex h-10 items-center overflow-hidden whitespace-nowrap rounded-[var(--radius-btn)] transition-[max-width,opacity,padding,background-color,color] duration-400 active:scale-95",
              t.cta,
              ctaVisible ? "max-w-[12rem] px-3.5 opacity-100" : "pointer-events-none max-w-0 px-0 opacity-0"
            )}
          >
            Necesito personal
          </Link>
        </nav>
      </div>
      {reloj && <RelojFijo tone={tone} />}
    </header>
  );
}
