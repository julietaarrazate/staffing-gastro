import type { Shift, ShiftStatus } from "@/lib/types";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export type ShiftStepperPerspective = "employer" | "worker";

// Cuatro hitos del ciclo de vida (Ley de marca: un solo acento naranja; el
// stepper usa naranja para lo vivo/actual y rojo SÓLO para cancelado).
const EMPLOYER_STEPS = ["Publicado", "Asignado", "En curso", "Finalizado"] as const;
const WORKER_STEPS = ["Postulado", "Aceptado", "En curso", "Finalizado"] as const;

// Bucket de los 12 `ShiftStatus` reales (lib/types.ts) en esos 4 hitos.
// Mismo bucket para las dos perspectivas: es el mismo campo `shift.status`,
// sólo cambia la palabra que se muestra (ver *_STEPS arriba).
//
// Nota sobre `confirmado`: el spec original de este fix lo agrupaba con
// finalizado/pagado ("confirmado/finalizado/pagado=paso4"). Se corrige acá:
// el orden real es asignado → confirmado → en_camino → ... → finalizado
// (`backend/app/modules/shift/domain/entities.py`), así que ubicar
// `confirmado` en el último hito haría que el stepper retrocediera de
// "Finalizado" a "En curso" apenas el trabajador sale hacia el turno — un
// stepper no puede desandar un paso ya completado. `confirmado` cae en el
// mismo hito que `asignado` (paso 2: el trabajador ya está en el turno,
// haya confirmado o no, pero todavía no arrancó a trabajar).
const STEP_BY_STATUS: Partial<Record<ShiftStatus, number>> = {
  publicado: 0,
  buscando_personal: 0,
  asignado: 1,
  confirmado: 1,
  en_camino: 2,
  check_in: 2,
  trabajando: 2,
  check_out: 2,
  finalizado: 3,
  pagado: 3,
};

type ShiftForStepper = Pick<Shift, "status" | "worker_profile_id" | "check_in_at" | "check_out_at">;

/**
 * A qué hito había llegado el turno antes de cancelarse. El dominio no
 * guarda el estado previo a `cancelado` (`Shift.cancel()` es alcanzable
 * desde cualquier estado no terminal), así que se infiere de las marcas que
 * sí sobreviven: si ya hubo check-in/check-out, murió "en curso"; si ya
 * tenía trabajador asignado, murió en "asignado"; si no, murió "publicado".
 */
function inferDeathStep(shift: ShiftForStepper): number {
  if (shift.check_in_at || shift.check_out_at) return 2;
  if (shift.worker_profile_id) return 1;
  return 0;
}

/**
 * Stepper horizontal compacto del ciclo de vida del turno (inspirado en el
 * tracker de pedido de Clickie, trasladado a la marca naranja de Oído):
 * numeritos en círculo unidos por una línea, paso actual resaltado, pasos
 * completados con check. Cancelado: se corta (línea punteada) y el hito
 * donde murió se reemplaza por un marcador rojo "Cancelado" — no se agrega
 * un 5º paso.
 */
export default function ShiftLifecycleStepper({
  shift,
  perspective = "employer",
  className,
}: {
  shift: ShiftForStepper;
  perspective?: ShiftStepperPerspective;
  className?: string;
}) {
  // Un borrador todavía no entró al ciclo de vida (ni siquiera se publicó):
  // no hay ningún hito que resaltar todavía.
  if (shift.status === "borrador") return null;

  const labels = perspective === "worker" ? WORKER_STEPS : EMPLOYER_STEPS;
  const isCancelled = shift.status === "cancelado";
  const currentStep = isCancelled ? inferDeathStep(shift) : STEP_BY_STATUS[shift.status];
  if (currentStep === undefined) return null;

  const caption = isCancelled
    ? `Cancelado en el paso ${currentStep + 1} de ${labels.length} (${labels[currentStep]})`
    : `Paso ${currentStep + 1} de ${labels.length}: ${labels[currentStep]}`;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div role="list" aria-label={caption} className="flex items-center">
        {labels.map((label, i) => {
          const state: "completed" | "current" | "future" | "death" | "cutoff" = isCancelled
            ? i < currentStep
              ? "completed"
              : i === currentStep
                ? "death"
                : "cutoff"
            : i < currentStep
              ? "completed"
              : i === currentStep
                ? "current"
                : "future";

          return (
            <div key={label} role="listitem" className="flex flex-1 items-center last:flex-none">
              <span
                aria-current={state === "current" || state === "death" ? "step" : undefined}
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors",
                  state === "completed" && "bg-orange-100 text-primary-text",
                  state === "current" && "bg-primary text-ink ring-2 ring-primary/20",
                  state === "future" && "bg-surface text-ink/35",
                  state === "death" && "bg-danger text-white ring-2 ring-red-100",
                  state === "cutoff" && "bg-surface text-ink/20"
                )}
              >
                {state === "completed" && <CheckIcon size={12} />}
                {state === "death" && <CloseIcon size={12} />}
                {(state === "current" || state === "future" || state === "cutoff") && i + 1}
              </span>
              {i < labels.length - 1 && (
                <span
                  className={cn(
                    "mx-1 h-0 flex-1 border-t-2 transition-colors",
                    i < currentStep
                      ? "border-solid border-primary/40"
                      : isCancelled
                        ? "border-dashed border-line"
                        : "border-solid border-line"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      <p
        aria-hidden="true"
        className={cn(
          "text-[11px] font-semibold",
          isCancelled ? "text-danger-text" : "text-ink/55"
        )}
      >
        {caption}
      </p>
    </div>
  );
}
