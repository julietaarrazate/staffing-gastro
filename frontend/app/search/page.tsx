"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import Link from "next/link";
import { SKILL_LABELS, WORKER_SKILLS, WorkerMapResult, WorkerSkill } from "@/lib/types";
import { EmptyState, ErrorBanner, Skeleton } from "@/components/ui";
import { SearchIcon, UsersIcon } from "@/components/icons";
import { SKILL_ACCENT, SKILL_HERO_GRADIENT, SKILL_RAIL_BORDER } from "@/lib/skill-style";
import StarRating from "@/components/StarRating";
import BottomSheet from "@/components/BottomSheet";

function WorkerRowSkeleton() {
  return (
    <div className="flex gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-soft)] ring-1 ring-line" aria-hidden>
      <Skeleton className="h-16 w-16 shrink-0 rounded-2xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-5 w-3/4 rounded-full" />
      </div>
    </div>
  );
}

const WorkerSearchMap = dynamic(() => import("@/components/WorkerSearchMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-surface" />,
});

// Centro por defecto: Obelisco (CABA), por si el navegador no comparte ubicación.
const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816];

function isWorkerSkill(value: string | null): value is WorkerSkill {
  return value !== null && (WORKER_SKILLS as string[]).includes(value);
}

export default function SearchPage() {
  // useSearchParams exige un boundary de Suspense en build estático.
  return (
    <Suspense fallback={null}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const { token } = useRequireAuth();
  const searchParams = useSearchParams();
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  // Precargable por URL (?skill=mozo): el asistente de IA (buscar_candidatos)
  // te trae directo con el filtro ya puesto.
  const [skill, setSkill] = useState<WorkerSkill | "">(() => {
    const fromUrl = searchParams.get("skill");
    return isWorkerSkill(fromUrl) ? fromUrl : "";
  });
  const [radiusKm, setRadiusKm] = useState(15);
  const [workers, setWorkers] = useState<WorkerMapResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Arranca en `true`: la búsqueda inicial se dispara en un efecto apenas hay
  // token/ubicación, así el sheet nunca llega a mostrar "0 trabajadores" antes
  // de que la primera búsqueda resuelva.
  const [loading, setLoading] = useState(true);
  // D4 (auditoría de producto/UI 2026-08-09): al montar se busca con
  // DEFAULT_CENTER de inmediato, y otra vez cuando `getCurrentPosition`
  // resuelve con la ubicación real — sin esto, si la respuesta del centro
  // por defecto llega DESPUÉS que la de la ubicación real (variación de
  // latencia normal), pisaba los resultados correctos con los del Obelisco.
  // Contador de secuencia: sólo la búsqueda más reciente puede escribir
  // estado; una respuesta vieja que llega tarde se descarta en silencio.
  const searchSeq = useRef(0);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter([pos.coords.latitude, pos.coords.longitude]),
      () => {
        // Sin permiso o sin soporte: nos quedamos con el centro por defecto.
      }
    );
  }, []);

  async function search() {
    if (!token) return;
    const seq = ++searchSeq.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        latitude: String(center[0]),
        longitude: String(center[1]),
        radius_km: String(radiusKm),
      });
      if (skill) params.set("skill", skill);
      const results = await api.get<WorkerMapResult[]>(
        `/matching/search?${params.toString()}`,
        token
      );
      if (seq !== searchSeq.current) return;
      setWorkers(results);
    } catch (err) {
      if (seq !== searchSeq.current) return;
      setError(getErrorMessage(err, "No se pudo buscar trabajadores"));
    } finally {
      if (seq === searchSeq.current) setLoading(false);
    }
  }

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, center]);

  const filterControls = (
    <div className="flex items-center gap-2 rounded-full bg-white/95 px-2 py-2 shadow-lg ring-1 ring-line backdrop-blur md:bg-card md:shadow-none md:ring-line">
      <select
        value={skill}
        onChange={(e) => setSkill(e.target.value as WorkerSkill | "")}
        className="flex-1 rounded-full bg-surface px-3 py-2 text-sm font-medium text-ink/75 ring-1 ring-line transition focus:bg-card focus:ring-orange-300"
      >
        <option value="">Todos los roles</option>
        {WORKER_SKILLS.map((s) => (
          <option key={s} value={s}>
            {SKILL_LABELS[s]}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={1}
        max={100}
        value={radiusKm}
        onChange={(e) => setRadiusKm(Number(e.target.value))}
        title="Radio en km"
        className="w-14 rounded-full bg-surface px-2 py-2 text-center text-sm font-medium text-ink/75 ring-1 ring-line transition focus:bg-card focus:ring-orange-300"
      />
      <button
        onClick={search}
        disabled={loading}
        aria-label="Buscar"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-strong text-white shadow-[0_8px_20px_rgba(249,115,22,0.28)] transition active:scale-95 disabled:opacity-60"
      >
        <SearchIcon size={16} className={loading ? "animate-pulse" : ""} />
      </button>
    </div>
  );

  const countLabel = loading
    ? "Buscando..."
    : `${workers.length} trabajador${workers.length === 1 ? "" : "es"} disponible${
        workers.length === 1 ? "" : "s"
      } en el radio seleccionado`;

  const workerList = (
    <>
      {!loading && workers.length === 0 ? (
        <EmptyState
          icon={<UsersIcon size={28} />}
          title="Nadie por acá todavía"
          subtitle="Ampliá el radio de búsqueda o probá otro rubro para encontrar candidatos cerca."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
          {loading ? (
            <>
              <WorkerRowSkeleton />
              <WorkerRowSkeleton />
              <WorkerRowSkeleton />
            </>
          ) : (
            workers.map((worker) => (
              <Link
                key={worker.profile_id}
                href={`/workers/${worker.profile_id}`}
                // Riel de color a la izquierda, del OFICIO PRINCIPAL del
                // trabajador (Julieta, captura 2026-08-17: "la foto donde
                // están los trabajadores reales no me gusta todo blanco,
                // ponele colores — naranja no"). La lista era íntegramente
                // blanca y todas las filas se leían iguales; el riel las
                // diferencia de un vistazo sin cambiar el fondo blanco que
                // hace legible el texto. Naranja sólo le toca a quien
                // efectivamente es mozo/cocinero: el resto de los oficios
                // trae su propio color de `SKILL_HERO_GRADIENT` (bartender
                // terracota, barista ámbar, cajero verde...), la misma tabla
                // que ya usan la landing, el mazo y las listas de turnos.
                className={`flex gap-3 overflow-hidden rounded-[var(--radius-card)] border-l-[6px] bg-surface p-4 pl-3.5 shadow-[var(--shadow-soft)] ring-1 ring-line transition active:scale-[0.99] hover:shadow-lg ${
                  worker.skills.length > 0
                    ? SKILL_RAIL_BORDER[worker.skills[0]]
                    : "border-l-line"
                }`}
              >
                {worker.photo_url ? (
                  <img
                    src={worker.photo_url}
                    alt={worker.full_name}
                    loading="lazy"
                    decoding="async"
                    className="h-16 w-16 rounded-2xl object-cover ring-1 ring-line"
                  />
                ) : (
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold text-white ${
                      worker.skills.length > 0
                        ? SKILL_HERO_GRADIENT[worker.skills[0]]
                        : "bg-gradient-to-br from-primary to-primary-strong"
                    }`}
                  >
                    {worker.full_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold text-ink">{worker.full_name}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <StarRating value={Math.round(worker.rating)} size={13} />
                    <span className="text-xs text-ink/50">{worker.rating.toFixed(1)}</span>
                    {worker.distance_km != null && (
                      <span className="text-xs text-ink/40">
                        · {worker.distance_km.toFixed(1)} km
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {worker.skills.map((s) => {
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
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] overflow-hidden md:h-[calc(100dvh-var(--chrome-top))]">
      {/* Panel lateral (desktop, md+): filtros + la MISMA lista que en mobile
          vive en el BottomSheet. Antes el sheet mobile se estiraba tal cual a
          la web y dejaba media pantalla vacía (mismo patrón que tenía /map,
          ver docs/STATUS.md). En mobile no se renderiza (hidden). */}
      <aside className="hidden w-full max-w-[400px] shrink-0 flex-col overflow-hidden border-r border-line bg-card md:flex">
        <div className="border-b border-line px-4 py-3">
          {filterControls}
          {error && (
            <div className="mt-2">
              <ErrorBanner message={error} onRetry={search} />
            </div>
          )}
        </div>
        <p className="px-5 pt-4 text-sm font-semibold text-ink/75">{countLabel}</p>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">{workerList}</div>
      </aside>

      {/* Mapa + overlays mobile */}
      <div className="relative h-full flex-1 overflow-hidden">
        <WorkerSearchMap center={center} workers={workers} className="absolute inset-0 h-full w-full" />

        {/* Filtros flotantes: sólo mobile (en desktop ya están en el panel). */}
        <div className="absolute inset-x-0 top-0 z-10 p-3 md:hidden">
          {filterControls}
          {error && (
            <div className="mt-2">
              <ErrorBanner message={error} onRetry={search} />
            </div>
          )}
        </div>

        {/* BottomSheet: sólo mobile — en desktop la lista vive en el panel. */}
        <div className="md:hidden">
          <BottomSheet header={<p className="px-4 pb-2 text-sm font-semibold text-ink/75">{countLabel}</p>}>
            {workerList}
          </BottomSheet>
        </div>
      </div>
    </div>
  );
}
