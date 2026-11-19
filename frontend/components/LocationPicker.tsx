"use client";

/**
 * Selector de ubicación para publicar turnos. Cascada provincia → barrio/ciudad
 * que autocompleta las coordenadas (centro del barrio/ciudad) para el matching
 * por distancia, sin pedir latitud/longitud a mano. Incluye un atajo para usar
 * la ubicación actual del dispositivo y precisar las coordenadas.
 */
import { useId, useState } from "react";
import { PROVINCES } from "@/lib/locations";
import { getCurrentPosition } from "@/lib/geolocation";
import { haversineKm } from "@/lib/map/geo";
import { MapPinIcon } from "@/components/icons";
import { BOTON_LISO } from "@/components/ui/Button";

export type LocationSelection = {
  city: string;
  latitude: number;
  longitude: number;
};

function shortProvince(name: string): string {
  if (name.startsWith("Ciudad Autónoma")) return "CABA";
  if (name.startsWith("Buenos Aires")) return "Buenos Aires";
  return name;
}

/** Radio máximo para ponerle nombre de barrio/ciudad a la ubicación del GPS. */
const MAX_NAME_DISTANCE_KM = 50;

/** Interpreta una zona guardada («Palermo, CABA») como índices de provincia y localidad. */
export function parseSavedCity(
  city: string | null | undefined
): { provinceIdx: number; localityName: string } | null {
  if (!city) return null;
  const cut = city.lastIndexOf(", ");
  if (cut < 0) return null;
  const name = city.slice(0, cut).trim();
  const prov = city.slice(cut + 2).trim();
  const provinceIdx = PROVINCES.findIndex((p) => shortProvince(p.name) === prov || p.name === prov);
  if (provinceIdx < 0) return null;
  return PROVINCES[provinceIdx].localities.some((l) => l.name === name)
    ? { provinceIdx, localityName: name }
    : null;
}

/** Barrio/ciudad más cercano a un punto, dentro de un radio razonable. */
export function nearestLocality(
  lat: number,
  lng: number
): { provinceIdx: number; localityName: string } | null {
  let best: { provinceIdx: number; localityName: string; km: number } | null = null;
  PROVINCES.forEach((p, provinceIdx) => {
    for (const l of p.localities) {
      const km = haversineKm([lat, lng], [l.lat, l.lng]);
      if (!best || km < best.km) best = { provinceIdx, localityName: l.name, km };
    }
  });
  const found = best as { provinceIdx: number; localityName: string; km: number } | null;
  return found && found.km <= MAX_NAME_DISTANCE_KM
    ? { provinceIdx: found.provinceIdx, localityName: found.localityName }
    : null;
}

/** Nombre de zona para un punto de GPS: el barrio elegido si el GPS queda a ≤50 km de él; si no, el más cercano. */
export function resolveGpsLocality(
  provinceIdx: number,
  localityName: string,
  lat: number,
  lng: number
): { provinceIdx: number; localityName: string } | null {
  const chosen = localityName
    ? PROVINCES[provinceIdx]?.localities.find((l) => l.name === localityName)
    : undefined;
  if (chosen && haversineKm([lat, lng], [chosen.lat, chosen.lng]) <= MAX_NAME_DISTANCE_KM) {
    return { provinceIdx, localityName };
  }
  return nearestLocality(lat, lng);
}

// Mismo tratamiento que `TextField` del design system (alto de toque 48px,
// radio y anillo por token): antes usaba grises/naranjas crudos y quedaba
// visiblemente distinto a los demás campos de la app.
const selectClass =
  "mt-1 min-h-[48px] w-full rounded-[var(--radius-input)] bg-surface px-4 text-body text-ink outline-none ring-1 ring-line transition";

export default function LocationPicker({
  onSelect,
  initialCity,
}: {
  onSelect: (selection: LocationSelection) => void;
  /** Zona ya guardada («Palermo, CABA»): los selectores arrancan mostrándola. */
  initialCity?: string | null;
}) {
  // Id único por instancia (no hardcodeado): el picker se usa en varios
  // formularios y un id fijo colisionaría si dos llegaran a montarse juntos.
  const idPrefix = useId();
  // Hasta que la persona toca un selector, se muestra la zona guardada (que
  // puede llegar después de montar, cuando termina de cargar el perfil).
  const [picked, setPicked] = useState<{ provinceIdx: number; localityName: string } | null>(null);
  const saved = parseSavedCity(initialCity);
  const { provinceIdx, localityName } = picked ?? saved ?? { provinceIdx: 0, localityName: "" };
  const setProvinceIdx = (idx: number) => setPicked({ provinceIdx: idx, localityName: "" });
  const setLocalityName = (name: string) => setPicked({ provinceIdx, localityName: name });
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  const province = PROVINCES[provinceIdx];

  function changeProvince(idx: number) {
    setProvinceIdx(idx);
    setGeoStatus("idle");
    setGeoMsg(null);
  }

  function selectLocality(name: string) {
    setLocalityName(name);
    setGeoStatus("idle");
    setGeoMsg(null);
    const loc = province.localities.find((l) => l.name === name);
    if (!loc) return;
    onSelect({
      city: `${loc.name}, ${shortProvince(province.name)}`,
      latitude: loc.lat,
      longitude: loc.lng,
    });
  }

  async function useMyLocation() {
    setGeoStatus("loading");
    setGeoMsg(null);
    try {
      const { latitude, longitude } = await getCurrentPosition();
      // Nunca se guarda «Mi ubicación actual» como nombre de zona: se usa el
      // barrio/ciudad elegido o, si no hay, el más cercano al GPS.
      // El barrio elegido/guardado sólo vale si el GPS está cerca de él: con
      // «Palermo» guardado y el GPS en Rosario se nombra por cercanía.
      const named = resolveGpsLocality(provinceIdx, localityName, latitude, longitude);
      if (!named) {
        setGeoStatus("error");
        setGeoMsg("No pudimos ponerle nombre a tu zona: elegí tu provincia y barrio o ciudad.");
        return;
      }
      setPicked(named);
      const city = `${named.localityName}, ${shortProvince(PROVINCES[named.provinceIdx].name)}`;
      onSelect({ city, latitude, longitude });
      setGeoStatus("done");
      setGeoMsg("Listo: usamos las coordenadas exactas de tu ubicación.");
    } catch (err) {
      setGeoStatus("error");
      setGeoMsg(
        err instanceof Error ? err.message : "No pudimos acceder a tu ubicación."
      );
    }
  }

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-province`} className="block text-sm font-semibold text-ink/70">
            Provincia
          </label>
          <select
            id={`${idPrefix}-province`}
            value={provinceIdx}
            onChange={(e) => changeProvince(Number(e.target.value))}
            className={selectClass}
          >
            {PROVINCES.map((p, i) => (
              <option key={p.name} value={i}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-locality`} className="block text-sm font-semibold text-ink/70">
            {province.localityLabel}
          </label>
          <select
            id={`${idPrefix}-locality`}
            value={localityName}
            onChange={(e) => selectLocality(e.target.value)}
            className={selectClass}
          >
            <option value="" disabled>
              Elegí un {province.localityLabel.toLowerCase()}…
            </option>
            {province.localities.map((l) => (
              <option key={l.name} value={l.name}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={useMyLocation}
        disabled={geoStatus === "loading"}
        className={`${BOTON_LISO} w-fit px-3.5 py-2 text-sm disabled:opacity-60`}
      >
        <MapPinIcon size={16} />
        {geoStatus === "loading" ? "Obteniendo ubicación…" : "Usar mi ubicación actual"}
      </button>

      {geoMsg && (
        // Celeste, no verde de éxito genérico: esto confirma una ubicación
        // verificada (coordenadas reales del dispositivo), el mismo rol que
        // cumple el celeste en el resto de la app (ADR-0011) — no es un
        // "operación completada" cualquiera.
        <p
          className={`text-xs ${
            geoStatus === "error" ? "text-danger-text" : "text-cielo-text"
          }`}
        >
          {geoMsg}
        </p>
      )}
    </div>
  );
}
