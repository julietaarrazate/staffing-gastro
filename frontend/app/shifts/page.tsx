"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getErrorMessage, isPlanLimitError } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { Shift, ShiftStatus } from "@/lib/types";
import ShiftCard from "@/components/ShiftCard";
import ShiftActions from "@/components/ShiftActions";
import ReviewBox from "@/components/ReviewBox";
import PlanLimitModal from "@/components/subscription/PlanLimitModal";
import ShiftPublishedNextSteps from "@/components/ShiftPublishedNextSteps";
import {
  Button,
  CardSkeletons,
  EmptyState,
  ErrorBanner,
  Modal,
  SegmentedControl,
  useToast,
} from "@/components/ui";
import {
  CheckCircleIcon,
  ClipboardIcon,
  ClockIcon,
  SearchIcon,
  XCircleIcon,
} from "@/components/icons";

// Familias de estado del panel (bug de la operadora, docs/planning/PULIDO_ROADMAP.md
// batch "panel-por-estados": "activos 2 pero abajo la lista completa con
// inactivos; buscando 1 y no muestra cuál; deberían estar agrupados por
// estado, cancelados con cancelados, finalizados con finalizados"). Antes
// había 3 KPIs estáticos (uno en azul — "Buscando", fuera de la Ley de marca)
// que no filtraban nada, más una lista plana. Ahora el estado real de cada
// turno decide en qué familia cae, y la familia decide qué pestaña lo
// muestra — el conteo de cada pestaña es siempre el largo real de esa
// familia, nunca un número desconectado de la lista.
type Family = "borrador" | "buscando" | "en_marcha" | "terminado" | "cancelado";

const FAMILY_STATUSES: Record<Family, ShiftStatus[]> = {
  borrador: ["borrador"],
  buscando: ["publicado", "buscando_personal"],
  en_marcha: ["asignado", "en_camino", "check_in", "trabajando", "check_out"],
  terminado: ["confirmado", "finalizado", "pagado"],
  cancelado: ["cancelado"],
};

// Orden de despliegue en la pestaña "Todos": borradores primero (ni siquiera
// se publicaron todavía), buscando, en marcha, terminados y cancelados al
// final — los dos últimos ya atenuados por `ShiftCard` (opacity-65 en sus
// estados terminales: finalizado/pagado/cancelado).
const FAMILY_ORDER: Family[] = ["borrador", "buscando", "en_marcha", "terminado", "cancelado"];

function familyOf(status: ShiftStatus): Family {
  return FAMILY_ORDER.find((family) => FAMILY_STATUSES[family].includes(status)) ?? "buscando";
}

type Tab = "todos" | Family;

const FAMILY_META: Record<
  Family,
  { title: string; icon: React.ReactNode; emptyTitle: string; emptySubtitle: string }
> = {
  borrador: {
    title: "Borradores",
    icon: <ClipboardIcon size={14} />,
    emptyTitle: "No tenés borradores",
    emptySubtitle: "Los turnos que empezás a cargar y todavía no publicás quedan acá.",
  },
  buscando: {
    title: "Buscando personal",
    icon: <SearchIcon size={14} />,
    emptyTitle: "Todavía no tenés turnos buscando personal",
    emptySubtitle: "Publicá un turno y en minutos vas a tener candidatos rankeados, listos para asignar.",
  },
  en_marcha: {
    title: "En marcha",
    icon: <ClockIcon size={14} />,
    emptyTitle: "No tenés turnos en marcha",
    emptySubtitle: "Cuando asignes un turno a un trabajador, va a aparecer acá hasta que se cierre.",
  },
  terminado: {
    title: "Terminados",
    icon: <CheckCircleIcon size={14} />,
    emptyTitle: "Todavía no tenés turnos terminados",
    emptySubtitle: "Los turnos confirmados, finalizados o pagados van a quedar acá.",
  },
  cancelado: {
    title: "Cancelados",
    icon: <XCircleIcon size={14} />,
    emptyTitle: "No tenés turnos cancelados",
    emptySubtitle: "Buena señal: todavía no cancelaste ningún turno.",
  },
};

type Action = "publish" | "cancel" | "finish" | "markPaid" | "noShow";

const ACTION_PATH: Record<Action, string> = {
  publish: "publish",
  cancel: "cancel",
  finish: "finish",
  markPaid: "mark-paid",
  noShow: "no-show",
};

export default function MyShiftsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [tab, setTab] = useState<Tab>("todos");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [planLimitMessage, setPlanLimitMessage] = useState<string | null>(null);
  const { keyFor, clear: clearIdempotencyKey } = useIdempotencyKeys();
  const [confirmNoShowId, setConfirmNoShowId] = useState<string | null>(null);
  // Pantalla "esto es lo que sigue" (Fix 2, docs/planning/PULIDO_ROADMAP.md): guarda
  // el id del turno que se acaba de publicar DESDE ESTE PANEL (borrador →
  // publicado). Reemplaza el cartel de una sola vez ("ya estás buscando
  // personal...", launch-gate #88): esta versión es más rica y se muestra
  // cada vez que se publica, no sólo la primera vez (ver
  // `ShiftPublishedNextSteps` para la justificación completa).
  const [justPublishedId, setJustPublishedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.get<Shift[]>("/shifts/me", token);
      setShifts(data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "Error al cargar tus turnos"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Helper único para las acciones de estado del turno: registra qué tarjeta
  // está ocupada (para loading/disabled), atrapa errores del POST (antes se
  // dejaban sin manejar) y refresca la lista al terminar.
  async function run(id: string, action: Action) {
    if (!token) return;
    const key = `${id}:${action}`;
    setBusy(key);
    try {
      // Idempotencia (product/IDEMPOTENCIA_SPEC.md): mismo intento = misma
      // key mientras no haya terminado bien; un doble-tap sobre "Publicar"/
      // "Cancelar" con `busy` ya deshabilitando el botón, más este header,
      // cubre tanto el 90% cliente-side como el reintento de red server-side.
      await api.post(`/shifts/${id}/${ACTION_PATH[action]}`, undefined, token, undefined, keyFor(key));
      clearIdempotencyKey(key);
      await load();
      if (action === "publish") setJustPublishedId(id);
    } catch (err) {
      if (action === "publish" && isPlanLimitError(err)) {
        setPlanLimitMessage(getErrorMessage(err));
      } else {
        toast(getErrorMessage(err, "No se pudo completar la acción"), "error");
      }
    } finally {
      setBusy(null);
    }
  }

  async function confirmNoShow(id: string) {
    setConfirmNoShowId(null);
    await run(id, "noShow");
  }

  // Agrupa una sola vez por familia; cada pestaña (incluida "Todos") lee de
  // acá, así que el número en el segmento y lo que se ve abajo nunca pueden
  // desincronizarse (ese era el bug: "buscando 1" sin mostrar cuál).
  const families = useMemo(() => {
    const grouped: Record<Family, Shift[]> = {
      borrador: [],
      buscando: [],
      en_marcha: [],
      terminado: [],
      cancelado: [],
    };
    for (const shift of shifts) grouped[familyOf(shift.status)].push(shift);
    return grouped;
  }, [shifts]);

  // Progreso de cobertura por evento (publicación masiva, /shifts/new-event):
  // cruza TODAS las familias — un evento de 6 roles puede tener 4 ya
  // asignados/en marcha y 2 todavía buscando, repartidos en pestañas
  // distintas. `covered` = ya tiene trabajador asignado (worker_profile_id),
  // sin importar en qué paso del ciclo vaya después de eso.
  const eventGroups = useMemo(() => {
    const byId = new Map<string, { name: string; total: number; covered: number }>();
    for (const shift of shifts) {
      if (!shift.event_id) continue;
      const entry = byId.get(shift.event_id) ?? {
        name: shift.event_name ?? "Evento",
        total: 0,
        covered: 0,
      };
      entry.total += 1;
      if (shift.worker_profile_id) entry.covered += 1;
      byId.set(shift.event_id, entry);
    }
    return Array.from(byId.entries()).map(([eventId, data]) => ({ eventId, ...data }));
  }, [shifts]);

  // En "Todos" se listan sólo las familias con contenido (no tiene sentido
  // mostrar 4 estados vacíos apilados). En una pestaña puntual se muestra
  // igual, vacía, con su propio mensaje de marca.
  const visibleFamilies: Family[] =
    tab === "todos" ? FAMILY_ORDER.filter((family) => families[family].length > 0) : [tab];

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-6 md:max-w-6xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Panel</h1>
          <p className="mt-0.5 text-sm text-ink/50">Gestioná los turnos de tu comercio.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/shifts/new-event"
            className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-ink/70 ring-1 ring-line transition active:scale-95"
          >
            + Evento
          </Link>
          <Link
            href="/shifts/new"
            className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-ink shadow-[0_8px_20px_rgba(249,115,22,0.3)] transition active:scale-95"
          >
            + Publicar
          </Link>
        </div>
      </div>

      {loading && <CardSkeletons />}
      {error && <ErrorBanner message={error} onRetry={load} />}

      {/* Primera experiencia (Parte B): CTA imposible de errar + qué va a
          pasar en 3 pasos concretos. Reusa el `EmptyState` de marca (mismo
          componente que usan los estados vacíos por familia, abajo). */}
      {!loading && !error && shifts.length === 0 && (
        <EmptyState
          icon={<ClipboardIcon size={26} />}
          title="Publicá tu primer turno"
          subtitle="Publicás el turno, te recomendamos a los mejores candidatos disponibles cerca tuyo, y vos elegís a quién asignar. En minutos vas a tener gente lista para cubrirlo."
          primaryAction={{
            label: "Publicá tu primer turno",
            onClick: () => router.push("/shifts/new"),
          }}
        />
      )}

      {!loading && !error && eventGroups.length > 0 && (
        <div className="mt-4 space-y-2">
          {eventGroups.map((event) => (
            <div
              key={event.eventId}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-line"
            >
              <p className="truncate text-sm font-semibold text-ink">{event.name}</p>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                  event.covered === event.total
                    ? "bg-green-50 text-success-text"
                    : "bg-orange-50 text-primary-text"
                }`}
              >
                {event.covered}/{event.total} cubiertos
              </span>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && shifts.length > 0 && (
        <>
          {/* Control segmentado por familia de estado. En 390px de ancho 5
              segmentos con conteo no entran sin achicar el texto a ilegible
              — el `min-w` fuerza el ancho real del control y el contenedor
              scrollea horizontal (mismo patrón que un tab bar nativo). */}
          <div className="-mx-4 mt-4 overflow-x-auto px-4 no-scrollbar">
            <SegmentedControl<Tab>
              value={tab}
              onChange={setTab}
              className="min-w-[540px]"
              options={[
                { value: "todos", label: "Todos" },
                { value: "buscando", label: `Buscando (${families.buscando.length})` },
                { value: "en_marcha", label: `En marcha (${families.en_marcha.length})` },
                { value: "terminado", label: `Terminados (${families.terminado.length})` },
                { value: "cancelado", label: `Cancelados (${families.cancelado.length})` },
              ]}
            />
          </div>

          <div className="mt-2" data-testid="shifts-panel-list">
            {visibleFamilies.map((family) => {
              const list = families[family];
              const meta = FAMILY_META[family];
              return (
                <section key={family} className="mt-6 first:mt-4" data-family={family}>
                  <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink/40">
                    {meta.icon}
                    {meta.title}
                    <span className="font-semibold text-ink/25">· {list.length}</span>
                  </h2>

                  {list.length === 0 ? (
                    <EmptyState icon={meta.icon} title={meta.emptyTitle} subtitle={meta.emptySubtitle} />
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {list.map((shift) => (
                        <ShiftCard key={shift.id} shift={shift}>
                          <ShiftActions
                            shift={shift}
                            busy={busy}
                            onRun={run}
                            onNoShow={() => setConfirmNoShowId(shift.id)}
                          />
                          {(shift.status === "finalizado" || shift.status === "pagado") && (
                            <div className="mt-3">
                              <ReviewBox shiftId={shift.id} />
                            </div>
                          )}
                        </ShiftCard>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      <PlanLimitModal
        open={planLimitMessage !== null}
        message={planLimitMessage}
        onClose={() => setPlanLimitMessage(null)}
      />

      <ShiftPublishedNextSteps
        open={justPublishedId !== null}
        onClose={() => setJustPublishedId(null)}
        onViewShift={() => {
          const id = justPublishedId;
          setJustPublishedId(null);
          if (id) router.push(`/shifts/${id}/candidates`);
        }}
      />

      <Modal
        open={confirmNoShowId !== null}
        onClose={() => setConfirmNoShowId(null)}
        title="¿Marcar que no se presentó?"
      >
        <p className="text-sm text-ink/60">
          El turno se libera para volver a buscar personal y le va a impactar
          la reputación al trabajador. Esta acción queda registrada.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="surface" size="sm" onClick={() => setConfirmNoShowId(null)}>
            Volver
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => confirmNoShowId && confirmNoShow(confirmNoShowId)}
          >
            Sí, no se presentó
          </Button>
        </div>
      </Modal>
    </div>
  );
}
