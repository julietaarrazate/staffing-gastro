import type { NextConfig } from "next";

// La URL del backend se toma de NEXT_PUBLIC_API_URL si está definida
// (ej: .env.local en desarrollo apunta a localhost). Si no está definida
// —como en el build de producción de Vercel— cae al backend de Render.
// Se deja acá (y no en un .env.production) porque los .env están en
// .gitignore; este archivo sí se versiona y no es un secreto: las vars
// NEXT_PUBLIC_* se inlinean en el bundle del browser de todos modos.
const PROD_API_URL = "https://staffya-backend.onrender.com/api/v1";

const API_ORIGIN = new URL(process.env.NEXT_PUBLIC_API_URL ?? PROD_API_URL).origin;
const API_WS_ORIGIN = API_ORIGIN.replace(/^http/, "ws");

// Content-Security-Policy (R1.3, ver docs/reference/SECURITY.md). Mitiga el impacto de
// un eventual XSS (los tokens viven en localStorage). Se aplica sólo en
// producción: el dev server de Next necesita eval/inline para el hot reload.
// - script-src: Next inyecta bootstrap inline ('unsafe-inline'; nonces
//   requerirían middleware propio, se acepta el trade-off por ahora).
//   blob: habilita el worker de MapLibre en navegadores sin worker-src.
// - connect-src: API + WebSocket propios, el estilo/tiles vectoriales de
//   CARTO (ver ADR-0001) y Nominatim/OSM (geocoder gratis del alta de local
//   desde el mapa, ver ADR-0006 — sin esto el `fetch` del buscador de
//   direcciones queda bloqueado por CSP aunque la respuesta sea correcta).
// - img-src https:: las fotos demo (loremflickr/pravatar) redirigen a CDNs
//   variables; al pasar a Cloudinary propio (R2.5) se puede endurecer.
// - accounts.google.com: botón "Continuar con Google" (Google Identity
//   Services, ver docs/reference/ACCESO_MODERNO.md) — el script se carga desde ahí
//   (script-src), el botón se renderiza en un iframe propio (frame-src) y el
//   flujo hace sus propias llamadas (connect-src). Sin esto el botón carga
//   pero el iframe queda bloqueado por `default-src 'self'`.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src https://accounts.google.com",
  "script-src 'self' 'unsafe-inline' blob: https://vercel.live https://accounts.google.com",
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self' ${API_ORIGIN} ${API_WS_ORIGIN} https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://nominatim.openstreetmap.org https://api.cloudinary.com https://vercel.live https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io https://accounts.google.com`,
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(self), microphone=(self), camera=()" },
];

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? PROD_API_URL,
  },
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
