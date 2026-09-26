"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion, useAnimationControls, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Shift } from "@/lib/types";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { Button } from "@/components/ui";
import { MOTION_UI } from "@/lib/motion";

type Direction = 1 | -1;

/**
 * Mazo de "Descubrir rápido": deslizar RECORRE, postularse es un botón.
 *
 * Antes el gesto decidía (derecha = postularse, izquierda = descartar), así
 * que no había forma de mirar varios turnos y elegir: el primer swipe ya te
 * comprometía o te sacaba el turno para siempre (Julieta, 2026-09-26: "no
 * podés seguir viendo los demás y elegir cuál querés verdaderamente"). Ahora
 * funciona como un carrusel: deslizar a la izquierda muestra el siguiente, a
 * la derecha vuelve al anterior, y nada se pierde. Postularse es la única
 * acción que compromete, y es explícita ("Postularme", debajo de la tarjeta).
 * No hay "descartar": el que no te sirve, lo pasás de largo.
 *
 * Tocar la tarjeta (sin arrastrar) abre el detalle del turno — `onTap` de
 * motion distingue tap de arrastre por diseño. Las flechas y el teclado
 * (← →) hacen lo mismo que el gesto, así el mazo se usa sin puntero.
 */
export default function SwipeDeck({
  shifts,
  onApply,
  renderCard,
  empty,
  onOpen,
}: {
  shifts: Shift[];
  /**
   * Devuelve `true` cuando la postulación quedó procesada y `false` cuando
   * falló: en ese caso la carta vuelve al mazo, en el lugar donde estaba,
   * para que el usuario pueda reintentar en vez de perderla.
   */
  onApply: (shift: Shift) => Promise<boolean>;
  renderCard: (shift: Shift) => ReactNode;
  empty: ReactNode;
  /** Tocar la tarjeta (sin arrastrar) abre el detalle del turno. */
  onOpen?: (shift: Shift) => void;
}) {
  // Mazo local para sacar la carta postulada de forma OPTIMISTA, sin esperar
  // la respuesta de red (contra un backend lento eso congelaba el mazo).
  const [deck, setDeck] = useState(shifts);
  const [index, setIndex] = useState(0);
  // `busy` sólo cubre las animaciones (~0.2s), no la red.
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDeck(shifts);
    setIndex(0);
  }, [shifts]);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-8, 0, 8]);
  const controls = useAnimationControls();
  const reducedMotion = useReducedMotion();

  const safeIndex = Math.min(index, Math.max(deck.length - 1, 0));
  const current = deck[safeIndex];
  const upcoming = deck[safeIndex + 1];
  const hasPrev = safeIndex > 0;
  const hasNext = safeIndex < deck.length - 1;

  /** Saca la carta hacia un lado y trae la otra desde el lado opuesto. */
  async function slide(dir: Direction, change: () => void) {
    setBusy(true);
    const transition = reducedMotion ? { duration: 0 } : MOTION_UI;
    await controls.start({ x: -dir * 420, opacity: 0, transition });
    change();
    x.set(dir * 420);
    controls.set({ x: dir * 420, opacity: 0 });
    await controls.start({ x: 0, opacity: 1, transition });
    setBusy(false);
  }

  function go(dir: Direction) {
    if (busy) return;
    if (dir === 1 && !hasNext) return;
    if (dir === -1 && !hasPrev) return;
    void slide(dir, () => setIndex(safeIndex + dir));
  }

  async function apply() {
    if (busy || !current) return;
    const shift = current;
    const at = safeIndex;
    setBusy(true);
    const transition = reducedMotion ? { duration: 0 } : MOTION_UI;
    // La carta postulada sube y se va: es otro gesto que "pasar de largo",
    // para que se note que ésta sí quedó enviada.
    await controls.start({ y: -60, scale: 0.96, opacity: 0, transition });
    setDeck((d) => d.filter((s) => s.id !== shift.id));
    // El índice queda donde estaba: ahora apunta al turno siguiente. Si era
    // el último, `safeIndex` lo acomoda al anterior.
    x.set(0);
    controls.set({ x: 0, y: 0, scale: 1, opacity: 1 });
    setBusy(false);
    // La red corre en segundo plano. Si falla, la carta vuelve a su lugar —
    // `onApply` ya mostró el error y conserva la Idempotency-Key, así que el
    // reintento es el mismo intento para el backend.
    void onApply(shift).then((ok) => {
      if (ok) return;
      setDeck((d) => (d.some((s) => s.id === shift.id) ? d : [...d.slice(0, at), shift, ...d.slice(at)]));
      setIndex(at);
    });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!current) return <>{empty}</>;

  const navButton =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-ink ring-1 ring-line transition active:scale-95 disabled:opacity-35";

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 select-none">
        {upcoming && (
          <div
            aria-hidden
            className="absolute inset-0 scale-[0.94] opacity-80"
            style={{ transformOrigin: "bottom" }}
          >
            {renderCard(upcoming)}
          </div>
        )}

        {/* Sin `key` por turno a propósito: la misma carta animada cambia de
            contenido. Con una `key`, el cambio de turno la remontaba en medio
            de `slide` y la animación de entrada nunca resolvía (el mazo
            quedaba trabado en `busy`). */}
        <motion.div
          data-testid="swipe-deck-card"
          className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
          style={{ x, rotate }}
          drag="x"
          dragSnapToOrigin
          // En los bordes del mazo la carta se resiste: no hay nada del otro lado.
          dragElastic={{ left: hasNext ? 0.6 : 0.15, right: hasPrev ? 0.6 : 0.15 }}
          animate={controls}
          onTap={() => {
            if (!busy) onOpen?.(current);
          }}
          onDragEnd={(_, info) => {
            if (info.offset.x < -100 || info.velocity.x < -600) go(1);
            else if (info.offset.x > 100 || info.velocity.x > 600) go(-1);
          }}
        >
          {renderCard(current)}
        </motion.div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button type="button" aria-label="Turno anterior" onClick={() => go(-1)} disabled={!hasPrev || busy} className={navButton}>
          <ChevronLeftIcon size={20} />
        </button>
        <Button fullWidth onClick={apply} disabled={busy}>
          Postularme
        </Button>
        <button type="button" aria-label="Turno siguiente" onClick={() => go(1)} disabled={!hasNext || busy} className={navButton}>
          <ChevronRightIcon size={20} />
        </button>
      </div>
      <p aria-live="polite" data-testid="swipe-deck-position" className="mt-2 text-center font-mono text-caption text-ink/55">
        {safeIndex + 1} de {deck.length}
      </p>
    </div>
  );
}
