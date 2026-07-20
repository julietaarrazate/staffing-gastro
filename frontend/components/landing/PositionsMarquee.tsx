import { SKILL_LABELS, WORKER_SKILLS } from "@/lib/types";

// Mismos barrios que ya aparecen como ejemplo en el resto de la landing y en
// los datos demo (backend/scripts/seed_demo_data.py) — no es una lista de
// "cobertura" (la beta cerrada arranca en Palermo, ver docs/LAUNCH_PLAN.md),
// es la misma ambientación de ejemplo que ya usa el hero.
const NEIGHBORHOODS = ["Palermo", "San Telmo", "Recoleta", "Belgrano", "Villa Crespo", "Caballito"];

const CHIPS = [...WORKER_SKILLS.map((skill) => SKILL_LABELS[skill]), ...NEIGHBORHOODS];

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
        {[...CHIPS, ...CHIPS].map((label, i) => (
          <span
            key={`${label}-${i}`}
            className="shrink-0 select-none rounded-full bg-white px-4 py-2 text-sm font-bold text-ink/60 ring-1 ring-line"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
