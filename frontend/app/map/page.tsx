"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getCurrentPosition } from "@/lib/geolocation";
import { SKILL_LABELS, Shift, ShiftApplication } from "@/lib/types";
import { SKILL_STYLES } from "@/lib/skill-style";
import { Avatar, Button, EmptyState, useToast } from "@/components/ui";
import { CalendarIcon, FlameIcon, MapPinIcon, WalletIcon } from "@/components/icons";

const ShiftMap = dynamic(() => import("@/components/worker/ShiftMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-zinc-100" />,
});

const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816]; // Obelisco

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function MapPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

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

  // Click en un pin -> scrollea el carrusel a esa tarjeta.
  function selectById(id: string) {
    const idx = shifts.findIndex((s) => s.id === id);
    if (idx < 0) return;
    setActiveIndex(idx);
    const el = carouselRef.current;
    if (el) {
      const cardWidth = el.scrollWidth / Math.max(shifts.length, 1);
      el.scrollTo({ left: cardWidth * idx, behavior: "smooth" });
    }
  }

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
    <div className="relative h-[calc(100dvh-4rem-5rem)] overflow-hidden md:h-[calc(100dvh-4rem)]">
      <ShiftMap shifts={shifts} center={center} activeId={activeId} onSelect={selectById} />

      {/* Encabezado flotante */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3">
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-[var(--shadow-soft)] ring-1 ring-zinc-100 backdrop-blur">
          <MapPinIcon size={16} className="text-primary" />
          {loading ? "Buscando turnos cerca..." : `${shifts.length} turnos cerca tuyo`}
        </div>
      </div>

      {/* Carrusel de tarjetas grandes */}
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
        <div
          ref={carouselRef}
          onScroll={onCarouselScroll}
          className="no-scrollbar absolute inset-x-0 bottom-3 z-10 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1"
        >
          {shifts.map((shift) => {
            const { Icon, gradient } = SKILL_STYLES[shift.position];
            const distance =
              shift.latitude != null && shift.longitude != null
                ? haversineKm(center, [shift.latitude, shift.longitude])
                : null;
            return (
              <div
                key={shift.id}
                className="w-[86%] shrink-0 snap-center overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-float)] ring-1 ring-zinc-100"
              >
                <div className={`relative flex h-20 items-end bg-gradient-to-br ${gradient} px-4 pb-2.5`}>
                  <Icon size={64} className="absolute -right-2 -top-2 text-white/15" />
                  {shift.urgent && (
                    <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-bold text-danger">
                      <FlameIcon size={11} /> Urgente
                    </span>
                  )}
                  <h3 className="relative z-10 text-lg font-extrabold text-white drop-shadow-sm">
                    {SKILL_LABELS[shift.position]}
                  </h3>
                </div>
                <div className="space-y-2 p-4">
                  <Link
                    href={`/companies/${shift.company_id}`}
                    className="flex items-center gap-2"
                  >
                    <Avatar src={shift.company_logo_url} name={shift.company_name ?? "Comercio"} size="sm" />
                    <span className="truncate text-sm font-semibold text-zinc-700">
                      {shift.company_name ?? "Comercio"}
                    </span>
                  </Link>
                  <div className="flex items-center justify-between">
                    <p className="inline-flex items-center gap-1 text-xl font-extrabold text-primary">
                      <WalletIcon size={18} /> {shift.currency} {Number(shift.pay_amount).toLocaleString("es-AR")}
                    </p>
                    <p className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500">
                      <MapPinIcon size={13} />
                      {distance != null ? `${distance.toFixed(1)} km` : (shift.city ?? "")}
                    </p>
                  </div>
                  <Button fullWidth size="sm" variant="secondary" onClick={() => apply(shift)}>
                    Me interesa
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
