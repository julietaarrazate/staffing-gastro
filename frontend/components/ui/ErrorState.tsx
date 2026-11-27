"use client";

import EmptyState from "./EmptyState";
import { ErrorIllustration } from "@/components/illustrations";

/** Los dos renglones de «no se pudo cargar», UNOS solos: las pantallas que no
 * usan `ErrorState` (la tarjeta chica del mapa, las filas del admin) los
 * importan en vez de escribir su propia versión. */
export const CARGA_FALLIDA_TITULO = "No pudimos cargar";
export const CARGA_FALLIDA_TEXTO = "Revisá tu conexión y probá de nuevo.";

/**
 * Pantalla (o bloque) de una carga que falló: dice que no se pudo y deja
 * «Reintentar». Existe para que un error NUNCA se vea como «no hay nada»: el
 * vacío afirma algo sobre los datos; esto sólo admite que no se llegó a verlos.
 * Es el `EmptyState` con la ilustración de error y el reintento como única
 * acción (el ámbar de la pantalla).
 */
export default function ErrorState({
  onRetry,
  title = CARGA_FALLIDA_TITULO,
  message = CARGA_FALLIDA_TEXTO,
}: {
  onRetry: () => void;
  title?: string;
  message?: string;
}) {
  return (
    <div role="alert">
      <EmptyState
        icon={<ErrorIllustration color="var(--color-primary)" />}
        title={title}
        subtitle={message}
        primaryAction={{ label: "Reintentar", onClick: onRetry }}
      />
    </div>
  );
}
