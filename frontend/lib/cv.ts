import { api } from "@/lib/api";
import { safeHttpsUrl } from "@/lib/safe-url";

/**
 * El CV del trabajador se abre con un link que vence (ADR-0021, actualización
 * 2026-11-19). El perfil ya no trae una URL que sirva sola: quien hoy lo puede
 * ver (la persona, un admin o un comercio con un turno o una postulación de
 * ella) pide `GET /workers/{id}/cv-link` en el momento de abrirlo. Un link
 * visto una vez deja de andar a los 5 minutos.
 */
export interface CvLink {
  url: string;
  /** `null` sólo para un link pegado a mano (o un CV viejo todavía público). */
  expires_at: string | null;
}

export function cvLinkPath(profileId: string, download = false): string {
  return `/workers/${encodeURIComponent(profileId)}/cv-link${download ? "?download=true" : ""}`;
}

/** Lo que se muestra si el link no llega (sin conexión, CV que ya no está). */
export const CV_OPEN_ERROR = "No pudimos abrir el CV. Probá de nuevo en un rato.";

/**
 * Abre el CV en otra pestaña, o lo baja con `download`. La pestaña se abre
 * YA, dentro del toque, para que el navegador no la bloquee como ventana
 * emergente, y se le carga el link cuando llega. Para bajarlo no hace falta
 * pestaña: el link pide el archivo como adjunto y la pantalla se queda donde
 * está. Devuelve `false` si no se pudo (la pantalla muestra `CV_OPEN_ERROR`).
 */
export async function openCv(
  profileId: string,
  token: string | null,
  download = false
): Promise<boolean> {
  const tab = download ? null : window.open("", "_blank");
  try {
    const link = await api.get<CvLink>(cvLinkPath(profileId, download), token);
    const href = safeHttpsUrl(link.url);
    if (!href) throw new Error("link inválido");
    if (tab) {
      tab.opener = null;
      tab.location.href = href;
    } else {
      // Para bajarlo, o sin pestaña nueva (bloqueada, o la app instalada).
      window.location.assign(href);
    }
    return true;
  } catch {
    tab?.close();
    return false;
  }
}
