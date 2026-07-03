// Sentry del lado servidor de Next (R1.1). No-op sin NEXT_PUBLIC_SENTRY_DSN.
// El import de "@sentry/nextjs" es DINÁMICO: sólo se pide cuando hay DSN, así
// el SDK no se bundlea en el server sin necesidad (mismo criterio que
// instrumentation-client.ts).
import type { captureRequestError as CaptureRequestError } from "@sentry/nextjs";

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

// Next.js llama a este hook en cada request con error; se resuelve en server
// así que un import dinámico acá no afecta al bundle del cliente. Sin DSN es
// un no-op.
export const onRequestError: typeof CaptureRequestError = (...args) => {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.captureRequestError(...args);
  });
};
