"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * Las pestañas de una pantalla (Mis turnos, el Panel, Candidatos, el admin y
 * el alta). Con la dirección «con relieve» (Julieta, 2026-11-19; ADR-0027):
 * texto plano sobre un filete, la activa en tinta y con una raya azul hondo
 * debajo, el mismo gesto que la barra de abajo. Sin píldora ni sombra: el
 * relieve queda para el objeto de la pantalla. Julieta la eligió entre tres
 * opciones puestas sobre las pantallas ya migradas (la raya, una pista recta
 * con la activa llena en azul y fichas de carpeta;
 * `docs/design-system/direccion-relieve.md`).
 *
 * Antes (desde el 2026-08) era un control segmentado estilo iOS, una pastilla
 * blanca que se deslizaba sobre una pista gris. La raya se sigue deslizando
 * de una pestaña a la otra (motion layout).
 *
 * Cada pestaña mide lo que su nombre, no una parte igual del ancho. Si entre
 * todas no entran, el nombre se recorta con «…» y el número queda a la vista;
 * donde hay muchas (el Panel) quien la usa le pasa `w-max min-w-full` dentro
 * de un contenedor que scrollea en horizontal.
 */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  // `count`: cuántos hay, como numerito aparte (más angosto que «(3)» pegado
  // al texto: tres pestañas con cantidad entran en 360 px sin scroll).
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const id = useId();
  return (
    // El filete va como sombra hacia adentro y no como `border-b`: así la
    // raya de la activa lo tapa sin salirse de la caja de las pestañas.
    // Donde scrollean (el Panel, el «En vivo» del admin), el contenedor lleva
    // `-my-1 py-1`: sin ese aire el contorno de foco, que va 4 px por fuera,
    // quedaba cortado arriba y abajo.
    // `gap-2.5` en el celular: con 16 px entre pestañas, a 320 las tres de Mis
    // turnos se recortaban aun con contadores de una cifra (revisión del
    // 2026-11-19); con 12 entraban con 11 px de sobra en local y no en CI.
    <div data-pestanas className={cn("flex gap-2.5 shadow-[inset_0_-1px_0_var(--color-line)] sm:gap-6", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            aria-label={o.count ? `${o.label} (${o.count})` : undefined}
            onClick={() => onChange(o.value)}
            // Donde las pestañas scrollean (el Panel, el «En vivo»), la que
            // recibe el foco de teclado se trae entera a la vista: si quedaba
            // asomando a medias, el navegador no la movía y el contorno salía
            // cortado (revisión del 2026-11-19). El aire lo da el
            // `scroll-padding` del contenedor.
            onFocus={(e) => e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" })}
            // `whitespace-nowrap`: un nombre largo («Postulaciones» con su
            // número) no se parte en dos renglones (Julieta, captura
            // 2026-08-17: una pestaña más alta que las otras). Debajo de `sm`,
            // 13 px: con 14 px las tres de Matches no entraban en 320 px.
            className="relative flex min-h-[44px] min-w-0 flex-initial items-center whitespace-nowrap pb-3 pt-2.5 text-caption font-semibold sm:text-sm"
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-[3px] bg-primary-text"
              />
            )}
            <span
              className={cn(
                "flex min-w-0 items-baseline transition-colors",
                // Las de reposo en `ink-soft` (7,5 sobre el lienzo claro) y
                // no en `ink/60` como antes.
                active ? "text-ink" : "text-ink-soft",
              )}
            >
              <span className="truncate">{o.label}</span>
              {o.count ? (
                <span className="ml-0.5 shrink-0 text-xs font-bold tabular-nums sm:ml-1">{o.count}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
