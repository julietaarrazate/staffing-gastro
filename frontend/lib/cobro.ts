import type { Shift } from "@/lib/types";
import { AR_TIMEZONE } from "@/lib/datetime";

/**
 * «¿Ya cobraste este turno?» (2026-11-27). Oído no mueve plata: el comercio le
 * paga a la persona por fuera. La persona puede confirmar que cobró o avisar
 * que todavía no. Las reglas (desde cuándo, una sola vez, definitivo) las pone
 * el servidor; acá se decide qué mostrar y cuándo ofrecer cada botón.
 */

export type FaseCobro =
  /** Todavía no dijo nada: se le pregunta. */
  | "pregunta"
  /** «Sí, cobré»: definitivo. */
  | "confirmado"
  /** «Todavía no cobré»: soporte ya lo sabe; puede pasar a «Sí, cobré». */
  | "avisado";

export type EstadoCobro = {
  fase: FaseCobro;
  /** ¿Se puede tocar «Todavía no» ahora? Sólo tiene sentido en `pregunta`. */
  puedeAvisar: boolean;
  /** Si todavía no se puede avisar, desde cuándo (ISO). */
  avisarDesde: string | null;
  /** El comercio ya marcó el turno como pagado. */
  comercioMarcoPagado: boolean;
};

type CamposDelCobro = Pick<
  Shift,
  "paid_at" | "worker_confirmed_paid_at" | "worker_reported_unpaid_at" | "unpaid_report_opens_at"
>;

export function estadoCobro(shift: CamposDelCobro, now: Date): EstadoCobro {
  const comercioMarcoPagado = shift.paid_at != null;
  const desde = shift.unpaid_report_opens_at ?? null;
  const fase: FaseCobro = shift.worker_confirmed_paid_at
    ? "confirmado"
    : shift.worker_reported_unpaid_at
      ? "avisado"
      : "pregunta";
  const puedeAvisar = desde != null && new Date(desde).getTime() <= now.getTime();
  return {
    fase,
    puedeAvisar,
    avisarDesde: puedeAvisar ? null : desde,
    comercioMarcoPagado,
  };
}

/** «el 28/11 a las 00:58», hora argentina. */
export function cuandoPuedeAvisar(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString("es-AR", { timeZone: AR_TIMEZONE, day: "2-digit", month: "2-digit" });
  const hora = d.toLocaleTimeString("es-AR", {
    timeZone: AR_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `el ${dia} a las ${hora}`;
}

/** Lo que ve el comercio en su turno: lo que dijo la persona, o `null` si no
 * dijo nada. Si confirmó después de avisar, vale lo último. */
export function cobroParaElComercio(
  shift: Pick<Shift, "worker_name" | "worker_confirmed_paid_at" | "worker_reported_unpaid_at">,
): { tono: "ok" | "aviso"; texto: string } | null {
  const nombre = shift.worker_name?.trim() || "La persona";
  if (shift.worker_confirmed_paid_at) return { tono: "ok", texto: `${nombre} confirmó que cobró` };
  if (shift.worker_reported_unpaid_at) return { tono: "aviso", texto: `${nombre} avisó que todavía no cobró` };
  return null;
}
