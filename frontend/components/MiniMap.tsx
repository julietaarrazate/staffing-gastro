"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import { MAP_TILE_SUBDOMAINS, MAP_TILE_URL } from "@/lib/map-tiles";

const pinIcon = L.divIcon({
  className: "",
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#ea580c;border:3px solid white;box-shadow:0 0 0 2px rgba(234,88,12,0.4)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function MiniMap({
  latitude,
  longitude,
  className = "h-28 w-full",
}: {
  latitude: number;
  longitude: number;
  className?: string;
}) {
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={14}
      dragging={false}
      zoomControl={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      attributionControl={false}
      className={`${className} rounded-2xl`}
    >
      <TileLayer url={MAP_TILE_URL} subdomains={MAP_TILE_SUBDOMAINS} detectRetina />
      <Marker position={[latitude, longitude]} icon={pinIcon} />
    </MapContainer>
  );
}
