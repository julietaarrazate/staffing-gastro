"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { usePushPrompt } from "@/lib/push-prompt-context";
import {
  SKILL_LABELS,
  Shift,
  ShiftApplication,
  WORKER_SKILLS,
  WorkerProfile,
  WorkerSkill,
} from "@/lib/types";
import {
  distanceOf,
  getStoredLocation,
  originFor,
  sortByDistance,
} from "@/lib/current-location";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { sortByBestPay } from "@/lib/pay";
import { FlameIcon, StarIcon } from "@/components/icons";
import OpportunityCard from "@/components/worker/OpportunityCard";
import { CardSkeletons, EmptyState, ErrorBanner, useToast } from "@/components/ui";
import { EmptyFeedIllustration } from "@/components/illustrations";

/**
 * Pedido de Julieta: "agregar la pestaña Buscar (trabajador)" — a diferencia
 * del feed (`/feed`, que sólo muestra los rubros que el trabajador eligió en
 * su perfil, GET /shifts/feed sin filtro explícito cae a `my_skills`), acá se
 * navega TODO el mercado por categoría, con la misma acción de postularse que
 * ya existe en el feed. Reusa endpoints existentes (`/shifts/feed`,
 * `/applications/shifts/{id}`, `/applications/mine`) — sin lógica nueva de
 * backend, sólo un filtro explícito por chip de rubro en vez del implícito
 * por perfil.
 */

function pillClass(active: boolean): string {
  return `inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold ring-1 transition active:scale-95 ${
    active
      ? "bg-primary text-night ring-primary"
      : "bg-card text-ink/60 ring-line hover:bg-surface"
  }`;
}

/** Filtros secundarios (urgentes, orden por pago): en tinte cuando están
 *  prendidos, para que no compitan con el rubro elegido, que es la decisión
 *  principal. Mismo alto y cuerpo de letra que los rubros (2026-10-04): eran
 *  más chicos (`text-caption`, `py-1.5`) y con la letra agrandada del celular
 *  las dos filas se veían de tamaños distintos, como si no entraran. */
function filterChipClass(active: boolean): string {
  return `inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold ring-1 transition active:scale-95 ${
    active ? "bg-primary-tint text-primary-text ring-primary/30" : "bg-card text-ink/70 ring-line hover:bg-surface"
  }`;
}

export default function BuscarPage() {
  const { token } = useRequireAuth();
  const { requestOptIn } = usePushPrompt();
  const toast = useToast();
  const [skill, setSkill] = useState<WorkerSkill | "">("");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  // "Urgentes" y "Mejores pagos" vivían en el Inicio y se mudaron acá
  // (2026-09-28, diagnóstico de sobrecarga): el Inicio muestra qué tomar,
  // Buscar es donde se filtra. Filtro y orden client-side, sobre lo ya
  // cargado (el feed no pagina): "Urgentes" se combina con cualquier orden;
  // "Mejores pagos" ordena por pago por hora (ADR-0012).
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [sort, setSort] = useState<"nearby" | "pay">("nearby");
  const { keyFor, clear: clearIdempotencyKey } = useIdempotencyKeys();

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      // Sin rubro elegido ("Todos"): se pasan TODOS los rubros explícitos
      // como `positions`, para no caer en el default de `/shifts/feed`
      // (los rubros del perfil) — acá el propósito es ver el mercado
      // completo, no lo mismo que ya se ve en el feed.
      if (skill) params.set("position", skill);
      else WORKER_SKILLS.forEach((s) => params.append("positions", s));
      const [feed, prof, applied] = await Promise.all([
        api.get<Shift[]>(`/shifts/feed?${params.toString()}`, token),
        api.get<WorkerProfile>("/workers/me/profile", token).catch(() => null),
        api.get<ShiftApplication[]>("/applications/mine", token).catch(() => []),
      ]);
      const appliedIds = new Set(applied.map((a) => a.shift_id));
      setShifts(feed.filter((s) => !appliedIds.has(s.id)));
      setProfile(prof);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los turnos");
    } finally {
      setLoading(false);
    }
  }, [token, skill]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDecide(shift: Shift, decision: "like" | "pass") {
    if (decidingId !== null) return;
    if (decision === "pass") {
      setShifts((prev) => prev.filter((s) => s.id !== shift.id));
      return;
    }
    if (!token) return;
    setDecidingId(shift.id);
    try {
      await api.post(
        `/applications/shifts/${shift.id}`,
        undefined,
        token,
        undefined,
        keyFor(shift.id)
      );
      clearIdempotencyKey(shift.id);
      setShifts((prev) => prev.filter((s) => s.id !== shift.id));
      toast("¡Te postulaste! El comercio ya te puede ver");
      requestOptIn();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        clearIdempotencyKey(shift.id);
        setShifts((prev) => prev.filter((s) => s.id !== shift.id));
        toast("Ya te habías postulado a este turno");
      } else {
        toast(getErrorMessage(err, "No se pudo enviar tu postulación"), "error");
      }
    } finally {
      setDecidingId(null);
    }
  }

  const origin = originFor(getStoredLocation(), profile);
  const byDistance = sortByDistance(shifts, origin);
  const sorted = sort === "pay" ? sortByBestPay(byDistance) : byDistance;
  const sortedShifts = urgentOnly ? sorted.filter((s) => s.urgent) : sorted;

  return (
    <div className="app-container px-4 pb-10 pt-6">
      <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">
        Buscar turnos
      </h1>
      <p className="mt-0.5 text-sm text-ink/50">
        Explorá oportunidades de cualquier rubro, no sólo el tuyo.
      </p>

      {/* Las filas de chips sangran hasta el borde de la pantalla (`-mx-4
          px-4`) y tienen aire arriba y abajo (`py-1`). Antes el scroll
          horizontal cortaba en seco contra el margen de 16px ("Ba|" partido
          al costado) y, como `overflow-x-auto` también recorta en vertical,
          se comía el borde (`ring-1`) del primer chip de cada fila: "Todos" y
          "Urgentes" se veían mordidos (captura de Julieta, 2026-10-04). Ahora
          el chip que no entra se va por debajo del borde de la pantalla, que
          es como se lee "hay más para deslizar". */}
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 py-1">
        <button type="button" onClick={() => setSkill("")} className={pillClass(skill === "")}>
          Todos
        </button>
        {WORKER_SKILLS.map((s) => {
          const { Icon } = SKILL_ACCENT[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSkill(s)}
              className={pillClass(skill === s)}
            >
              <Icon size={14} /> {SKILL_LABELS[s]}
            </button>
          );
        })}
      </div>

      <div className="no-scrollbar -mx-4 mt-1 flex gap-2 overflow-x-auto px-4 py-1">
        <button
          type="button"
          role="switch"
          aria-checked={urgentOnly}
          onClick={() => setUrgentOnly((v) => !v)}
          className={filterChipClass(urgentOnly)}
        >
          <FlameIcon size={14} className="text-primary-text" /> Urgentes
        </button>
        <button
          type="button"
          aria-pressed={sort === "pay"}
          onClick={() => setSort((v) => (v === "pay" ? "nearby" : "pay"))}
          className={filterChipClass(sort === "pay")}
        >
          <StarIcon size={14} filled className="text-rating" /> Mejores pagos
        </button>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} onRetry={load} />
        </div>
      )}

      <div className="mt-5">
        {loading ? (
          <CardSkeletons count={6} />
        ) : sortedShifts.length === 0 ? (
          <EmptyState
            icon={<EmptyFeedIllustration color="var(--color-primary)" />}
            title={urgentOnly ? "No hay turnos urgentes ahora" : "No hay turnos en este rubro"}
            subtitle={
              urgentOnly
                ? "Sacá el filtro para ver el resto de las oportunidades."
                : "Probá con otra categoría o volvé más tarde."
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sortedShifts.map((shift) => (
              // 560px en el celu, 620px desde `sm` (2026-10-04): en una sola
              // columna no hay otra tarjeta con la que alinear el alto, y con
              // 620px quedaba un hueco de ~100px entre los datos y las
              // acciones (captura de Julieta). En la grilla sí hace falta el
              // alto parejo. El cuerpo de la tarjeta igual scrollea si algún
              // dress code largo no entra.
              <div key={shift.id} data-testid="buscar-card" className="h-[560px] sm:h-[620px]">
                <OpportunityCard
                  shift={shift}
                  distanceKm={distanceOf(shift, origin)}
                  applying={decidingId === shift.id}
                  onApply={() => handleDecide(shift, "like")}
                  onPass={() => handleDecide(shift, "pass")}
                  shareable
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
