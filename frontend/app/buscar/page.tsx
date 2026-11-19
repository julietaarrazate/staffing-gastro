"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { appliedShiftIds } from "@/lib/applications";
import { getErrorMessage } from "@/lib/errors";
import { useLiveRefresh } from "@/lib/live-refresh";
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
import { sortByBestPay } from "@/lib/pay";
import { FlameIcon, StarIcon } from "@/components/icons";
import OportunidadComanda from "@/components/worker/OportunidadComanda";
import { CardSkeletons, EmptyState, ErrorBanner, SegmentedControl, useToast } from "@/components/ui";
import { LETRAS_APP } from "@/lib/letras";
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
 *
 * Con la dirección «con relieve» desde el 2026-11-19: el cielo arriba con el
 * título en brocha, los rubros como pestañas con la raya azul hondo (antes,
 * píldoras con «Todos» en ámbar, y el ámbar es sólo la acción) y cada turno
 * como comanda (`OportunidadComanda`).
 */

/** Filtros secundarios (urgentes, orden por pago): rectos con filete; cuando
 *  están prendidos, llenos en azul hondo, como lo actual de un indicador
 *  (`marca-hoy.md`, regla 2). Antes, píldoras en tinte. Mismo alto que una
 *  pestaña tocable (36 px) y la misma letra en las dos. */
function filterChipClass(active: boolean): string {
  return `inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-relieve)] px-3.5 text-sm font-semibold ring-1 transition active:scale-95 ${
    active ? "bg-primary-text text-card ring-primary-text" : "bg-card text-ink ring-line hover:bg-surface"
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

  // Turnos que la persona descartó o a los que se postuló desde esta pantalla:
  // una recarga (aviso, vuelta a la pestaña) no los vuelve a mostrar aunque el
  // servidor todavía los traiga o la respuesta haya salido antes.
  const ocultos = useRef<Set<string>>(new Set());
  // Último pedido gana: una respuesta vieja (otro rubro, o salida antes de una
  // postulación) no pisa a la nueva.
  const latestLoad = useRef(0);

  // `silent` (avisos y vuelta a la pestaña): sin esqueleto, y si falla se deja
  // lo que ya se ve.
  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!token) return;
      const silent = options?.silent === true;
      const mine = ++latestLoad.current;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const params = new URLSearchParams();
        // Buscar es la pantalla para mirar otras zonas: pide todo el mercado.
        // Sin esto, el feed sólo devuelve lo que queda cerca de la zona del
        // perfil (lo que muestran el Inicio y el Mapa).
        params.set("scope", "all");
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
        if (mine !== latestLoad.current) return;
        const appliedIds = appliedShiftIds(applied);
        setShifts(feed.filter((s) => !appliedIds.has(s.id) && !ocultos.current.has(s.id)));
        setProfile(prof);
        setError(null);
      } catch (err) {
        if (!silent && mine === latestLoad.current) {
          setError(err instanceof ApiError ? err.message : "No se pudieron cargar los turnos");
        }
      } finally {
        if (mine === latestLoad.current) setLoading(false);
      }
    },
    [token, skill]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Al día con los avisos (VIE-03): un turno que se cubrió o se canceló sale de
  // la lista sin recargar. En pausa con una carga normal o una postulación en curso.
  useLiveRefresh(load, { paused: loading || decidingId !== null });

  async function handleDecide(shift: Shift, decision: "like" | "pass") {
    if (decidingId !== null) return;
    if (decision === "pass") {
      ocultos.current.add(shift.id);
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
      ocultos.current.add(shift.id);
      setShifts((prev) => prev.filter((s) => s.id !== shift.id));
      toast("¡Te postulaste! El comercio ya te puede ver");
      requestOptIn();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        clearIdempotencyKey(shift.id);
        ocultos.current.add(shift.id);
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
    <div className={`${LETRAS_APP} app-container px-4 pb-10 md:pt-4`}>
      <div className="app-cielo -mx-4 px-4 pb-6 pt-5 md:mx-0 md:rounded-[var(--radius-card)] md:px-6">
        <h1 className="letra-cartel letra-cartel-pantalla break-words">Buscar turnos</h1>
        <p className="mt-1 text-sm">Explorá oportunidades de cualquier rubro, no sólo el tuyo.</p>
      </div>

      <div className="no-scrollbar -mx-4 -mb-1 mt-3 scroll-px-4 overflow-x-auto px-4 py-1">
        <SegmentedControl<WorkerSkill | "">
          className="w-max min-w-full"
          value={skill}
          onChange={setSkill}
          options={[{ value: "", label: "Todos" }, ...WORKER_SKILLS.map((s) => ({ value: s, label: SKILL_LABELS[s] }))]}
        />
      </div>

      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 py-1">
        <button
          type="button"
          role="switch"
          aria-checked={urgentOnly}
          onClick={() => setUrgentOnly((v) => !v)}
          className={filterChipClass(urgentOnly)}
        >
          <FlameIcon size={14} /> Urgentes
        </button>
        <button
          type="button"
          aria-pressed={sort === "pay"}
          onClick={() => setSort((v) => (v === "pay" ? "nearby" : "pay"))}
          className={filterChipClass(sort === "pay")}
        >
          <StarIcon size={14} filled /> Mejores pagos
        </button>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} onRetry={() => load()} />
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
          // Cada turno es una comanda de papel, el mismo objeto que en el
          // Inicio, Mis turnos y el Panel (Julieta, 2026-11-19, entre la
          // comanda y una lista con filete). Antes, la tarjeta con foto
          // grande de 560 a 620 px (`OpportunityCard`), que sigue en el mazo
          // del Inicio y en la grilla del Inicio en compu.
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sortedShifts.map((shift) => (
              <OportunidadComanda
                key={shift.id}
                shift={shift}
                distanceKm={distanceOf(shift, origin)}
                applying={decidingId === shift.id}
                onApply={() => handleDecide(shift, "like")}
                onPass={() => handleDecide(shift, "pass")}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
