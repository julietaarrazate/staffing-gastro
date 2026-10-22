// Opciones de Sentry compartidas por instrumentation.ts (server) e
// instrumentation-client.ts (browser). Este módulo NO importa "@sentry/nextjs"
// en runtime (sólo tipos), así no arrastra el SDK al bundle sin DSN.
import type { init } from "@sentry/nextjs";

type DataCollection = NonNullable<
  NonNullable<Parameters<typeof init>[0]>["dataCollection"]
>;

// Sentry v11 eliminó `sendDefaultPii` y lo reemplazó por `dataCollection`,
// cuyo default es MÁS permisivo que el `sendDefaultPii: false` de la v10
// (manda usuario, cookies, headers, cuerpos HTTP y query params). Acá se
// apaga todo explícitamente: sólo registro de errores, sin datos personales.
// Se conservan las líneas de código alrededor del error (no son datos del
// usuario) para que el stack trace sirva.
export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
} satisfies DataCollection;
