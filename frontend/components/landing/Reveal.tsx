"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Entrada suave, una sola vez, cuando el bloque aparece en pantalla. Es la
 * única animación de scroll de la landing (Julieta, 2026-10-12: las de la
 * historia eran muy rápidas y reemplazaban texto).
 *
 * El HTML del servidor sale visible: el estado escondido (`data-reveal=
 * "pending"`) lo pone el navegador después de montar y sólo a lo que todavía
 * está debajo de la pantalla. Así lo ven igual los buscadores, quien no tiene
 * JavaScript y quien pidió reducir el movimiento (ahí no se esconde nada).
 * Los estilos están en globals.css.
 */
export default function Reveal({
  children,
  className,
  delay = 0,
  margen = "0px 0px -12% 0px",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  /** Retraso en ms, para escalonar bloques hermanos. */
  delay?: number;
  /** Cuánto tiene que entrar en pantalla antes de arrancar (rootMargin). */
  margen?: string;
  as?: "div" | "li";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    el.dataset.reveal = "pending";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.dataset.reveal = "shown";
        io.disconnect();
      },
      { rootMargin: margen }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margen]);

  return (
    <Tag
      // El tipo de `ref` cambia con la etiqueta; las dos son HTMLElement.
      ref={ref as never}
      className={cn("landing-reveal", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
