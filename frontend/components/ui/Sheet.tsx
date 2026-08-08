"use client";

import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/components/icons";

/**
 * Bottom sheet modal del Design System: backdrop con fade, panel que sube
 * desde abajo y se puede arrastrar hacia abajo para cerrar. Estilo app.
 *
 * Cierre: además del backdrop y el drag (naturales en mobile), tiene un botón
 * X visible y responde a Escape — en desktop nadie arrastra un sheet y "tocá
 * el fondo para cerrar" no es descubrible, así que sin un cierre explícito
 * parecía trabado (bug reportado por Julieta, panel del comercio 2026-08-07).
 *
 * Causa raíz real (tercera vuelta del mismo bug, Julieta 2026-08-07 y
 * 2026-08-08, reproducido de punta a punta con Playwright `.tap()` en un
 * dispositivo emulado): el `fixed inset-0` de acá **no estaba portado a
 * `document.body`** — como cualquier componente de React, se renderiza
 * anidado donde se lo use. `Card` (`components/ui/Card.tsx`) usa
 * `whileTap={{ scale: 0.985 }}`: cuando un `Sheet` se abre desde DENTRO de
 * un `Card` (p. ej. "Más acciones" en una `ShiftCard`), ese ancestro con
 * transform activo le rompe el *containing block* al `position: fixed` —
 * en vez de cubrir el viewport entero, el wrapper del sheet quedaba
 * confinado a la caja del `Card`. Visualmente el panel se seguía viendo
 * bien (el `flex flex-col justify-end` lo empuja hacia abajo igual), pero
 * el punto real donde el navegador hace hit-test para el click ya no
 * coincidía con dónde el ojo lo ve — el toque le llegaba a lo que hay
 * DETRÁS. `createPortal` a `document.body` saca el sheet de cualquier
 * ancestro que pueda romperle el posicionamiento, sea cual sea (no sólo
 * `Card`) — la fix correcta para cualquier overlay `fixed`, no un parche
 * puntual.
 *
 * El arrastre usa Pointer Events nativos + `useMotionValue` (no el prop
 * `drag` de Framer Motion): iniciarlo únicamente desde la manija (nunca
 * desde la X ni el contenido) evita cualquier ambigüedad de qué elemento
 * captura el puntero.
 */
export default function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const y = useMotionValue(0);
  const dragState = useRef<{ startY: number; startClientY: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    y.set(0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);

  function handlePointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = { startY: y.get(), startClientY: e.clientY };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragState.current) return;
    const offset = e.clientY - dragState.current.startClientY;
    // Elástico hacia arriba (no se puede levantar el sheet más allá de su
    // posición de reposo), libre hacia abajo — mismo criterio visual que
    // antes con `dragElastic={{ top: 0, bottom: 0.6 }}`.
    y.set(offset < 0 ? offset * 0.15 : offset);
  }

  function handlePointerUp() {
    if (!dragState.current) return;
    dragState.current = null;
    const offset = y.get();
    if (offset > 120) {
      onClose();
      return;
    }
    animate(y, 0, { type: "spring", stiffness: 320, damping: 32 });
  }

  const content = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : undefined}
            onClick={onClose}
            className="absolute inset-0 bg-black/40"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title ?? "Acciones"}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 32 }}
            style={{ y }}
            className="relative z-10 max-h-[88dvh] overflow-y-auto rounded-t-[var(--radius-sheet)] bg-white pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-[var(--shadow-float)]"
          >
            <div className="sticky top-0 z-10 flex flex-col items-center gap-2 rounded-t-[var(--radius-sheet)] bg-white pb-2 pt-3">
              {/* El arrastre sólo arranca acá (la manija), nunca en la X ni
                  en el título — evita cualquier ambigüedad de a qué elemento
                  capturarle el puntero (ver nota de arriba del componente). */}
              <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="flex w-full touch-none justify-center py-1"
              >
                <span className="h-1.5 w-10 rounded-full bg-line" />
              </div>
              {title && <h3 className="text-base font-bold text-ink">{title}</h3>}
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink/60 transition hover:bg-line hover:text-ink active:scale-95"
              >
                <CloseIcon size={18} />
              </button>
            </div>
            <div className="px-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  // `document` no existe en SSR; para entonces `open` es siempre false en el
  // primer render de cualquier pantalla real, así que no hay contenido que
  // portar todavía y este guard nunca esconde nada visible.
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
