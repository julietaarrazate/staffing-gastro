"use client";

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import OpportunityCard from "@/components/worker/OpportunityCard";
import type { Shift, WorkerSkill } from "@/lib/types";

// Turnos de ejemplo con la pinta real del feed (mismo componente que ve un
// trabajador logueado). Sin foto de local: cae al estado real "sin foto" de
// OpportunityCard (tinte de rubro + ícono grande), no una imagen inventada.
function exampleShift(input: {
  id: string;
  position: WorkerSkill;
  city: string;
  pay: number;
  start: string;
  end: string;
  companyName: string;
  urgent?: boolean;
  dressCode?: string;
}): Shift {
  return {
    id: input.id,
    company_id: input.id,
    position: input.position,
    quantity: 1,
    start_at: input.start,
    end_at: input.end,
    pay_amount: String(input.pay),
    currency: "ARS",
    tips: true,
    meal: false,
    dress_code: input.dressCode ?? null,
    urgent: input.urgent ?? false,
    address: null,
    city: input.city,
    latitude: null,
    longitude: null,
    title: null,
    description: null,
    status: "publicado",
    worker_profile_id: null,
    check_in_latitude: null,
    check_in_longitude: null,
    check_in_at: null,
    check_out_latitude: null,
    check_out_longitude: null,
    check_out_at: null,
    paid_at: null,
    no_show_at: null,
    last_no_show_worker_profile_id: null,
    event_id: null,
    event_name: null,
    created_at: null,
    company_name: input.companyName,
    company_logo_url: null,
    company_verified: false,
  };
}

const EXAMPLE_SHIFTS: Shift[] = [
  exampleShift({
    id: "demo-1",
    position: "mozo",
    city: "Palermo",
    pay: 70000,
    // Mismo día (no cruza medianoche): formatShiftRange usa el formato corto
    // de una línea — clave para que el texto entre cómodo en la tarjeta.
    start: "2026-07-24T19:00:00-03:00",
    end: "2026-07-24T23:30:00-03:00",
    companyName: "Bar Uriarte",
    urgent: true,
    dressCode: "Camisa negra",
  }),
  exampleShift({
    id: "demo-2",
    position: "bartender",
    city: "San Telmo",
    pay: 85000,
    start: "2026-07-25T20:00:00-03:00",
    end: "2026-07-25T23:45:00-03:00",
    companyName: "Coctelería Defensa",
  }),
  exampleShift({
    id: "demo-3",
    position: "barista",
    city: "Recoleta",
    pay: 52000,
    start: "2026-07-26T09:00:00-03:00",
    end: "2026-07-26T15:00:00-03:00",
    companyName: "Café Quintana",
  }),
];

// Ninguna tiene foto (`company_logo_url: null` arriba) — las 3 conviven a la
// vista al mismo tiempo como "product shot" del hero, así que acá SÍ importa
// que cada una tenga su propio color (a diferencia del feed real, donde un
// turno por vez hace que un solo acento de marca sea lo correcto — ver
// `heroFallbackClassName` en OpportunityCard). Julieta, captura 2026-08-16:
// "modificaste el color de las tarjetas que se mueven a un solo naranja,
// antes eran de colores, ponele un color que combine y contraste, uno para
// cada una". Se mantiene dentro de la paleta cálida de la marca (naranja/
// terracota/ámbar, mismo criterio que `SKILL_ACCENT` en skill-style.tsx) en
// vez de volver al arcoíris que esa paleta reemplazó a propósito.
const HERO_FALLBACKS = [
  "bg-gradient-to-br from-primary to-primary-strong",
  "bg-gradient-to-br from-red-600 to-red-900",
  "bg-gradient-to-br from-amber-500 to-amber-800",
];

type Pose = { x: number; y: number; rotate: number; opacity: number; scale: number; z: number };

// Las 3 poses del stack: de encima (front) a la más lejana (back2). Mismos
// valores que el diseño estático original (translate-x-4/translate-y-7/
// rotate-6 para la de más atrás, etc.) para no romper la identidad visual.
const POSES: Pose[] = [
  { x: 0, y: 0, rotate: 0, opacity: 1, scale: 1, z: 30 },
  { x: -12, y: 12, rotate: -4, opacity: 0.95, scale: 0.97, z: 20 },
  { x: 16, y: 28, rotate: 6, opacity: 0.9, scale: 0.94, z: 10 },
];

// Reparte el progreso de scroll (0→1) en 3 tercios con una transición corta
// en cada borde y una "pausa" (hold) en el medio — así cada tarjeta se lee
// tranquila antes de ceder el lugar a la siguiente.
const SEGMENTS = [0, 0.298, 0.368, 0.631, 0.702, 1];

/**
 * Una tarjeta del stack: su pose (posición/rotación/escala/opacidad/z) rota
 * cíclicamente entre las 3 poses según el progreso del scroll — cada tarjeta
 * pasa su turno "adelante" una vez durante el recorrido.
 */
function StackCard({
  shift,
  index,
  progress,
  heroFallbackClassName,
}: {
  shift: Shift;
  index: number;
  progress: MotionValue<number>;
  heroFallbackClassName: string;
}) {
  const poseAt = (seg: number) => POSES[(index + seg) % 3];
  const values = (key: keyof Pose) => [
    poseAt(0)[key],
    poseAt(0)[key],
    poseAt(1)[key],
    poseAt(1)[key],
    poseAt(2)[key],
    poseAt(2)[key],
  ];

  const x = useTransform(progress, SEGMENTS, values("x"));
  const y = useTransform(progress, SEGMENTS, values("y"));
  const rotate = useTransform(progress, SEGMENTS, values("rotate"));
  const opacity = useTransform(progress, SEGMENTS, values("opacity"));
  const scale = useTransform(progress, SEGMENTS, values("scale"));
  const zRaw = useTransform(progress, SEGMENTS, values("z"));
  const zIndex = useTransform(zRaw, Math.round);

  return (
    <motion.div className="absolute inset-0" style={{ x, y, rotate, opacity, scale, zIndex }}>
      <OpportunityCard shift={shift} heroFallbackClassName={heroFallbackClassName} />
    </motion.div>
  );
}

/**
 * Product shot del hero: las tarjetas reales de turno (OpportunityCard), en
 * stack, saliendo de un marco de celular dibujado con CSS. Mientras el
 * usuario scrollea la sección, el celular queda sticky (desktop/tablet) y las
 * 3 tarjetas se van turnando adelante con el progreso del scroll — no es
 * decoración: es el mismo stack de turnos que ve un trabajador logueado.
 *
 * En mobile no hay alto de sobra para un sticky largo: `sticky` sólo se
 * aplica desde `sm:`, así que en mobile el celular scrollea normal (sin
 * fijarse) y el ciclo de las tarjetas queda como un barrido suave al pasar la
 * sección. Aun así el contenedor mantiene un `h-[140vh]` (más que la altura
 * de viewport típica) en vez de alto automático: `useScroll` con offset
 * ["start start","end end"] necesita que el contenedor sea MÁS ALTO que el
 * viewport para que el progreso avance monótono 0→1 — si es más bajo (como
 * quedaba con alto automático, ~600px de contenido en un viewport típico de
 * ~700-900px), el orden de los dos bordes se invierte y el progreso queda
 * errático, lo que se vio como un glitch real: texto de dos tarjetas
 * ilegiblemente superpuesto a mitad de una transición congelada.
 */
export default function ScrollHeroShowcase() {
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  // Con reduced-motion, progreso fijo en 0: cada tarjeta cae en su pose
  // inicial (POSES[index]) — exactamente el stack estático original.
  const staticProgress = useMotionValue(0);
  const progress = reducedMotion ? staticProgress : scrollYProgress;

  return (
    <div
      ref={containerRef}
      className={reducedMotion ? "relative" : "relative h-[140vh] sm:h-[240vh]"}
    >
      <div
        className={
          reducedMotion
            ? "flex justify-center"
            : "flex h-full items-center justify-center pb-6 sm:h-auto sm:items-start sm:sticky sm:top-16 sm:pb-10"
        }
      >
        <div className="relative mx-auto h-[560px] w-[320px] select-none sm:h-[600px] sm:w-[340px]">
          {/* Chasis del teléfono */}
          <div className="absolute inset-x-0 top-0 h-[500px] rounded-[3rem] bg-ink p-2.5 shadow-2xl sm:h-[536px]">
            <div className="relative h-full w-full overflow-hidden rounded-[2.4rem] bg-paper">
              <div className="absolute left-1/2 top-3 z-10 h-1.5 w-14 -translate-x-1/2 rounded-full bg-ink/15" />
              <div className="px-6 pt-11">
                <div className="h-3 w-28 rounded-full bg-ink/10" />
                <div className="mt-2.5 h-2 w-20 rounded-full bg-ink/5" />
              </div>
            </div>
          </div>

          {/* Stack de tarjetas, apoyado sobre el teléfono. Ancho generoso
              (~90% del ancho de la pantalla) para que el cuerpo de la
              tarjeta real (pago, horario, cantidad) entre en una línea. */}
          <div className="absolute inset-x-0 top-[92px] z-20 mx-auto w-[276px] sm:top-[100px] sm:w-[292px]">
            <div className="relative h-[440px] sm:h-[460px]">
              {EXAMPLE_SHIFTS.map((shift, i) => (
                <StackCard
                  key={shift.id}
                  shift={shift}
                  index={i}
                  progress={progress}
                  heroFallbackClassName={HERO_FALLBACKS[i]}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
