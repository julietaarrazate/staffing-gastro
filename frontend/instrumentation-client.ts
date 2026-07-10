// Sentry en el browser (R1.1). Sólo se activa si NEXT_PUBLIC_SENTRY_DSN está
// configurada en Vercel; sin DSN este archivo es un no-op. El import de
// "@sentry/nextjs" es DINÁMICO (`import()`) y sólo se dispara si hay DSN: sin
// DSN (caso actual) el SDK completo (~138 KB gzip) no se agrega al bundle de
// ninguna ruta — antes se importaba estático a nivel de módulo, así que
// viajaba siempre aunque `Sentry.init` estuviera gateado en runtime. Sin
// upload de source maps por ahora (requiere auth token; si se quiere, es un
// cambio aparte con withSentryConfig).
import type { captureRouterTransitionStart as CaptureRouterTransitionStart } from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      // Sólo captura de errores; sin tracing de performance por ahora.
      tracesSampleRate: 0,
      sendDefaultPii: false,
    });
  });
}

// Next.js requiere este export de forma síncrona (se lee al cargar el
// módulo, para instrumentar las transiciones de router). Sin DSN queda como
// no-op sin costo; con DSN, delega a Sentry vía import dinámico (ya
// cacheado por el `import()` de arriba, así que no vuelve a pedir el chunk).
export const onRouterTransitionStart: typeof CaptureRouterTransitionStart = (
  ...args
) => {
  if (!dsn) return;
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.captureRouterTransitionStart(...args);
  });
};
