// Sentry en el browser (R1.1). Sólo se activa si NEXT_PUBLIC_SENTRY_DSN está
// configurada en Vercel; sin DSN este archivo es un no-op y no agrega peso
// funcional. Sin upload de source maps por ahora (requiere auth token; si se
// quiere, es un cambio aparte con withSentryConfig).
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Sólo captura de errores; sin tracing de performance por ahora.
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
