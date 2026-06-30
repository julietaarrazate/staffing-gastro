"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { Shift } from "@/lib/types";
import { MAP_TILE_ATTRIBUTION, MAP_TILE_SUBDOMAINS, MAP_TILE_URL } from "@/lib/map-tiles";

function shiftPin(active: boolean) {
  const size = active ? 34 : 24;
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:linear-gradient(135deg,#ff8a00,#ea580c);border:3px solid white;box-shadow:0 3px 8px rgba(0,0,0,${active ? 0.45 : 0.3})"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

const originPin = L.divIcon({
  className: "",
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 0 0 3px rgba(37,99,235,0.3)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/** Mantiene el mapa centrado en la tarjeta activa del carrusel. */
function PanTo({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null) map.panTo([lat, lng], { animate: true, duration: 0.4 });
  }, [lat, lng, map]);
  return null;
}

export default function ShiftMap({
  shifts,
  center,
  activeId,
  onSelect,
}: {
  shifts: Shift[];
  center: [number, number];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const active = shifts.find((s) => s.id === activeId);
  return (
    <MapContainer
      center={center}
      zoom={14}
      zoomControl={false}
      scrollWheelZoom
      className="absolute inset-0 h-full w-full"
    >
      <TileLayer
        url={MAP_TILE_URL}
        attribution={MAP_TILE_ATTRIBUTION}
        subdomains={MAP_TILE_SUBDOMAINS}
        detectRetina
      />
      <Marker position={center} icon={originPin} />
      {shifts
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => (
          <Marker
            key={s.id}
            position={[s.latitude as number, s.longitude as number]}
            icon={shiftPin(s.id === activeId)}
            eventHandlers={{ click: () => onSelect(s.id) }}
          />
        ))}
      {active && <PanTo lat={active.latitude} lng={active.longitude} />}
    </MapContainer>
  );
}
