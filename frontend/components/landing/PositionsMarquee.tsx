import { SKILL_LABELS, WORKER_SKILLS } from "@/lib/types";

// Mismos barrios que ya aparecen como ejemplo en el resto de la landing y en
// los datos demo (backend/scripts/seed_demo_data.py) — no es una lista de
// "cobertura" (la beta cerrada arranca en Palermo, ver docs/planning/LAUNCH_PLAN.md),
// es la misma ambientación de ejemplo que ya usa el hero.
const NEIGHBORHOODS = ["Palermo", "San Telmo", "Recoleta", "Belgrano", "Villa Crespo", "Caballito"];

/* Puestos y barrios se distinguen por color en vez de ir todos blancos: la
   cinta mezcla dos cosas distintas ("Barista" y "Palermo" no son lo mismo) y
   hasta ahora se leían igual. Manteca para el oficio, cielo para el lugar —
   el color acá lleva información, no es decoración. */
const CHIPS: { label: string; accent: string }[] = [
  ...WORKER_SKILLS.map((skill) => ({
    label: SKILL_LABELS[skill],
    accent: "bg-manteca-tint text-manteca-text",
  })),
  ...NEIGHBORHOODS.map((name) => ({
    label: name,
    accent: "bg-cielo-tint text-cielo-text",
  })),
];

/**
 * Cinta horizontal de chips (puestos + barrios) con desplazamiento continuo
 * lento, puro CSS (`.animate-marquee` en globals.css) — sin JS, liviano, y ya
 * queda pausado por la regla global de `prefers-reduced-motion`.
 */
export default function PositionsMarquee() {
  return (
    <div
      className="overflow-hidden py-1"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
      }}
    >
      <div className="flex w-max gap-3 animate-marquee">
        {[...CHIPS, ...CHIPS].map((chip, i) => (
          <span
            key={`${chip.label}-${i}`}
            className={`shrink-0 select-none rounded-full px-4 py-2 text-sm font-bold ${chip.accent}`}
          >
            {chip.label}
          </span>
        ))}
      </div>
    </div>
  );
}
