"use client";

import { useEffect } from "react";
import PaginaAviso from "@/components/PaginaAviso";
import { Button } from "@/components/ui";

/**
 * Pantalla de error general de Next.js: lo que se ve cuando una pantalla se
 * rompe al dibujarse (en vez de quedar en blanco). Hermana de `not-found.tsx`:
 * misma `PaginaAviso`, con «Probar de nuevo» (`reset` vuelve a dibujar el
 * pedazo que falló) y la salida a inicio como link. Un solo ámbar: el botón.
 *
 * El error se manda a Sentry sólo si hay DSN (igual que `lib/push.ts`); el
 * mensaje técnico nunca se muestra a la persona.
 */
export default function ErrorGeneral({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    void import("@/lib/sentry-client")
      .then(({ captureException }) => captureException(error))
      .catch(() => {});
  }, [error]);

  return (
    <PaginaAviso
      titulo="Algo salió mal"
      texto="Tuvimos un problema al mostrar esta pantalla. Probá de nuevo; si sigue igual, volvé al inicio."
      secundaria={{ label: "Ir al inicio", href: "/" }}
    >
      <Button fullWidth size="lg" onClick={reset}>
        Probar de nuevo
      </Button>
    </PaginaAviso>
  );
}
