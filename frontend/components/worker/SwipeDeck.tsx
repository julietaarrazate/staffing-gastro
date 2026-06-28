"use client";

import { useState, type ReactNode } from "react";
import {
  motion,
  useAnimationControls,
  useMotionValue,
  useTransform,
} from "motion/react";
import { Shift } from "@/lib/types";
import { CheckIcon } from "@/components/icons";

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
  onDecide: (shift: Shift, decision: Decision) => void;
  renderCard: (shift: Shift) => ReactNode;
  empty: ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-14, 0, 14]);
  const likeOpacity = useTransform(x, [40, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-150, -40], [1, 0]);
  const controls = useAnimationControls();

  const current = shifts[index];
  const upcoming = shifts[index + 1];

  async function decide(decision: Decision) {
    if (busy || !current) return;
    setBusy(true);
    const dir = decision === "like" ? 1 : -1;
    await controls.start({
      x: dir * 520,
      rotate: dir * 18,
      opacity: 0,
      transition: { duration: 0.28, ease: "easeIn" },
    });
    onDecide(current, decision);
    x.set(0);
    controls.set({ x: 0, rotate: 0, opacity: 1 });
    setIndex((i) => i + 1);
    setBusy(false);
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
            className="pointer-events-none absolute left-5 top-6 -rotate-12 rounded-xl border-4 border-secondary px-3 py-1 text-2xl font-extrabold uppercase tracking-wide text-secondary"
          >
            Me interesa
          </motion.div>
          <motion.div
            style={{ opacity: nopeOpacity }}
            className="pointer-events-none absolute right-5 top-6 rotate-12 rounded-xl border-4 border-danger px-3 py-1 text-2xl font-extrabold uppercase tracking-wide text-danger"
          >
            No
          </motion.div>
        </motion.div>
      </div>

      {/* Acciones */}
      <div className="mt-4 flex items-center justify-center gap-6">
        <motion.button
          type="button"
          aria-label="No gracias"
          onClick={() => decide("pass")}
          disabled={busy}
          whileTap={{ scale: 0.88 }}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-danger shadow-[var(--shadow-float)] ring-1 ring-zinc-100 disabled:opacity-50"
        >
          <CrossIcon />
        </motion.button>
        <motion.button
          type="button"
          aria-label="Me interesa"
          onClick={() => decide("like")}
          disabled={busy}
          whileTap={{ scale: 0.88 }}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-white shadow-[0_10px_24px_rgba(34,197,94,0.4)] disabled:opacity-50"
        >
          <CheckIcon size={34} />
        </motion.button>
      </div>
    </div>
  );
}

function CrossIcon() {
  return (
    <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
