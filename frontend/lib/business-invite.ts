/**
 * "Invitá a tu comercio": el trabajador le pasa Oído al local donde trabaja
 * (o donde le gustaría trabajar) por WhatsApp. Es la forma más barata de
 * sumar comercios, que es lo que le falta a la beta: el trabajador ya conoce
 * al encargado y el mensaje le llega de alguien de confianza, no de un
 * anuncio. Idea tomada de TitoFree ("Invitá a tu jefe"), que la usa como su
 * principal canal de crecimiento.
 *
 * El link abre el alta ya en "Comercio" (`/register?rol=comercio`), así quien
 * lo recibe no tiene que adivinar qué tipo de cuenta crear.
 */
import { SITE_URL } from "@/lib/site";

export const BUSINESS_INVITE_URL = `${SITE_URL}/register?rol=comercio`;

/** Mensaje listo para mandar. Habla del problema del comercio (quedarse sin
 * gente a último momento), no de la app. */
export function buildBusinessInviteText(): string {
  return (
    "Te paso Oído, una app para cubrir turnos en gastronomía: si te falta alguien, " +
    "publicás el turno y te avisan los que están cerca y disponibles. " +
    `Crear la cuenta es gratis: ${BUSINESS_INVITE_URL}`
  );
}

/** Abre el share sheet del teléfono (o WhatsApp Web si no hay), igual que
 * compartir un turno (`lib/shift-share.ts`). */
export function shareBusinessInvite(): void {
  const text = buildBusinessInviteText();

  if (typeof navigator !== "undefined" && "share" in navigator) {
    navigator.share({ title: "Oído", text }).catch(() => {
      // El usuario canceló el share sheet: no es un error.
    });
    return;
  }

  const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(waUrl, "_blank", "noopener,noreferrer");
}
