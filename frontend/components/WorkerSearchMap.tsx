"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import MapView from "@/components/map/MapView";
import UserPuck from "@/components/map/UserPuck";
import WorkerMarker from "@/components/map/WorkerMarker";
import { WorkerMapResult } from "@/lib/types";

/**
 * Mapa del comercio en `/search`, reimplementado sobre el módulo
 * `components/map/` (MapLibre vectorial) manteniendo la misma interfaz de
 * props que la versión Leaflet anterior.
 *
 * Antes tocar un pin sólo abría una tarjeta flotante con nombre/rating y un
 * link "Ver perfil →" adentro — dos toques para llegar a lo que el comercio
 * en realidad busca (evaluar al candidato). Ahora el pin lleva directo al
 * perfil completo del trabajador, un solo toque (Julieta, 2026-07-31).
 */
export default function WorkerSearchMap({
  center,
  workers,
  className = "h-[60vh] w-full rounded-2xl ring-1 ring-line",
}: {
  center: [number, number];
  workers: WorkerMapResult[];
  className?: string;
}) {
  const router = useRouter();

  const located = useMemo(
    () =>
      workers.filter(
        (w): w is WorkerMapResult & { latitude: number; longitude: number } =>
          w.latitude != null && w.longitude != null
      ),
    [workers]
  );

  return (
    // Wrapper externo: conserva exactamente el `className` del caller (tamaño/
    // posición/bordes), igual que antes cuando se aplicaba directo al mapa.
    <div className={className}>
      <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
        <MapView center={center} zoom={13} className="absolute inset-0 h-full w-full">
          <UserPuck center={center} />
          {located.map((worker, index) => (
            <WorkerMarker
              key={worker.profile_id}
              id={worker.profile_id}
              longitude={worker.longitude}
              latitude={worker.latitude}
              photoUrl={worker.photo_url}
              name={worker.full_name}
              rating={worker.rating}
              active={false}
              delayMs={index * 60}
              onClick={(id) => router.push(`/workers/${id}`)}
            />
          ))}
        </MapView>
      </div>
    </div>
  );
}
