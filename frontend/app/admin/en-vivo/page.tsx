"use client";

// "Turnos en vivo" (paso 3 del panel de admin ordenado, 2026-10-20): responde
// "¿qué turno se está quedando sin cubrir ahora?". Lista lo publicado que
// todavía no tiene a nadie confirmado, lo más urgente primero, y se actualiza
// sola cada 30 segundos mientras la pestaña está a la vista. No hay canal de
// WebSocket para el admin; el polling alcanza para una pantalla que se mira.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { AR_TIMEZONE, formatAgo, formatShiftWhen } from "@/lib/datetime";
import { SKILL_LABELS } from "@/lib/types";
import type { LiveShift, LiveShiftsBoard } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  CardSkeletons,
  EmptyState,
  ErrorBanner,
  SegmentedControl,
} from "@/components/ui";
import { CheckCircleIcon, ClockIcon, FlameIcon, UsersIcon } from "@/components/icons";
import { AdminHeading } from "@/components/admin/AdminStats";
import { LIVE_REFRESH_MS, PROMISE_MINUTES, formatMinutesOpen } from "@/components/admin/live";

type Filter = "todos" | "urgentes" | "escalados";

const QUERY: Record<Filter, string> = {
  todos: "",
  urgentes: "?urgent=true",
  escalados: "?escalated=true",
};

const EMPTY_TEXT: Record<Filter, { title: string; subtitle: string }> = {
  todos: {
    title: "Nada esperando",
    subtitle: "Todos los turnos publicados tienen a alguien confirmado.",
  },
  urgentes: { title: "Sin urgentes ahora", subtitle: "Ningún turno urgente está sin cubrir." },
  escalados: {
    title: "Sin escalados ahora",
    subtitle: "El sistema no tuvo que escalar ningún turno abierto.",
  },
};

function filterFromUrl(): Filter {
  if (typeof window === "undefined") return "todos";
  const value = new URLSearchParams(window.location.search).get("filtro");
  return value === "urgentes" || value === "escalados" ? value : "todos";
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    timeZone: AR_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

function LiveShiftCard({ shift }: { shift: LiveShift }) {
  const assigned = shift.status === "asignado";
  const late = !assigned && shift.minutes_open > PROMISE_MINUTES;
  const where = [SKILL_LABELS[shift.position] ?? shift.position, shift.company_name, shift.city]
    .filter(Boolean)
    .join(" · ");
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">
            {shift.title || SKILL_LABELS[shift.position] || "Turno"}
          </p>
          <p className="mt-0.5 truncate text-sm text-ink/60">{where}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink/70">
            <ClockIcon size={14} />
            {formatShiftWhen(shift.start_at, shift.end_at)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`text-2xl font-extrabold tabular-nums ${late ? "text-danger-text" : "text-ink"}`}
          >
            {formatMinutesOpen(shift.minutes_open)}
          </p>
          <p className="text-xs font-medium text-ink/50">
            {assigned ? "publicado" : "sin cubrir"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {shift.urgent && (
          <Badge tone="danger" icon={<FlameIcon size={12} />}>
            Urgente
          </Badge>
        )}
        {shift.escalated && shift.escalated_at && (
          <Badge tone="neutral">Escalado {formatAgo(shift.escalated_at)}</Badge>
        )}
        <Badge tone="neutral">{assigned ? "Asignado, falta que confirme" : "Buscando"}</Badge>
        <Badge tone="neutral" icon={<UsersIcon size={12} />}>
          {shift.applications === 1 ? "1 postulación" : `${shift.applications} postulaciones`}
        </Badge>
      </div>
    </Card>
  );
}

export default function AdminLiveShiftsPage() {
  const { token } = useAuth();
  const [filter, setFilter] = useState<Filter>("todos");
  const [board, setBoard] = useState<LiveShiftsBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const filterRef = useRef<Filter>(filter);

  useEffect(() => {
    const fromUrl = filterFromUrl();
    filterRef.current = fromUrl;
    setFilter(fromUrl);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    const requested = filterRef.current;
    setRefreshing(true);
    try {
      const data = await api.get<LiveShiftsBoard>(`/admin/live-shifts${QUERY[requested]}`, token);
      // Si el filtro cambió mientras viajaba la respuesta, se descarta.
      if (filterRef.current === requested) {
        setBoard(data);
        setError(null);
      }
    } catch (err) {
      setError(getErrorMessage(err, "No se pudieron cargar los turnos en vivo"));
    } finally {
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    filterRef.current = filter;
    void load();
  }, [filter, load]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void load();
    };
    const id = window.setInterval(tick, LIVE_REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  const changeFilter = (next: Filter) => {
    setBoard(null);
    setFilter(next);
    const url = next === "todos" ? window.location.pathname : `?filtro=${next}`;
    window.history.replaceState(null, "", url);
  };

  const counts = board ?? { total: 0, urgent: 0, escalated: 0 };
  const label = (text: string, n: number) => (board ? `${text} (${n})` : text);

  return (
    <div>
      <AdminHeading
        title="Turnos en vivo"
        subtitle="Lo publicado que todavía no tiene a nadie confirmado, lo más urgente primero."
      />

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl<Filter>
          className="sm:w-[26rem]"
          value={filter}
          onChange={changeFilter}
          options={[
            { value: "todos", label: label("Todos", counts.total) },
            { value: "urgentes", label: label("Urgentes", counts.urgent) },
            { value: "escalados", label: label("Escalados", counts.escalated) },
          ]}
        />
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <p className="text-xs text-ink/50" aria-live="polite">
            {board ? `Actualizado ${formatClock(board.generated_at)} · cada 30 s` : "Cargando…"}
          </p>
          <Button variant="surface" size="sm" onClick={() => void load()} disabled={refreshing}>
            Actualizar
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} onRetry={() => void load()} />
        </div>
      )}

      <div className="mt-4">
        {!board ? (
          !error && <CardSkeletons count={3} />
        ) : board.shifts.length === 0 ? (
          <EmptyState
            icon={<CheckCircleIcon size={26} />}
            title={EMPTY_TEXT[filter].title}
            subtitle={EMPTY_TEXT[filter].subtitle}
          />
        ) : (
          <ul className="grid gap-3" aria-label="Turnos sin cubrir">
            {board.shifts.map((shift) => (
              <li key={shift.id}>
                <LiveShiftCard shift={shift} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
