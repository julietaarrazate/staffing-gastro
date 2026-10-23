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
