"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { WorkerMapResult } from "@/lib/types";
import { SKILL_LABELS } from "@/lib/types";

// Los íconos default de Leaflet apuntan a assets que Webpack no resuelve;
// se reconstruye el ícono con las imágenes servidas por el propio paquete.
const workerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
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
    <MapContainer center={center} zoom={13} scrollWheelZoom className={className}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
