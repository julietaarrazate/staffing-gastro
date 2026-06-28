"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useEffect } from "react";

/**
 * Bottom sheet modal del Design System: backdrop con fade, panel que sube
 * desde abajo y se puede arrastrar hacia abajo para cerrar. Estilo app.
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
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            className="relative z-10 max-h-[88dvh] overflow-y-auto rounded-t-[var(--radius-sheet)] bg-white pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-[var(--shadow-float)]"
          >
            <div className="sticky top-0 z-10 flex flex-col items-center gap-2 rounded-t-[var(--radius-sheet)] bg-white pb-2 pt-3">
              <span className="h-1.5 w-10 rounded-full bg-zinc-300" />
              {title && <h3 className="text-base font-bold text-zinc-900">{title}</h3>}
            </div>
            <div className="px-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
