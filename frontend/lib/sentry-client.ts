// Lo único de "@sentry/nextjs" que usa el browser. Se importa con `import()`
// desde instrumentation-client.ts: al nombrar sólo estas funciones, el
// bundler deja afuera lo que no se usa (Replay, Feedback, tracing). Antes se
// importaba el paquete entero: ~534 KB sin comprimir en todas las rutas
// (medido 2026-10-22).
import { captureException, captureRouterTransitionStart, init } from "@sentry/nextjs";

import { SENTRY_DATA_COLLECTION } from "@/lib/sentry";

export { captureException, captureRouterTransitionStart };

export function startSentry(dsn: string) {
  init({
    dsn,
    environment: process.env.NODE_ENV,
    // Sólo captura de errores; sin tracing de performance por ahora.
    tracesSampleRate: 0,
    // v11: `sendDefaultPii` ya no existe; ver lib/sentry.ts.
    dataCollection: SENTRY_DATA_COLLECTION,
  });
}
