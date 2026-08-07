"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { CloseIcon } from "@/components/icons";

/**
 * Bottom sheet modal del Design System: backdrop con fade, panel que sube
 * desde abajo y se puede arrastrar hacia abajo para cerrar. Estilo app.
 *
 * Cierre: además del backdrop y el drag (naturales en mobile), tiene un botón
 * X visible y responde a Escape — en desktop nadie arrastra un sheet y "tocá
 * el fondo para cerrar" no es descubrible, así que sin un cierre explícito
 * parecía trabado (bug reportado por Julieta, panel del comercio 2026-08-07).
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

  useEffect(() => {
    if (!open) return;
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
  }, [open, onClose]);

  return (
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
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            className="relative z-10 max-h-[88dvh] overflow-y-auto rounded-t-[var(--radius-sheet)] bg-white pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-[var(--shadow-float)]"
          >
            <div className="sticky top-0 z-10 flex flex-col items-center gap-2 rounded-t-[var(--radius-sheet)] bg-white pb-2 pt-3">
              <span className="h-1.5 w-10 rounded-full bg-line" />
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
}
