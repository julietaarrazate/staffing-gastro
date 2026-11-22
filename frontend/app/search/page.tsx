"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useCompanyPlace } from "@/lib/company-place";
import Link from "next/link";
import { SKILL_LABELS, WORKER_SKILLS, WorkerMapResult, WorkerSkill } from "@/lib/types";
import { Button, EmptyState, ErrorBanner, Skeleton } from "@/components/ui";
import { MapPinIcon, SearchIcon, UsersIcon } from "@/components/icons";
import PersonaCerca from "@/components/employer/PersonaCerca";
import BottomSheet from "@/components/BottomSheet";

function WorkerRowSkeleton() {
  return (
    <div className="mapa-turno persona-fila flex gap-3 p-3" aria-hidden>
      <Skeleton className="persona-foto shrink-0 rounded-full" />
      <div className="flex-1 space-y-2 pt-1">
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

// Tamaño de página de `/matching/search` (el backend devuelve 50 por defecto y
// acepta hasta 100, con `offset`). La API no informa el total: si la página
// vino llena, puede haber más.
const PAGINA = 50;

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
      <div data-testid="guarda-cargando" aria-busy className="estilo-suave mx-auto max-w-md space-y-3 px-4 pb-8 pt-4 md:max-w-5xl">
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
  // La última página vino llena: puede haber más personas que las que se ven.
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
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

  function paramsDeBusqueda(offset: number) {
    const params = new URLSearchParams({
      latitude: String(center[0]),
      longitude: String(center[1]),
      radius_km: String(radiusKm),
      limit: String(PAGINA),
      offset: String(offset),
    });
    if (skill) params.set("skill", skill);
    return params;
  }

  async function verMas() {
    if (!token || cargandoMas) return;
    const seq = searchSeq.current;
    setCargandoMas(true);
    setError(null);
    try {
      const mas = await api.get<WorkerMapResult[]>(
        `/matching/search?${paramsDeBusqueda(workers.length).toString()}`,
        token
      );
      if (seq !== searchSeq.current) return;
      const vistos = new Set(workers.map((w) => w.profile_id));
      setWorkers([...workers, ...mas.filter((w) => !vistos.has(w.profile_id))]);
      setHayMas(mas.length >= PAGINA);
    } catch (err) {
      if (seq !== searchSeq.current) return;
      setError(getErrorMessage(err, "No se pudo buscar trabajadores"));
    } finally {
      setCargandoMas(false);
    }
  }

  async function search() {
    if (!token || !filtersRestored) return;
    if (origin === "esperando" || origin === "sin-local" || origin === "error") {
      if (origin === "sin-local" || origin === "error") {
        setWorkers([]);
        setHayMas(false);
        setLoading(false);
      }
      return;
    }
    const seq = ++searchSeq.current;
    setLoading(true);
    setError(null);
    try {
      const results = await api.get<WorkerMapResult[]>(
        `/matching/search?${paramsDeBusqueda(0).toString()}`,
        token
      );
      if (seq !== searchSeq.current) return;
      setWorkers(results);
      setHayMas(results.length >= PAGINA);
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

  // Los filtros, de vidrio sobre el cielo del mapa (celular) y sobre el panel
  // (compu). Misma función y mismos nombres accesibles que antes.
  // La hoja, arrastrada al máximo, no tapa el cielo: se mide hasta dónde llega
  // lo de arriba (título, desde dónde se mide, filtros y avisos) y se le pasa
  // a `BottomSheet` como `--hoja-tope`. En la compu el cielo no se ve (alto 0)
  // y no hay tope.
  const mapaRef = useRef<HTMLDivElement>(null);
  const cieloRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const mapa = mapaRef.current;
    const cielo = cieloRef.current;
    if (!mapa || !cielo) return;
    const medir = () => {
      const ultimo = cielo.lastElementChild as HTMLElement | null;
      if (cielo.offsetHeight === 0 || !ultimo) {
        mapa.style.removeProperty("--hoja-tope");
        return;
      }
      // El último renglón con contenido (el de avisos puede estar vacío).
      let fin = cielo.firstElementChild as HTMLElement;
      for (const hijo of Array.from(cielo.children) as HTMLElement[]) {
        if (hijo.offsetHeight > 0) fin = hijo;
      }
      const tope = fin.getBoundingClientRect().bottom - mapa.getBoundingClientRect().top + 12;
      mapa.style.setProperty("--hoja-tope", `${Math.max(0, Math.round(tope))}px`);
    };
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(cielo);
    observer.observe(mapa);
    return () => observer.disconnect();
  }, []);

  const filterControls = (
    <div className="buscar-filtros flex items-center gap-2">
      <select
        value={skill}
        onChange={(e) => setSkill(e.target.value as WorkerSkill | "")}
        aria-label="Rubro"
        // `min-w-0`: sin esto el select no se achica y a 320 px la lupa quedaba
        // fuera de la pantalla (revisión del 2026-11-19).
        className="campo-vidrio h-11 min-w-0 flex-1 px-3 text-sm font-semibold text-ink"
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
        className="campo-vidrio h-11 w-14 px-1 text-center text-sm font-semibold text-ink"
      />
      <span className="-ml-1 text-sm font-semibold" aria-hidden>
        km
      </span>
      <button
        onClick={search}
        disabled={loading}
        aria-label="Buscar"
        className="boton-vidrio h-11 w-11 shrink-0 transition active:scale-95 disabled:opacity-60"
      >
        <SearchIcon size={18} className={loading ? "animate-pulse" : ""} />
      </button>
    </div>
  );

  const sinLocal = origin === "sin-local";
  const placeFailed = origin === "error";
  // El título de la pantalla: cuántas personas hay y respecto de qué (el comercio
  // mide desde su local; el admin, desde donde está).
  const cerca = origin === "cerca" ? "cerca tuyo" : "cerca de tu local";
  const titulo = placeFailed
    ? "No pudimos ubicar tu local"
    : sinLocal
    ? "Falta la ubicación de tu local"
    : loading
    ? "Buscando..."
    : `${workers.length}${hayMas ? " o más" : ""} ${workers.length === 1 && !hayMas ? "persona" : "personas"} ${cerca}`;

  // Desde dónde se mide, dicho en pantalla (el comercio no debería adivinarlo).
  const originNote =
    origin === "local" && companyPlace ? (
      <p data-testid="search-origin" className="flex items-center gap-1.5 text-xs font-semibold">
        <MapPinIcon size={13} className="shrink-0" />
        <span className="min-w-0 truncate">
          Desde tu local · {companyPlace.label}
        </span>
      </p>
    ) : sinLocal ? (
      // En mobile la hoja arranca replegada y el botón del estado vacío queda
      // abajo. El cielo no recibe toques (el mapa se mueve por debajo): este
      // enlace los vuelve a pedir, si no el toque cae en el mapa.
      <Link href="/profile/edit" className="pointer-events-auto inline-flex min-h-[44px] items-center text-sm font-semibold underline">
        Completar ubicación del local
      </Link>
    ) : null;

  // Falló el pedido del local: no es «sin local». Se dice y se puede reintentar.
  const placeBanner = placeFailed ? (
    <div className="mt-2">
      <ErrorBanner message="No pudimos cargar la ubicación de tu local." onRetry={retryPlace} />
    </div>
  ) : null;

  const workerList = (
    <>
      {placeFailed ? null : sinLocal ? (
        <div className="buscar-vacio">
          <EmptyState
            icon={<MapPinIcon size={28} />}
            title="Tu local no tiene ubicación"
            subtitle="Para buscar gente cerca necesitamos saber dónde queda. Completá la dirección de tu local y medimos desde ahí."
            primaryAction={{ label: "Completar ubicación", onClick: () => router.push("/profile/edit") }}
          />
        </div>
      ) : !loading && workers.length === 0 ? (
        <EmptyState
          icon={<UsersIcon size={28} />}
          title="Nadie por acá todavía"
          subtitle="Ampliá el radio de búsqueda o probá otro rubro para encontrar candidatos cerca."
        />
      ) : (
        // Cada persona en una fila suave, como los turnos de `/map`: foto
        // redonda, nombre, nota y distancia, «Disponible ahora» en verde y los
        // rubros como chips. Toda la fila lleva a su ficha.
        <div className="grid gap-3 py-1 sm:grid-cols-2 md:grid-cols-1">
          {loading ? (
            <>
              <WorkerRowSkeleton />
              <WorkerRowSkeleton />
              <WorkerRowSkeleton />
            </>
          ) : (
            workers.map((worker) => <PersonaCerca key={worker.profile_id} worker={worker} />)
          )}
          {!loading && hayMas && (
            <Button variant="surface" fullWidth loading={cargandoMas} disabled={cargandoMas} onClick={verMas} className="sm:col-span-2 md:col-span-1">
              Ver más personas
            </Button>
          )}
        </div>
      )}
    </>
  );

  const avisoError = error && (
    <div className="mt-2">
      <ErrorBanner message={error} onRetry={search} />
    </div>
  );

  return (
    <div className="estilo-suave bajo-barra-hoja flex h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] overflow-hidden md:h-[calc(100dvh-var(--chrome-top))]">
      {/* Panel lateral (desktop, md+): el título, los filtros y la MISMA lista
          que en mobile vive en la hoja (mismo patrón que `/map`). En mobile no
          se renderiza (hidden). */}
      <aside className="mapa-panel hidden w-full max-w-[400px] shrink-0 flex-col overflow-hidden bg-card md:flex">
        <div className="shrink-0 px-5 pb-3 pt-5">
          <h1 className="titulo-pantalla break-words text-ink">{titulo}</h1>
          {originNote && <div className="mt-1.5 text-ink-soft">{originNote}</div>}
          <div className="mt-3">{filterControls}</div>
          {placeBanner}
          {avisoError}
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-1">{workerList}</div>
      </aside>

      {/* Mapa + overlays mobile */}
      <div ref={mapaRef} className="buscar-mapa relative h-full flex-1 overflow-hidden">
        <WorkerSearchMap center={center} workers={workers} showOrigin={origin === "local" || origin === "cerca"} className="absolute inset-0 h-full w-full" />

        {/* El mapa es el cielo (ADR-0028, como `/map`): arriba se funde con el
            cielo de la app (lo hace el CSS sobre el lienzo) y encima van el
            título, desde dónde se mide y los filtros de vidrio. Sólo mobile: en
            la compu van en el panel. El cielo no recibe toques (el mapa se
            mueve también por debajo del título); los filtros sí. */}
        <div ref={cieloRef} className="mapa-cielo buscar-cielo pointer-events-none absolute inset-x-0 top-0 z-10 px-4 pb-8 pt-5 md:hidden">
          <h1 className="titulo-pantalla break-words px-1">{titulo}</h1>
          {originNote && <div className="mt-1.5 px-1">{originNote}</div>}
          <div className="pointer-events-auto mt-3">{filterControls}</div>
          <div className="pointer-events-auto">
            {placeBanner}
            {avisoError}
          </div>
        </div>

        {/* La hoja: sólo mobile — en desktop la lista vive en el panel. */}
        <div className="md:hidden">
          <BottomSheet>{workerList}</BottomSheet>
        </div>
      </div>
    </div>
  );
}
