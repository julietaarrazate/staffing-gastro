import type { Shift, ShiftStatus } from "@/lib/types";
import { CheckIcon, ClockIcon, CloseIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export type ShiftStepperPerspective = "employer" | "worker";

// Cuatro hitos del ciclo de vida (Ley de marca: un solo acento naranja; el
// stepper usa naranja para lo vivo/actual y rojo SÓLO para cancelado).
const EMPLOYER_STEPS = ["Publicado", "Asignado", "En curso", "Finalizado"] as const;
const WORKER_STEPS = ["Postulado", "Aceptado", "En curso", "Finalizado"] as const;

// Bucket de los 13 `ShiftStatus` reales (lib/types.ts) en esos 4 hitos.
// Mismo bucket para las dos perspectivas: es el mismo campo `shift.status`,
// sólo cambia la palabra que se muestra (ver *_STEPS arriba). `cancelado` y
// `no_cubierto` (ADR-0015) quedan AFUERA a propósito: los dos son terminales
// sin un hito propio, y su paso se infiere con `inferDeathStep` en vez de
// buscarse acá.
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

type ShiftForStepper = Pick<
  Shift,
  "status" | "worker_profile_id" | "check_in_at" | "check_out_at" | "last_no_show_worker_profile_id"
>;

/**
 * A qué hito había llegado el turno antes de resolverse en un estado
 * terminal sin hito propio (`cancelado` o `no_cubierto`, ADR-0015). El
 * dominio no guarda el estado previo a ninguno de los dos (alcanzables desde
 * cualquier estado no terminal elegible), así que se infiere de las marcas
 * que sí sobreviven: si ya hubo check-in/check-out, murió "en curso"; si ya
 * tenía trabajador asignado, murió en "asignado"; si no, murió "publicado".
 *
 * `last_no_show_worker_profile_id` entra en el chequeo de "asignado" porque
 * `cancel()` y `mark_not_covered()` limpian `worker_profile_id` de forma
 * distinta: `cancel()` lo deja como estaba, `mark_not_covered()` lo pisa a
 * `null` (mismo patrón que `no_show()`) y guarda quién era ahí. Mirar sólo
 * `worker_profile_id` hacía que un turno `no_cubierto` que SÍ había sido
 * asignado apareciera muriendo en "Publicado" — encontrado por el propio
 * E2E de este archivo, no a ojo.
 */
function inferDeathStep(shift: ShiftForStepper): number {
  if (shift.check_in_at || shift.check_out_at) return 2;
  if (shift.worker_profile_id || shift.last_no_show_worker_profile_id) return 1;
  return 0;
}

/**
 * Stepper horizontal compacto del ciclo de vida del turno:
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
  // ADR-0015: mismo mecanismo visual que "cancelado" (se corta, no se agrega
  // un 5º paso), pero SIN el rojo — nadie decidió esto, es el sistema
  // constatando que el tiempo se agotó. Confundirlo con una cancelación
  // activa le haría preguntar al comercio/trabajador "cancelado por quién".
  const isNotCovered = shift.status === "no_cubierto";
  const isCutShort = isCancelled || isNotCovered;
  const currentStep = isCutShort ? inferDeathStep(shift) : STEP_BY_STATUS[shift.status];
  if (currentStep === undefined) return null;

  const caption = isCancelled
    ? `Cancelado en el paso ${currentStep + 1} de ${labels.length} (${labels[currentStep]})`
    : isNotCovered
      ? `No se cubrió en el paso ${currentStep + 1} de ${labels.length} (${labels[currentStep]})`
      : `Paso ${currentStep + 1} de ${labels.length}: ${labels[currentStep]}`;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div role="list" aria-label={caption} className="flex items-center">
        {labels.map((label, i) => {
          const state: "completed" | "current" | "future" | "death" | "uncovered" | "cutoff" =
            isCancelled
              ? i < currentStep
                ? "completed"
                : i === currentStep
                  ? "death"
                  : "cutoff"
              : isNotCovered
                ? i < currentStep
                  ? "completed"
                  : i === currentStep
                    ? "uncovered"
                    : "cutoff"
                : i < currentStep
                  ? "completed"
                  : i === currentStep
                    ? "current"
                    : "future";

          return (
            <div key={label} role="listitem" className="flex flex-1 items-center last:flex-none">
              <span
                aria-current={
                  state === "current" || state === "death" || state === "uncovered"
                    ? "step"
                    : undefined
                }
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors",
                  state === "completed" && "bg-primary-tint text-primary-text",
                  state === "current" && "bg-primary text-night ring-2 ring-primary/20",
                  state === "future" && "bg-surface text-ink/35",
                  state === "death" && "bg-danger text-white ring-2 ring-danger/20",
                  state === "uncovered" && "bg-surface text-ink/60 ring-2 ring-line",
                  state === "cutoff" && "bg-surface text-ink/20"
                )}
              >
                {state === "completed" && <CheckIcon size={12} />}
                {state === "death" && <CloseIcon size={12} />}
                {state === "uncovered" && <ClockIcon size={12} />}
                {(state === "current" || state === "future" || state === "cutoff") && i + 1}
              </span>
              {i < labels.length - 1 && (
                <span
                  className={cn(
                    "mx-1 h-0 flex-1 border-t-2 transition-colors",
                    i < currentStep
                      ? "border-solid border-primary/40"
                      : isCutShort
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
        className={cn("text-[11px] font-semibold", isCancelled ? "text-danger-text" : "text-ink/55")}
      >
        {caption}
      </p>
    </div>
  );
}
