"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckCircleIcon } from "@/components/icons";

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; message: string; tone: ToastTone };

const TONE_STYLES: Record<ToastTone, string> = {
  // `bg-toast`, no `bg-night`: en oscuro se invierte (ver globals.css).
  success: "bg-toast text-toast-ink",
  error: "bg-danger text-white",
  info: "bg-toast text-toast-ink",
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
      {/* El aviso NUNCA intercepta toques (ni el contenedor ni el cuerpo) y en
          pantallas angostas va ARRIBA, debajo del encabezado (`--chrome-top`:
          4rem + zona segura; el aviso arranca 0,5rem más abajo): abajo, a 390 px, caía sobre
          «Publicar turno» y quien tocaba el cartel creyendo cerrarlo publicaba
          el turno sin querer (U009). Desde `md` no hay barra inferior y queda
          abajo como siempre (`bottom-24`, ~21 px sobre «Publicar turno» a
          768×1024, sin cruce). Se va
          solo a los 3,2 s; si algún día lleva un botón de acción, sólo ese
          botón recibe punteros (`[&_button]`). z-[60] > Navbar (z-40). */}
      {/* role="status" + aria-live="polite": sin esto un toast (confirmación
          de acción, error de una mutación) es invisible para un usuario de
          lector de pantalla — no hay foco que mover a un elemento que
          aparece y desaparece solo, así que la única forma de que se entere
          es una región viva que el navegador anuncia sola. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[calc(var(--chrome-top)+0.5rem)] z-[60] md:top-auto md:bottom-24 flex flex-col items-center gap-2 px-4"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.95 }}
              transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
              className={`pointer-events-none [&_button]:pointer-events-auto flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold shadow-[var(--shadow-float)] ${TONE_STYLES[t.tone]}`}
            >
              {/* Verde, no blanco: sobre la píldora negra el tilde en blanco
                  era un adorno más del texto. En color dice "salió bien" antes
                  de que se lea el mensaje, y es la misma regla del resto de las
                  superficies oscuras de la app — adentro de negro, el ícono
                  lleva su acento. */}
              {t.tone === "success" && <CheckCircleIcon size={18} className="text-success" />}
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
