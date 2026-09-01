"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { usePushPrompt } from "@/lib/push-prompt-context";
import { Shift, ShiftApplication, WorkerProfile } from "@/lib/types";
import { getCached, setCached } from "@/lib/screen-cache";
import { isTodayInArgentina } from "@/lib/datetime";
import {
  distanceOf,
  getStoredLocation,
  originFor,
  sortByDistance,
  type CurrentLocation,
} from "@/lib/current-location";
import LocationBar from "@/components/worker/LocationBar";
import AIAssistantBar from "@/components/AIAssistantBar";
import { Avatar, CardSkeleton, CardSkeletons, EmptyState, useToast } from "@/components/ui";
import SwipeDeck from "@/components/worker/SwipeDeck";
import OpportunityCard from "@/components/worker/OpportunityCard";
import GuidedTour, { type TourStep } from "@/components/GuidedTour";
import { CloseIcon, FlameIcon } from "@/components/icons";
import { EmptyFeedIllustration, ErrorIllustration } from "@/components/illustrations";

/** Pedido de Julieta: el onboarding del trabajador (zona + oficio) quedaba
 * corto — al aterrizar en el feed no había nada que explicara cómo se usa.
 * Mini-tour de una sola vez (ver `GuidedTour`), apuntando a lo mínimo para
 * entender la pantalla: el mazo de turnos, el filtro de urgentes (si hay) y
 * dónde encontrar después las postulaciones. */
const WORKER_FEED_TOUR: TourStep[] = [
  {
    target: '[data-tour="feed-deck"]',
    title: "Así se ven los turnos",
    body: "Deslizá o tocá una tarjeta para ver el detalle y postularte. Van apareciendo en tiempo real.",
  },
  {
    target: '[data-tour="feed-urgent-filter"]',
    title: "Los urgentes se cubren rápido",
    body: "Activá este filtro para ver primero los turnos que el comercio necesita cubrir ya.",
  },
  {
    target: '[data-tour="nav-my-shifts"]',
    title: "Acá seguís tus postulaciones",
    body: 'Cuando te postulás o te asignan un turno, lo vas a encontrar en "Matches".',
  },
];

/** Lo que se conserva del feed entre visitas a la pestaña (ver screen-cache). */
interface CachedFeed {
  shifts: Shift[];
  profile: WorkerProfile | null;
}
const FEED_CACHE_KEY = "worker-feed";

/** Búsqueda armada por el asistente de IA del trabajador (`/assistant`,
 * `lib/use-worker-ai-assistant.ts`: "búscame un turno en Palermo a menos de
 * 2 km para hoy tanto para mozo barista y cajero") y pasada acá por query
 * params — la zona ya viene resuelta a lat/lng (el hook la busca en
 * `lib/locations.ts`), así que este componente sólo filtra/ordena, no
 * geocodifica nada. */
interface AssistantSearch {
  positions: string[];
  origin: [number, number];
  zoneName: string;
  radiusKm: number | null;
  todayOnly: boolean;
}

function useAssistantSearch(): AssistantSearch | null {
  const searchParams = useSearchParams();
  return useMemo(() => {
    const positions = searchParams.getAll("positions");
    const lat = searchParams.get("zoneLat");
    const lng = searchParams.get("zoneLng");
    const zoneName = searchParams.get("zoneName");
    if (positions.length === 0 || !lat || !lng || !zoneName) return null;
    const radiusKmRaw = searchParams.get("radiusKm");
    return {
      positions,
      origin: [Number(lat), Number(lng)],
      zoneName,
      radiusKm: radiusKmRaw ? Number(radiusKmRaw) : null,
      todayOnly: searchParams.get("today") === "1",
    };
  }, [searchParams]);
}

function feedPathFor(positions: string[]): string {
  if (positions.length === 0) return "/shifts/feed";
  const params = new URLSearchParams();
  positions.forEach((p) => params.append("positions", p));
  return `/shifts/feed?${params.toString()}`;
}

export default function WorkerHomePage() {
  return (
    <Suspense fallback={null}>
      <WorkerFeedPanel />
    </Suspense>
  );
}

function WorkerFeedPanel() {
  const { token, user } = useRequireAuth();
  const router = useRouter();
  const assistantSearch = useAssistantSearch();
  const { requestOptIn } = usePushPrompt();
  const toast = useToast();
  // Stale-while-revalidate (lib/screen-cache.ts): si el trabajador ya estuvo
  // en el feed en esta sesión, la pantalla pinta al instante lo último que vio
  // y refresca por detrás, en vez de mostrar el esqueleto entero cada vez que
  // vuelve a la pestaña.
  const cached = getCached<CachedFeed>(FEED_CACHE_KEY);
  const [shifts, setShifts] = useState<Shift[]>(cached?.shifts ?? []);
  const [profile, setProfile] = useState<WorkerProfile | null>(cached?.profile ?? null);
  const [available, setAvailable] = useState(cached?.profile?.is_available ?? true);
  const [loading, setLoading] = useState(cached === undefined);
  const [error, setError] = useState<string | null>(null);
  // Grilla de escritorio (md+, sin swipe): turno con una decisión en vuelo.
  const [decidingId, setDecidingId] = useState<string | null>(null);
  // "Estoy acá ahora": si el trabajador compartió dónde está, el feed se
  // ordena desde ese punto y no desde la zona fija de su perfil. Dura lo que
  // dura la pestaña y NO pisa el perfil (ver lib/current-location.ts).
  const [here, setHere] = useState<CurrentLocation | null>(null);
  useEffect(() => setHere(getStoredLocation()), []);
  // F1 (auditoría de producto 2026-08-10): el backend ya soporta filtrar por
  // `urgent` (GET /shifts/feed?urgent=true), pero no había ningún control en
  // esta pantalla para usarlo — sólo se veía el badge "Urgente" en la
  // tarjeta. Filtro client-side (el feed ya está cargado completo, sin
  // paginar) para no perder el orden por distancia ni disparar otro request.
  const [urgentOnly, setUrgentOnly] = useState(false);
  const { keyFor, clear: clearIdempotencyKey } = useIdempotencyKeys();

  const load = useCallback(async () => {
    if (!token) return;
    // Una búsqueda del asistente siempre recarga (no hay caché previo que
    // sirva para una consulta puntual) y siempre bloquea con esqueleto —
    // fuera de eso, sólo bloqueamos en la primera carga real; si ya hay algo
    // cacheado, el refresco del feed normal es silencioso.
    if (assistantSearch || getCached<CachedFeed>(FEED_CACHE_KEY) === undefined) {
      setLoading(true);
    }
    setError(null);
    try {
      const [feed, prof, applied] = await Promise.all([
        api.get<Shift[]>(feedPathFor(assistantSearch?.positions ?? []), token),
        api.get<WorkerProfile>("/workers/me/profile", token).catch(() => null),
        api.get<ShiftApplication[]>("/applications/mine", token).catch(() => []),
      ]);
      const appliedIds = new Set(applied.map((a) => a.shift_id));
      const visible = feed.filter((s) => !appliedIds.has(s.id));
      setShifts(visible);
      if (prof) {
        setProfile(prof);
        setAvailable(prof.is_available);
      }
      // No cachear resultados de una búsqueda del asistente: son la
      // respuesta a ESA consulta puntual, no "el feed" que se restaura al
      // volver a la pestaña sin más contexto.
      if (!assistantSearch) setCached<CachedFeed>(FEED_CACHE_KEY, { shifts: visible, profile: prof });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el feed");
    } finally {
      setLoading(false);
    }
  }, [token, assistantSearch]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleAvailable() {
    if (!token || !profile) return;
    const next = !available;
    setAvailable(next); // optimista
    try {
      await api.put<WorkerProfile>(
        "/workers/me/profile",
        {
          photo_url: profile.photo_url,
          birth_date: profile.birth_date,
          city: profile.city,
          bio: profile.bio,
          latitude: profile.latitude,
          longitude: profile.longitude,
          skills: profile.skills,
          years_experience: profile.years_experience,
          languages: profile.languages,
          certifications: profile.certifications,
          cv_url: profile.cv_url,
          is_available: next,
        },
        token
      );
      toast(next ? "Estás disponible" : "Te marcaste como no disponible");
    } catch {
      setAvailable(!next); // revertir
      toast("No se pudo actualizar tu disponibilidad", "error");
    }
  }

  /** Saca un turno ya decidido del caché del feed, para que al volver a la
   *  pestaña no reaparezca una carta que el trabajador ya despachó (el mazo
   *  visible no se toca: lo maneja SwipeDeck con su propio estado). */
  function dropFromCache(shiftId: string) {
    const current = getCached<CachedFeed>(FEED_CACHE_KEY);
    if (!current) return;
    setCached<CachedFeed>(FEED_CACHE_KEY, {
      ...current,
      shifts: current.shifts.filter((s) => s.id !== shiftId),
    });
  }

  async function onDecide(shift: Shift, decision: "like" | "pass"): Promise<boolean> {
    // "pass" es un descarte local: no hay red de por medio, así que siempre
    // se considera procesado.
    if (decision === "pass" || !token) {
      if (decision === "pass") dropFromCache(shift.id);
      return true;
    }
    try {
      // Idempotencia (product/IDEMPOTENCIA_SPEC.md): si la carta vuelve al
      // mazo por un error de red y el trabajador vuelve a swipear a la
      // derecha, es el MISMO intento — se reusa la key hasta que postularse
      // termine bien.
      await api.post(
        `/applications/shifts/${shift.id}`,
        undefined,
        token,
        undefined,
        keyFor(shift.id)
      );
      clearIdempotencyKey(shift.id);
      dropFromCache(shift.id);
      toast("¡Te postulaste! El comercio ya te puede ver");
      // Primera acción significativa del flujo del trabajador: acá, y no al
      // aterrizar en la app, es cuando tiene sentido preguntar si quiere
      // enterarse por push cuando el comercio responda (ver docs/reference/ACCESO_MODERNO.md).
      requestOptIn();
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Ya estaba postulado: no es un error real, se trata como descarte
        // (la carta no vuelve).
        clearIdempotencyKey(shift.id);
        dropFromCache(shift.id);
        toast("Ya te habías postulado a este turno");
        return true;
      }
      toast(getErrorMessage(err, "No se pudo enviar tu postulación"), "error");
      return false;
    }
  }

  /** Decidir desde la grilla de escritorio: mismo `onDecide` de arriba, pero
   *  sin el mazo local de SwipeDeck que en mobile saca la carta de encima —
   *  acá hay que sacar el turno de `shifts` a mano para que desaparezca de
   *  la grilla apenas se resuelve. */
  async function handleGridDecide(shift: Shift, decision: "like" | "pass") {
    if (decidingId !== null) return;
    setDecidingId(shift.id);
    const ok = await onDecide(shift, decision);
    if (ok) setShifts((prev) => prev.filter((s) => s.id !== shift.id));
    setDecidingId(null);
  }

  const firstName = user?.full_name?.split(" ")[0];

  // Búsqueda del asistente: origen fijo en la zona pedida (no "acá ahora"/
  // perfil), radio como corte duro (no sólo orden, como en el feed normal —
  // "a menos de 2 km" tiene que sacar lo que no entra) y sólo hoy si lo pidió.
  const origin = assistantSearch ? assistantSearch.origin : originFor(here, profile);
  let sortedShifts = sortByDistance(shifts, origin);
  if (assistantSearch?.radiusKm != null) {
    const radiusKm = assistantSearch.radiusKm;
    sortedShifts = sortedShifts.filter((s) => {
      const d = distanceOf(s, origin);
      return d != null && d <= radiusKm;
    });
  }
  if (assistantSearch?.todayOnly) {
    sortedShifts = sortedShifts.filter((s) => isTodayInArgentina(s.start_at));
  }
  const visibleShifts = urgentOnly ? sortedShifts.filter((s) => s.urgent) : sortedShifts;
  const urgentCount = sortedShifts.filter((s) => s.urgent).length;
  const emptyTitle = assistantSearch
    ? "No encontramos turnos con esa búsqueda"
    : urgentOnly
      ? "No hay turnos urgentes ahora"
      : "No hay más turnos cerca";
  const emptySubtitle = assistantSearch
    ? "Probá un radio más amplio o menos puestos a la vez."
    : urgentOnly
      ? "Sacá el filtro para ver el resto de las oportunidades disponibles."
      : "Ya viste todas las oportunidades del momento. Aparecen en tiempo real: volvé en un rato.";
  const emptyStateAction = assistantSearch
    ? { label: "Ver todos los turnos", onClick: () => router.push("/feed") }
    : urgentOnly
      ? { label: "Ver todos", onClick: () => setUrgentOnly(false) }
      : { label: "Actualizar", onClick: load };

  return (
    <div className="mx-auto flex h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] max-w-md flex-col px-4 pb-3 pt-3 md:h-[calc(100dvh-var(--chrome-top))] md:max-w-5xl">
      {/* Header: saludo + disponibilidad. `mb-2` (no `mb-3`): en un
          `flex flex-col` los márgenes entre hermanos no colapsan, así que
          todo este bloque de cabecera (saludo, barra del asistente,
          ubicación, filtro de urgentes) usa el mismo `mb-2` para un ritmo
          parejo de 8px y recuperar alto real para el mazo — antes eran 12px
          acá y hasta 24px más abajo por el doble margen entre la barra del
          asistente y LocationBar (auditoría de espaciado, Julieta,
          2026-08-16). */}
      {/* Avatar "md" (44px), no "lg" (64px): un círculo grande de marca acá
          arriba quedaba apilado muy cerca del círculo del ícono de
          AIAssistantBar apenas debajo — dos "globos" naranjas del mismo
          tamaño casi tocándose (Julieta, 2026-08-16: "el ícono de Oído en
          qué necesitás se junta demasiado con otros globos"). De paso
          devuelve unos px más de alto real para el mazo de abajo. */}
      <header className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar src={profile?.photo_url} name={user?.full_name ?? "Vos"} size="md" />
          <div>
            <h1 className="font-display text-2xl font-semibold leading-tight text-ink">
              {firstName ? `Hola, ${firstName}` : "Hola"}
            </h1>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleAvailable}
          className="flex flex-col items-center gap-1"
          aria-label="Cambiar disponibilidad"
        >
          <span
            className={`relative h-7 w-12 rounded-full transition-colors ${
              available ? "bg-success" : "bg-line"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-card shadow transition-all ${
                available ? "left-[22px]" : "left-0.5"
              }`}
            />
          </span>
          <span className={`text-[11px] font-semibold ${available ? "text-success-text" : "text-ink/40"}`}>
            {available ? "Disponible" : "No disp."}
          </span>
        </button>
      </header>

      {/* Mismo lugar y tratamiento que ya tiene el comercio en /shifts
          (pedido de Julieta: "queda mejor como tiene comercio, un lugar
          arriba... lo mismo tiene que tener para trabajador"); reemplaza a la
          cápsula flotante, que se sacó de toda la app (Julieta, 2026-08-16:
          "no quiero botones flotantes"). */}
      <div className="mb-2">
        <AIAssistantBar />
      </div>

      {assistantSearch ? (
        // Reemplaza a LocationBar mientras hay una búsqueda del asistente
        // activa: el origen ya no es "acá ahora"/perfil, es la zona pedida
        // — mostrar los dos juntos confundiría cuál manda.
        <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-soft)] ring-1 ring-line">
          <p className="text-sm text-ink/70">
            Turnos que buscaste en <span className="font-semibold text-ink">{assistantSearch.zoneName}</span>
          </p>
          <button
            type="button"
            onClick={() => router.push("/feed")}
            aria-label="Ver todos los turnos"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-ink/50"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      ) : (
        <div className="mb-2">
          <LocationBar current={here} profileCity={profile?.city ?? null} onChange={setHere} />
        </div>
      )}

      {(urgentCount > 0 || urgentOnly) && (
        <div className="mb-2 flex">
          <button
            type="button"
            role="switch"
            aria-checked={urgentOnly}
            data-tour="feed-urgent-filter"
            onClick={() => setUrgentOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition active:scale-95 ${
              urgentOnly
                ? "bg-primary/10 text-primary-text ring-primary/30"
                : "bg-card text-ink/60 ring-line hover:bg-surface"
            }`}
          >
            <FlameIcon size={14} />
            Sólo urgentes{urgentCount > 0 ? ` (${urgentCount})` : ""}
          </button>
        </div>
      )}

      {/* Deck */}
      <div className="min-h-0 flex-1 md:overflow-y-auto">
        {loading ? (
          <>
            <div className="h-full md:hidden">
              <CardSkeleton />
            </div>
            <div className="hidden md:block">
              <CardSkeletons count={6} />
            </div>
          </>
        ) : error ? (
          <EmptyState
            icon={<ErrorIllustration color="#f97316" />}
            title="No se pudo cargar"
            subtitle={error}
            primaryAction={{ label: "Reintentar", onClick: load }}
          />
        ) : (
          <>
            {/* Mobile: mazo tipo Tinder, se decide con swipe. */}
            <div className="h-full md:hidden" data-tour="feed-deck">
              <SwipeDeck
                shifts={visibleShifts}
                onDecide={onDecide}
                // Tocar la tarjeta abre el turno completo (`/turno/[id]`),
                // que ya existe como página pública y trae el detalle y el
                // link al comercio. Antes desde el mazo sólo se podía
                // swipear: no había forma de mirar el turno antes de decidir
                // (Julieta, 2026-08-17).
                onOpen={(shift) => router.push(`/turno/${shift.id}`)}
                renderCard={(shift) => (
                  <OpportunityCard shift={shift} distanceKm={distanceOf(shift, origin)} />
                )}
                empty={
                  <EmptyState
                    icon={<EmptyFeedIllustration color="#f97316" />}
                    title={emptyTitle}
                    subtitle={emptySubtitle}
                    primaryAction={emptyStateAction}
                  />
                }
              />
            </div>

            {/* Desktop (md+): el gesto de swipe no existe con mouse, así que
                se ven todas las oportunidades a la vez en una grilla, con
                Postularme/No gracias como botones directos en cada tarjeta
                (antes el mazo se estiraba solo, centrado en una pantalla
                vacía — ver docs/STATUS.md, pedido de Julieta 2026-07-29). */}
            <div className="hidden md:block">
              {visibleShifts.length === 0 ? (
                <EmptyState
                  icon={<EmptyFeedIllustration color="#f97316" />}
                  title={emptyTitle}
                  subtitle={emptySubtitle}
                  primaryAction={emptyStateAction}
                />
              ) : (
                <div className="grid grid-cols-2 gap-5 pb-6 lg:grid-cols-3">
                  {visibleShifts.map((shift) => (
                    <div key={shift.id} data-testid="feed-grid-card" className="h-[620px]">
                      <OpportunityCard
                        shift={shift}
                        distanceKm={distanceOf(shift, origin)}
                        applying={decidingId === shift.id}
                        onApply={() => handleGridDecide(shift, "like")}
                        onPass={() => handleGridDecide(shift, "pass")}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {!loading && <GuidedTour steps={WORKER_FEED_TOUR} storageKey="staffya_tour_worker_feed" />}
    </div>
  );
}
