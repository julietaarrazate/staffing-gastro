"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { WorkerMapResult } from "@/lib/types";
import { MAP_TILE_ATTRIBUTION, MAP_TILE_SUBDOMAINS, MAP_TILE_URL } from "@/lib/map-tiles";
import { SKILL_LABELS } from "@/lib/types";

// Pin propio (sin imágenes externas: los assets default de Leaflet apuntan a un
// CDN y Webpack no los resuelve). Un "gota" naranja con la marca.
const workerIcon = L.divIcon({
  className: "",
  html: '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:linear-gradient(135deg,#f97316,#dc2626);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -24],
});

const originIcon = L.divIcon({
  className: "",
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#ea580c;border:3px solid white;box-shadow:0 0 0 2px rgba(234,88,12,0.4)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function WorkerSearchMap({
  center,
  workers,
  className = "h-[60vh] w-full rounded-2xl ring-1 ring-zinc-200",
}: {
  center: [number, number];
  workers: WorkerMapResult[];
  className?: string;
}) {
  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom
      zoomControl={false}
      className={className}
    >
      <TileLayer
        url={MAP_TILE_URL}
        attribution={MAP_TILE_ATTRIBUTION}
        subdomains={MAP_TILE_SUBDOMAINS}
        detectRetina
      />
      <Marker position={center} icon={originIcon}>
        <Popup>Tu ubicación de búsqueda</Popup>
      </Marker>
      {workers
        .filter((w) => w.latitude != null && w.longitude != null)
        .map((worker) => (
          <Marker
            key={worker.profile_id}
            position={[worker.latitude as number, worker.longitude as number]}
            icon={workerIcon}
          >
            <Popup>
              <div className="text-sm">
                <a href={`/workers/${worker.profile_id}`} className="font-semibold hover:text-orange-600">
                  {worker.full_name}
                </a>
                <p>
                  ★ {worker.rating.toFixed(1)} ·{" "}
                  {worker.distance_km != null
                    ? `${worker.distance_km.toFixed(1)} km`
                    : "distancia desconocida"}
                </p>
                <p className="text-zinc-500">
                  {worker.skills.map((s) => SKILL_LABELS[s] ?? s).join(", ")}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
