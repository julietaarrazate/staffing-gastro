"use client";

/**
 * "Va en camino" del lado del comercio: dónde está el trabajador y qué le
 * falta para llegar.
 *
 * Responde una sola pregunta — "¿llega?" — y por eso muestra tres cosas y
 * nada más: el punto de la persona, la línea hasta el local y a qué distancia
 * está. La línea es recta a propósito: no es el camino que va a hacer ni el
 * que hizo, es la distancia que falta. Dibujar una ruta de calles sugeriría
 * que sabemos por dónde viene, y no lo sabemos ni queremos saberlo (el
 * backend guarda una sola posición, nunca el recorrido).
 *
 * `en_route_at` se muestra siempre: un punto sin "hace cuánto" es peor que no
 * tenerlo, porque una posición vieja se lee como actual.
 */

import { useMemo } from "react";
import { Layer, Marker, Source } from "@vis.gl/react-maplibre";
import MapView from "@/components/map/MapView";
import { haversineKm } from "@/lib/map/geo";

const SOURCE_ID = "en-route-line";

/** "hace 2 min" / "hace 1 h 10". Sin librería: es el único uso. */
function agoLabel(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `hace ${hours} h` : `hace ${hours} h ${rest}`;
}

export default function EnRouteMap({
  venueLatitude,
  venueLongitude,
  workerLatitude,
  workerLongitude,
  reportedAt,
  workerName,
}: {
  venueLatitude: number;
  venueLongitude: number;
  workerLatitude: number;
  workerLongitude: number;
  reportedAt: string;
  /** El turno no trae hoy el nombre del asignado (sólo `worker_profile_id`),
   *  así que en el panel sale sin nombre. El comercio igual sabe a quién
   *  asignó; queda el prop para cuando el turno lo exponga. */
  workerName?: string | null;
}) {
  const distanceKm = haversineKm(
    [workerLatitude, workerLongitude],
    [venueLatitude, venueLongitude]
  );

  // Encuadre: el punto medio entre los dos, para que ninguno quede fuera.
  const center: [number, number] = [
    (venueLatitude + workerLatitude) / 2,
    (venueLongitude + workerLongitude) / 2,
  ];

  // Zoom por distancia. Con dos puntos fijos alcanza una tabla corta y evita
  // el `fitBounds` (que necesita el ref del mapa y un efecto para algo que no
  // cambia mientras el thumbnail está montado).
  const zoom = distanceKm > 8 ? 10 : distanceKm > 3 ? 11.5 : distanceKm > 1 ? 13 : 14;

  const line = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(
    () => ({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [workerLongitude, workerLatitude],
          [venueLongitude, venueLatitude],
        ],
      },
    }),
    [workerLatitude, workerLongitude, venueLatitude, venueLongitude]
  );

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] ring-1 ring-line">
      <MapView
        center={center}
        zoom={zoom}
        interactive={false}
        attribution={false}
        className="h-36 w-full"
      >
        <Source id={SOURCE_ID} type="geojson" data={line}>
          <Layer
            id={`${SOURCE_ID}-stroke`}
            type="line"
            paint={{
              "line-color": "#d97706",
              "line-width": 2,
              "line-opacity": 0.7,
              "line-dasharray": [2, 2],
            }}
          />
        </Source>

        {/* El local: cuadrado, fijo, es el destino. */}
        <Marker longitude={venueLongitude} latitude={venueLatitude} anchor="center">
          <div className="h-3.5 w-3.5 rounded-[4px] border-2 border-white bg-night shadow-[0_2px_6px_rgba(0,0,0,0.3)]" />
        </Marker>

        {/* El trabajador: redondo y con halo, es lo que se mueve. */}
        <Marker longitude={workerLongitude} latitude={workerLatitude} anchor="center">
          <span className="relative flex h-4 w-4 items-center justify-center">
            <span className="absolute -inset-2 rounded-full bg-primary/25 [animation:puckHalo_2s_ease-out_infinite]" />
            <span className="h-4 w-4 rounded-full border-[3px] border-white bg-primary shadow-[0_2px_6px_rgba(0,0,0,0.3)]" />
          </span>
        </Marker>
      </MapView>

      <div className="flex items-baseline justify-between gap-2 bg-card px-3 py-2">
        <p className="text-sm font-semibold text-ink">
          {workerName ? `${workerName} va en camino` : "Va en camino"}
        </p>
        <p className="text-xs text-ink/60">
          a {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}
          {" · "}
          {agoLabel(reportedAt)}
        </p>
      </div>
    </div>
  );
}
