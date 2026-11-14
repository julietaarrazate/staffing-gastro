"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { getErrorMessage, isNotFound } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { Applicant, CandidateMatch, SKILL_LABELS, Shift } from "@/lib/types";
import { SKILL_ACCENT, heroTile } from "@/lib/skill-style";
import { formatDuration, formatShiftWhen, shiftDurationMinutes } from "@/lib/datetime";
import { formatPayAmount } from "@/lib/pay";
import { rankApplicants, standoutApplicant } from "@/lib/applicants";
import CandidateCard from "@/components/CandidateCard";
import IdentityVerifiedBadge from "@/components/IdentityVerifiedBadge";
import ConfirmOverlay from "@/components/ui/ConfirmOverlay";
import GuaranteeCard from "@/components/candidate/GuaranteeCard";
import { CandidateStatChips } from "@/components/candidate/CandidateSignals";
import {
  Avatar,
  Badge,
  Button,
  CardSkeletons,
  EmptyState,
  ErrorBanner,
  SegmentedControl,
  useToast,
} from "@/components/ui";
import { useLiveRefresh } from "@/lib/live-refresh";
import { ClockIcon, StarIcon, UsersIcon } from "@/components/icons";

type Tab = "postulantes" | "recomendados";

/**
 * Carga una lista. 404 (turno ajeno o inexistente) = lista vacía, como
 * siempre; cualquier otra falla deja `error` y conserva lo ya cargado. Una
 * respuesta vieja que llega tarde no pisa a la más nueva.
 */
function useLoadedList<T>(path: string, token: string | null | undefined) {
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);
  // `silent` (recarga por un aviso, ver `lib/live-refresh.ts`): sin esqueleto
  // y sin marcar error si falla; se conserva lo que ya se ve.
  const reload = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!token) return;
    const mine = ++latest.current;
    if (!silent) setLoading(true);
    try {
      const data = await api.get<T[]>(path, token);
      if (mine !== latest.current) return;
      setItems(data);
      setError(false);
    } catch (err) {
      if (mine !== latest.current) return;
      if (isNotFound(err)) {
        setItems([]);
        setError(false);
      } else if (!silent) {
        setError(true);
      }
    } finally {
      if (mine === latest.current) setLoading(false);
    }
  }, [path, token]);
  return { items, error, loading, reload };
}

function ShiftCandidatesContent() {
  const { token } = useRequireAuth();
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const shiftId = params.id;
  const searchParams = useSearchParams();
  // El tab va en la URL (no sólo en state) para que al entrar a un perfil
  // desde "Recomendados" y volver atrás, el back nativo del navegador
  // restaure el mismo tab en vez de reiniciar en "Postulantes" (bug
  // reportado por Julieta: "vuelvo atrás y sale de los recomendados").
  const [tab, setTabState] = useState<Tab>(
    searchParams.get("tab") === "recomendados" ? "recomendados" : "postulantes"
  );
  function setTab(next: Tab) {
    setTabState(next);
    router.replace(`/shifts/${shiftId}/candidates?tab=${next}`, { scroll: false });
  }
  const [shift, setShift] = useState<Shift | null>(null);
  // Cada lista carga y falla por su cuenta. Un error NUNCA se convierte en
  // lista vacía: «Todavía nadie se postuló» sólo aparece si el servidor
  // contestó bien con cero postulantes. Si ya había datos y una recarga
  // falla, se conservan y se avisa.
  const {
    items: applicants,
    error: appsError,
    loading: loadingApps,
    reload: reloadApps,
  } = useLoadedList<Applicant>(`/applications/shifts/${shiftId}`, token);
  const {
    items: candidates,
    error: candsError,
    loading: loadingCands,
    reload: reloadCands,
  } = useLoadedList<CandidateMatch>(`/shifts/${shiftId}/candidates`, token);
  const rankedApplicants = useMemo(() => rankApplicants(applicants), [applicants]);
  const standout = standoutApplicant(rankedApplicants);
  const [assigning, setAssigning] = useState<string | null>(null);
  // Recién asignado: su tarjeta sube arriba con la confirmación y el resto
  // se atenúa, un instante antes de volver al panel. La decisión se VE, en
  // vez de sólo un toast sobre una pantalla que ya se fue.
  const [assignedId, setAssignedId] = useState<string | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useReducedMotion();
  useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);
  const shownApplicants = useMemo(() => {
    if (!assignedId) return rankedApplicants;
    const chosen = rankedApplicants.filter((a) => a.worker_profile_id === assignedId);
    return [...chosen, ...rankedApplicants.filter((a) => a.worker_profile_id !== assignedId)];
  }, [rankedApplicants, assignedId]);
  const shownCandidates = useMemo(() => {
    if (!assignedId) return candidates;
    const chosen = candidates.filter((c) => c.profile_id === assignedId);
    return [...chosen, ...candidates.filter((c) => c.profile_id !== assignedId)];
  }, [candidates, assignedId]);
  /** Atenuado de los que no fueron elegidos, una vez asignado alguien. */
  function settle(profileId: string) {
    const dimmed = assignedId !== null && assignedId !== profileId;
    return { opacity: dimmed ? 0.35 : 1, scale: dimmed && !reducedMotion ? 0.97 : 1 };
  }
  const { keyFor, clear: clearIdempotencyKey } = useIdempotencyKeys();

  const load = useCallback(({ silent = false }: { silent?: boolean } = {}) => {
    reloadApps({ silent });
    reloadCands({ silent });
    // Aparte de la carga principal: si falla, la pantalla igual funciona sin
    // el resumen del turno de arriba (era información nueva agregada acá, no
    // el contenido central de esta pantalla).
    if (token) api.get<Shift>(`/shifts/${shiftId}`, token).then(setShift).catch(() => {});
  }, [reloadApps, reloadCands, token, shiftId]);

  useEffect(() => {
    load();
  }, [load]);

  // Al día con los avisos (G1, U014): llega una postulación nueva, o se cae el
  // turno, y la lista se actualiza sola. En pausa mientras se asigna.
  useLiveRefresh(load, {
    paused: loadingApps || loadingCands || assigning !== null || assignedId !== null,
  });

  async function assign(profileId: string) {
    if (!token) return;
    setAssigning(profileId);
    try {
      // Idempotencia (product/IDEMPOTENCIA_SPEC.md): mismo intento (mismo
      // turno+candidato) reusa la key hasta que la asignación termine bien.
      const attemptKey = `${shiftId}:${profileId}`;
      await api.post(
        `/shifts/${shiftId}/assign`,
        { worker_profile_id: profileId },
        token,
        undefined,
        keyFor(attemptKey)
      );
      clearIdempotencyKey(attemptKey);
      toast("Turno asignado. El trabajador tiene que confirmar");
      setAssignedId(profileId);
      leaveTimer.current = setTimeout(() => router.push("/shifts"), reducedMotion ? 0 : 1100);
    } catch (err) {
      toast(getErrorMessage(err, "No se pudo asignar"), "error");
      setAssigning(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-6 md:max-w-6xl">
      <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">Candidatos</h1>
      <p className="mt-0.5 text-sm text-ink/50">
        Elegí a quién asignarle el turno. Los postulantes ya levantaron la mano.
      </p>

      {/* Recordatorio de PARA QUÉ turno son estos candidatos: un comercio con
          varios turnos abiertos podía llegar acá (desde el panel, un link
          del asistente de IA, o el próximo-paso de publicar) sin ninguna
          referencia de puesto/horario/pago en la pantalla. Mismo endpoint
          que ya usa "Duplicar turno" (`GET /shifts/{id}`) — no hace falta
          nada nuevo del backend. */}
      {shift && (
        <div className="mt-4 flex items-center gap-3 rounded-[var(--radius-card)] bg-card p-3.5 shadow-[var(--shadow-soft)] ring-1 ring-line">
          {(() => {
            // Mismo tono por rubro que el banner de las tarjetas de turno
            // (SKILL_HERO_TONE) — el tinte pálido de antes quedaba como un
            // cuadro claro en el modo oscuro.
            const { Icon } = SKILL_ACCENT[shift.position];
            return (
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${heroTile(shift.position)}`}
              >
                <Icon size={20} />
              </span>
            );
          })()}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-medium text-ink">{SKILL_LABELS[shift.position]}</p>
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-ink/55">
              <ClockIcon size={13} className="shrink-0 text-ink/35" />
              {formatShiftWhen(shift.start_at, shift.end_at)}
              {(() => {
                const minutes = shiftDurationMinutes(shift.start_at, shift.end_at);
                return minutes != null ? ` · ${formatDuration(minutes)}` : "";
              })()}
            </p>
          </div>
          <p className="shrink-0 text-right text-lg font-extrabold text-ink">{formatPayAmount(shift)}</p>
        </div>
      )}

      <div className="mt-4">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: "postulantes", label: `Postulantes${applicants.length > 0 ? ` (${applicants.length})` : ""}` },
            { value: "recomendados", label: `Recomendados${candidates.length > 0 ? ` (${candidates.length})` : ""}` },
          ]}
        />
      </div>

      {tab === "postulantes" && loadingApps && <CardSkeletons />}
      {tab === "recomendados" && loadingCands && <CardSkeletons />}

      {/* El aviso de postulantes va en las dos pestañas: es la lista principal
          y el error no puede quedar escondido tras la otra pestaña. */}
      {!loadingApps && appsError && (
        <ErrorBanner
          message={
            applicants.length > 0
              ? "No pudimos actualizar los postulantes. Te mostramos los que ya habían cargado."
              : "No pudimos cargar los postulantes. Reintentá en un momento."
          }
          onRetry={() => reloadApps()}
        />
      )}
      {tab === "recomendados" && !loadingCands && candsError && (
        <ErrorBanner
          message={
            candidates.length > 0
              ? "No pudimos actualizar los recomendados. Te mostramos los que ya habían cargado."
              : "No pudimos cargar los recomendados. Reintentá en un momento."
          }
          onRetry={() => reloadCands()}
        />
      )}
      {tab === "postulantes" && !loadingCands && candsError && (
        <p role="status" className="mt-3 text-xs text-ink/60">
          No pudimos cargar los recomendados.{" "}
          <button
            type="button"
            onClick={() => reloadCands()}
            className="font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Reintentar
          </button>
        </p>
      )}

      {tab === "postulantes" && !loadingApps && (!appsError || applicants.length > 0) && (
        <div className="mt-5">
          {applicants.length === 0 ? (
            <EmptyState
              icon={<UsersIcon size={28} />}
              title="Todavía nadie se postuló"
              subtitle="Cuando un trabajador se postule a tu turno, aparece acá. Mientras tanto, mirá los recomendados."
            />
          ) : (
            <>
              {/* Ordenados para decidir rápido (`rankApplicants`): primero
                  quien ya tiene turnos hechos, después por calificación y
                  puntualidad. El mejor, si tiene historial que lo respalde, va
                  destacado en verde bosque con el único "Asignar" primario de
                  la pantalla — mismo criterio que la tarjeta "Recomendado por
                  Oído" de la otra pestaña: UNA acción principal, no tres
                  empatadas. La Garantía va DESPUÉS de la lista: antes ocupaba
                  la mitad de la pantalla antes del primer postulante. */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {shownApplicants.map((a) => {
                  const top = standout?.application_id === a.application_id;
                  return (
                    <motion.div
                      key={a.application_id}
                      layout={!reducedMotion}
                      animate={settle(a.worker_profile_id)}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      // `.no-select`: fila de chrome (rating, chips), mismo criterio
                      // C0 #2 que ShiftCard/CandidateCard.
                      className={`no-select relative min-w-0 rounded-[var(--radius-card)] p-4 ${
                        top
                          ? "bg-secondary shadow-[var(--shadow-float)]"
                          : "bg-card shadow-[var(--shadow-soft)] ring-1 ring-line"
                      }`}
                    >
                      {top && (
                        <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-on-brand-label">
                          <StarIcon size={13} filled /> Mejor valorado
                        </p>
                      )}
                      <div className="flex items-center gap-3">
                        <Link href={`/workers/${a.worker_profile_id}`}>
                          <Avatar src={a.photo_url} name={a.full_name} size="lg" />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Link
                              href={`/workers/${a.worker_profile_id}`}
                              className={`min-w-0 truncate font-semibold ${top ? "text-on-brand" : "text-ink"}`}
                            >
                              {a.full_name}
                            </Link>
                            {a.is_available && !top && <Badge tone="secondary">Disponible</Badge>}
                          </div>
                          {/* Mismo sello que en «Recomendados» (`CandidateCard`). */}
                          {a.identidad_verificada && (
                            // Desde 390 px el chip entero; de 360 a 389 px
                            // «Verificada»; por debajo, sólo el escudo.
                            <IdentityVerifiedBadge verified responsive className="mt-1 block" />
                          )}
                          <CandidateStatChips signals={a} className="mt-1" onDark={top} />
                        </div>
                        <Button
                          size="sm"
                          variant={top || !standout ? "primary" : "surface"}
                          onClick={() => assign(a.worker_profile_id)}
                          loading={assigning === a.worker_profile_id}
                          disabled={assigning !== null}
                        >
                          Asignar
                        </Button>
                      </div>
                      {assignedId === a.worker_profile_id && <ConfirmOverlay label="Asignado" detail={a.full_name} />}
                    </motion.div>
                  );
                })}
              </div>
              <div className="mt-4">
                <GuaranteeCard />
              </div>
            </>
          )}
        </div>
      )}

      {tab === "recomendados" && !loadingCands && (!candsError || candidates.length > 0) && (
        <div className="mt-5">
          {candidates.length === 0 ? (
            <EmptyState
              icon={<UsersIcon size={28} />}
              title="Sin recomendados por ahora"
              subtitle="El sistema sigue buscando trabajadores disponibles para este turno en tiempo real."
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {shownCandidates.map((candidate) => (
                  <motion.div
                    key={candidate.profile_id}
                    layout={!reducedMotion}
                    animate={settle(candidate.profile_id)}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="relative min-w-0 rounded-[var(--radius-card)]"
                  >
                    <CandidateCard
                      candidate={candidate}
                      recommended={candidate.profile_id === candidates[0]?.profile_id}
                      disabled={assigning !== null}
                      onAssign={() => assign(candidate.profile_id)}
                    />
                    {assignedId === candidate.profile_id && (
                      <ConfirmOverlay label="Asignado" detail={candidate.full_name} />
                    )}
                  </motion.div>
                ))}
              </div>
              <div className="mt-4">
                <GuaranteeCard />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ShiftCandidatesPage() {
  return (
    <Suspense fallback={null}>
      <ShiftCandidatesContent />
    </Suspense>
  );
}
