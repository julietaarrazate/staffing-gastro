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
    // Sin margen propio: el espaciado antes/después lo controla el padre
    // (app/feed/page.tsx), igual que el resto de los bloques apilados de la
    // cabecera — antes tenía `mt-3` acá Y `mb-3` en el bloque anterior, que en
    // un `flex flex-col` NO colapsan (a diferencia del flujo normal): el
    // espacio real terminaba siendo el doble (24px) de lo que se ve en el
    // resto de la pantalla (8px), y encima sin nada de aire después, antes
    // del chip de urgentes (auditoría de espaciado, Julieta, 2026-08-16).
    <div>
      <div className="flex items-center gap-2 rounded-full bg-white px-3.5 py-2 ring-1 ring-line">
        <MapPinIcon size={16} className="shrink-0 text-primary-text" />
        <p className="min-w-0 flex-1 truncate text-sm text-ink/70">
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
        </p>
        {current ? (
          <button
            type="button"
            onClick={backToProfile}
            className="shrink-0 text-sm font-semibold text-primary-text"
          >
            Volver a mi zona
          </button>
        ) : (
          <button
            type="button"
            onClick={useHere}
            disabled={loading}
            className="shrink-0 text-sm font-semibold text-primary-text disabled:opacity-60"
          >
            {loading ? "Ubicando…" : "Estoy acá"}
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 px-1 text-xs text-danger-text">{error}</p>}
    </div>
  );
}
