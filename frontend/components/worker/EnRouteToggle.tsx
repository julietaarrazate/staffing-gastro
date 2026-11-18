"use client";

/**
 * Control de "va en camino" para el trabajador: comparte dónde está mientras
 * viaja a un turno confirmado, para que el comercio vea que está llegando.
 *
 * El control es deliberadamente explícito y reversible. Compartir la propia
 * ubicación no puede ser algo que pasa de fondo porque aceptaste un turno: la
 * persona tiene que verlo prendido, entender hasta cuándo dura y poder
 * apagarlo en el mismo lugar donde lo prendió. Por eso el texto dice qué se
 * comparte y cuándo se corta, en vez de un "compartir ubicación" a secas.
 */

import { useEffect } from "react";
import { MapPinIcon } from "@/components/icons";
import { Button, ErrorBanner } from "@/components/ui";
import { useEnRouteSharing } from "@/lib/use-en-route-sharing";

export default function EnRouteToggle({
  shiftId,
  token,
  prominent = true,
  lastSharedAt,
  onSharingChange,
}: {
  shiftId: string;
  token: string | null;
  /** `false` cuando otra acción de la tarjeta es la principal (un solo ámbar). */
  prominent?: boolean;
  /**
   * El servidor todavía guarda una última posición de este viaje
   * (`shift.en_route_at`). Pasa cuando la persona salió de la pantalla sin
   * apagar: acá ya no comparte, pero el comercio sigue viendo ese punto.
   */
  lastSharedAt?: string | null;
  onSharingChange?: (sharing: boolean) => void;
}) {
  const { sharing, error, starting, start, stop, clearLast, clearing, cleared, mayBeVisible } =
    useEnRouteSharing(shiftId, token);
  // Puede quedar un punto a la vista del comercio sin que acá se esté
  // compartiendo: salió de la pantalla sin apagar, el borrado todavía no se
  // confirmó, o un error cortó el viaje. Hasta que el servidor confirme que
  // lo borró, la tarjeta lo dice y ofrece borrarlo.
  const leftover = !sharing && !cleared && (lastSharedAt != null || mayBeVisible);

  useEffect(() => {
    onSharingChange?.(sharing);
  }, [sharing, onSharingChange]);

  return (
    <div className="mt-3 rounded-[var(--radius-card)] bg-surface p-3.5 ring-1 ring-line">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
            sharing ? "bg-primary-text text-card" : "bg-card text-ink/45"
          }`}
        >
          <MapPinIcon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            {sharing ? "Estás avisando que vas en camino" : "Avisá que vas en camino"}
          </p>
          <p className="mt-0.5 text-xs text-ink/60">
            {sharing
              ? "El comercio ve que estás llegando. Se corta solo cuando marcás tu llegada."
              : leftover
                ? clearing
                  ? "Borrando tu última ubicación…"
                  : "Ya no estás compartiendo, pero el comercio todavía puede ver tu última ubicación."
                : "El comercio ve dónde estás mientras viajás, hasta que marcás tu llegada. Podés cortarlo cuando quieras: deja de verte en el momento."}
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-2.5">
          <ErrorBanner message={error} />
        </div>
      )}

      <Button
        variant={sharing || !prominent ? "surface" : "primary"}
        size="sm"
        fullWidth
        loading={starting}
        onClick={sharing ? stop : start}
        className="mt-3"
      >
        {sharing ? "Dejar de compartir" : "Voy en camino"}
      </Button>
      {leftover && (
        <Button
          variant="surface"
          size="sm"
          fullWidth
          loading={clearing}
          onClick={clearLast}
          className="mt-2"
        >
          Borrar mi última ubicación
        </Button>
      )}
    </div>
  );
}
