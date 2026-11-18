/**
 * Compartir Oído desde la landing (pedido de Julieta, 2026-11-18): un link
 * directo para pasarle la página a alguien, sin que moleste a la vista. Vive
 * en el pie, al lado de lo legal (`components/landing/CompartirLanding.tsx`).
 *
 * El texto le habla a los dos lados, como la landing, y no promete tiempos.
 * Mismo camino que compartir un turno (`lib/shift-share.ts`): el menú de
 * compartir del teléfono si existe, y si no, WhatsApp.
 */
import { SITE_URL } from "@/lib/site";

export const LANDING_SHARE_TEXT =
  "Te paso Oído: personal gastronómico en Buenos Aires. Para locales que necesitan cubrir un turno y para quienes buscan turnos cerca.";

export function shareLanding(): void {
  if (typeof navigator !== "undefined" && "share" in navigator) {
    // El link va aparte del texto: con los dos juntos WhatsApp lo repite.
    navigator.share({ title: "Oído", text: LANDING_SHARE_TEXT, url: SITE_URL }).catch(() => {
      // Se canceló el menú de compartir: no es un error.
    });
    return;
  }
  const waUrl = `https://wa.me/?text=${encodeURIComponent(`${LANDING_SHARE_TEXT} ${SITE_URL}`)}`;
  window.open(waUrl, "_blank", "noopener,noreferrer");
}
