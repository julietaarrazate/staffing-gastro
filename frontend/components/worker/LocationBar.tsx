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
    // Desde el 2026-11-18 va sobre el cielo del Inicio (`.app-cielo`): la
    // letra hereda la tinta del cielo, y lo que se toca va subrayado en vez
    // de en el azul de los links, que sobre el celeste no llega a contraste.
    <div className="mt-1">
      <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm">
        <MapPinIcon size={14} className="shrink-0 opacity-70" />
        <span className="min-w-0 truncate">
          {current ? (
            <>
              Turnos cerca de <span className="font-semibold">donde estás ahora</span>
            </>
          ) : profileCity ? (
            <>
              Turnos cerca de <span className="font-semibold">{profileCity}</span>
            </>
          ) : (
            "Ordená los turnos por cercanía"
          )}
        </span>
        <span aria-hidden className="opacity-50">·</span>
        {current ? (
          <button
            type="button"
            onClick={backToProfile}
            className="shrink-0 font-semibold underline underline-offset-2"
          >
            Volver a mi zona
          </button>
        ) : (
          <button
            type="button"
            onClick={useHere}
            disabled={loading}
            className="shrink-0 font-semibold underline underline-offset-2 disabled:opacity-60"
          >
            {loading ? "Ubicando…" : "Estoy acá"}
          </button>
        )}
      </p>
      {error && (
        <p className="mt-1.5 inline-block rounded-[var(--radius-chip)] bg-card px-2 py-1 text-xs text-danger-text">{error}</p>
      )}
    </div>
  );
}
