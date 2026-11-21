"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveRefresh } from "@/lib/live-refresh";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { api, ApiError } from "@/lib/api";
import { appliedShiftIds } from "@/lib/applications";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { usePushPrompt } from "@/lib/push-prompt-context";
import { getCurrentPosition } from "@/lib/geolocation";
import { getStoredLocation, nearbyOnly, originFor, sortByDistance } from "@/lib/current-location";
import { haversineKm } from "@/lib/map/geo";
import { estimateTravelTimes } from "@/lib/map/travel-time";
import { SKILL_LABELS, Shift, ShiftApplication, WorkerProfile } from "@/lib/types";
import { Button, EmptyState, Sheet, Skeleton, useToast } from "@/components/ui";
import { BikeIcon, CalendarIcon, CarIcon, FootprintsIcon, MapPinIcon, UsersIcon } from "@/components/icons";
import { formatShiftRange, formatShiftTime } from "@/lib/datetime";
import ListaMapa from "@/components/worker/ListaMapa";
import FiltrosMapaChips from "@/components/worker/FiltrosMapa";
import { filtrarTurnos, hayFiltros, SIN_FILTROS, type FiltrosMapa } from "@/lib/map/filtros-mapa";
import MapSheet from "@/components/worker/MapSheet";
import TurnoMapa, { MiniaturaTurno } from "@/components/worker/TurnoMapa";
import ConfirmOverlay from "@/components/ui/ConfirmOverlay";
import { formatPayAmount, formatPayCompact, payView } from "@/lib/pay";
import { formatDistance, plural } from "@/lib/format";

const ShiftMap = dynamic(() => import("@/components/worker/ShiftMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-surface" />,
});

// Último recurso: sin GPS, sin ubicación guardada y sin zona en el perfil.
const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816]; // Obelisco

/** Enter/Espacio activan igual que un click — necesario para que las
 * tarjetas de turno (arriba) sean usables con teclado: son un `<div>`, no un
 * `<button>`, porque ya contienen un botón real adentro ("Postularme") y un
 * `<button>` no puede anidar otro `<button>` (jsx-a11y/no-static-element-
 * interactions, TECH_DEBT.md F4). */
function handleCardActivate(e: React.KeyboardEvent, onActivate: () => void) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    onActivate();
  }
}

function MapCardSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className={`mapa-turno p-3 ${wide ? "w-full" : "w-[86%] shrink-0 snap-center"}`} aria-hidden>
      <div className="flex items-start gap-3">
        <Skeleton className="h-16 w-16 rounded-[14px]" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="mt-3 h-11 w-full rounded-[16px]" />
    </div>
  );
}

/** Los tiempos de viaje estimados (a pie, en bici, en auto), en un renglón. */
function TiemposDeViaje({ distanceKm, className = "" }: { distanceKm: number; className?: string }) {
  const { walkMin, bikeMin, carMin } = estimateTravelTimes(distanceKm);
  return (
    <p className={`flex items-center gap-2.5 text-xs font-medium text-ink-soft ${className}`}>
      <span className="inline-flex items-center gap-1">
        <FootprintsIcon size={13} /> {walkMin}&apos;
      </span>
      <span className="inline-flex items-center gap-1">
        <BikeIcon size={13} /> {bikeMin}&apos;
      </span>
      <span className="inline-flex items-center gap-1">
        <CarIcon size={13} /> {carMin}&apos;
      </span>
      <span className="text-ink-mute">aprox.</span>
    </p>
  );
}

/** Cómo sale una tarjeta de la lista después de postularse. */
const CARD_EXIT = { opacity: 0, scale: 0.92, transition: { duration: 0.2 } };

/**
 * Fila de turno del panel lateral (desktop, md+): misma información que la
 * tarjeta del carrusel mobile, en formato de lista vertical de ancho
 * completo. Tocar la fila lleva al detalle del turno (`/turno/[id]`; en mobile,
 * la hoja del mapa), para revisar antes de decidir; el botón de acá es el atajo de postulación
 * directa. Hover resalta la fila y sincroniza el mapa (mismo pin que al
 * tocar un marcador).
 */
function ShiftRow({
  shift,
  center,
  active,
  applying,
  justApplied,
  disabled,
  onSelect,
  onApply,
}: {
  shift: Shift;
  center: [number, number];
  active: boolean;
  applying: boolean;
  justApplied: boolean;
  disabled: boolean;
  onSelect: () => void;
  onApply: () => void;
}) {
  const distance =
    shift.latitude != null && shift.longitude != null ? haversineKm(center, [shift.latitude, shift.longitude]) : null;

  return (
    <div
      onMouseEnter={onSelect}
      data-elegido={active || undefined}
      // Una fila suave (ADR-0028): tecla blanca con sombra difusa. La elegida
      // (la del pin en azul hondo) lleva un aro del mismo azul y es la única
      // con «Postularme» en ámbar; en las demás el botón va quieto. Se fueron
      // el riel y el cuadradito de color por rubro.
      className="mapa-turno relative w-full p-3 text-left"
    >
      <TurnoMapa
        shift={shift}
        distanceKm={distance}
        pago={formatPayCompact(shift)}
        titulo={
          // Link real al detalle (`/turno/[id]`), estirado sobre toda la
          // fila: se llega con Tab y Enter. El botón «Postularme» queda por
          // encima (`z-10`) y no navega.
          <Link
            href={`/turno/${shift.id}`}
            data-testid="map-row-link"
            className="after:absolute after:inset-0 after:rounded-[inherit] foco-propio focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-(--focus-ring)"
          >
            {SKILL_LABELS[shift.position]}
          </Link>
        }
      />
      <div className="relative z-10 mt-3">
        <Button
          fullWidth
          size="sm"
          variant={active ? "primary" : "surface"}
          className={`min-h-[44px] ${active ? "" : "boton-quieto"}`}
          loading={applying}
          disabled={disabled}
          onClick={onApply}
        >
          Postularme
        </Button>
      </div>
      {justApplied && <ConfirmOverlay label="Te postulaste" />}
    </div>
  );
}

function SinResultadosPorFiltro({ onQuitar }: { onQuitar: () => void }) {
  return (
    <div className="mapa-sin-filtro" data-testid="mapa-sin-filtro" role="status">
      <span>Sin turnos con estos filtros</span>
      <Button size="sm" variant="surface" className="boton-quieto min-h-[44px] shrink-0" onClick={onQuitar}>
        Quitar filtros
      </Button>
    </div>
  );
}

export default function MapPage() {
  const { token, user } = useRequireAuth();
  const router = useRouter();
  const { requestOptIn } = usePushPrompt();
  const toast = useToast();
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  // `true` mientras no sabemos si la ubicación real llegó o falló — antes el
  // catch de abajo fallaba en silencio y el mapa mostraba el centro de
  // Buenos Aires (Obelisco) sin avisar, indistinguible de "estás ahí" para
  // quien no reconoce la zona (auditoría UX 2026-08-16, reporte de Julieta:
  // el mapa mostraba Recoleta/Retiro sin ser su ubicación real).
  const [gpsFailed, setGpsFailed] = useState(false);
  // Sin GPS se mide desde la misma fuente que Inicio y Buscar (`originFor`):
  // la ubicación guardada o, si no hay, la zona del perfil. El Obelisco queda
  // sólo si no hay ninguna (U107).
  const [fallbackOrigin, setFallbackOrigin] = useState<[number, number] | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const locationUnavailable = gpsFailed && profileChecked && !fallbackOrigin;
  const usingZone = gpsFailed && fallbackOrigin !== null;
  // `shiftsAll` es lo que llegó; `shifts`, lo que pasa los chips. Los chips
  // filtran sólo en el cliente (no se mandan al backend ni se recuerdan entre
  // visitas): los pines, las tarjetas y el título cuentan `shifts`.
  const [shiftsAll, setShifts] = useState<Shift[]>([]);
  const [filtros, setFiltros] = useState<FiltrosMapa>(SIN_FILTROS);
  const shifts = useMemo(() => filtrarTurnos(shiftsAll, filtros), [shiftsAll, filtros]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  // Turno recién postulado: su tarjeta muestra la confirmación un instante
  // (ConfirmOverlay) y recién después sale de la lista.
  const [justAppliedId, setJustAppliedId] = useState<string | null>(null);
  const removeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useReducedMotion();
  useEffect(() => () => {
    if (removeTimer.current) clearTimeout(removeTimer.current);
  }, []);
  // Turno abierto en el sheet de detalle (revisar antes de decidir — no
  // confundir con `activeIndex`, que es la tarjeta que el mapa sigue).
  const [previewShift, setPreviewShift] = useState<Shift | null>(null);
  const { keyFor, clear: clearIdempotencyKey } = useIdempotencyKeys();
  const carouselRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Alto que la hoja de tarjetas tapa del mapa (mobile): la cámara lo deja libre.
  const [sheetHeight, setSheetHeight] = useState(0);

  // El mapa abre en la persona y ordena las tarjetas por cercanía a ella,
  // igual que /feed y /buscar (auditoría de interfaz 2026-10-11, B02).
  // Mientras no hay ubicación (GPS pendiente o negado) la cámara acompaña a
  // la primera tarjeta, para no quedar en el Obelisco sin turnos a la vista.
  // Cuando llega la ubicación, vuela a la persona y recién vuelve a seguir a
  // una tarjeta cuando ella toca o desliza.
  const originRef = useRef<[number, number] | null>(null);
  const userInteractedRef = useRef(false);
  // «Cerca tuyo» acá se mide desde donde está la persona (el GPS, que no sale
  // del dispositivo), pero la respuesta trae los turnos cercanos a la zona
  // de su PERFIL —o, si el perfil no tiene zona, los más nuevos del país—.
  // Sin cortar por la distancia al GPS, alguien con el perfil en Palermo y
  // parado en Córdoba leía «2 turnos cerca tuyo» con tarjetas a 640 km. Es el
  // mismo corte que hace el Inicio (`nearbyOnly`). `fetchedRef` guarda lo que
  // llegó, para saber si lo que falta es porque quedó lejos.
  const fetchedRef = useRef<Shift[]>([]);
  const [farFromHere, setFarFromHere] = useState(false);
  const [hasOrigin, setHasOrigin] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const followActive = userInteracted || !hasOrigin;
  const startFollowing = useCallback(() => {
    userInteractedRef.current = true;
    setUserInteracted(true);
  }, []);

  const applyOrigin = useCallback((origin: [number, number]) => {
    originRef.current = origin;
    setCenter(origin);
    setHasOrigin(true);
    // Lo que queda lejos de acá se va siempre. El orden, en cambio, sólo
    // se toca si todavía no estaba eligiendo tarjetas: no le reordenamos
    // la lista abajo.
    const reorder = !userInteractedRef.current;
    setShifts((prev) => {
      const near = nearbyOnly(prev, origin);
      return reorder ? sortByDistance(near, origin) : near;
    });
    setFarFromHere(nearbyOnly(fetchedRef.current, origin).length < fetchedRef.current.length);
    if (reorder) setActiveIndex(0);
  }, []);

  useEffect(() => {
    getCurrentPosition()
      .then((p) => applyOrigin([p.latitude, p.longitude]))
      .catch(() => setGpsFailed(true));
  }, [applyOrigin]);

  // Perfil: sólo para saber desde dónde medir si el GPS no llega.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .get<WorkerProfile>("/workers/me/profile", token)
      .catch(() => null)
      .then((profile) => {
        if (cancelled) return;
        setFallbackOrigin(originFor(getStoredLocation(), profile));
        setProfileChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (gpsFailed && fallbackOrigin && !originRef.current) applyOrigin(fallbackOrigin);
  }, [gpsFailed, fallbackOrigin, applyOrigin]);

  // `silent` (avisos y vuelta a la pestaña): sin esqueleto, y si falla se deja
  // lo que ya se ve.
  // Último pedido gana: una respuesta vieja no pisa a la nueva.
  const latestLoad = useRef(0);
  // Turnos a los que se postuló desde esta pantalla: una recarga que salió antes
  // no los vuelve a poner.
  const postulados = useRef<Set<string>>(new Set());

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!token) return;
      const silent = options?.silent === true;
      const mine = ++latestLoad.current;
      if (!silent) setLoading(true);
      try {
        const [feed, applied] = await Promise.all([
          api.get<Shift[]>("/shifts/feed", token),
          api.get<ShiftApplication[]>("/applications/mine", token).catch(() => []),
        ]);
        if (mine !== latestLoad.current) return;
        const appliedIds = appliedShiftIds(applied);
        const fetched = feed.filter((s) => !appliedIds.has(s.id) && !postulados.current.has(s.id) && s.latitude != null);
        fetchedRef.current = fetched;
        const near = nearbyOnly(fetched, originRef.current);
        setFarFromHere(near.length < fetched.length);
        setShifts(sortByDistance(near, originRef.current));
        setError(null);
      } catch (err) {
        if (!silent && mine === latestLoad.current) {
          setError(err instanceof ApiError ? err.message : "No se pudo cargar el mapa");
        }
      } finally {
        if (mine === latestLoad.current) setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Al día con los avisos (VIE-03): un turno cubierto o cancelado sale del mapa
  // sin recargar. En pausa con una carga normal, una postulación en curso o la
  // ficha de un turno abierta (para no cambiarle la lista bajo los dedos).
  useLiveRefresh(load, {
    paused: loading || applyingId !== null || justAppliedId !== null || previewShift !== null,
  });

  // Cambiar un chip vuelve a la primera tarjeta (la lista cambió bajo el dedo).
  const cambiarFiltros = useCallback((f: FiltrosMapa) => {
    setFiltros(f);
    setActiveIndex(0);
    carouselRef.current?.scrollTo({ left: 0 });
  }, []);
  const quitarFiltros = useCallback(() => cambiarFiltros(SIN_FILTROS), [cambiarFiltros]);

  // Scroll del carrusel -> tarjeta activa (que el mapa sigue).
  function onCarouselScroll() {
    const el = carouselRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / Math.max(shifts.length, 1);
    const idx = Math.round(el.scrollLeft / cardWidth);
    if (idx !== activeIndex && idx >= 0 && idx < shifts.length) {
      startFollowing();
      setActiveIndex(idx);
    }
  }

  // Click en un pin -> scrollea el carrusel a esa tarjeta. Estable
  // (useCallback) para que `ShiftMap` pueda pasar un `onClick` de referencia
  // fija a cada marcador y `React.memo` evite re-renderizar los N marcadores
  // al seleccionar uno solo (ver components/worker/ShiftMap.tsx).
  const selectById = useCallback(
    (id: string) => {
      const idx = shifts.findIndex((s) => s.id === id);
      if (idx < 0) return;
      startFollowing();
      setActiveIndex(idx);
      const el = carouselRef.current;
      if (el) {
        const cardWidth = el.scrollWidth / Math.max(shifts.length, 1);
        el.scrollTo({ left: cardWidth * idx, behavior: "smooth" });
      }
    },
    [shifts, startFollowing]
  );

  async function apply(shift: Shift) {
    if (!token || applyingId !== null) return;
    // Un admin puede entrar acá a mirar el mapa en modo sólo-lectura (sin
    // impersonar a nadie); postularse no tiene sentido para esa cuenta y el
    // backend lo rechazaría igual (no tiene perfil de trabajador) — se corta
    // antes con un mensaje claro en vez de un error crudo.
    if (user?.role !== "worker") {
      toast("Estás viendo el mapa como admin — sólo lectura", "error");
      return;
    }
    setApplyingId(shift.id);
    try {
      // Idempotencia (product/IDEMPOTENCIA_SPEC.md): mismo intento (mismo
      // turno) reusa la key hasta que postularse termine bien; el `busy`
      // (`applyingId`) además deshabilita el botón mientras está en vuelo.
      await api.post(
        `/applications/shifts/${shift.id}`,
        undefined,
        token,
        undefined,
        keyFor(shift.id)
      );
      clearIdempotencyKey(shift.id);
      postulados.current.add(shift.id);
      toast("¡Te postulaste! El comercio ya te puede ver");
      setPreviewShift((prev) => (prev?.id === shift.id ? null : prev));
      setJustAppliedId(shift.id);
      removeTimer.current = setTimeout(
        () => {
          setShifts((prev) => prev.filter((s) => s.id !== shift.id));
          setJustAppliedId((prev) => (prev === shift.id ? null : prev));
          // Primera acción significativa, no al aterrizar (ver
          // docs/reference/ACCESO_MODERNO.md). DESPUÉS de la confirmación:
          // si sale junto con ella, su hoja tapa el check.
          requestOptIn();
        },
        reducedMotion ? 0 : 900
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        clearIdempotencyKey(shift.id);
        toast("Ya te habías postulado");
      } else {
        toast("No se pudo enviar la postulación", "error");
      }
    } finally {
      setApplyingId(null);
    }
  }

  // Si la lista se achicó (llegó la ubicación y sacó lo lejano) y el índice
  // quedó afuera, la activa es la primera.
  const activeId = (shifts[activeIndex] ?? shifts[0])?.id ?? null;

  // Vacío: si había turnos y todos quedan lejos de donde está la persona, no
  // se afirma que no hay nada: el mapa sólo trae los de la zona del perfil, y
  // los de otras zonas se ven en Buscar.
  const goToSearch = { label: "Ver todos en Buscar", onClick: () => router.push("/buscar") };
  const allFarFromHere = !error && farFromHere;
  const emptyTitle =
    error ?? (allFarFromHere ? "No hay turnos cerca de donde estás ahora" : "No hay turnos cerca");
  const emptySubtitle = error
    ? "No pudimos cargar los turnos. Revisá tu conexión e intentá de nuevo."
    : allFarFromHere
      ? "El mapa trae los turnos de la zona de tu perfil. Los de otras zonas están en Buscar."
      : "Aparecen en tiempo real. Volvé en un rato o mirá otras zonas en Buscar.";
  const emptyPrimary = error
    ? { label: "Reintentar", onClick: () => load() }
    : allFarFromHere
      ? goToSearch
      : { label: "Actualizar", onClick: () => load() };
  const emptySecondary = error || allFarFromHere ? undefined : goToSearch;
  // Había turnos y los chips los dejaron en cero: no es «no hay turnos», es una
  // línea tranquila con la salida (no el estado vacío grande).
  const sinResultadosPorFiltro = !loading && shifts.length === 0 && shiftsAll.length > 0 && hayFiltros(filtros);
  const hayChips = !loading && shiftsAll.length > 0;

  return (
    <div className="estilo-suave flex h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] overflow-hidden md:h-[calc(100dvh-var(--chrome-top))]">
      {/* Panel lateral (desktop, md+): la MISMA lista de turnos que en mobile
          vive en el sheet inferior, acá como columna fija — así la función
          del mapa no queda "escondida"/reducida en la versión web (antes el
          bottom-sheet mobile se estiraba tal cual a una tarjeta gigantesca
          y vacía en pantallas anchas). En mobile no se renderiza (hidden). */}
      <aside className="mapa-panel hidden w-full max-w-[380px] shrink-0 flex-col overflow-y-auto bg-card md:flex">
        <div className="sticky top-0 z-20 bg-card/95 px-5 pb-3 pt-5 backdrop-blur">
          {/* El conmutador Lista / Mapa: sólo quien trabaja tiene la lista
              (el admin entra al mapa a mirar). */}
          {user?.role === "worker" && <ListaMapa actual="mapa" className="conmutador-hoja mb-3 w-fit" />}
          <h1 className="titulo-pantalla text-ink">
            {loading
              ? "Buscando turnos..."
              : locationUnavailable
                ? "Turnos en el centro de Buenos Aires"
                : usingZone
                  ? `${plural(shifts.length, "turno", "turnos")} cerca de tu zona`
                  : `${plural(shifts.length, "turno", "turnos")} cerca tuyo`}
          </h1>
          {!loading && locationUnavailable && (
            <p className="mt-1.5 text-sm text-ink-soft">
              No pudimos ubicarte — activá la ubicación para ver los turnos
              realmente cerca tuyo.
            </p>
          )}
          {hayChips && <FiltrosMapaChips variante="panel" filtros={filtros} onChange={cambiarFiltros} />}
        </div>
        <div className="flex-1 px-4 pb-5 pt-1">
          {loading ? (
            <div className="space-y-3">
              <MapCardSkeleton wide />
              <MapCardSkeleton wide />
              <MapCardSkeleton wide />
            </div>
          ) : sinResultadosPorFiltro ? (
            <SinResultadosPorFiltro onQuitar={quitarFiltros} />
          ) : shifts.length === 0 ? (
            <div className="px-2 py-6">
              <EmptyState
                icon={<CalendarIcon size={28} />}
                title={emptyTitle}
                subtitle={emptySubtitle}
                primaryAction={emptyPrimary}
                secondaryAction={emptySecondary}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {shifts.map((shift) => (
                  <motion.div key={shift.id} layout={!reducedMotion} exit={CARD_EXIT}>
                    <ShiftRow
                      shift={shift}
                      center={center}
                      active={shift.id === activeId}
                      applying={applyingId === shift.id}
                      justApplied={justAppliedId === shift.id}
                      disabled={applyingId !== null || justAppliedId !== null}
                      onSelect={() => selectById(shift.id)}
                      onApply={() => apply(shift)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </aside>

      {/* Mapa + overlays mobile */}
      <div ref={containerRef} className="relative h-full flex-1 overflow-hidden">
      <ShiftMap
        shifts={shifts}
        center={center}
        activeId={activeId}
        onSelect={selectById}
        followActive={followActive}
        bottomPadding={sheetHeight}
      />

      {/* El mapa es el cielo (ADR-0028, maqueta `T-Mapa`): arriba se funde con
          el cielo de la app (lo hace el CSS, sobre el lienzo del mapa: ver
          `.estilo-suave .maplibregl-map`) y el título va encima, en su tinta.
          Sólo mobile: en la compu el título está en el panel de al lado. No
          recibe toques: el mapa se mueve también por debajo del título. */}
      <div className="mapa-cielo pointer-events-none absolute inset-x-0 top-0 z-10 px-5 pb-7 pt-5 md:hidden">
        {/* El conmutador sí recibe toques (el resto del cielo no). */}
        {user?.role === "worker" && <ListaMapa actual="mapa" className="pointer-events-auto float-right mb-1 ml-3" />}
        <h1 className="titulo-pantalla break-words">
          {loading
            ? "Buscando turnos cerca..."
            : locationUnavailable
              ? "Turnos en el centro de Buenos Aires"
              : usingZone
                ? `${plural(shifts.length, "turno", "turnos")} cerca de tu zona`
                : `${plural(shifts.length, "turno", "turnos")} cerca tuyo`}
        </h1>
        {/* Los chips sí reciben toques (el resto del cielo no), igual que los de /buscar. */}
        {hayChips && <FiltrosMapaChips filtros={filtros} onChange={cambiarFiltros} />}
        {!loading && locationUnavailable && (
          <p className="mapa-aviso mt-2.5">
            No pudimos ubicarte — activá la ubicación para ver lo que está
            realmente cerca
          </p>
        )}
      </div>
      {/* Sheet inferior arrastrable con el carrusel de tarjetas — SÓLO mobile,
          en desktop la lista ya vive en el panel lateral de al lado. */}
      <div className="md:hidden">
      {sinResultadosPorFiltro ? (
        <div className="absolute inset-x-0 bottom-4 z-10 px-4">
          <div className="mapa-tarjeta px-4 py-2">
            <SinResultadosPorFiltro onQuitar={quitarFiltros} />
          </div>
        </div>
      ) : !loading && shifts.length === 0 ? (
        <div className="absolute inset-x-0 bottom-4 z-10 px-4">
          {/* Compacta (2026-11-20, Julieta: «esa tarjeta gigante lo tapa»): sin
              la ilustración y con los dos botones en un renglón, para que el
              mapa se siga viendo. En la compu el vacío va en el panel, con el
              `EmptyState` de siempre. */}
          <div className="mapa-tarjeta p-4" data-testid="mapa-vacio">
            <h2 className="text-base font-extrabold leading-tight tracking-[-0.01em] text-ink">{emptyTitle}</h2>
            <p className="mt-1 text-sm leading-snug text-ink-soft">{emptySubtitle}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" className="min-h-[44px] min-w-0 flex-1 basis-[8rem]" onClick={emptyPrimary.onClick}>
                {emptyPrimary.label}
              </Button>
              {emptySecondary && (
                <Button
                  size="sm"
                  variant="surface"
                  className="boton-quieto min-h-[44px] min-w-0 flex-1 basis-[8rem]"
                  onClick={emptySecondary.onClick}
                >
                  {emptySecondary.label}
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <MapSheet containerRef={containerRef} onVisibleHeightChange={setSheetHeight}>
          <div
            ref={carouselRef}
            onScroll={onCarouselScroll}
            className="no-scrollbar relative flex items-stretch snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-4 pt-1"
          >
          {loading ? (
            <>
              <MapCardSkeleton />
              <MapCardSkeleton />
              <MapCardSkeleton />
            </>
          ) : (
          <AnimatePresence initial={false} mode="popLayout">
          {shifts.map((shift) => {
            const distance =
              shift.latitude != null && shift.longitude != null
                ? haversineKm(center, [shift.latitude, shift.longitude])
                : null;
            // La tarjeta que el mapa sigue (la del pin en azul hondo) es la
            // única con «Postularme» en ámbar: un solo ámbar por pantalla.
            const elegida = shift.id === activeId;
            return (
              <motion.div
                key={shift.id}
                layout={!reducedMotion}
                exit={CARD_EXIT}
                role="button"
                tabIndex={0}
                // Tocar la tarjeta ABRE el detalle para revisar — NO postula
                // sola. Antes tocaba postular directo con cualquier toque en
                // la tarjeta, y eso disparaba postulaciones sin querer al
                // simplemente mirar una oferta (bug real reportado por
                // Julieta, 2026-07-29). Postularse sigue siendo una acción
                // explícita: el botón de acá abajo (postula directo) o el
                // del sheet de detalle (después de revisar). El link al
                // comercio corta la propagación para no abrir el detalle al
                // navegar a su perfil.
                onClick={() => setPreviewShift(shift)}
                onKeyDown={(e) => handleCardActivate(e, () => setPreviewShift(shift))}
                className="mapa-turno relative flex w-[86%] shrink-0 snap-center flex-col p-3 text-left transition active:scale-[0.98]"
              >
                <TurnoMapa
                  shift={shift}
                  distanceKm={distance}
                  pago={formatPayAmount(shift)}
                  comercioHref={`/companies/${shift.company_id}`}
                />
                {distance != null && <TiemposDeViaje distanceKm={distance} className="mt-2" />}
                {/* stopPropagation: sin esto, el toque también burbujea al
                    onClick de la tarjeta y abre el sheet de detalle a la vez
                    que postula. Este botón es el atajo directo para quien ya
                    decidió sin necesidad de revisar más. El div en sí no
                    necesita semántica/teclado propios — el botón de adentro
                    ya es interactivo y accesible por su cuenta. */}
                {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
                <div className="mt-auto pt-3" onClick={(e) => e.stopPropagation()}>
                  <Button
                    fullWidth
                    size="sm"
                    variant={elegida ? "primary" : "surface"}
                    className={`min-h-[44px] ${elegida ? "" : "boton-quieto"}`}
                    loading={applyingId === shift.id}
                    disabled={applyingId !== null || justAppliedId !== null}
                    onClick={() => apply(shift)}
                  >
                    Postularme
                  </Button>
                </div>
                {justAppliedId === shift.id && <ConfirmOverlay label="Te postulaste" />}
              </motion.div>
            );
          })}
          </AnimatePresence>
          )}
          </div>
        </MapSheet>
      )}
      </div>
      </div>

      {/* Detalle del turno: se abre al tocar la tarjeta (mobile), para
          revisar antes de decidir (en desktop la fila lleva a `/turno/[id]`).
          Postularse sigue siendo un botón explícito acá adentro. */}
      {previewShift && (
        <Sheet
          open
          onClose={() => setPreviewShift(null)}
          title={SKILL_LABELS[previewShift.position]}
        >
          {(() => {
            const shift = previewShift;
            const distance =
              shift.latitude != null && shift.longitude != null
                ? haversineKm(center, [shift.latitude, shift.longitude])
                : null;
            const pago = payView(shift);
            return (
              // `estilo-suave` acá también: la hoja se dibuja en un portal,
              // fuera de la raíz de la pantalla.
              <div className="estilo-suave pb-2 pt-1">
                <div className="flex items-center gap-3">
                  <MiniaturaTurno shift={shift} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/companies/${shift.company_id}`}
                      onClick={() => setPreviewShift(null)}
                      className="text-sm font-semibold text-ink"
                    >
                      {shift.company_name ?? "Comercio"}
                    </Link>
                    <p className="flex items-center gap-1 text-caption text-ink-soft">
                      <MapPinIcon size={13} />
                      {distance != null ? `A ${formatDistance(distance)}` : (shift.city ?? "Zona a confirmar")}
                    </p>
                  </div>
                  {shift.urgent && <span className="chip-suave chip-urgente ml-auto shrink-0">Urgente</span>}
                </div>

                {/* El pago es el número más grande de la hoja, en tinta sobre
                    la hoja (como en `/turno/[id]`). Hasta el 2026-11-20 era un
                    módulo negro con el ícono en ámbar, que sumaba un segundo
                    ámbar al de «Postularme». */}
                <div className="mt-5">
                  <p className="turno-pago">{pago.amount}</p>
                  <p className="mt-1.5 text-sm font-medium text-ink-soft">
                    {/* Turno reofrecido (U080): el número es por hora. */}
                    {pago.kind === "por_hora" ? "Por hora, desde que llegás" : "Pago ofrecido"}
                    {shift.tips ? " + propinas" : ""}{shift.meal ? " + comida" : ""}
                  </p>
                </div>

                <div className="mt-5 space-y-2.5 text-body text-ink">
                  <p className="flex items-center gap-2">
                    <CalendarIcon size={18} className="shrink-0 text-ink-mute" />
                    {pago.kind === "por_hora"
                      ? `Ya empezó · hasta las ${formatShiftTime(shift.end_at)}`
                      : formatShiftRange(shift.start_at, shift.end_at)}
                  </p>
                  <p className="flex items-center gap-2">
                    <UsersIcon size={18} className="shrink-0 text-ink-mute" />
                    {shift.quantity} {shift.quantity === 1 ? "persona" : "personas"}
                  </p>
                  {shift.dress_code && (
                    <p className="text-sm text-ink-soft">Dress code: {shift.dress_code}</p>
                  )}
                  {shift.description && (
                    <p className="text-sm text-ink-soft">{shift.description}</p>
                  )}
                </div>

                {distance != null && <TiemposDeViaje distanceKm={distance} className="mt-3" />}

                <Button
                  fullWidth
                  className="mt-5"
                  loading={applyingId === shift.id}
                  disabled={applyingId !== null}
                  onClick={() => apply(shift)}
                >
                  Postularme
                </Button>
              </div>
            );
          })()}
        </Sheet>
      )}
    </div>
  );
}
