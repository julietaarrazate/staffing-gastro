"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import MapView from "@/components/map/MapView";
import UserPuck from "@/components/map/UserPuck";
import WorkerMarker from "@/components/map/WorkerMarker";
import StarRating from "@/components/StarRating";
import { Card } from "@/components/ui";
import { CloseIcon } from "@/components/icons";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { SKILL_LABELS, WorkerMapResult } from "@/lib/types";

/**
 * Mapa del comercio en `/search`, reimplementado sobre el módulo
 * `components/map/` (MapLibre vectorial) manteniendo la misma interfaz de
 * props que la versión Leaflet anterior. Los popups default de Leaflet se
 * reemplazan por una tarjeta flotante del Design System (ver
 * docs/MAPS_REDESIGN.md §5/§8).
 */
export default function WorkerSearchMap({
  center,
  workers,
  className = "h-[60vh] w-full rounded-2xl ring-1 ring-zinc-200",
}: {
  center: [number, number];
  workers: WorkerMapResult[];
  className?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Memoizado: antes se recalculaba en cada render (incluido al tocar un
  // marcador, que sólo cambia `selectedId`), filtrando de nuevo toda la
  // lista de trabajadores sin necesidad.
  const located = useMemo(
    () =>
      workers.filter(
        (w): w is WorkerMapResult & { latitude: number; longitude: number } =>
          w.latitude != null && w.longitude != null
      ),
    [workers]
  );
  const selected = located.find((w) => w.profile_id === selectedId) ?? null;

  // Handler estable: junto con `React.memo` en `WorkerMarker`, evita que
  // los N marcadores se re-rendericen todos al seleccionar uno solo.
  const toggle = useCallback((id: string) => {
    setSelectedId((current) => (current === id ? null : id));
  }, []);

  return (
    // Wrapper externo: conserva exactamente el `className` del caller (tamaño/
    // posición/bordes), igual que antes cuando se aplicaba directo al mapa.
    // El wrapper interno `relative` es el que ancla la tarjeta flotante, sin
    // pelear con las clases de posición que traiga `className` (p. ej.
    // `absolute inset-0` en `/search`).
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
              active={worker.profile_id === selectedId}
              delayMs={index * 60}
              onClick={toggle}
            />
          ))}
        </MapView>

        {selected && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
            {/* `no-select`: popup de chrome sobre el mapa (nombre, rating,
                distancia) — mismo criterio C0 #2 que ShiftCard/CandidateCard. */}
            <Card className="no-select pointer-events-auto w-full max-w-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">{selected.full_name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink/60">
                    <StarRating value={Math.round(selected.rating)} size={13} />
                    <span>{selected.rating.toFixed(1)}</span>
                    {selected.distance_km != null && (
                      <span>· {selected.distance_km.toFixed(1)} km</span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Cerrar"
                  onClick={() => setSelectedId(null)}
                  className="shrink-0 rounded-full p-1 text-ink/40 transition hover:bg-surface hover:text-ink/70"
                >
                  <CloseIcon size={16} />
                </button>
              </div>

              {selected.skills.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {selected.skills.map((s) => {
                    const { Icon, bg, fg } = SKILL_ACCENT[s];
                    return (
                      <span
                        key={s}
                        className={`inline-flex items-center gap-1 rounded-full ${bg} ${fg} px-2 py-0.5 text-xs font-semibold`}
                      >
                        <Icon size={11} /> {SKILL_LABELS[s]}
                      </span>
                    );
                  })}
                </div>
              )}

              <Link
                href={`/workers/${selected.profile_id}`}
                className="mt-3 inline-flex items-center text-sm font-bold text-primary hover:underline"
              >
                Ver perfil →
              </Link>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
