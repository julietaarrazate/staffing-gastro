"use client";

/**
 * Selector de ubicación para publicar turnos. Cascada provincia → barrio/ciudad
 * que autocompleta las coordenadas (centro del barrio/ciudad) para el matching
 * por distancia, sin pedir latitud/longitud a mano. Incluye un atajo para usar
 * la ubicación actual del dispositivo y precisar las coordenadas.
 */
import { useState } from "react";
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

const selectClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100";

export default function LocationPicker({
  onSelect,
}: {
  onSelect: (selection: LocationSelection) => void;
}) {
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
          <label className="block text-sm font-medium text-zinc-700">Provincia</label>
          <select
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
          <label className="block text-sm font-medium text-zinc-700">
            {province.localityLabel}
          </label>
          <select
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
        className="inline-flex w-fit items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-200 disabled:opacity-60"
      >
        <MapPinIcon size={16} />
        {geoStatus === "loading" ? "Obteniendo ubicación…" : "Usar mi ubicación actual"}
      </button>

      {geoMsg && (
        <p
          className={`text-xs ${
            geoStatus === "error" ? "text-red-600" : "text-green-700"
          }`}
        >
          {geoMsg}
        </p>
      )}
    </div>
  );
}
