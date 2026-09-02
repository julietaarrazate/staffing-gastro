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
  return `inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition active:scale-95 ${
    active
      ? "bg-primary text-white ring-primary"
      : "bg-card text-ink/60 ring-line hover:bg-surface"
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
  const sortedShifts = sortByDistance(shifts, origin);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-6">
      <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">
        Buscar turnos
      </h1>
      <p className="mt-0.5 text-sm text-ink/50">
        Explorá oportunidades de cualquier rubro, no sólo el tuyo.
      </p>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
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
            icon={<EmptyFeedIllustration color="#f97316" />}
            title="No hay turnos en este rubro"
            subtitle="Probá con otra categoría o volvé más tarde."
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sortedShifts.map((shift) => (
              <div key={shift.id} className="h-[620px]">
                <OpportunityCard
                  shift={shift}
                  distanceKm={distanceOf(shift, origin)}
                  applying={decidingId === shift.id}
                  onApply={() => handleDecide(shift, "like")}
                  onPass={() => handleDecide(shift, "pass")}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
