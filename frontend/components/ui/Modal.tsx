"use client";

import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useEscapeLayer } from "@/lib/use-escape-layer";
import { useFocusTrap } from "@/lib/use-focus-trap";

/**
 * Capa del diálogo. Mientras se anima el cierre (`AnimatePresence` la
 * mantiene montada) no recibe toques: el dedo que cae sobre el botón de
 * confirmar en ese instante lo recibiría un diálogo que ya se cerró, o,
 * peor, la pantalla de atrás por el hueco.
 */
function ModalLayer({ children }: { children: ReactNode }) {
  const isPresent = useIsPresent();
  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-5 ${isPresent ? "" : "pointer-events-none"}`}
      aria-hidden={isPresent ? undefined : true}
    >
      {children}
    </div>
  );
}

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
  // Prioridad = z-index de la capa (z-[60]): Escape cierra sólo la de más arriba.
  useEscapeLayer(open, onClose, 60);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const content = (
    <AnimatePresence>
      {open && (
        // `z-[60]`, por encima del `z-50` de `Sheet`: ambos portan a
        // `document.body` (ver nota de arriba) y podían coexistir de verdad
        // — p. ej. el modal "¡Turno publicado!" y el sheet de activar
        // notificaciones push, que se disparaban con la misma acción de publicar
        // (hoy el pedido sale recién al cerrar la confirmación).
        // Antes del portal el orden salía bien de pura casualidad (el modal
        // vivía más profundo en el árbol que el sheet del prompt de push,
        // que envuelve toda la app desde el layout); con los dos en el mismo
        // contenedor hay que decidir la prioridad a mano: una confirmación
        // que el usuario tiene que resolver pesa más que un nudge dismisible.
        <ModalLayer>
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
            className="relative z-10 max-h-[85vh] w-full max-w-sm overflow-y-auto overscroll-contain rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-float)]"
          >
            {title && <h3 className="text-lg font-extrabold text-ink">{title}</h3>}
            <div className={title ? "mt-2" : ""}>{children}</div>
          </motion.div>
        </ModalLayer>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
