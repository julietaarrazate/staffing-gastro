"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  motion,
  useAnimationControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { Shift } from "@/lib/types";
import { CheckIcon } from "@/components/icons";
import { MOTION_UI } from "@/lib/motion";

type Decision = "like" | "pass";

/**
 * Mazo de tarjetas estilo Tinder: la de arriba se arrastra (drag horizontal)
 * o se decide con los botones. Derecha = "Me interesa", izquierda = "No gracias".
 * Muestra la siguiente tarjeta detrás para dar profundidad.
 */
export default function SwipeDeck({
  shifts,
  onDecide,
  renderCard,
  empty,
}: {
  shifts: Shift[];
  /**
   * Devuelve `true` cuando la decisión quedó procesada (o es un descarte que
   * no requiere red) y `false` cuando falló: en ese caso la carta vuelve al
   * tope del mazo para que el usuario pueda reintentar en vez de perderla.
   */
  onDecide: (shift: Shift, decision: Decision) => Promise<boolean>;
  renderCard: (shift: Shift) => ReactNode;
  empty: ReactNode;
}) {
  // Mazo local para poder avanzar de forma OPTIMISTA: la siguiente carta se
  // habilita apenas termina la animación de salida, sin esperar la respuesta
  // de red de la postulación (contra un backend lento eso congelaba el mazo
  // varios segundos con la carta siguiente "gris" y los botones muertos).
  const [deck, setDeck] = useState(shifts);
  // `busy` sólo cubre la animación de salida (~0.3s), no la red.
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDeck(shifts);
  }, [shifts]);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-14, 0, 14]);
  const likeOpacity = useTransform(x, [40, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-150, -40], [1, 0]);
  const controls = useAnimationControls();
  const reducedMotion = useReducedMotion();

  const current = deck[0];
  const upcoming = deck[1];

  async function decide(decision: Decision) {
    if (busy || !current) return;
    const shift = current;
    setBusy(true);
    const dir = decision === "like" ? 1 : -1;
    await controls.start({
      x: dir * 520,
      rotate: dir * 18,
      opacity: 0,
      transition: reducedMotion ? { duration: 0 } : MOTION_UI,
    });
    x.set(0);
    controls.set({ x: 0, rotate: 0, opacity: 1 });
    setDeck((d) => d.slice(1));
    setBusy(false);
    // La red corre en segundo plano. Si la postulación falla (red/5xx), la
    // carta vuelve al tope del mazo para reintentar — `onDecide` ya mostró el
    // error y conserva la Idempotency-Key, así que el reintento es el mismo
    // intento para el backend.
    void onDecide(shift, decision).then((ok) => {
      if (!ok) setDeck((d) => [shift, ...d]);
    });
  }

  if (!current) return <>{empty}</>;

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 select-none">
        {upcoming && (
          <div
            className="absolute inset-0 scale-[0.94] opacity-80"
            style={{ transformOrigin: "bottom" }}
          >
            {renderCard(upcoming)}
          </div>
        )}

        <motion.div
          key={current.id}
          data-testid="swipe-deck-card"
          className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
          style={{ x, rotate }}
          drag="x"
          dragSnapToOrigin
          dragElastic={0.6}
          animate={controls}
          onDragEnd={(_, info) => {
            if (info.offset.x > 120 || info.velocity.x > 700) decide("like");
            else if (info.offset.x < -120 || info.velocity.x < -700) decide("pass");
          }}
        >
          {renderCard(current)}

          <motion.div
            style={{ opacity: likeOpacity }}
            className="pointer-events-none absolute left-5 top-6 -rotate-12 rounded-xl border-4 border-success px-3 py-1 text-2xl font-extrabold uppercase tracking-wide text-success"
          >
            Me interesa
          </motion.div>
          <motion.div
            style={{ opacity: nopeOpacity }}
            className="pointer-events-none absolute right-5 top-6 rotate-12 rounded-xl border-4 border-danger px-3 py-1 text-2xl font-extrabold uppercase tracking-wide text-danger-text"
          >
            No
          </motion.div>
        </motion.div>
      </div>

      {/* Acciones. Tamaño ajustado dos veces por auditoría de Julieta:
          primero 64px/80px→56px/64px (2026-08-16, referencias Uber/Tegu —
          el par en la grilla de escritorio, OpportunityCard, usa 44px);
          ahora, mismo día, "el botón de rechazar y aceptar tienen distintos
          tamaños" — quedaban asimétricos (56 vs 64) pese al ajuste. Mismo
          tamaño para las dos acciones (64px, por encima del mínimo táctil de
          44px) y mismo peso de ícono adentro (26px), para que se lean como
          un único par de opciones y no como una principal/secundaria. */}
      <div className="mt-4 flex items-center justify-center gap-6">
        <motion.button
          type="button"
          aria-label="No gracias"
          onClick={() => decide("pass")}
          disabled={busy}
          whileTap={{ scale: 0.88 }}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-danger-text shadow-[var(--shadow-float)] ring-1 ring-line disabled:opacity-50"
        >
          <CrossIcon />
        </motion.button>
        <motion.button
          type="button"
          aria-label="Me interesa"
          onClick={() => decide("like")}
          disabled={busy}
          whileTap={{ scale: 0.88 }}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-success text-white shadow-[0_10px_24px_rgba(34,197,94,0.4)] disabled:opacity-50"
        >
          <CheckIcon size={26} />
        </motion.button>
      </div>
    </div>
  );
}

function CrossIcon() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
