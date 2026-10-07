"use client";

import { createContext, forwardRef, useContext, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";

/** Fondo de cada tramo de la historia. El encabezado lo lee (data-tone) para
 *  pintarse igual que lo que tiene debajo. Cada color fuerte se gasta una
 *  sola vez: noche en la urgencia, ámbar en el "¡Oído!", bosque en el
 *  resultado. */
export type Tone = "light" | "night" | "amber" | "forest" | "paper";

export const StoryContext = createContext<{ enhanced: boolean }>({ enhanced: false });
export const useStory = () => useContext(StoryContext);

/**
 * Sección fijada de la historia: una sección alta (los estados × el ritmo
 * de la página) con un escenario `sticky` del alto de la pantalla adentro.
 *
 * `states` es cuántos estados tiene la escena: el alto sale de
 * `--svh-estado` (70svh en el celular, 85svh en escritorio, en el root de la
 * landing) más 30svh de asiento. Un solo número controla el ritmo de toda la
 * página: si la recorrida se siente larga, se baja ése y no se cortan escenas.
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
      style={{ height: `calc(var(--svh-estado) * ${states} + 30svh)` }}
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
 * se reemplazan cuando cambia el estado. En el celular va abajo (el 60% de
 * arriba es del producto); en escritorio, en la columna izquierda.
 *
 * Para un lector de pantalla se lee la narración completa de una vez
 * (`sr-only`), no un pedazo según dónde quedó el scroll.
 */
export function Narration({
  items,
  index,
  dark = false,
  className,
}: {
  items: NarrationItem[];
  index: number;
  dark?: boolean;
  className?: string;
}) {
  const item = items[Math.max(0, Math.min(items.length - 1, index))];
  return (
    <div className={cn("pointer-events-none", className)}>
      <div className="sr-only">
        {items.map((it, i) => (
          <p key={i}>
            {it.title} {it.line}
          </p>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={index}
          aria-hidden
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.2, 0.8, 0.2, 1] } }}
          exit={{ opacity: 0, y: -10, transition: { duration: 0.16, ease: [0.7, 0, 0.84, 0] } }}
        >
          <p
            className={cn(
              "font-display text-h1 font-semibold tracking-[-0.02em] [text-wrap:balance] lg:text-display",
              dark ? "text-white" : "text-ink"
            )}
          >
            {item.title}
          </p>
          <p
            className={cn(
              "mt-2 max-w-[38ch] text-body [text-wrap:pretty] lg:mt-4 lg:text-lg lg:leading-relaxed",
              dark ? "text-white/75" : "text-ink-soft"
            )}
          >
            {item.line}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
