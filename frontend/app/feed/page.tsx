"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { appliedShiftIds } from "@/lib/applications";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useTapGuard } from "@/lib/use-tap-guard";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { usePushPrompt } from "@/lib/push-prompt-context";
import { Shift, ShiftApplication, WorkerProfile } from "@/lib/types";
import { getCached, setCached } from "@/lib/screen-cache";
import { saveProfilePart } from "@/lib/worker-profile";
import { esPerfilInexistente } from "@/lib/perfil-faltante";
import { bienvenidaHref } from "@/lib/safe-next";
import PerfilFaltanteCard from "@/components/PerfilFaltanteCard";
import { isTodayInArgentina } from "@/lib/datetime";
import {
  distanceOf,
  getStoredLocation,
  NEARBY_RADIUS_KM,
  nearbyOnly,
  originFor,
  sortByDistance,
  type CurrentLocation,
} from "@/lib/current-location";
import LocationBar from "@/components/worker/LocationBar";
import AIAssistantBar from "@/components/AIAssistantBar";
import { CardSkeletons, EmptyState, Skeleton, useToast } from "@/components/ui";
import OpportunityCard from "@/components/worker/OpportunityCard";
import FeedHero from "@/components/worker/FeedHero";
import NearbyRow from "@/components/worker/NearbyRow";
import DiscoverDeck from "@/components/worker/DiscoverDeck";
import GuidedTour, { type TourStep } from "@/components/GuidedTour";
import { ChevronRightIcon, CloseIcon, SparklesIcon } from "@/components/icons";
import { EmptyFeedIllustration, ErrorIllustration } from "@/components/illustrations";

/** Pedido de Julieta: el onboarding del trabajador (zona + oficio) quedaba
 * corto — al aterrizar en el feed no había nada que explicara cómo se usa.
 * Mini-tour de una sola vez (ver `GuidedTour`), apuntando a lo mínimo para
 * entender la pantalla: los turnos, el filtro de urgentes y dónde encontrar
 * después las postulaciones. */
const WORKER_FEED_TOUR: TourStep[] = [
  {
    target: '[data-tour="feed-deck"]',
    title: "Así se ven los turnos",
    body: "Tocá un turno para ver el detalle y postularte, o usá Descubrir rápido para recorrerlos de a uno. Van apareciendo en tiempo real.",
  },
  {
    target: '[data-tour="nav-buscar"]',
    title: "Los urgentes se cubren rápido",
    body: "En Buscar ves todo el mercado y podés quedarte sólo con los urgentes u ordenar por lo que pagan.",
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
/** Marca interna: el perfil se pidió y el servidor dijo 404 (no existe). */
const SIN_PERFIL = Symbol("sin-perfil");

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

/** El Inicio pide el feed a secas: el servidor ya lo acota a lo que queda
 * cerca de la zona del perfil. Una búsqueda del asistente pide todo el
 * mercado (`scope=all`) medido desde el centro de la zona que la persona
 * escribió, para que "turnos en Córdoba" no dependa de dónde está su perfil.
 * Ese punto es un lugar que se pidió por nombre, no la posición del
 * dispositivo: "Estoy acá" no viaja al servidor. */
function feedPathFor(search: AssistantSearch | null): string {
  if (!search) return "/shifts/feed";
  const params = new URLSearchParams();
  params.set("scope", "all");
  params.set("latitude", String(search.origin[0]));
  params.set("longitude", String(search.origin[1]));
  search.positions.forEach((p) => params.append("positions", p));
  return `/shifts/feed?${params.toString()}`;
}

// Una sola composición del feed por pantalla: antes se montaban la de celular
// y la de escritorio a la vez (una oculta con CSS), ~2300 nodos en celular, y
// cada toque re-renderizaba las dos (INP ~460 ms medido 2026-10-22). En el
// servidor y en la hidratación se asume celular; si es escritorio, cambia
// apenas monta.
const DESKTOP_QUERY = "(min-width: 48rem)"; // `md` de Tailwind

function subscribeDesktop(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
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
  // «Llegó vacío» (el servidor no devolvió ningún turno) no es lo mismo que
  // «los vi todos» (la persona fue pasando/descartando las tarjetas): lo
  // primero no se puede decir como si ya hubiera visto algo. El caché guarda
  // lo que devolvió el servidor, así que vacío ahí también es «llegó vacío».
  const [arrivedEmpty, setArrivedEmpty] = useState(cached !== undefined && cached.shifts.length === 0);
  const [error, setError] = useState<string | null>(null);
  // La cuenta no tiene perfil de trabajador (se cortó la bienvenida): cartel
  // para completarlo en vez de dejar el Inicio como si nada.
  const [sinPerfil, setSinPerfil] = useState(false);
  // Grilla de escritorio (md+, sin swipe): turno con una decisión en vuelo.
  const [decidingId, setDecidingId] = useState<string | null>(null);
  // Turnos a los que se postuló desde la grilla: la tarjeta queda en su lugar,
  // marcada «Postulado», hasta la próxima carga (si desapareciera, las demás
  // correrían bajo el dedo y el segundo toque caería en otra «Postularme»).
  const [appliedInGrid, setAppliedInGrid] = useState<ReadonlySet<string>>(() => new Set());
  const tapGuard = useTapGuard();
  // "Estoy acá ahora": si el trabajador compartió dónde está, el feed se
  // ordena desde ese punto y no desde la zona fija de su perfil. Dura lo que
  // dura la pestaña y NO pisa el perfil (ver lib/current-location.ts).
  const [here, setHere] = useState<CurrentLocation | null>(null);
  useEffect(() => setHere(getStoredLocation()), []);
  // Los chips "Urgentes" y "Mejores pagos" vivían acá y se mudaron a /buscar
  // (2026-09-28, diagnóstico de sobrecarga): arriba del primer turno había
  // tres maneras de filtrar o de decir dónde estás. El Inicio responde una
  // sola pregunta, "¿qué turno tomo?", ordenado por cercanía; filtrar es lo
  // que se hace en Buscar.
  // "Descubrir rápido": el mazo para deslizar a pantalla completa. Mientras está
  // abierto se le pasa una foto fija de los turnos (si cambiara la lista bajo
  // sus pies, SwipeDeck resetearía el mazo en medio de un gesto); lo decidido
  // se saca del home recién al cerrar.
  const [deckShifts, setDeckShifts] = useState<Shift[] | null>(null);
  const decidedInDeck = useRef<Set<string>>(new Set());
  const { keyFor, clear: clearIdempotencyKey } = useIdempotencyKeys();
  // Cuenta los guardados del perfil hechos desde esta pantalla. Una carga que
  // leyó el perfil ANTES de un guardado y termina DESPUÉS (el feed es el
  // pedido más lento) trae una copia vieja: si el contador cambió, `load` la
  // descarta y la pantalla se queda con lo que devolvió el servidor al guardar.
  const profileSaves = useRef(0);
  // Hay un guardado del perfil en vuelo: `load` no aplica su perfil (sería el
  // viejo) para que el interruptor no parpadee de vuelta.
  const savingProfile = useRef(false);
  // Último perfil que devolvió el servidor al guardar desde acá. Sirve cuando
  // se guardó antes de que existiera el caché de pantalla (primera carga): si
  // `load` descarta su copia vieja, esto es lo que se cachea, no `null`.
  const lastSavedProfile = useRef<WorkerProfile | null>(null);

  // Último pedido gana: una carga vieja que termina tarde no pisa a la nueva.
  const latestLoad = useRef(0);
  // Cuenta las postulaciones hechas desde la grilla. Una carga que empezó
  // antes de postularse trae al turno todavía sin postular: no tiene que
  // borrar la marca «Postulado» ni volver a ofrecerlo.
  const gridApplies = useRef(0);

  const load = useCallback(async () => {
    if (!token) return;
    const mine = ++latestLoad.current;
    const appliesAtStart = gridApplies.current;
    // Una búsqueda del asistente siempre recarga (no hay caché previo que
    // sirva para una consulta puntual) y siempre bloquea con esqueleto —
    // fuera de eso, sólo bloqueamos en la primera carga real; si ya hay algo
    // cacheado, el refresco del feed normal es silencioso.
    if (assistantSearch || getCached<CachedFeed>(FEED_CACHE_KEY) === undefined) {
      setLoading(true);
    }
    setError(null);
    const savesAtStart = profileSaves.current;
    try {
      const [feed, prof, applied] = await Promise.all([
        api.get<Shift[]>(feedPathFor(assistantSearch), token),
        api
          .get<WorkerProfile>("/workers/me/profile", token)
          .catch((err) => (esPerfilInexistente(err) ? SIN_PERFIL : null)),
        api.get<ShiftApplication[]>("/applications/mine", token).catch(() => []),
      ]);
      if (mine !== latestLoad.current) return;
      const appliedIds = appliedShiftIds(applied);
      const visible = feed.filter((s) => !appliedIds.has(s.id));
      setShifts(visible);
      // La próxima carga ya trae a los postulados filtrados: la marca de la
      // grilla termina su trabajo (y si se retiró una postulación, el turno
      // vuelve a ofrecerse sin la marca vieja).
      if (gridApplies.current === appliesAtStart) setAppliedInGrid(new Set());
      setArrivedEmpty(feed.length === 0);
      // Si la persona guardó su perfil mientras esto cargaba, `prof` es viejo.
      const profFresh = profileSaves.current === savesAtStart && !savingProfile.current;
      if (prof === SIN_PERFIL) {
        if (profFresh) {
          setSinPerfil(true);
          setProfile(null);
        }
      } else if (prof && profFresh) {
        setSinPerfil(false);
        setProfile(prof);
        setAvailable(prof.is_available);
      }
      // No cachear resultados de una búsqueda del asistente: son la
      // respuesta a ESA consulta puntual, no "el feed" que se restaura al
      // volver a la pestaña sin más contexto.
      if (!assistantSearch && gridApplies.current === appliesAtStart) {
        const cachedProfile = profFresh
          ? prof === SIN_PERFIL
            ? null
            : prof
          : (lastSavedProfile.current ?? getCached<CachedFeed>(FEED_CACHE_KEY)?.profile ?? null);
        setCached<CachedFeed>(FEED_CACHE_KEY, { shifts: visible, profile: cachedProfile });
      }
    } catch (err) {
      if (mine === latestLoad.current) {
        setError(err instanceof ApiError ? err.message : "No se pudo cargar el feed");
      }
    } finally {
      if (mine === latestLoad.current) setLoading(false);
    }
  }, [token, assistantSearch]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleAvailable() {
    if (!token || savingProfile.current) return;
    const next = !available;
    setAvailable(next); // optimista
    savingProfile.current = true;
    try {
      // El endpoint reemplaza el perfil: `saveProfilePart` lo lee del servidor
      // justo antes de escribir y cambia sólo la disponibilidad. La copia de
      // esta pantalla puede estar vieja (se pinta desde caché y se actualiza
      // por detrás) y mandarla pisaba lo recién guardado en el perfil.
      const saved = await saveProfilePart(token, { is_available: next });
      profileSaves.current += 1;
      lastSavedProfile.current = saved;
      setProfile(saved);
      setAvailable(saved.is_available);
      const cachedFeed = getCached<CachedFeed>(FEED_CACHE_KEY);
      if (cachedFeed) setCached<CachedFeed>(FEED_CACHE_KEY, { ...cachedFeed, profile: saved });
      toast(next ? "Estás disponible" : "Te marcaste como no disponible");
    } catch (err) {
      setAvailable(!next); // revertir
      if (err instanceof ApiError && err.status === 404) {
        // Cerró la app en la bienvenida antes de guardar: no hay perfil que
        // actualizar y reintentar no lo arregla.
        toast("Completá tu perfil para marcarte disponible", "error");
        return;
      }
      toast("No se pudo actualizar tu disponibilidad", "error");
      // Si una carga terminó con el guardado en vuelo, descartó su perfil y
      // nadie lo volvió a aplicar. Se relee sólo el perfil: recargar todo el
      // Inicio fallaría igual sin conexión y taparía la lista con el error.
      void api
        .get<WorkerProfile>("/workers/me/profile", token)
        .then((p) => {
          if (savingProfile.current) return;
          setProfile(p);
          setAvailable(p.is_available);
          lastSavedProfile.current = p;
          const cachedFeed = getCached<CachedFeed>(FEED_CACHE_KEY);
          if (cachedFeed) setCached<CachedFeed>(FEED_CACHE_KEY, { ...cachedFeed, profile: p });
        })
        .catch(() => {});
    } finally {
      savingProfile.current = false;
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
    await tapGuard.run(async () => {
      setDecidingId(shift.id);
      try {
        const ok = await onDecide(shift, decision);
        if (!ok) return;
        if (decision === "like") {
          gridApplies.current += 1;
          setAppliedInGrid((prev) => new Set(prev).add(shift.id));
        }
        else setShifts((prev) => prev.filter((s) => s.id !== shift.id));
      } finally {
        setDecidingId(null);
      }
    });
  }

  async function onDeckApply(shift: Shift): Promise<boolean> {
    const ok = await onDecide(shift, "like");
    if (ok) decidedInDeck.current.add(shift.id);
    return ok;
  }

  function openDiscover(list: Shift[]) {
    decidedInDeck.current = new Set();
    setDeckShifts(list);
  }

  const closeDiscover = useCallback(() => {
    const decided = decidedInDeck.current;
    if (decided.size > 0) setShifts((prev) => prev.filter((s) => !decided.has(s.id)));
    setDeckShifts(null);
  }, []);

  const firstName = user?.full_name?.split(" ")[0];

  // Búsqueda del asistente: origen fijo en la zona pedida (no "acá ahora"/
  // perfil), radio como corte duro (no sólo orden, como en el feed normal —
  // "a menos de 2 km" tiene que sacar lo que no entra) y sólo hoy si lo pidió.
  // Memorizado (como `distanceFromOrigin`): así tocar "Disponible" no vuelve
  // a ordenar ni a dibujar las tarjetas, que no cambiaron.
  // Depende de la zona del perfil (dos números), no del objeto entero: guardar
  // la disponibilidad cambia `profile` y no tiene que redibujar las tarjetas.
  const profileLat = profile?.latitude ?? null;
  const profileLng = profile?.longitude ?? null;
  const origin = useMemo(
    () =>
      assistantSearch
        ? assistantSearch.origin
        : originFor(here, { latitude: profileLat, longitude: profileLng }),
    [assistantSearch, here, profileLat, profileLng],
  );
  const distanceFromOrigin = useCallback((s: Shift) => distanceOf(s, origin), [origin]);
  const visibleShifts = useMemo(() => {
    let sortedShifts = sortByDistance(shifts, origin);
    // «Cerca» es cerca: acá no se muestra nada más lejos que el radio, medido
    // desde el mismo origen que las distancias de las tarjetas. Si se pidió
    // un radio puntual ("a menos de 2 km"), manda ése, y lo que no se puede
    // ubicar queda afuera.
    sortedShifts = nearbyOnly(sortedShifts, origin, assistantSearch?.radiusKm ?? NEARBY_RADIUS_KM, {
      keepUnlocated: !assistantSearch,
    });
    if (assistantSearch?.todayOnly) {
      sortedShifts = sortedShifts.filter((s) => isTodayInArgentina(s.start_at));
    }
    return sortedShifts;
  }, [shifts, origin, assistantSearch]);
  const heroShift = visibleShifts[0];
  const restShifts = useMemo(() => visibleShifts.slice(1), [visibleShifts]);
  const isDesktop = useIsDesktop();
  // Con "Estoy acá" lo que se muestra es lo cercano a ese punto. Si ahí no hay
  // nada, se dice eso y se manda a Buscar, que es donde se ve todo: el Inicio
  // sólo trae lo de la zona del perfil, así que no puede afirmar que no hay
  // turnos en ningún lado.
  const emptyNearHere = !assistantSearch && here !== null;
  // Sin zona en el perfil el servidor manda todo: ahí «cerca de tu zona» sería falso.
  const emptyNoneInZone = !assistantSearch && !emptyNearHere && arrivedEmpty && profileLat !== null && profileLng !== null;
  const goBuscar = () => router.push("/buscar");
  const emptyTitle = assistantSearch
    ? "No encontramos turnos con esa búsqueda"
    : emptyNearHere
      ? "No hay turnos cerca de donde estás ahora"
      : emptyNoneInZone
        ? "Todavía no hay turnos cerca de tu zona"
        : "No hay más turnos cerca";
  const emptySubtitle = assistantSearch
    ? "Probá un radio más amplio o menos puestos a la vez."
    : emptyNearHere
      ? "Tocá «Volver a mi zona», arriba, o mirá todos los turnos en Buscar."
      : emptyNoneInZone
        ? "Aparecen en tiempo real y te avisamos cuando salga uno. Mientras, podés mirar los de otras zonas en Buscar."
        : "Ya viste todas las oportunidades del momento. Aparecen en tiempo real: volvé en un rato.";
  // Una sola acción primaria (ámbar) por vacío; la otra va como secundaria.
  const verTodosEnBuscar = { label: "Ver todos en Buscar", onClick: goBuscar };
  const actualizar = { label: "Actualizar", onClick: load };
  const emptyStateAction = assistantSearch
    ? { label: "Ver todos los turnos", onClick: () => router.push("/feed") }
    : emptyNearHere || emptyNoneInZone
      ? verTodosEnBuscar
      : actualizar;
  const emptySecondaryAction = assistantSearch || emptyNearHere ? undefined : emptyNoneInZone ? actualizar : verTodosEnBuscar;

  const emptyState = (
    <EmptyState
      icon={<EmptyFeedIllustration color="var(--color-primary)" />}
      title={emptyTitle}
      subtitle={emptySubtitle}
      primaryAction={emptyStateAction}
      secondaryAction={emptySecondaryAction}
    />
  );

  return (
    // Home del trabajador con la composición del board de Julieta (pantalla
    // 1): saludo en serif con la zona, buscador, la tarjeta
    // "Recomendado" y la fila "Cerca tuyo". Ya no es un mazo de alto fijo: la
    // pantalla scrollea como el board. El mazo para deslizar sigue existiendo
    // como "Descubrir rápido" (decisión de Julieta, 2026-09-22).
    <div className="mx-auto max-w-md px-4 pb-8 pt-4 md:max-w-5xl">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-h1 font-semibold text-ink">
            {firstName ? `Hola, ${firstName}` : "Hola"}
          </h1>
          {/* Desde dónde se mide el feed, en el renglón del saludo: antes era
              una barra propia entre el buscador y los chips. Mientras hay una
              búsqueda del asistente, manda la zona pedida (cartel de abajo). */}
          {assistantSearch ? (
            <p className="mt-0.5 text-sm text-ink/55">Encontrá tu próximo turno.</p>
          ) : (
            <LocationBar current={here} profileCity={profile?.city ?? null} onChange={setHere} />
          )}
        </div>
        <button
          type="button"
          onClick={toggleAvailable}
          className="mt-1 flex shrink-0 flex-col items-center gap-1"
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
          <span className={`text-label font-semibold ${available ? "text-success-text" : "text-ink/40"}`}>
            {available ? "Disponible" : "No disp."}
          </span>
        </button>
      </header>

      <div className="mb-4">
        <AIAssistantBar />
      </div>

      {/* Alta a medias (G12, U034, U035): sin perfil, o con el perfil pero sin
          zona u oficio, el Inicio no puede personalizar nada. El cartel queda
          fijo hasta que se completa (no se cierra). */}
      {!loading && sinPerfil && (
        <div className="-mt-1 mb-4">
          <PerfilFaltanteCard
            title="Te falta completar tu perfil"
            body="Completá tu zona y tus oficios para recibir turnos."
            actionLabel="Completar mi perfil"
            href={bienvenidaHref("/feed")}
          />
        </div>
      )}
      {!loading && !sinPerfil && profile && (profile.latitude == null || profile.longitude == null || !profile.skills?.length) && (
        <div className="-mt-1 mb-4">
          <PerfilFaltanteCard
            title="Completá tu zona y tus oficios para recibir turnos"
            body="Sin eso te mostramos todo y no te avisamos de los turnos que te sirven."
            actionLabel="Completar mi perfil"
            href="/profile"
          />
        </div>
      )}

      {assistantSearch && (
        // Reemplaza a LocationBar mientras hay una búsqueda del asistente
        // activa: el origen ya no es "acá ahora"/perfil, es la zona pedida
        // — mostrar los dos juntos confundiría cuál manda.
        <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-soft)] ring-1 ring-line">
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
      )}

      {loading ? (
        <>
          <div className="space-y-5 md:hidden" aria-hidden>
            <Skeleton className="h-[232px] w-full rounded-[var(--radius-card)]" />
            <div className="flex gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[170px] w-[156px] shrink-0 rounded-[var(--radius-chip)]" />
              ))}
            </div>
          </div>
          <div className="hidden md:block">
            <CardSkeletons count={6} />
          </div>
        </>
      ) : error ? (
        <EmptyState
          icon={<ErrorIllustration color="var(--color-primary)" />}
          title="No se pudo cargar"
          subtitle={error}
          primaryAction={{ label: "Reintentar", onClick: load }}
        />
      ) : (
        <>
          {/* Mobile: Recomendado + Descubrir rápido + Cerca tuyo. */}
          {!isDesktop && (
            <div className="md:hidden">
              {heroShift ? (
                <div className="space-y-6">
                  <div data-tour="feed-deck" className="space-y-3">
                    <FeedHero shift={heroShift} />
                    <button
                      type="button"
                      onClick={() => openDiscover(visibleShifts)}
                      className="flex w-full items-center gap-3 rounded-[var(--radius-card)] bg-card px-4 py-3 text-left shadow-[var(--shadow-soft)] ring-1 ring-line transition active:scale-[0.99]"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-chip)] bg-primary-tint text-primary-text">
                        <SparklesIcon size={20} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-body font-semibold text-ink">Descubrir rápido</span>
                        <span className="block text-xs text-ink/55">
                          Recorré {visibleShifts.length === 1 ? "el turno" : `los ${visibleShifts.length} turnos`} y
                          postulate al que elijas
                        </span>
                      </span>
                      <ChevronRightIcon size={18} className="shrink-0 text-ink/35" />
                    </button>
                  </div>
                  <NearbyRow shifts={restShifts} distanceOf={distanceFromOrigin} />
                </div>
              ) : (
                emptyState
              )}
            </div>
          )}

          {/* Desktop (md+): el gesto de swipe no existe con mouse, así que
              se ven todas las oportunidades a la vez en una grilla, con
              Postularme/No gracias como botones directos en cada tarjeta. */}
          {isDesktop && (
            <div className="hidden md:block">
              {visibleShifts.length === 0 ? (
                emptyState
              ) : (
                <div className="grid grid-cols-2 gap-5 pb-6 lg:grid-cols-3">
                  {visibleShifts.map((shift) => (
                    <div key={shift.id} data-testid="feed-grid-card" className="h-[620px]">
                      <OpportunityCard
                        shift={shift}
                        distanceKm={distanceOf(shift, origin)}
                        applying={decidingId === shift.id}
                        locked={tapGuard.locked}
                        applied={appliedInGrid.has(shift.id)}
                        onApply={() => handleGridDecide(shift, "like")}
                        onPass={() => handleGridDecide(shift, "pass")}
                        shareable
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {deckShifts && (
        <DiscoverDeck
          shifts={deckShifts}
          onApply={onDeckApply}
          onClose={closeDiscover}
          onOpen={(shift) => router.push(`/turno/${shift.id}`)}
          renderCard={(shift) => <OpportunityCard shift={shift} distanceKm={distanceOf(shift, origin)} />}
          empty={
            <EmptyState
              icon={<EmptyFeedIllustration color="var(--color-primary)" />}
              title="Viste todos los turnos"
              subtitle="Cerrá para volver al inicio. Van apareciendo nuevos en tiempo real."
              primaryAction={{ label: "Volver al inicio", onClick: closeDiscover }}
            />
          }
        />
      )}

      {!loading && <GuidedTour steps={WORKER_FEED_TOUR} storageKey="staffya_tour_worker_feed" />}
    </div>
  );
}
