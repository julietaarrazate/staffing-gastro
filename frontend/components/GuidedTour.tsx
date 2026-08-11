"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { Button } from "@/components/ui";
import { CloseIcon } from "@/components/icons";
import { MOTION_UI } from "@/lib/motion";

export interface TourStep {
  /** Selector CSS de un elemento ya presente en el DOM (`data-tour="..."`). */
  target: string;
  title: string;
  body: string;
}

/**
 * Mini-tour de globos ("coachmarks") sobre elementos reales de la pantalla,
 * una sola vez por navegador (pedido de Julieta: el onboarding en sí
 * quedaba corto, faltaba algo más guiado al aterrizar en la app por primera
 * vez — el "tour guiado" que `docs/planning/PULIDO_ROADMAP.md` C4 ya había
 * dejado afuera del wizard a propósito, para evaluarlo aparte).
 *
 * Portado a `document.body` (mismo motivo que `Modal`/`Sheet`: sin portal,
 * un ancestro con `whileTap` le rompe el *containing block* al
 * `position: fixed`).
 */
interface GuidedTourProps {
  steps: TourStep[];
  /** Clave de localStorage: una vez visto (o saltado) no vuelve a aparecer
   *  en este navegador — independiente de cuántas veces se repita el
   *  onboarding en sí (p. ej. invitados, que lo recorren en cada login). */
  storageKey: string;
}

const PADDING = 8;
const TOOLTIP_WIDTH = 300;
const GAP = 14;

export default function GuidedTour({ steps, storageKey }: GuidedTourProps) {
  const reducedMotion = useReducedMotion();
  const [activeSteps, setActiveSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  useFocusTrap(cardRef, activeSteps !== null);

  // Se decide una sola vez, al montar, qué pasos tienen un target real en
  // el DOM (algunos, como el filtro de urgentes, sólo existen si hay
  // datos) — si ninguno existe todavía no hay tour que mostrar, y se marca
  // como visto igual para no reintentarlo en cada render.
  useEffect(() => {
    if (localStorage.getItem(storageKey)) return;
    const existing = steps.filter((step) => document.querySelector(step.target));
    if (existing.length === 0) {
      localStorage.setItem(storageKey, "1");
      return;
    }
    setActiveSteps(existing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!activeSteps) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [activeSteps]);

  useEffect(() => {
    if (!activeSteps) return;
    const target = document.querySelector(activeSteps[index].target);
    if (!target) {
      finish();
      return;
    }
    target.scrollIntoView({ block: "center", behavior: "auto" });
    const measure = () => setRect(target.getBoundingClientRect());
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSteps, index]);

  function finish() {
    localStorage.setItem(storageKey, "1");
    setActiveSteps(null);
  }

  function next() {
    if (!activeSteps) return;
    if (index + 1 >= activeSteps.length) {
      finish();
    } else {
      setIndex(index + 1);
    }
  }

  if (typeof document === "undefined" || !activeSteps || !rect) return null;

  const step = activeSteps[index];
  const spaceBelow = window.innerHeight - rect.bottom;
  const placeBelow = spaceBelow > 200 || rect.top < 200;
  const tooltipLeft = Math.min(
    Math.max(rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2, 16),
    window.innerWidth - TOOLTIP_WIDTH - 16
  );

  const content = (
    <div className="fixed inset-0 z-[70]">
      <div
        className="pointer-events-none absolute rounded-2xl transition-all duration-300"
        style={{
          top: rect.top - PADDING,
          left: rect.left - PADDING,
          width: rect.width + PADDING * 2,
          height: rect.height + PADDING * 2,
          boxShadow: "0 0 0 3px var(--color-primary), 0 0 0 9999px rgba(17,17,17,0.65)",
        }}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-label={step.title}
          initial={reducedMotion ? false : { opacity: 0, y: placeBelow ? -8 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={reducedMotion ? { duration: 0 } : MOTION_UI}
          className="absolute rounded-2xl bg-white p-4 shadow-[var(--shadow-float)]"
          style={{
            top: placeBelow ? rect.bottom + GAP : undefined,
            bottom: placeBelow ? undefined : window.innerHeight - rect.top + GAP,
            left: tooltipLeft,
            width: TOOLTIP_WIDTH,
          }}
        >
          <button
            type="button"
            onClick={finish}
            aria-label="Saltar recorrido"
            className="absolute right-3 top-3 text-ink/40"
          >
            <CloseIcon size={16} />
          </button>
          <p className="pr-5 font-display text-base font-semibold text-ink">{step.title}</p>
          <p className="mt-1 text-sm text-ink/60">{step.body}</p>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-1" aria-hidden>
              {activeSteps.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-primary" : "bg-line"}`}
                />
              ))}
            </div>
            <Button size="sm" onClick={next}>
              {index + 1 === activeSteps.length ? "Entendido" : "Siguiente"}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );

  return createPortal(content, document.body);
}
