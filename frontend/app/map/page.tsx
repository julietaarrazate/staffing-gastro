"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { usePushPrompt } from "@/lib/push-prompt-context";
import { getCurrentPosition } from "@/lib/geolocation";
import { haversineKm } from "@/lib/map/geo";
import { estimateTravelTimes } from "@/lib/map/travel-time";
import { SKILL_LABELS, Shift, ShiftApplication } from "@/lib/types";
import { SKILL_ACCENT, SKILL_HERO_GRADIENT, SKILL_RAIL_BORDER } from "@/lib/skill-style";
import { Button, EmptyState, Sheet, Skeleton, useToast } from "@/components/ui";
import { BikeIcon, CalendarIcon, CarIcon, FlameIcon, FootprintsIcon, MapPinIcon, UsersIcon } from "@/components/icons";
import { formatShiftRange } from "@/lib/datetime";
import MapSheet from "@/components/worker/MapSheet";

const ShiftMap = dynamic(() => import("@/components/worker/ShiftMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-surface" />,
});

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
    <div
      className={`overflow-hidden rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-float)] ring-1 ring-line ${
        wide ? "w-full" : "w-[86%] shrink-0 snap-center"
      }`}
      aria-hidden
    >
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-11 w-11 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-3 w-14" />
      </div>
      <Skeleton className="mt-3 h-9 w-full rounded-full" />
    </div>
  );
}

/**
 * Fila de turno del panel lateral (desktop, md+): misma información que la
 * tarjeta del carrusel mobile, en formato de lista vertical de ancho
 * completo. Tocar la fila abre el detalle (revisar antes de decidir, mismo
 * criterio que en mobile); el botón de acá es el atajo de postulación
 * directa. Hover resalta la fila y sincroniza el mapa (mismo pin que al
 * tocar un marcador).
 */
function ShiftRow({
  shift,
  center,
  active,
  applying,
  disabled,
  onSelect,
  onOpenDetail,
  onApply,
}: {
  shift: Shift;
  center: [number, number];
  active: boolean;
  applying: boolean;
  disabled: boolean;
  onSelect: () => void;
  onOpenDetail: () => void;
  onApply: () => void;
}) {
  const { Icon } = SKILL_ACCENT[shift.position];
  const heroGradient = SKILL_HERO_GRADIENT[shift.position];
  const rail = SKILL_RAIL_BORDER[shift.position];
  const distance =
    shift.latitude != null && shift.longitude != null ? haversineKm(center, [shift.latitude, shift.longitude]) : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onMouseEnter={onSelect}
      onClick={onOpenDetail}
      onKeyDown={(e) => handleCardActivate(e, onOpenDetail)}
      // Riel de color por rubro a la izquierda: estas tarjetas eran todas
      // blancas y en una lista de varias se leían iguales (Julieta,
      // 2026-08-17: "en mapa, donde se ven los turnos en blanco, también que
      // las tarjetas tengan colores"). El estado activo sigue marcándose con
      // el borde/fondo naranja, que es señal de SELECCIÓN, no de rubro.
      className={`w-full cursor-pointer rounded-[var(--radius-card)] border border-l-[6px] p-3.5 pl-3 text-left transition ${rail} ${
        active ? "border-primary/40 bg-primary-tint/60" : "border-line bg-card hover:bg-surface"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white ${heroGradient}`}>
            <Icon size={20} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-extrabold leading-tight text-ink">
              {SKILL_LABELS[shift.position]}
            </h3>
            <p className="truncate text-xs font-medium text-ink/50">{shift.company_name ?? "Comercio"}</p>
          </div>
        </div>
        {shift.urgent && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger-tint px-2 py-0.5 text-[10px] font-bold text-danger-text">
            <FlameIcon size={10} /> Urgente
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-end justify-between gap-2">
        <p className="text-base font-extrabold text-primary-text">
          {shift.currency} {Number(shift.pay_amount).toLocaleString("es-AR")}
        </p>
        <p className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-ink/50">
          <MapPinIcon size={12} />
          {distance != null ? `${distance.toFixed(1)} km` : (shift.city ?? "")}
        </p>
      </div>
      {/* Sólo corta la propagación del click hacia la tarjeta — el botón de
          adentro ya es interactivo/accesible por su cuenta, este div no
          necesita semántica ni soporte de teclado propios. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div onClick={(e) => e.stopPropagation()} className="mt-3">
        <Button fullWidth size="sm" loading={applying} disabled={disabled} onClick={onApply}>
          Postularme
        </Button>
      </div>
    </div>
  );
}

export default function MapPage() {
  const { token, user } = useRequireAuth();
  const { requestOptIn } = usePushPrompt();
  const toast = useToast();
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  // `true` mientras no sabemos si la ubicación real llegó o falló — antes el
  // catch de abajo fallaba en silencio y el mapa mostraba el centro de
  // Buenos Aires (Obelisco) sin avisar, indistinguible de "estás ahí" para
  // quien no reconoce la zona (auditoría UX 2026-08-16, reporte de Julieta:
  // el mapa mostraba Recoleta/Retiro sin ser su ubicación real).
  const [locationUnavailable, setLocationUnavailable] = useState(false);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  // Turno abierto en el sheet de detalle (revisar antes de decidir — no
  // confundir con `activeIndex`, que es la tarjeta que el mapa sigue).
  const [previewShift, setPreviewShift] = useState<Shift | null>(null);
  const { keyFor, clear: clearIdempotencyKey } = useIdempotencyKeys();
  const carouselRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCurrentPosition()
      .then((p) => setCenter([p.latitude, p.longitude]))
      .catch(() => setLocationUnavailable(true)); // fallback al Obelisco, avisado
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [feed, applied] = await Promise.all([
        api.get<Shift[]>("/shifts/feed", token),
        api.get<ShiftApplication[]>("/applications/mine", token).catch(() => []),
      ]);
      const appliedIds = new Set(applied.map((a) => a.shift_id));
      setShifts(feed.filter((s) => !appliedIds.has(s.id) && s.latitude != null));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el mapa");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Scroll del carrusel -> tarjeta activa (que el mapa sigue).
  function onCarouselScroll() {
    const el = carouselRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / Math.max(shifts.length, 1);
    const idx = Math.round(el.scrollLeft / cardWidth);
    if (idx !== activeIndex && idx >= 0 && idx < shifts.length) setActiveIndex(idx);
  }

  // Click en un pin -> scrollea el carrusel a esa tarjeta. Estable
  // (useCallback) para que `ShiftMap` pueda pasar un `onClick` de referencia
  // fija a cada marcador y `React.memo` evite re-renderizar los N marcadores
  // al seleccionar uno solo (ver components/worker/ShiftMap.tsx).
  const selectById = useCallback(
    (id: string) => {
      const idx = shifts.findIndex((s) => s.id === id);
      if (idx < 0) return;
      setActiveIndex(idx);
      const el = carouselRef.current;
      if (el) {
        const cardWidth = el.scrollWidth / Math.max(shifts.length, 1);
        el.scrollTo({ left: cardWidth * idx, behavior: "smooth" });
      }
    },
    [shifts]
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
      toast("¡Te postulaste! El comercio ya te puede ver");
      setShifts((prev) => prev.filter((s) => s.id !== shift.id));
      setPreviewShift((prev) => (prev?.id === shift.id ? null : prev));
      // Primera acción significativa, no al aterrizar (ver docs/reference/ACCESO_MODERNO.md).
      requestOptIn();
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

  const activeId = shifts[activeIndex]?.id ?? null;

  return (
    <div className="flex h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] overflow-hidden md:h-[calc(100dvh-var(--chrome-top))]">
      {/* Panel lateral (desktop, md+): la MISMA lista de turnos que en mobile
          vive en el sheet inferior, acá como columna fija — así la función
          del mapa no queda "escondida"/reducida en la versión web (antes el
          bottom-sheet mobile se estiraba tal cual a una tarjeta gigantesca
          y vacía en pantallas anchas). En mobile no se renderiza (hidden). */}
      <aside className="hidden w-full max-w-[380px] shrink-0 flex-col overflow-y-auto border-r border-line bg-card md:flex">
        <div className="sticky top-0 z-10 border-b border-line bg-white/95 px-5 py-4 backdrop-blur">
          <h1 className="font-display text-h1 font-semibold text-ink">
            {loading
              ? "Buscando turnos..."
              : locationUnavailable
                ? "Turnos en el centro de Buenos Aires"
                : `${shifts.length} turnos cerca tuyo`}
          </h1>
          {!loading && locationUnavailable && (
            <p className="mt-1 text-sm text-ink/50">
              No pudimos ubicarte — activá la ubicación para ver los turnos
              realmente cerca tuyo.
            </p>
          )}
        </div>
        <div className="flex-1 px-3 py-3">
          {loading ? (
            <div className="space-y-3">
              <MapCardSkeleton wide />
              <MapCardSkeleton wide />
              <MapCardSkeleton wide />
            </div>
          ) : shifts.length === 0 ? (
            <div className="px-2 py-6">
              <EmptyState
                icon={<CalendarIcon size={28} />}
                title={error ?? "No hay turnos cerca"}
                subtitle={
                  error
                    ? "No pudimos cargar los turnos. Revisá tu conexión e intentá de nuevo."
                    : "Aparecen en tiempo real. Volvé en un rato o ampliá tu zona."
                }
                primaryAction={{ label: error ? "Reintentar" : "Actualizar", onClick: load }}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {shifts.map((shift) => (
                <ShiftRow
                  key={shift.id}
                  shift={shift}
                  center={center}
                  active={shift.id === activeId}
                  applying={applyingId === shift.id}
                  disabled={applyingId !== null}
                  onSelect={() => selectById(shift.id)}
                  onOpenDetail={() => setPreviewShift(shift)}
                  onApply={() => apply(shift)}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Mapa + overlays mobile */}
      <div ref={containerRef} className="relative h-full flex-1 overflow-hidden">
      <ShiftMap shifts={shifts} center={center} activeId={activeId} onSelect={selectById} />

      {/* Encabezado flotante (sólo mobile: en desktop el conteo ya está en el
          panel lateral, repetirlo acá arriba del mapa sería ruido). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-start gap-1.5 p-3 md:hidden">
        {/* Pastillas flotantes SOBRE el mapa: el mapa (MapLibre) no cambia de
            tema, así que la pastilla queda blanca en ambos modos y su texto
            debe ser SIEMPRE oscuro (`text-night`), no `text-ink` que se voltea
            a claro en oscuro y desaparecería sobre el blanco. */}
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2.5 text-sm font-semibold text-night/70 shadow-[var(--shadow-soft)] ring-1 ring-line backdrop-blur">
          <MapPinIcon size={16} className="text-primary-text" />
          {loading
            ? "Buscando turnos cerca..."
            : locationUnavailable
              ? "Turnos en el centro de Buenos Aires"
              : `${shifts.length} turnos cerca tuyo`}
        </div>
        {!loading && locationUnavailable && (
          <div className="pointer-events-auto rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-medium text-night/50 shadow-[var(--shadow-soft)] ring-1 ring-line backdrop-blur">
            No pudimos ubicarte — activá la ubicación para ver lo que está
            realmente cerca
          </div>
        )}
      </div>

      {/* Sheet inferior arrastrable con el carrusel de tarjetas — SÓLO mobile,
          en desktop la lista ya vive en el panel lateral de al lado. */}
      <div className="md:hidden">
      {!loading && shifts.length === 0 ? (
        <div className="absolute inset-x-0 bottom-4 z-10 px-4">
          <div className="rounded-[var(--radius-card)] bg-card p-2 shadow-[var(--shadow-float)]">
            <EmptyState
              icon={<CalendarIcon size={28} />}
              title={error ?? "No hay turnos cerca"}
              subtitle={
                error
                  ? "No pudimos cargar los turnos. Revisá tu conexión e intentá de nuevo."
                  : "Aparecen en tiempo real. Volvé en un rato o ampliá tu zona."
              }
              primaryAction={{ label: error ? "Reintentar" : "Actualizar", onClick: load }}
            />
          </div>
        </div>
      ) : (
        <MapSheet containerRef={containerRef}>
          <div
            ref={carouselRef}
            onScroll={onCarouselScroll}
            className="no-scrollbar flex items-stretch snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-4"
          >
          {loading ? (
            <>
              <MapCardSkeleton />
              <MapCardSkeleton />
              <MapCardSkeleton />
            </>
          ) : (
          shifts.map((shift) => {
            const { Icon } = SKILL_ACCENT[shift.position];
            const heroGradient = SKILL_HERO_GRADIENT[shift.position];
            const rail = SKILL_RAIL_BORDER[shift.position];
            const distance =
              shift.latitude != null && shift.longitude != null
                ? haversineKm(center, [shift.latitude, shift.longitude])
                : null;
            return (
              <div
                key={shift.id}
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
                className={`flex w-[86%] shrink-0 snap-center flex-col overflow-hidden rounded-[var(--radius-card)] border-l-[6px] bg-card p-4 pl-3.5 text-left shadow-[var(--shadow-float)] ring-1 ring-line transition active:scale-[0.98] ${rail}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-white ${heroGradient}`}>
                      <Icon size={22} />
                    </span>
                    <div>
                      <h3 className="text-base font-extrabold leading-tight text-ink">
                        {SKILL_LABELS[shift.position]}
                      </h3>
                      <Link
                        href={`/companies/${shift.company_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-medium text-ink/50"
                      >
                        {shift.company_name ?? "Comercio"}
                      </Link>
                    </div>
                  </div>
                  {shift.urgent && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-danger-tint px-2 py-0.5 text-[11px] font-bold text-danger-text">
                      <FlameIcon size={11} /> Urgente
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-xl font-extrabold text-primary-text">
                    {shift.currency} {Number(shift.pay_amount).toLocaleString("es-AR")}
                  </p>
                  <p className="inline-flex items-center gap-1 text-xs font-medium text-ink/50">
                    <MapPinIcon size={13} />
                    {distance != null ? `${distance.toFixed(1)} km` : (shift.city ?? "")}
                  </p>
                </div>
                {distance != null && (
                  <p className="mt-1.5 flex items-center gap-2.5 text-xs font-medium text-ink/45">
                    {(() => {
                      const { walkMin, bikeMin, carMin } = estimateTravelTimes(distance);
                      return (
                        <>
                          <span className="inline-flex items-center gap-0.5">
                            <FootprintsIcon size={12} /> {walkMin}&apos;
                          </span>
                          <span className="inline-flex items-center gap-0.5">
                            <BikeIcon size={12} /> {bikeMin}&apos;
                          </span>
                          <span className="inline-flex items-center gap-0.5">
                            <CarIcon size={12} /> {carMin}&apos;
                          </span>
                          <span className="text-ink/30">aprox.</span>
                        </>
                      );
                    })()}
                  </p>
                )}
                {/* stopPropagation: sin esto, el toque también burbujea al
                    onClick de la tarjeta y abre el sheet de detalle a la vez
                    que postula. Este botón es el atajo directo para quien ya
                    decidió sin necesidad de revisar más. El div en sí no
                    necesita semántica/teclado propios — el botón de adentro
                    ya es interactivo y accesible por su cuenta. */}
                {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
                <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                  <Button
                    fullWidth
                    size="sm"
                    loading={applyingId === shift.id}
                    disabled={applyingId !== null}
                    onClick={() => apply(shift)}
                  >
                    Postularme
                  </Button>
                </div>
              </div>
            );
          })
          )}
          </div>
        </MapSheet>
      )}
      </div>
      </div>

      {/* Detalle del turno: se abre al tocar la tarjeta (mobile) o la fila
          del panel lateral (desktop), para revisar antes de decidir.
          Postularse sigue siendo un botón explícito acá adentro. */}
      {previewShift && (
        <Sheet
          open
          onClose={() => setPreviewShift(null)}
          title={SKILL_LABELS[previewShift.position]}
        >
          {(() => {
            const shift = previewShift;
            const { Icon } = SKILL_ACCENT[shift.position];
            // Sin riel de color acá, a diferencia de las dos tarjetas de
            // lista: esto es la hoja de detalle de UN turno, y el riel existe
            // para diferenciar filas entre sí. Sobre un único elemento a
            // pantalla completa sería decoración sin información.
            const heroGradient = SKILL_HERO_GRADIENT[shift.position];
            const distance =
              shift.latitude != null && shift.longitude != null
                ? haversineKm(center, [shift.latitude, shift.longitude])
                : null;
            return (
              <div className="pb-2 pt-1">
                <div className="flex items-center gap-3">
                  <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white ${heroGradient}`}>
                    <Icon size={26} />
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/companies/${shift.company_id}`}
                      onClick={() => setPreviewShift(null)}
                      className="text-sm font-semibold text-ink/60"
                    >
                      {shift.company_name ?? "Comercio"}
                    </Link>
                    <p className="flex items-center gap-1 text-xs font-medium text-ink/45">
                      <MapPinIcon size={13} />
                      {distance != null ? `A ${distance.toFixed(1)} km` : (shift.city ?? "Zona a confirmar")}
                    </p>
                  </div>
                  {shift.urgent && (
                    <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-danger-tint px-2 py-0.5 text-[11px] font-bold text-danger-text">
                      <FlameIcon size={11} /> Urgente
                    </span>
                  )}
                </div>

                <div className="mt-4 rounded-2xl bg-surface px-4 py-3.5 text-center">
                  <p className="text-2xl font-extrabold text-primary-text">
                    {shift.currency} {Number(shift.pay_amount).toLocaleString("es-AR")}
                  </p>
                  <p className="text-xs font-medium text-ink/50">
                    Pago ofrecido{shift.tips ? " + propinas" : ""}{shift.meal ? " + comida" : ""}
                  </p>
                </div>

                <div className="mt-4 space-y-2.5 text-[15px] text-ink/80">
                  <p className="inline-flex items-center gap-2">
                    <CalendarIcon size={18} className="text-ink/35" />
                    {formatShiftRange(shift.start_at, shift.end_at)}
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <UsersIcon size={18} className="text-ink/35" />
                    {shift.quantity} {shift.quantity === 1 ? "persona" : "personas"}
                  </p>
                  {shift.dress_code && (
                    <p className="text-sm text-ink/50">Dress code: {shift.dress_code}</p>
                  )}
                  {shift.description && (
                    <p className="text-sm text-ink/70">{shift.description}</p>
                  )}
                </div>

                {distance != null && (
                  <p className="mt-3 flex items-center gap-3 text-xs font-medium text-ink/45">
                    {(() => {
                      const { walkMin, bikeMin, carMin } = estimateTravelTimes(distance);
                      return (
                        <>
                          <span className="inline-flex items-center gap-1">
                            <FootprintsIcon size={13} /> {walkMin}&apos;
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <BikeIcon size={13} /> {bikeMin}&apos;
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <CarIcon size={13} /> {carMin}&apos;
                          </span>
                          <span className="text-ink/30">aprox.</span>
                        </>
                      );
                    })()}
                  </p>
                )}

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
