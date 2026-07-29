"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Alturas del sheet como fracción del contenedor: a la altura de la tarjeta /
 * intermedio / cubre casi todo el mapa. El primer snap ERA 0.25 y quedaba por
 * debajo de lo que una tarjeta necesita (medido: tarjeta 238px + manija 26px +
 * padding inferior 16px ≈ 280px sobre un contenedor típico de ~700px ≈ 0.40),
 * así que a ese tamaño la tarjeta quedaba recortada. 0.44 la deja completa con
 * un poco de aire. El del medio (antes 0.58, tapaba de más sin mostrar nada
 * adicional útil — el carrusel es horizontal, no gana contenido con más alto)
 * baja a 0.5 sólo para que quede un paso intermedio real hacia el máximo.
 */
const SNAPS = [0.44, 0.5, 0.88] as const;
type SnapIndex = 0 | 1 | 2;
const MAX_SNAP: SnapIndex = 2;

/**
 * Sheet inferior arrastrable a tres alturas (estilo Uber Eats/Airbnb) para el
 * layout 40/60 de `/map`. El panel tiene altura fija (la del snap más alto) y
 * se desplaza en `y`; así el drag es un simple `translateY`, con `motion`
 * (spring) para el asentado. Ver docs/MAPS_REDESIGN.md §5/§6.
 */
export default function MapSheet({
  children,
  containerRef,
}: {
  children: ReactNode;
  containerRef: RefObject<HTMLElement | null>;
}) {
  const [containerHeight, setContainerHeight] = useState(0);
  // Arranca en el snap más chico (a la altura de la tarjeta): el mapa queda
  // lo más visible posible por defecto; antes arrancaba en el intermedio
  // (0.58) y tapaba más mapa del necesario sin mostrar nada extra (Julieta,
  // 2026-07-29).
  const [snap, setSnap] = useState<SnapIndex>(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setContainerHeight(entry.contentRect.height));
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  const panelHeight = containerHeight * SNAPS[MAX_SNAP];
  const offsetFor = (i: SnapIndex) => containerHeight * (SNAPS[MAX_SNAP] - SNAPS[i]);
  const maxDrag = offsetFor(0);

  function snapToClosest(rawY: number) {
    let best: SnapIndex = 0;
    let bestDist = Infinity;
    ([0, 1, 2] as SnapIndex[]).forEach((i) => {
      const d = Math.abs(offsetFor(i) - rawY);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setSnap(best);
  }

  return (
    <motion.div
      drag={containerHeight > 0 ? "y" : false}
      dragElastic={0.12}
      dragConstraints={{ top: 0, bottom: maxDrag }}
      dragMomentum={false}
      animate={{ y: offsetFor(snap) }}
      transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 340, damping: 34 }}
      onDragEnd={(_, info) => snapToClosest(offsetFor(snap) + info.offset.y)}
      style={{ height: panelHeight || "58%" }}
      className="absolute inset-x-0 bottom-0 z-10 flex flex-col overflow-hidden rounded-t-[var(--radius-sheet)] bg-white shadow-[0_-8px_30px_rgba(17,17,20,0.14)]"
    >
      <button
        type="button"
        aria-label="Arrastrá o tocá para cambiar el tamaño de la lista de turnos"
        onClick={() => setSnap((s) => ((s + 1) % 3) as SnapIndex)}
        className="flex shrink-0 cursor-grab touch-none flex-col items-center gap-1.5 py-2.5 active:cursor-grabbing"
      >
        <span className="h-1.5 w-10 rounded-full bg-line" />
      </button>
      <div className="min-h-0 flex-1">{children}</div>
    </motion.div>
  );
}
