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
import { MapPinIcon } from "@/components/icons";

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

// Mismo tratamiento que `TextField` del design system (alto de toque 48px,
// radio y anillo por token): antes usaba grises/naranjas crudos y quedaba
// visiblemente distinto a los demás campos de la app.
const selectClass =
  "mt-1 min-h-[48px] w-full rounded-[var(--radius-input)] bg-card px-4 text-[15px] text-ink outline-none ring-1 ring-line transition focus:ring-2 focus:ring-primary/40";

export default function LocationPicker({
  onSelect,
}: {
  onSelect: (selection: LocationSelection) => void;
}) {
  // Id único por instancia (no hardcodeado): el picker se usa en varios
  // formularios y un id fijo colisionaría si dos llegaran a montarse juntos.
  const idPrefix = useId();
  const [provinceIdx, setProvinceIdx] = useState(0);
  const [localityName, setLocalityName] = useState("");
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  const province = PROVINCES[provinceIdx];

  function changeProvince(idx: number) {
    setProvinceIdx(idx);
    setLocalityName("");
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
      const city = localityName
        ? `${localityName}, ${shortProvince(province.name)}`
        : "Mi ubicación actual";
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
        className="inline-flex w-fit items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-sm font-semibold text-ink/70 ring-1 ring-line transition active:scale-95 disabled:opacity-60"
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
