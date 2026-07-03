"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckCircleIcon } from "@/components/icons";

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; message: string; tone: ToastTone };

const TONE_STYLES: Record<ToastTone, string> = {
  success: "bg-zinc-900 text-white",
  error: "bg-danger text-white",
  info: "bg-zinc-900 text-white",
};

const ToastContext = createContext<((message: string, tone?: ToastTone) => void) | null>(null);

/**
 * Provider de toasts/snackbars. Envuelve la app una vez y se usa con
 * `useToast()` desde cualquier componente cliente.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const reducedMotion = useReducedMotion();

  const show = useCallback((message: string, tone: ToastTone = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={reducedMotion ? false : { opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.95 }}
              transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
              className={`pointer-events-auto flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold shadow-[var(--shadow-float)] ${TONE_STYLES[t.tone]}`}
            >
              {t.tone === "success" && <CheckCircleIcon size={18} />}
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider");
  return ctx;
}
