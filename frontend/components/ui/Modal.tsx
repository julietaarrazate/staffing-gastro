"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/lib/use-focus-trap";

/**
 * Diálogo centrado con backdrop (para confirmaciones). Para acciones desde
 * abajo usar `Sheet`. Entra con un leve pop.
 *
 * Portado a `document.body` (mismo motivo que `Sheet.tsx`, ver su comentario
 * para el detalle completo): sin portal, un `Card` ancestro con `whileTap`
 * activo le rompe el *containing block* al `position: fixed` de acá, y los
 * botones de adentro dejan de recibir el click aunque se vean bien.
 */
export default function Modal({
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
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

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

  const content = (
    <AnimatePresence>
      {open && (
        // `z-[60]`, por encima del `z-50` de `Sheet`: ambos portan a
        // `document.body` (ver nota de arriba) y pueden coexistir de verdad
        // — p. ej. el modal "¡Turno publicado!" y el sheet de activar
        // notificaciones push, disparados por la misma acción de publicar.
        // Antes del portal el orden salía bien de pura casualidad (el modal
        // vivía más profundo en el árbol que el sheet del prompt de push,
        // que envuelve toda la app desde el layout); con los dos en el mismo
        // contenedor hay que decidir la prioridad a mano: una confirmación
        // que el usuario tiene que resolver pesa más que un nudge dismisible.
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : undefined}
            onClick={onClose}
            className="absolute inset-0 bg-black/40"
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={title ?? "Diálogo"}
            initial={reducedMotion ? false : { opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.96 }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 28 }}
            className="relative z-10 max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-[var(--radius-card)] bg-white p-6 shadow-[var(--shadow-float)]"
          >
            {title && <h3 className="text-lg font-extrabold text-ink">{title}</h3>}
            <div className={title ? "mt-2" : ""}>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
