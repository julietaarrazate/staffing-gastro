"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getCurrentPosition } from "@/lib/geolocation";
import { haversineKm } from "@/lib/map/geo";
import { estimateTravelTimes } from "@/lib/map/travel-time";
import { SKILL_LABELS, Shift, ShiftApplication } from "@/lib/types";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { Button, EmptyState, useToast } from "@/components/ui";
import { BikeIcon, CalendarIcon, CarIcon, FlameIcon, FootprintsIcon, MapPinIcon } from "@/components/icons";
import MapSheet from "@/components/worker/MapSheet";

const ShiftMap = dynamic(() => import("@/components/worker/ShiftMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-zinc-100" />,
});

const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816]; // Obelisco

export default function MapPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCurrentPosition()
      .then((p) => setCenter([p.latitude, p.longitude]))
      .catch(() => {}); // fallback al Obelisco
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
    if (!token) return;
    try {
      await api.post(`/applications/shifts/${shift.id}`, undefined, token);
      toast("¡Te postulaste! El comercio ya te puede ver");
      setShifts((prev) => prev.filter((s) => s.id !== shift.id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) toast("Ya te habías postulado");
      else toast("No se pudo enviar la postulación", "error");
    }
  }

  const activeId = shifts[activeIndex]?.id ?? null;

  return (
    <div
      ref={containerRef}
      className="relative h-[calc(100dvh-4rem-5rem)] overflow-hidden md:h-[calc(100dvh-4rem)]"
    >
      <ShiftMap shifts={shifts} center={center} activeId={activeId} onSelect={selectById} />

      {/* Encabezado flotante */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3">
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-[var(--shadow-soft)] ring-1 ring-zinc-100 backdrop-blur">
          <MapPinIcon size={16} className="text-primary" />
          {loading ? "Buscando turnos cerca..." : `${shifts.length} turnos cerca tuyo`}
        </div>
      </div>

      {/* Sheet inferior arrastrable (25% / 58% / 88%) con el carrusel de tarjetas */}
      {!loading && shifts.length === 0 ? (
        <div className="absolute inset-x-0 bottom-4 z-10 px-4">
          <div className="rounded-[var(--radius-card)] bg-white p-2 shadow-[var(--shadow-float)]">
            <EmptyState
              icon={<CalendarIcon size={28} />}
              title={error ?? "No hay turnos cerca"}
              subtitle="Aparecen en tiempo real. Volvé en un rato o ampliá tu zona."
              primaryAction={{ label: "Actualizar", onClick: load }}
            />
          </div>
        </div>
      ) : (
        <MapSheet containerRef={containerRef}>
          <div
            ref={carouselRef}
            onScroll={onCarouselScroll}
            className="no-scrollbar flex h-full items-start snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-4"
          >
          {shifts.map((shift) => {
            const { Icon, bg, fg } = SKILL_ACCENT[shift.position];
            const distance =
              shift.latitude != null && shift.longitude != null
                ? haversineKm(center, [shift.latitude, shift.longitude])
                : null;
            return (
              <div
                key={shift.id}
                className="w-[86%] shrink-0 snap-center overflow-hidden rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-float)] ring-1 ring-line"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${bg} ${fg}`}>
                      <Icon size={22} />
                    </span>
                    <div>
                      <h3 className="text-base font-extrabold leading-tight text-ink">
                        {SKILL_LABELS[shift.position]}
                      </h3>
                      <Link
                        href={`/companies/${shift.company_id}`}
                        className="text-xs font-medium text-ink/50"
                      >
                        {shift.company_name ?? "Comercio"}
                      </Link>
                    </div>
                  </div>
                  {shift.urgent && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-danger">
                      <FlameIcon size={11} /> Urgente
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-xl font-extrabold text-primary">
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
                <Button fullWidth size="sm" className="mt-3" onClick={() => apply(shift)}>
                  Me interesa
                </Button>
              </div>
            );
          })}
          </div>
        </MapSheet>
      )}
    </div>
  );
}
