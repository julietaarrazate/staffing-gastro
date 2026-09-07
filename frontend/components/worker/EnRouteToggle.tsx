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

import { MapPinIcon } from "@/components/icons";
import { Button, ErrorBanner } from "@/components/ui";
import { useEnRouteSharing } from "@/lib/use-en-route-sharing";

export default function EnRouteToggle({
  shiftId,
  token,
}: {
  shiftId: string;
  token: string | null;
}) {
  const { sharing, error, starting, start, stop } = useEnRouteSharing(shiftId, token);

  return (
    <div className="mt-3 rounded-[var(--radius-card)] bg-surface p-3.5 ring-1 ring-line">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
            sharing ? "bg-primary text-night" : "bg-card text-ink/45"
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
              : "El comercio ve dónde estás mientras viajás, hasta que marcás tu llegada. Podés cortarlo cuando quieras."}
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-2.5">
          <ErrorBanner message={error} />
        </div>
      )}

      <Button
        variant={sharing ? "surface" : "primary"}
        size="sm"
        fullWidth
        loading={starting}
        onClick={sharing ? stop : start}
        className="mt-3"
      >
        {sharing ? "Dejar de compartir" : "Voy en camino"}
      </Button>
    </div>
  );
}
