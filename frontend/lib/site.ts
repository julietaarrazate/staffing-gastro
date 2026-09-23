/**
 * Dominio público de Oído — la única fuente para URLs absolutas (Open Graph,
 * sitemap, robots, fallback del link compartible de un turno).
 *
 * Estaba escrito a mano en cuatro lugares como `staffya.com.ar`, un dominio
 * que no existe (no resuelve en DNS): toda vista previa de un link compartido
 * pedía su imagen a ese host y el sitemap le anunciaba a Google URLs
 * muertas. El dominio real es `oido.com.ar` (conectado el 2026-09-08).
 */
export const SITE_HOST = "oido.com.ar";
export const SITE_URL = `https://${SITE_HOST}`;
