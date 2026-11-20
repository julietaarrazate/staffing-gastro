import type { Shift, ShiftStatus } from "@/lib/types";
import { ClockIcon, CloseIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export type ShiftStepperPerspective = "employer" | "worker";

// Cuatro hitos del ciclo de vida (Ley de marca: un solo ámbar por pantalla, y
// ése es del botón de la tarjeta; el stepper marca lo actual en azul de marca,
// `primary-text` con `card` encima, como el círculo de comparar de Matches, y
// rojo SÓLO para cancelado).
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
 * Los pasos del turno en un renglón, tachados a mano como en el pase de la
 * cocina (dirección «con relieve», Julieta 2026-11-19): lo hecho tachado en
 * azul hondo, lo actual en negrita, lo que falta en la letra suave.
 * Cancelado: el hito donde murió va en rojo con una cruz y los que siguen
 * quedan sin tachar — no se agrega un 5º paso. No cubierto: lo mismo, con un
 * reloj y sin el rojo.
 */
export default function ShiftLifecycleStepper({
  shift,
  perspective = "employer",
  className,
  caption: captionMode = "always",
  variante = "tachados",
}: {
  shift: ShiftForStepper;
  perspective?: ShiftStepperPerspective;
  className?: string;
  /** "cutShort": el texto de abajo sólo aparece cuando el turno se cortó
   *  (cancelado / no cubierto), que es cuando dice algo que el chip de estado
   *  no dice: EN QUÉ paso murió. En el resto repetía el chip ("Publicado" /
   *  "Paso 1 de 4: Publicado"), así que queda sólo para lectores de
   *  pantalla, en el `aria-label` de la lista. */
  caption?: "always" | "cutShort";
  /** "barras" (dirección suave, ADR-0028; la tarjeta de hoy de Mis turnos):
   *  los mismos cuatro hitos, cada uno con su barra arriba; la barra de lo
   *  hecho y de lo actual en azul hondo; lo hecho en letra azul, sin tacha
   *  (un tilde al lado no entraba a 320 px). */
  variante?: "tachados" | "barras";
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

  // Con la dirección «con relieve» (Julieta, 2026-11-19): los cuatro hitos
  // en un renglón, como en el pase de la cocina. Lo hecho se tacha a mano en
  // azul hondo, lo actual va en negrita y lo que falta queda en la letra
  // suave. Antes eran circulitos numerados unidos por una línea; los hitos,
  // sus nombres y en qué paso está cada estado no cambiaron.
  const barras = variante === "barras";
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {/* `role="list"` explícito: sin viñetas, Safari le saca a la lista su
          rol de lista. */}
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
      <ol
        role="list"
        aria-label={caption}
        className={barras ? "pasos-barras" : "pasos-tachados flex flex-wrap items-baseline gap-x-3 gap-y-1"}
      >
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
            <li
              key={label}
              data-paso={state}
              aria-current={state === "current" || state === "death" || state === "uncovered" ? "step" : undefined}
              className={cn(
                barras ? "min-w-0 text-xs" : "inline-flex items-center gap-1 whitespace-nowrap text-xs",
                state === "completed" && (barras ? "font-bold text-primary-text" : "font-medium text-ink-soft"),
                state === "current" && "font-bold text-ink",
                (state === "future" || state === "cutoff") && "font-medium text-ink-soft",
                state === "death" && "font-bold text-danger-text",
                state === "uncovered" && "font-bold text-ink-soft",
              )}
            >
              {state === "death" && <CloseIcon size={12} aria-hidden />}
              {state === "uncovered" && <ClockIcon size={12} aria-hidden />}
              <span className="relative">
                {label}
                {state === "completed" && barras && <span className="sr-only"> (hecho)</span>}
                {state === "completed" && !barras && (
                  <>
                    <svg className="tacha" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
                      <path d="M2 6C20 2 40 8 60 4S90 3 98 6" />
                    </svg>
                    <span className="sr-only"> (hecho)</span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {(captionMode === "always" || isCutShort) && (
        <p
          aria-hidden="true"
          className={cn("text-label font-semibold", isCancelled ? "text-danger-text" : "text-ink-soft")}
        >
          {caption}
        </p>
      )}
    </div>
  );
}
