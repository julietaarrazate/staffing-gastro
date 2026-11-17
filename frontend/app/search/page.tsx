"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { formatAgo } from "@/lib/datetime";
import { formatKm } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useCompanyPlace } from "@/lib/company-place";
import Link from "next/link";
import { SKILL_LABELS, WORKER_SKILLS, WorkerMapResult, WorkerSkill } from "@/lib/types";
import { EmptyState, ErrorBanner, Skeleton } from "@/components/ui";
import { MapPinIcon, SearchIcon, UsersIcon } from "@/components/icons";
import { SKILL_ACCENT, SKILL_RAIL_BORDER, heroTile } from "@/lib/skill-style";
import RatingOrNew from "@/components/RatingOrNew";
import BottomSheet from "@/components/BottomSheet";

function WorkerRowSkeleton() {
  return (
    <div className="flex gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-soft)] ring-1 ring-line" aria-hidden>
      <Skeleton className="h-16 w-16 shrink-0 rounded-[var(--radius-chip)]" />
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

const FILTERS_KEY = "oido.buscar.filtros";

function readSavedFilters(): { skill?: string; radiusKm?: number } {
  try {
    const raw = window.sessionStorage.getItem(FILTERS_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    const radiusKm = Number(data?.radiusKm);
    return {
      skill: typeof data?.skill === "string" ? data.skill : undefined,
      radiusKm: Number.isFinite(radiusKm) && radiusKm >= 1 && radiusKm <= 100 ? radiusKm : undefined,
    };
  } catch {
    return {};
  }
}

export default function SearchPage() {
  // useSearchParams exige un boundary de Suspense en build estático.
  return (
    <Suspense fallback={null}>
      <SearchGuard />
    </Suspense>
  );
}

// Comercio y admin: son los que el backend deja buscar (`EmployerOrAdminDep`).
// Hasta conocer el rol no se monta nada (así no sale ningún pedido de más).
// La guarda va por fuera: con otro rol la pantalla ni se monta (no pide la
// ubicación del navegador ni busca) mientras redirige a la home de su rol.
function SearchGuard() {
  const { allowed, user } = useRequireAuth({ roles: ["employer", "admin"] });
  if (!allowed) return null;
  if (!user) {
    return (
      <div data-testid="guarda-cargando" aria-busy className="mx-auto max-w-md space-y-3 px-4 pb-8 pt-4 md:max-w-5xl">
        <WorkerRowSkeleton />
        <WorkerRowSkeleton />
        <WorkerRowSkeleton />
      </div>
    );
  }
  return <SearchPageContent />;
}

function SearchPageContent() {
  const { user, token } = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [geoCenter, setGeoCenter] = useState<[number, number]>(DEFAULT_CENTER);
  // Comercio: la búsqueda parte de su local (U073), no del Obelisco ni de
  // donde esté el celular. Sin local cargado no se busca desde ningún lado en
  // silencio: la pantalla lo dice y lleva a completarlo.
  const isEmployer = user?.role === "employer";
  const { place: companyPlace, loaded: placeLoaded, error: placeError, retry: retryPlace } = useCompanyPlace(isEmployer ? token : null);
  const origin: "esperando" | "local" | "sin-local" | "error" | "cerca" = !user
    ? "esperando"
    : !isEmployer
      ? "cerca"
      : !placeLoaded
        ? "esperando"
        : placeError
          ? "error"
          : companyPlace
          ? "local"
          : "sin-local";
  const originLat = origin === "local" && companyPlace ? companyPlace.latitude : geoCenter[0];
  const originLng = origin === "local" && companyPlace ? companyPlace.longitude : geoCenter[1];
  // Memoizado: el efecto de búsqueda depende de la identidad del centro.
  const center = useMemo<[number, number]>(() => [originLat, originLng], [originLat, originLng]);
  // Precargable por URL (?skill=mozo): el asistente de IA (buscar_candidatos)
  // te trae directo con el filtro ya puesto.
  const [skill, setSkill] = useState<WorkerSkill | "">(() => {
    const fromUrl = searchParams.get("skill");
    return isWorkerSkill(fromUrl) ? fromUrl : "";
  });
  const [radiusKm, setRadiusKm] = useState(15);
  const [filtersRestored, setFiltersRestored] = useState(false);
  useEffect(() => {
    if (!filtersRestored) return;
    try {
      window.sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ skill, radiusKm }));
    } catch {
      // Sin almacenamiento: los filtros simplemente no se recuerdan.
    }
  }, [skill, radiusKm, filtersRestored]);

  // Los filtros sobreviven a entrar a un perfil y volver: viven en
  // sessionStorage (la URL ?skill= del asistente manda si viene).
  useEffect(() => {
    // Después de montar (no en el estado inicial) para no desfasar la
    // hidratación. Con ?skill= en la URL, el rol de la URL manda.
    const saved = readSavedFilters();
    if (saved.radiusKm) setRadiusKm(saved.radiusKm);
    if (!isWorkerSkill(searchParams.get("skill")) && isWorkerSkill(saved.skill ?? null)) {
      setSkill(saved.skill as WorkerSkill);
    }
    setFiltersRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
    // El trabajador (y el admin) siguen midiendo desde donde están; el comercio
    // mide desde su local y no le pide la ubicación al navegador.
    if (!token || origin !== "cerca" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeoCenter([pos.coords.latitude, pos.coords.longitude]),
      () => {
        // Sin permiso o sin soporte: nos quedamos con el centro por defecto.
      }
    );
  }, [origin, token]);

  async function search() {
    if (!token || !filtersRestored) return;
    if (origin === "esperando" || origin === "sin-local" || origin === "error") {
      if (origin === "sin-local" || origin === "error") {
        setWorkers([]);
        setLoading(false);
      }
      return;
    }
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
  }, [token, center, origin, filtersRestored]);

  const filterControls = (
    <div className="flex items-center gap-2 rounded-full bg-card/95 px-2 py-2 shadow-lg ring-1 ring-line backdrop-blur md:bg-card md:shadow-none md:ring-line">
      <select
        value={skill}
        onChange={(e) => setSkill(e.target.value as WorkerSkill | "")}
        className="flex-1 rounded-full bg-surface px-3 py-2 text-sm font-medium text-ink/75 ring-1 ring-line transition focus:bg-card focus:ring-2 focus:ring-primary/40"
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
        aria-label="Radio en kilómetros"
        className="w-12 rounded-full bg-surface px-1 py-2 text-center text-sm font-medium text-ink/75 ring-1 ring-line transition focus:bg-card focus:ring-2 focus:ring-primary/40"
      />
      <span className="-ml-1 text-sm font-medium text-ink/60" aria-hidden>
        km
      </span>
      <button
        onClick={search}
        disabled={loading}
        aria-label="Buscar"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-strong text-night shadow-[var(--shadow-primary)] transition active:scale-95 disabled:opacity-60"
      >
        <SearchIcon size={16} className={loading ? "animate-pulse" : ""} />
      </button>
    </div>
  );

  const sinLocal = origin === "sin-local";
  const placeFailed = origin === "error";
  const countLabel = placeFailed
    ? "No pudimos ubicar tu local"
    : sinLocal
    ? "Falta la ubicación de tu local"
    : loading
    ? "Buscando..."
    : `${workers.length} trabajador${workers.length === 1 ? "" : "es"} disponible${
        workers.length === 1 ? "" : "s"
      } en el radio seleccionado`;

  // Desde dónde se mide, dicho en pantalla (el comercio no debería adivinarlo).
  const originNote =
    origin === "local" && companyPlace ? (
      <p
        data-testid="search-origin"
        className="flex items-center gap-1.5 text-xs font-medium text-ink/60"
      >
        <MapPinIcon size={13} className="shrink-0 text-primary-text" />
        <span className="min-w-0 truncate">
          Desde tu local · {companyPlace.label}
        </span>
      </p>
    ) : sinLocal ? (
      // En mobile el sheet arranca replegado y el botón del estado vacío queda
      // abajo: el acceso a completar el local también va en el encabezado.
      <Link href="/profile/edit" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-primary-text underline">
        Completar ubicación del local
      </Link>
    ) : null;

  // Falló el pedido del local: no es «sin local». Se dice y se puede reintentar.
  const placeBanner = placeFailed ? (
    <div className="-mt-4">
      <ErrorBanner message="No pudimos cargar la ubicación de tu local." onRetry={retryPlace} />
    </div>
  ) : null;

  const workerList = (
    <>
      {placeFailed ? null : sinLocal ? (
        <EmptyState
          icon={<MapPinIcon size={28} />}
          title="Tu local no tiene ubicación"
          subtitle="Para buscar gente cerca necesitamos saber dónde queda. Completá la dirección de tu local y medimos desde ahí."
          primaryAction={{ label: "Completar ubicación", onClick: () => router.push("/profile/edit") }}
        />
      ) : !loading && workers.length === 0 ? (
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
                // hace legible el texto. El verde bosque sólo le toca a quien
                // efectivamente es mozo: el resto de los oficios
                // trae su propio color de `SKILL_HERO_TONE` (bartender
                // petróleo, barista espresso, cajero azul noche...), la misma tabla
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
                    className="h-16 w-16 rounded-[var(--radius-chip)] object-cover ring-1 ring-line"
                  />
                ) : (
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-[var(--radius-chip)] text-xl font-bold ${
                      worker.skills.length > 0
                        ? heroTile(worker.skills[0])
                        : "bg-gradient-to-br from-primary to-primary-strong text-night"
                    }`}
                  >
                    {worker.full_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold text-ink">{worker.full_name}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <RatingOrNew rating={worker.rating} size={13} numberClassName="text-xs text-ink/50" />
                    {worker.distance_km != null && (
                      <span className="text-xs text-ink/40">
                        · {formatKm(worker.distance_km)}
                      </span>
                    )}
                  </div>
                  {/* ADR-0014: "Disponible ahora" — sólo cuando está vigente,
                      nunca "zona del perfil" a modo de badge (ésa es la
                      ausencia de esto, no otro estado que mostrar). */}
                  {worker.is_live && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-success-text">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
                      Disponible ahora
                      {worker.position_updated_at && (
                        <span className="font-normal text-ink/40">
                          · {formatAgo(worker.position_updated_at)}
                        </span>
                      )}
                    </p>
                  )}
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
          {placeBanner}
          {error && (
            <div className="mt-2">
              <ErrorBanner message={error} onRetry={search} />
            </div>
          )}
        </div>
        <p className="px-5 pt-4 text-sm font-semibold text-ink/75">{countLabel}</p>
        {originNote && <div className="px-5 pt-1">{originNote}</div>}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">{workerList}</div>
      </aside>

      {/* Mapa + overlays mobile */}
      <div className="relative h-full flex-1 overflow-hidden">
        <WorkerSearchMap center={center} workers={workers} showOrigin={origin === "local" || origin === "cerca"} className="absolute inset-0 h-full w-full" />

        {/* Filtros flotantes: sólo mobile (en desktop ya están en el panel). */}
        <div className="absolute inset-x-0 top-0 z-10 p-3 md:hidden">
          {filterControls}
          {placeBanner}
          {error && (
            <div className="mt-2">
              <ErrorBanner message={error} onRetry={search} />
            </div>
          )}
        </div>

        {/* BottomSheet: sólo mobile — en desktop la lista vive en el panel. */}
        <div className="md:hidden">
          <BottomSheet header={
              <div className="px-4 pb-2">
                <p className="text-sm font-semibold text-ink/75">{countLabel}</p>
                {originNote && <div className="mt-0.5">{originNote}</div>}
              </div>
            }>
            {workerList}
          </BottomSheet>
        </div>
      </div>
    </div>
  );
}
