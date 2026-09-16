"use client";

/**
 * Control de "Disponible ahora" (ADR-0014): el trabajador comparte dónde
 * está buscando en este momento, para que la distancia que ve el comercio
 * (mapa y postulaciones) no dependa de su domicilio.
 *
 * Mismo criterio explícito y reversible que `EnRouteToggle` ("va en
 * camino"): el texto dice qué se comparte y hasta cuándo, nunca "compartir
 * ubicación" a secas. Diferencia real con "va en camino": esto es UNA
 * captura, no un seguimiento — se lo dice también en el texto, porque es la
 * pregunta que le importa a quien está por tocar el botón.
 */

import { MapPinIcon } from "@/components/icons";
import { Button, ErrorBanner } from "@/components/ui";
import { formatShiftTime } from "@/lib/datetime";
import { useAvailableNow } from "@/lib/use-available-now";

export default function AvailableNowToggle({ token }: { token: string | null }) {
  const { active, until, loading, error, start, stop } = useAvailableNow(token);

  return (
    <div className="rounded-[var(--radius-card)] bg-surface p-3.5 ring-1 ring-line">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
            active ? "bg-primary text-night" : "bg-card text-ink/45"
          }`}
        >
          <MapPinIcon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            {active ? "Estás disponible ahora" : "Avisá que estás disponible ahora"}
          </p>
          <p className="mt-0.5 text-xs text-ink/60">
            {active
              ? `El comercio ve la distancia real hasta las ${
                  until ? formatShiftTime(until) : ""
                }, o hasta que lo apagués. Es una sola posición, no un seguimiento.`
              : "Compartís tu posición UNA vez (no un seguimiento) para que la distancia que ve el comercio sea la real, no la de tu domicilio. Se apaga solo en unas horas, o cuando quieras."}
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-2.5">
          <ErrorBanner message={error} />
        </div>
      )}

      <Button
        variant={active ? "surface" : "primary"}
        size="sm"
        fullWidth
        loading={loading}
        onClick={active ? stop : start}
        className="mt-3"
      >
        {active ? "Dejar de compartir" : "Estoy disponible ahora"}
      </Button>
    </div>
  );
}
