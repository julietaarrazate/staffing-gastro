"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, type ReactNode } from "react";

/**
 * Diálogo centrado con backdrop (para confirmaciones). Para acciones desde
 * abajo usar `Sheet`. Entra con un leve pop.
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

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : undefined}
            onClick={onClose}
            className="absolute inset-0 bg-black/40"
          />
          <motion.div
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
}
