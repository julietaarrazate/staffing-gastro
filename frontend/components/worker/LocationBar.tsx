"use client";

import { useState } from "react";
import { MapPinIcon } from "@/components/icons";
import {
  captureCurrentLocation,
  clearStoredLocation,
  type CurrentLocation,
} from "@/lib/current-location";

/**
 * Desde dónde se están midiendo los turnos del feed, siempre a la vista.
 *
 * El trabajador tiene que poder saber —y cambiar— desde qué punto se ordena
 * su feed. Antes se medía siempre desde la zona fija del perfil, sin decirlo
 * en ningún lado: si estabas en otro barrio, los turnos de al lado te
 * aparecían como lejanos y no había forma de entender por qué.
 */
export default function LocationBar({
  current,
  profileCity,
  onChange,
}: {
  current: CurrentLocation | null;
  profileCity: string | null;
  onChange: (location: CurrentLocation | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function useHere() {
    setError(null);
    setLoading(true);
    try {
      onChange(await captureCurrentLocation());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No pudimos acceder a tu ubicación."
      );
    } finally {
      setLoading(false);
    }
  }

  function backToProfile() {
    clearStoredLocation();
    onChange(null);
    setError(null);
  }

  return (
    // Un renglón debajo del saludo, no una barra propia (2026-09-28,
    // diagnóstico de sobrecarga): arriba del primer turno había buscador,
    // barra de ubicación y chips, tres maneras de decir qué y dónde. La zona
    // sigue a la vista y se cambia desde acá mismo, sin ocupar una fila.
    <div className="mt-0.5">
      <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm text-ink/55">
        <MapPinIcon size={14} className="shrink-0 text-ink/40" />
        <span className="min-w-0 truncate">
          {current ? (
            <>
              Turnos cerca de <span className="font-semibold text-ink">donde estás ahora</span>
            </>
          ) : profileCity ? (
            <>
              Turnos cerca de <span className="font-semibold text-ink">{profileCity}</span>
            </>
          ) : (
            "Ordená los turnos por cercanía"
          )}
        </span>
        <span aria-hidden className="text-ink/30">·</span>
        {current ? (
          <button
            type="button"
            onClick={backToProfile}
            className="shrink-0 font-semibold text-primary-text"
          >
            Volver a mi zona
          </button>
        ) : (
          <button
            type="button"
            onClick={useHere}
            disabled={loading}
            className="shrink-0 font-semibold text-primary-text disabled:opacity-60"
          >
            {loading ? "Ubicando…" : "Estoy acá"}
          </button>
        )}
      </p>
      {error && <p className="mt-1 text-xs text-danger-text">{error}</p>}
    </div>
  );
}
