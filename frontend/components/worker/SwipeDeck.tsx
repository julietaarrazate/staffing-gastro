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
 * Mazo de tarjetas: la de arriba se arrastra (drag horizontal). Derecha =
 * "Me interesa", izquierda = "No gracias". Muestra la siguiente tarjeta
 * detrás para dar profundidad.
 *
 * Sin fila de botones fija debajo (Julieta, 2026-08-16, con capturas de
 * OkCupid: "borra el botón x y check, que aparezcan dependiendo si haces
 * swipe para un lado u otro"): los indicadores aparecen SOBRE la tarjeta
 * mientras arrastrás, y crecen con el gesto. Eso además le devuelve a la
 * tarjeta los ~80px de alto que ocupaba la fila — parte del pedido de que
 * "entre todo el contenido" sin deslizar dentro de la tarjeta.
 *
 * Accesibilidad: sacar los botones visibles dejaría el mazo sin ninguna
 * forma de decidir con teclado o lector de pantalla (el drag es puro
 * puntero). Por eso quedan dos botones `sr-only` + `focus:not-sr-only`:
 * invisibles mientras usás el dedo, pero alcanzables con Tab y anunciados
 * por el lector — misma función, cero costo visual.
 */
export default function SwipeDeck({
  shifts,
  onDecide,
  renderCard,
  empty,
  onOpen,
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
  /** Tocar la tarjeta (sin arrastrar) abre el detalle del turno. Antes el
   *  mazo SÓLO dejaba swipear: no había forma de mirar el turno completo ni
   *  de entrar al comercio sin decidir primero (Julieta, 2026-08-17: "cuando
   *  quiero abrir para mirar bien el turno tampoco abre, no hace nada, no
   *  puedo indagar el comercio, sólo me deja hacer swipe"). Se usa `onTap` de
   *  motion, que distingue tap de arrastre por diseño — un `onClick` común se
   *  disparaba también al terminar un swipe. */
  onOpen?: (shift: Shift) => void;
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
  // Los indicadores no sólo aparecen: CRECEN con el gesto (0.6→1), así el
  // arrastre se siente proporcional a la decisión, como en OkCupid. El umbral
  // de opacidad plena (±150) coincide a propósito con el punto en que soltar
  // ya dispara la decisión (±120 en `onDragEnd`): cuando el círculo está
  // lleno, ya estás del otro lado del umbral.
  const likeOpacity = useTransform(x, [40, 150], [0, 1]);
  const likeScale = useTransform(x, [40, 150], [0.6, 1]);
  const nopeOpacity = useTransform(x, [-150, -40], [1, 0]);
  const nopeScale = useTransform(x, [-150, -40], [1, 0.6]);
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
          onTap={() => {
            // `busy` cubre la animación de salida: sin esto, un tap durante
            // el vuelo de la carta abriría el detalle de un turno que el
            // usuario acaba de descartar.
            if (!busy) onOpen?.(current);
          }}
          onDragEnd={(_, info) => {
            if (info.offset.x > 120 || info.velocity.x > 700) decide("like");
            else if (info.offset.x < -120 || info.velocity.x < -700) decide("pass");
          }}
        >
          {renderCard(current)}

          {/* Indicadores de decisión, estilo OkCupid: círculos grandes que
              aparecen y crecen sobre la tarjeta según hacia dónde arrastrás.
              Reemplazan a la fila de botones fija que había debajo y a los
              sellos de texto ("ME INTERESA"/"NO") que había antes acá.
              Centrados verticalmente y hacia el borde correspondiente, para
              que el pulgar no los tape mientras arrastra. */}
          <motion.div
            style={{ opacity: nopeOpacity, scale: nopeScale }}
            className="pointer-events-none absolute left-6 top-1/2 flex h-20 w-20 -translate-y-1/2 items-center justify-center rounded-full bg-card text-danger-text shadow-[var(--shadow-float)] ring-1 ring-line"
          >
            <CrossIcon />
          </motion.div>
          <motion.div
            style={{ opacity: likeOpacity, scale: likeScale }}
            className="pointer-events-none absolute right-6 top-1/2 flex h-20 w-20 -translate-y-1/2 items-center justify-center rounded-full bg-success text-white shadow-[0_10px_24px_rgba(46,139,87,0.45)]"
          >
            <CheckIcon size={34} />
          </motion.div>
        </motion.div>
      </div>

      {/* Único camino no-táctil para decidir, ahora que no hay botones
          visibles: invisibles hasta que los enfocás con Tab, y ahí sí se
          muestran (`focus:not-sr-only`). Sin esto el mazo quedaría
          inoperable con teclado o lector de pantalla — el drag es puro
          puntero. */}
      <div className="sr-only focus-within:not-sr-only focus-within:mt-4 focus-within:flex focus-within:items-center focus-within:justify-center focus-within:gap-4">
        <button
          type="button"
          onClick={() => decide("pass")}
          disabled={busy}
          className="rounded-full bg-card px-4 py-2 text-sm font-semibold text-danger-text ring-1 ring-line disabled:opacity-50"
        >
          No gracias
        </button>
        <button
          type="button"
          onClick={() => decide("like")}
          disabled={busy}
          className="rounded-full bg-success px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Me interesa
        </button>
      </div>
    </div>
  );
}

function CrossIcon() {
  return (
    <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
