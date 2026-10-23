// Sentry en el browser (R1.1). Sólo se activa si NEXT_PUBLIC_SENTRY_DSN está
// configurada; sin DSN este archivo es un no-op. El SDK se carga con
// `import()` y recién cuando la página terminó de cargar y el navegador
// quedó libre: antes arrancaba junto con la hidratación y en celular
// demoraba ~0,9 s lo primero que se ve (medido 2026-10-22). Los errores que
// pasen antes de eso se guardan y se mandan apenas Sentry arranca. Sin
// upload de source maps por ahora (requiere auth token; si se quiere, es un
// cambio aparte con withSentryConfig).
import type { captureRouterTransitionStart as CaptureRouterTransitionStart } from "@sentry/nextjs";

type SentryClient = typeof import("@/lib/sentry-client");

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

let client: SentryClient | null = null;

if (dsn && typeof window !== "undefined") {
  const early: unknown[] = [];
  const onError = (event: ErrorEvent) => early.push(event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) => early.push(event.reason);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  const start = () => {
    void import("@/lib/sentry-client").then((loaded) => {
      loaded.startSentry(dsn);
      client = loaded;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      for (const error of early.splice(0)) loaded.captureException(error);
    });
  };
  const whenIdle = () => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(start, { timeout: 4000 });
    } else {
      setTimeout(start, 1500);
    }
  };
  if (document.readyState === "complete") whenIdle();
  else window.addEventListener("load", whenIdle, { once: true });
}

// Next.js requiere este export de forma síncrona (se lee al cargar el
// módulo, para instrumentar las transiciones de router). Antes de que
// Sentry arranque no hay nada que instrumentar, así que no hace nada.
export const onRouterTransitionStart: typeof CaptureRouterTransitionStart = (
  ...args
) => {
  client?.captureRouterTransitionStart(...args);
};
