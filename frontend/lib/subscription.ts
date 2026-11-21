/**
 * Cobro mensual del comercio (ADR-0022): un pago por mes con Mercado Pago,
 * sin débito automático. Helpers puros de la pantalla "Mi plan".
 */

export type PaymentReturn = "ok" | "pendiente" | "error";

export interface PaymentReturnMessage {
  tone: "ok" | "pending" | "error";
  title: string;
  text: string;
}

/**
 * Mensaje al volver de Mercado Pago (`/subscription?pago=ok|pendiente|error`,
 * las `back_urls` de la preferencia). La vuelta NO confirma el pago: lo
 * confirma el webhook, por eso "ok" dice que se puede tardar unos segundos.
 */
export function paymentReturnMessage(pago: string | null): PaymentReturnMessage | null {
  switch (pago) {
    case "ok":
      return {
        tone: "ok",
        title: "¡Listo! Recibimos tu pago",
        text: "Mercado Pago nos avisa en unos segundos y tu plan queda activo. Si todavía no lo ves, actualizá la página.",
      };
    case "pendiente":
      return {
        tone: "pending",
        title: "Tu pago quedó pendiente",
        text: "Mercado Pago todavía lo está procesando. Apenas se acredite, tu plan se activa solo y te avisamos.",
      };
    case "error":
      return {
        tone: "error",
        title: "El pago no se completó",
        text: "No se te cobró nada. Podés intentarlo de nuevo con dinero en cuenta, débito o transferencia.",
      };
    default:
      return null;
  }
}

/** El 402 de publicar por plan sin pagar (no por llegar al tope). */
export function isInactivePlanMessage(message: string | null | undefined): boolean {
  return !!message && message.startsWith("Tu plan no está activo");
}

/** "2026-11-01" → "1/11/2026" (fecha de negocio, ya viene en hora argentina). */
export function formatPlainDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

/**
 * Cuándo vence una fecha de negocio (`withdrawal_until`): el último instante de
 * ese día en hora argentina, porque el servidor la cuenta inclusive
 * (`hoy_art() <= deadline`). `null` si la fecha no se puede leer.
 */
export function endOfArgentinaDay(isoDate: string): number | null {
  const ms = Date.parse(`${isoDate.slice(0, 10)}T23:59:59.999-03:00`);
  return Number.isNaN(ms) ? null : ms;
}

/** Línea de la beta: mientras el tope no se exige, «Mi plan» no promete uno. */
export const BETA_SIN_TOPE_TEXT = "Durante la beta no hay tope de turnos.";

/** El tope del plan se hace cumplir salvo que el servidor diga que no. */
export function limiteExigido(sub: { limite_exigido?: boolean }): boolean {
  return sub.limite_exigido !== false;
}

/** «9 turnos publicados este mes»: el uso solo, sin «de N» que parezca excedido. */
export function usoSinTopeText(usados: number): string {
  return `${usados} ${usados === 1 ? "turno publicado" : "turnos publicados"} este mes`;
}

/** Umbral de «casi al límite»: cuando quedan pocos turnos se avisa antes de que falle publicar. */
export const LOW_REMAINING_THRESHOLD = 2;

/**
 * Qué acciones pide la tarjeta del plan actual (`SubscriptionStatusCard`):
 * pagar el mes (bloqueado, o vencido en los días de gracia) y mejorar el plan
 * (al límite o cerca, sólo con el tope exigido). La pantalla lo usa para que
 * haya **un solo botón ámbar** (Julieta, 2026-11-21): si la tarjeta de arriba
 * pide una acción, ningún plan de la lista va en ámbar.
 */
export function accionesDelPlanActual(
  sub: {
    billing_enabled?: boolean;
    renews?: boolean;
    status: string;
    paid_until?: string | null;
    can_publish?: boolean;
    max_turnos_mes: number | null;
    turnos_usados_mes: number;
    limite_exigido?: boolean;
  },
  ahora: number,
  puedePagar: boolean
): { pagar: boolean; alLimite: boolean; cercaDelLimite: boolean } {
  const billing = sub.billing_enabled === true;
  const renews = sub.renews !== false;
  const paidUntil = billing && sub.status === "activa" ? (sub.paid_until ?? null) : null;
  const inGrace = paidUntil !== null && new Date(paidUntil).getTime() < ahora;
  const blocked = billing && sub.can_publish === false;
  const remaining = sub.max_turnos_mes === null ? null : Math.max(sub.max_turnos_mes - sub.turnos_usados_mes, 0);
  const conTope = limiteExigido(sub);
  return {
    pagar: (blocked || (inGrace && renews)) && puedePagar,
    alLimite: conTope && remaining !== null && remaining <= 0,
    cercaDelLimite: conTope && remaining !== null && remaining > 0 && remaining <= LOW_REMAINING_THRESHOLD,
  };
}

/**
 * El plan de la lista que lleva el ámbar: el más barato por encima del actual,
 * y ninguno si arriba ya hay una acción en ámbar.
 */
export function planDestacado(
  plans: { code: string; price_ars: number | string }[],
  currentPriceArs: number,
  hayAccionArriba: boolean
): string | null {
  if (hayAccionArriba) return null;
  const superiores = plans
    .map((p) => ({ code: p.code, precio: Number(p.price_ars) }))
    .filter((p) => p.precio > currentPriceArs)
    .sort((a, b) => a.precio - b.precio);
  return superiores[0]?.code ?? null;
}
