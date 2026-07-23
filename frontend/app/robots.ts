import type { MetadataRoute } from "next";

// Next.js sirve esto en /robots.txt. Base alineada con `metadataBase` del
// layout raíz (app/layout.tsx) y con `getPublicUrl` de la página pública del
// turno (app/turno/[id]/page.tsx).
const BASE_URL = "https://staffya.com.ar";

/**
 * Le dice a los buscadores qué indexar. Permitimos las páginas públicas (la
 * landing, registro/login, legales y —clave para el loop de difusión por
 * WhatsApp— las páginas públicas de turno `/turno/[id]`) y bloqueamos todo lo
 * que vive detrás de sesión (feed, matches, chats, perfil, admin, suscripción,
 * mapa/búsqueda, fichas de comercio/trabajador) más el reseteo de contraseña,
 * que no aporta SEO y no debería aparecer en resultados.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/feed",
        "/my-shifts",
        "/chats",
        "/profile",
        "/admin",
        "/subscription",
        "/search",
        "/map",
        "/companies",
        "/workers",
        "/recuperar",
        "/restablecer",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
