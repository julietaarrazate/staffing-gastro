"use client";

import { Marker } from "@vis.gl/react-maplibre";

/**
 * Punto azul del usuario con halo pulsante (CSS), estilo Uber/Google Maps.
 * Ver docs/MAPS_REDESIGN.md §5 ("Apertura").
 */
export default function UserPuck({ center }: { center: [number, number] }) {
  return (
    <Marker longitude={center[1]} latitude={center[0]} anchor="center">
      <div className="relative h-4 w-4">
        <span className="absolute -inset-2.5 rounded-full bg-[#2f6fed]/25 [animation:puckHalo_2s_ease-out_infinite]" />
        <span className="absolute inset-0 rounded-full border-[3px] border-white bg-[#2f6fed] shadow-[0_2px_6px_rgba(0,0,0,0.3)]" />
      </div>
    </Marker>
  );
}
