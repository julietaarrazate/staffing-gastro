"use client";

/**
 * Alta de la ubicación del comercio "desde el mapa" (ADR-0006). Reemplaza a
 * `LocationPicker` como método principal del alta: el comercio busca su
 * dirección con un geocoder gratuito (Nominatim/OSM, ver `lib/geocoder.ts`),
 * el mapa centra ahí con un pin arrastrable, y el comercio ajusta a mano si
 * el geocoder erró unos metros. **La posición final del pin es la fuente de
 * verdad de `latitude/longitude`**; la dirección/ciudad vienen del resultado
 * elegido pero quedan editables.
 *
 * Si el geocoder falla (red/disponibilidad) se muestra un aviso y se ofrece
 * volver al `LocationPicker` clásico vía `onFallback` — el alta nunca queda
 * bloqueada por una dependencia externa caída.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Marker, type MapRef, type MarkerDragEvent } from "@vis.gl/react-maplibre";
import MapView from "@/components/map/MapView";
import { flyToPoint } from "@/lib/map/camera";
import { getCurrentPosition } from "@/lib/geolocation";
import { searchAddress, type GeocodeResult } from "@/lib/geocoder";
import { TextField } from "@/components/ui";
import { SearchIcon, MapPinIcon, AlertTriangleIcon, XCircleIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

const DEBOUNCE_MS = 400;
/** Obelisco (CABA): centro por defecto hasta que haya una búsqueda o un pin previo. */
const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816];

export interface MapAddressSelection {
  address: string;
  city: string;
  latitude: number;
  longitude: number;
}

type SearchStatus = "idle" | "loading" | "success" | "empty" | "error";

export default function MapAddressPicker({
  initial,
  onChange,
  onFallback,
}: {
  initial?: Partial<MapAddressSelection>;
  /** La posición final del pin es la fuente de verdad de lat/lng (ADR-0006). */
  onChange: (selection: MapAddressSelection) => void;
  /** El comercio pidió volver al selector manual (provincia/localidad). */
  onFallback: () => void;
}) {
  const hasInitialPin =
    typeof initial?.latitude === "number" && typeof initial?.longitude === "number";

  const [query, setQuery] = useState(initial?.address ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    hasInitialPin
      ? { lat: initial!.latitude as number, lng: initial!.longitude as number }
      : null
  );
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [dragging, setDragging] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const mapRef = useRef<MapRef | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // No dispara una búsqueda al precargar la dirección ya guardada del perfil.
  const skipNextSearchRef = useRef(Boolean(initial?.address));

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    },
    []
  );

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    // Query corta: no se dispara pedido ni se resetea estado acá (evita
    // setState síncrono en el cuerpo del efecto) — el render ya oculta el
    // dropdown para queries < 3 caracteres, ver `showDropdown` más abajo.
    const trimmed = query.trim();
    if (trimmed.length < 3) return;

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("loading");
      searchAddress(trimmed, controller.signal)
        .then((found) => {
          if (controller.signal.aborted) return;
          setResults(found);
          setStatus(found.length ? "success" : "empty");
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setResults([]);
          setStatus("error");
        });
    }, DEBOUNCE_MS);
  }, [query]);

  const handleLoad = useCallback((map: MapRef) => {
    mapRef.current = map;
  }, []);

  function selectResult(result: GeocodeResult) {
    setQuery(result.address);
    setAddress(result.address);
    setCity(result.city);
    setPin({ lat: result.latitude, lng: result.longitude });
    setResults([]);
    setStatus("idle");
    flyToPoint(mapRef.current, [result.latitude, result.longitude], { zoom: 17, duration: 900 });
    onChange({
      address: result.address,
      city: result.city,
      latitude: result.latitude,
      longitude: result.longitude,
    });
  }

  function handleDragEnd(e: MarkerDragEvent) {
    setDragging(false);
    const { lat, lng } = e.lngLat;
    setPin({ lat, lng });
    onChange({ address, city, latitude: lat, longitude: lng });
  }

  function editAddress(value: string) {
    setAddress(value);
    if (pin) onChange({ address: value, city, latitude: pin.lat, longitude: pin.lng });
  }

  function editCity(value: string) {
    setCity(value);
    if (pin) onChange({ address, city: value, latitude: pin.lat, longitude: pin.lng });
  }

  async function useMyLocation() {
    setGeoBusy(true);
    setGeoError(null);
    try {
      const { latitude, longitude } = await getCurrentPosition();
      setPin({ lat: latitude, lng: longitude });
      flyToPoint(mapRef.current, [latitude, longitude], { zoom: 16, duration: 900 });
      onChange({ address, city, latitude, longitude });
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : "No pudimos acceder a tu ubicación.");
    } finally {
      setGeoBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <div className="flex items-center gap-2 rounded-[var(--radius-input)] bg-white px-3.5 ring-1 ring-line focus-within:ring-2 focus-within:ring-primary/40">
          <SearchIcon size={17} className="shrink-0 text-ink/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscá la dirección de tu local"
            aria-label="Buscar dirección"
            className="min-h-[48px] w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink/40"
          />
          {status === "loading" && (
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
          {query && status !== "loading" && (
            <button
              type="button"
              aria-label="Borrar búsqueda"
              onClick={() => {
                setQuery("");
                setResults([]);
                setStatus("idle");
              }}
              className="shrink-0 text-ink/25 hover:text-ink/50"
            >
              <XCircleIcon size={17} />
            </button>
          )}
        </div>

        {query.trim().length >= 3 && status === "success" && results.length > 0 && (
          <ul className="absolute z-10 mt-1.5 w-full overflow-hidden rounded-2xl bg-white py-1 shadow-[var(--shadow-float)] ring-1 ring-line">
            {results.map((result, idx) => (
              <li key={`${result.latitude}-${result.longitude}-${idx}`}>
                <button
                  type="button"
                  onClick={() => selectResult(result)}
                  className="flex w-full items-start gap-2 px-3.5 py-2.5 text-left text-sm hover:bg-surface"
                >
                  <MapPinIcon size={16} className="mt-0.5 shrink-0 text-ink/40" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{result.address}</span>
                    {result.city && (
                      <span className="block truncate text-xs text-ink/50">{result.city}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {query.trim().length >= 3 && status === "empty" && (
          <p className="mt-1.5 px-1 text-xs text-ink/50">
            No encontramos esa dirección. Probá con otro texto (calle y altura) o ajustá el pin a mano.
          </p>
        )}
      </div>

      {status === "error" && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 ring-1 ring-amber-100">
          <span className="flex items-center gap-2">
            <AlertTriangleIcon size={16} className="shrink-0" />
            No pudimos conectarnos al buscador de direcciones.
          </span>
          <button
            type="button"
            onClick={onFallback}
            className="shrink-0 font-semibold underline decoration-amber-300 underline-offset-2 hover:text-amber-900"
          >
            Usar selector manual
          </button>
        </div>
      )}

      <div className="relative h-64 w-full overflow-hidden rounded-[var(--radius-card)] ring-1 ring-line">
        <MapView
          center={pin ? [pin.lat, pin.lng] : DEFAULT_CENTER}
          zoom={hasInitialPin ? 16 : 12}
          onLoad={handleLoad}
          className="absolute inset-0 h-full w-full"
        >
          {pin && (
            <Marker
              longitude={pin.lng}
              latitude={pin.lat}
              anchor="bottom"
              draggable
              onDragStart={() => setDragging(true)}
              onDragEnd={handleDragEnd}
            >
              <div
                className={cn(
                  "origin-bottom cursor-grab transition-transform duration-150 ease-out active:cursor-grabbing",
                  dragging ? "-translate-y-1.5 scale-110" : "scale-100"
                )}
              >
                <svg
                  width="34"
                  height="44"
                  viewBox="0 0 34 44"
                  className="drop-shadow-[0_6px_10px_rgba(17,17,17,0.35)]"
                >
                  <path
                    d="M17 0C7.6 0 0 7.6 0 17c0 12.2 17 27 17 27s17-14.8 17-27C34 7.6 26.4 0 17 0z"
                    fill="var(--color-primary)"
                  />
                  <circle cx="17" cy="17" r="6.5" fill="white" />
                </svg>
              </div>
            </Marker>
          )}
        </MapView>

        {!pin && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/60 px-6 text-center text-sm font-medium text-ink/50">
            Buscá tu dirección arriba para ubicar el local en el mapa
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink/50">
          {pin
            ? "Arrastrá el pin para ajustar la ubicación exacta."
            : "También podés usar tu ubicación actual como punto de partida."}
        </p>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={geoBusy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink/70 hover:bg-line disabled:opacity-60"
        >
          <MapPinIcon size={14} />
          {geoBusy ? "Obteniendo ubicación…" : "Usar mi ubicación actual"}
        </button>
      </div>
      {geoError && <p className="text-xs text-danger-text">{geoError}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Dirección" value={address} onChange={editAddress} placeholder="Calle y altura" />
        <TextField label="Ciudad / barrio" value={city} onChange={editCity} placeholder="Ej: Palermo, CABA" />
      </div>

      <button
        type="button"
        onClick={onFallback}
        className="w-fit text-xs font-medium text-ink/40 underline decoration-zinc-200 underline-offset-2 hover:text-ink/60"
      >
        ¿No encontrás tu dirección? Cargala a mano
      </button>
    </div>
  );
}
