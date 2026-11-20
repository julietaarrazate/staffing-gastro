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

export default function AvailableNowToggle({
  token,
  quieta = false,
}: {
  token: string | null;
  /** La acción de la pantalla es otra (un solo ámbar por pantalla): el botón
   * va quieto, con el relleno de la hoja y la letra azul. */
  quieta?: boolean;
}) {
  const { active, until, loading, error, start, stop } = useAvailableNow(token);

  return (
    // `caja-suave`, `disponible-activo` y `boton-quieto`: los ganchos de la
        // dirección suave (ADR-0028), que sólo pesan adentro de `.estilo-suave`.
    <div className="caja-suave rounded-[var(--radius-card)] bg-surface p-3.5 ring-1 ring-line">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
            active ? "disponible-activo bg-primary text-night" : "bg-card text-ink/45"
          }`}
        >
          <MapPinIcon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            {active ? "Estás disponible ahora" : "Avisá que estás disponible ahora"}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
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
        variant={active || quieta ? "surface" : "primary"}
        size="sm"
        fullWidth
        loading={loading}
        onClick={active ? stop : start}
        className={active || quieta ? "boton-quieto mt-3" : "mt-3"}
      >
        {active ? "Dejar de compartir" : "Estoy disponible ahora"}
      </Button>
    </div>
  );
}
