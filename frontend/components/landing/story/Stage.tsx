"use client";

import { createContext, forwardRef, useContext, type CSSProperties, type ReactNode, type Ref } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";

/** Fondo de cada tramo de la historia. El encabezado lo lee (data-tone) para
 *  pintarse igual que lo que tiene debajo. Cada color fuerte se gasta una
 *  sola vez: noche en la urgencia, ámbar en el "¡Oído!", bosque en el
 *  resultado ("forest" es el tono de marca: con la paleta celeste, el
 *  azul hondo). */
export type Tone = "light" | "night" | "amber" | "forest" | "paper";

export const StoryContext = createContext<{ enhanced: boolean }>({ enhanced: false });
export const useStory = () => useContext(StoryContext);

/**
 * Sección fijada de la historia: una sección alta (los estados × el ritmo
 * de la página) con un escenario `sticky` del alto de la pantalla adentro.
 *
 * `states` es cuántos estados tiene la escena: el alto sale de
 * `--svh-estado` (93,333svh en el celular, 113,333svh en escritorio, en el
 * root de la landing) más 6,667svh de asiento. Un solo número controla el
 * ritmo de toda la página: si la recorrida se siente larga, se baja ése y no
 * se cortan escenas. (Hasta el 2026-10-08 eran 70/85svh con 30svh de
 * asiento. Lo que se scrollea es el alto menos una pantalla: con 6,667svh de
 * asiento queda en 93,333 × (estados − 1)svh, 4/3 de lo de antes, y la
 * historia corre un 25% más lento.)
 *
 * `overflow-hidden` va en el propio escenario y nunca en un ancestro: un
 * `overflow` en un ancestro rompe el `sticky`.
 */
export const Stage = forwardRef<
  HTMLElement,
  {
    states: number;
    tone: Tone;
    id?: string;
    label: string;
    hideHeaderCta?: boolean;
    className?: string;
    stageClassName?: string;
    stageStyle?: CSSProperties;
    children: ReactNode;
  }
>(function Stage({ states, tone, id, label, hideHeaderCta, className, stageClassName, stageStyle, children }, ref) {
  return (
    <section
      ref={ref}
      id={id}
      aria-label={label}
      data-tone={tone}
      data-hide-cta={hideHeaderCta ? "" : undefined}
      className={cn("relative", className)}
      style={{ height: `calc(var(--svh-estado) * ${states} + 6.667svh)` }}
    >
      <div
        className={cn(
          "sticky top-[var(--lht)] h-[calc(100svh-var(--lht))] overflow-hidden",
          stageClassName
        )}
        style={stageStyle}
      >
        {children}
      </div>
    </section>
  );
});

/** Etiqueta chica en mono que acompaña cada escena: deja claro que la
 *  historia es de ejemplo, y de qué lado de la app se está mirando. */
export function SceneLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "font-mono text-label font-medium uppercase tracking-[0.14em] text-ink-mute",
        className
      )}
    >
      {children}
    </p>
  );
}

export type NarrationItem = { title: ReactNode; line: ReactNode };

/**
 * La narración de una escena fijada: un titular y una línea por estado, que
 * se reemplazan cuando cambia el estado. En el celular va abajo (el producto
 * ocupa lo de arriba); en escritorio, en la columna izquierda.
 *
 * Todos los estados están apilados e invisibles en la misma celda, así la caja
 * mide lo que el más largo: la escena mide ese alto (`measureRef`) para saber
 * dónde termina el producto, y nada salta cuando cambia el texto. Con el
 * titular a 48px (2026-10-08) un estado puede ocupar dos o tres líneas, y un
 * alto fijo ya no alcanzaba.
 *
 * Para un lector de pantalla se lee la narración completa de una vez
 * (`sr-only`), no un pedazo según dónde quedó el scroll.
 */
export function Narration({
  items,
  index,
  dark = false,
  className,
  measureRef,
}: {
  items: NarrationItem[];
  index: number;
  dark?: boolean;
  className?: string;
  measureRef?: Ref<HTMLDivElement>;
}) {
  const i = Math.max(0, Math.min(items.length - 1, index));
  return (
    <div ref={measureRef} className={cn("pointer-events-none", className)}>
      <div className="sr-only">
        {items.map((it, k) => (
          <p key={k}>
            {it.title} {it.line}
          </p>
        ))}
      </div>
      <div className="grid" aria-hidden>
        {items.map((it, k) => (
          <NarrationText key={k} item={it} dark={dark} className="invisible [grid-area:1/1] self-end" data-narr-item />
        ))}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={i}
            className="self-end [grid-area:1/1]"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.4533, ease: [0.2, 0.8, 0.2, 1] } }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.2133, ease: [0.7, 0, 0.84, 0] } }}
          >
            <NarrationText item={items[i]} dark={dark} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function NarrationText({
  item,
  dark,
  className,
  ...rest
}: {
  item: NarrationItem;
  dark: boolean;
  className?: string;
  "data-narr-item"?: boolean;
}) {
  return (
    <div className={className} {...rest}>
      <p
        className={cn(
          "font-display text-headline font-semibold tracking-[-0.025em] [text-wrap:balance]",
          dark ? "text-white" : "text-ink"
        )}
      >
        {item.title}
      </p>
      <p
        className={cn(
          "mt-3 max-w-[38ch] text-body [text-wrap:pretty] lg:mt-4 lg:text-lg lg:leading-relaxed",
          dark ? "text-white/75" : "text-ink-soft"
        )}
      >
        {item.line}
      </p>
    </div>
  );
}
