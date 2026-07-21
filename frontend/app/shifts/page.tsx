"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getErrorMessage, isPlanLimitError } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { Shift, ShiftStatus } from "@/lib/types";
import ShiftCard from "@/components/ShiftCard";
import ReviewBox from "@/components/ReviewBox";
import ShareShiftButton from "@/components/ShareShiftButton";
import PlanLimitModal from "@/components/subscription/PlanLimitModal";
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
  AlertTriangleIcon,
  CheckCircleIcon,
  ClipboardIcon,
  ClockIcon,
  CloseIcon,
  CopyIcon,
  MessageIcon,
  SearchIcon,
  SparklesIcon,
  WalletIcon,
  XCircleIcon,
} from "@/components/icons";

// Primera experiencia del comercio nuevo (PRIMER_TURNO_REAL_SPEC Parte B):
// tras publicar el primer turno alguna vez, mostramos un cartel breve una
// sola vez ("ya estás buscando personal..."). Mismo criterio de "una sola
// vez" que `push-prompt-context.tsx` (localStorage, no intrusivo).
const FIRST_SHIFT_BANNER_SHOWN_KEY = "staffya_first_shift_banner_shown";

// Familias de estado del panel (bug de la operadora, docs/PULIDO_ROADMAP.md
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

// No-show (PRIMER_TURNO_REAL_SPEC Parte C, ADR-0007): sólo tiene sentido
// marcarlo mientras el trabajador confirmado todavía no se presentó
// (antes del check-in).
const NO_SHOW_ELIGIBLE_STATUSES: ShiftStatus[] = ["confirmado", "en_camino"];

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
  // Primera experiencia (Parte B): "ya se mostró antes" se lee UNA vez al
  // montar (inicializador perezoso de useState, no un efecto) — mismo
  // criterio de persistencia que `push-prompt-context.tsx`: se marca en
  // localStorage recién cuando el usuario lo cierra, no apenas se calcula
  // que correspondería mostrarlo (evita `setState` dentro de un efecto).
  const [firstShiftBannerDismissed, setFirstShiftBannerDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(FIRST_SHIFT_BANNER_SHOWN_KEY) === "1"
  );
  const [confirmNoShowId, setConfirmNoShowId] = useState<string | null>(null);

  async function load() {
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
  }

  useEffect(() => {
    load();
  }, [token]);

  function dismissFirstShiftBanner() {
    if (typeof window !== "undefined") {
      localStorage.setItem(FIRST_SHIFT_BANNER_SHOWN_KEY, "1");
    }
    setFirstShiftBannerDismissed(true);
  }

  // Si este comercio tiene EXACTAMENTE un turno y ya está publicado (no un
  // borrador), es su primer turno publicado — se deriva directo del render,
  // sin estado propio ni efecto.
  const isFirstPublishedShift =
    shifts.length === 1 &&
    (shifts[0].status === "publicado" || shifts[0].status === "buscando_personal");
  const showFirstShiftBanner = isFirstPublishedShift && !firstShiftBannerDismissed;

  // Helper único para las acciones de estado del turno: registra qué tarjeta
  // está ocupada (para loading/disabled), atrapa errores del POST (antes se
  // dejaban sin manejar) y refresca la lista al terminar.
  async function run(id: string, action: Action) {
    if (!token) return;
    const key = `${id}:${action}`;
    setBusy(key);
    try {
      await api.post(`/shifts/${id}/${ACTION_PATH[action]}`, undefined, token);
      await load();
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

  // En "Todos" se listan sólo las familias con contenido (no tiene sentido
  // mostrar 4 estados vacíos apilados). En una pestaña puntual se muestra
  // igual, vacía, con su propio mensaje de marca.
  const visibleFamilies: Family[] =
    tab === "todos" ? FAMILY_ORDER.filter((family) => families[family].length > 0) : [tab];

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">Panel</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Gestioná los turnos de tu comercio.</p>
        </div>
        <Link
          href="/shifts/new"
          className="shrink-0 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(255,107,0,0.3)] transition active:scale-95"
        >
          + Publicar
        </Link>
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

      {/* Cartel breve, una sola vez, tras publicar el primer turno de la
          cuenta (ver el `useEffect` que arma `showFirstShiftBanner`). No
          intrusivo: banner inline dentro del panel, no un modal. */}
      {!loading && !error && showFirstShiftBanner && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-primary/5 p-4 ring-1 ring-primary/15">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <SparklesIcon size={18} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold text-ink">Ya estás buscando personal</p>
            <p className="mt-0.5 text-sm text-ink/60">
              Te avisamos apenas haya candidatos disponibles para asignar.
            </p>
          </div>
          <button
            onClick={dismissFirstShiftBanner}
            aria-label="Cerrar"
            className="shrink-0 rounded-full p-1 text-ink/40 hover:bg-primary/10 hover:text-ink/70"
          >
            <CloseIcon size={16} />
          </button>
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
                    <div className="grid gap-4">
                      {list.map((shift) => (
                        <ShiftCard key={shift.id} shift={shift}>
                          <div className="flex flex-wrap gap-2">
                            {shift.worker_profile_id && shift.status !== "cancelado" && (
                              <>
                                <Link
                                  href={`/chats/${shift.id}`}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
                                >
                                  <MessageIcon size={16} /> Chat
                                </Link>
                                <Link
                                  href={`/workers/${shift.worker_profile_id}`}
                                  className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
                                >
                                  Ver trabajador
                                </Link>
                              </>
                            )}
                            {shift.status === "borrador" && (
                              <Button
                                size="sm"
                                onClick={() => run(shift.id, "publish")}
                                loading={busy === `${shift.id}:publish`}
                                disabled={busy !== null}
                              >
                                Publicar
                              </Button>
                            )}
                            {(shift.status === "publicado" || shift.status === "buscando_personal") && (
                              <Link
                                href={`/shifts/${shift.id}/candidates`}
                                className="rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-white transition active:scale-95"
                              >
                                Ver candidatos
                              </Link>
                            )}
                            {shift.status === "publicado" && (
                              <ShareShiftButton shift={shift} shiftId={shift.id} />
                            )}
                            <Link
                              href={`/shifts/new?duplicate=${shift.id}`}
                              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
                            >
                              <CopyIcon size={16} /> Duplicar
                            </Link>
                            {NO_SHOW_ELIGIBLE_STATUSES.includes(shift.status) && (
                              <Button
                                size="sm"
                                variant="surface"
                                leftIcon={<AlertTriangleIcon size={16} />}
                                onClick={() => setConfirmNoShowId(shift.id)}
                                loading={busy === `${shift.id}:noShow`}
                                disabled={busy !== null}
                              >
                                No se presentó
                              </Button>
                            )}
                            {!["finalizado", "pagado", "cancelado"].includes(shift.status) && (
                              <Button
                                size="sm"
                                variant="surface"
                                onClick={() => run(shift.id, "cancel")}
                                loading={busy === `${shift.id}:cancel`}
                                disabled={busy !== null}
                              >
                                Cancelar
                              </Button>
                            )}
                            {shift.status === "check_out" && (
                              <Button
                                size="sm"
                                variant="secondary"
                                leftIcon={<CheckCircleIcon size={16} />}
                                onClick={() => run(shift.id, "finish")}
                                loading={busy === `${shift.id}:finish`}
                                disabled={busy !== null}
                              >
                                Cerrar turno
                              </Button>
                            )}
                            {shift.status === "finalizado" && (
                              <Button
                                size="sm"
                                leftIcon={<WalletIcon size={16} />}
                                onClick={() => run(shift.id, "markPaid")}
                                loading={busy === `${shift.id}:markPaid`}
                                disabled={busy !== null}
                              >
                                Marcar como pagado
                              </Button>
                            )}
                            {shift.status === "pagado" && (
                              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700">
                                <CheckCircleIcon size={16} /> Pagado
                              </span>
                            )}
                          </div>
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

      <Modal
        open={confirmNoShowId !== null}
        onClose={() => setConfirmNoShowId(null)}
        title="¿Marcar que no se presentó?"
      >
        <p className="text-sm text-zinc-600">
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
