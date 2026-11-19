// Etiquetas de "Personas" en el panel de admin (lista y ficha).

import type { AdminCloseAction, AdminShiftClosure, SuspensionPreview } from "@/lib/types";

export const ROLE_LABELS: Record<string, string> = {
  worker: "Trabajador",
  employer: "Comercio",
  admin: "Admin",
};

export const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  suspended: "Suspendido",
  deleted: "Eliminado",
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  abierto: "Abierto",
  cerrado: "Cerrado",
};

/** Qué les pasa a sus turnos si se confirma la suspensión (ADR-0024), en
 * frases para el diálogo de «Suspender». Sin turnos tocados, una sola frase
 * que lo dice: la admin sabe que se miró y dio cero. */
export function suspensionImpactLines(preview: SuspensionPreview): string[] {
  const { hidden, cancelled, reopened } = preview;
  const lines: string[] = [];
  if (hidden > 0) {
    lines.push(
      hidden === 1
        ? "Se oculta 1 turno abierto: nadie lo ve ni se postula. Si la reactivás, vuelve a verse."
        : `Se ocultan ${hidden} turnos abiertos: nadie los ve ni se postula. Si la reactivás, vuelven a verse.`
    );
  }
  if (cancelled > 0) {
    lines.push(
      cancelled === 1
        ? "Se cancela 1 turno con alguien asignado o confirmado. Le avisamos a esa persona, sin penalidad para nadie."
        : `Se cancelan ${cancelled} turnos con alguien asignado o confirmado. Le avisamos a cada persona, sin penalidad para nadie.`
    );
  }
  if (reopened > 0) {
    lines.push(
      reopened === 1
        ? "1 turno suyo vuelve a buscar personal. Le avisamos al comercio, sin sumarle una cancelación."
        : `${reopened} turnos suyos vuelven a buscar personal. Le avisamos a cada comercio, sin sumarle una cancelación.`
    );
  }
  if (lines.length === 0) lines.push("No tiene turnos por cubrir: no se toca ninguno.");
  return lines;
}

/** «Cerrar turno» (decisión 21): por qué aparece el botón en la fila. */
export function adminCloseHint(action: AdminCloseAction): string {
  if (action.check_out && action.finish) {
    return "Nadie puede entrar a marcar la salida ni a cerrarlo.";
  }
  if (action.check_out) return "No puede entrar a marcar la salida.";
  return "El comercio no puede entrar a cerrarlo.";
}

/** Qué va a pasar si la admin confirma «Cerrar turno», en frases para el
 * diálogo. `hora` es la de ahora («21:40»): la salida se marca con esa hora. */
export function adminCloseLines(action: AdminCloseAction, hora: string): string[] {
  const lines: string[] = [];
  if (action.check_out && action.finish) {
    lines.push(
      `Marcamos la salida de la persona a las ${hora} y cerramos el turno, en nombre de las dos cuentas.`
    );
  } else if (action.check_out) {
    lines.push(`Marcamos la salida de la persona a las ${hora}, en su nombre.`);
  } else {
    lines.push("Cerramos el turno en nombre del comercio.");
  }
  if (action.finish) {
    lines.push("Le suma el turno a la persona, con la puntualidad de su llegada.");
  }
  if (action.notifies === "company") {
    lines.push("Le avisamos al comercio para que cierre el turno, como siempre.");
  } else if (action.notifies === "worker") {
    lines.push("Le avisamos a la persona para que califique al comercio.");
  } else {
    lines.push("Nadie recibe avisos en el celular: las dos cuentas están suspendidas.");
  }
  lines.push("No se marca como pagado. Queda registrado que lo hiciste vos.");
  return lines;
}

/** Qué hizo «Cerrar turno», para mostrarlo al terminar. `hora` es la de la
 * salida marcada, si se marcó. */
export function adminCloseResult(result: AdminShiftClosure, hora: string | null): string {
  const done =
    result.check_out && result.finish
      ? `Marcamos la salida a las ${hora} y cerramos el turno.`
      : result.check_out
        ? `Marcamos la salida a las ${hora}.`
        : "Cerramos el turno.";
  const notice =
    result.notifies === "company"
      ? " Le avisamos al comercio para que lo cierre."
      : result.notifies === "worker"
        ? " Le avisamos a la persona para que califique."
        : "";
  return `${done}${notice}`;
}
