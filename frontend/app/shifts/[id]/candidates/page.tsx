"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { Applicant, CandidateMatch, SKILL_LABELS, Shift } from "@/lib/types";
import { SKILL_ACCENT, SKILL_HERO_TONE } from "@/lib/skill-style";
import { formatDuration, formatShiftWhen, shiftDurationMinutes } from "@/lib/datetime";
import { formatPayAmount } from "@/lib/pay";
import { rankApplicants, standoutApplicant } from "@/lib/applicants";
import CandidateCard from "@/components/CandidateCard";
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
import { ClockIcon, StarIcon, UsersIcon } from "@/components/icons";

type Tab = "postulantes" | "recomendados";

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
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const rankedApplicants = useMemo(() => rankApplicants(applicants), [applicants]);
  const standout = standoutApplicant(rankedApplicants);
  const [candidates, setCandidates] = useState<CandidateMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [apps, cands] = await Promise.all([
        api.get<Applicant[]>(`/applications/shifts/${shiftId}`, token).catch(() => []),
        api.get<CandidateMatch[]>(`/shifts/${shiftId}/candidates`, token).catch(() => []),
      ]);
      setApplicants(apps);
      setCandidates(cands);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "Error al cargar candidatos"));
    } finally {
      setLoading(false);
    }
    // Aparte de la carga principal: si falla, la pantalla igual funciona sin
    // el resumen del turno de arriba (era información nueva agregada acá, no
    // el contenido central de esta pantalla).
    api.get<Shift>(`/shifts/${shiftId}`, token).then(setShift).catch(() => {});
  }, [token, shiftId]);

  useEffect(() => {
    load();
  }, [load]);

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
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${SKILL_HERO_TONE[shift.position]}`}
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

      {loading && <CardSkeletons />}
      {error && <ErrorBanner message={error} onRetry={load} />}

      {!loading && !error && tab === "postulantes" && (
        <div className="mt-5">
          {applicants.length === 0 ? (
            <EmptyState
              icon={<UsersIcon size={28} />}
              title="Todavía nadie se postuló"
              subtitle="Cuando un trabajador deslice tu turno a la derecha, aparece acá. Mientras tanto, mirá los recomendados."
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
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                      className={`no-select relative rounded-[var(--radius-card)] p-4 ${
                        top
                          ? "bg-secondary shadow-[var(--shadow-float)]"
                          : "bg-card shadow-[var(--shadow-soft)] ring-1 ring-line"
                      }`}
                    >
                      {top && (
                        <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-primary">
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
                              className={`truncate font-semibold ${top ? "text-white" : "text-ink"}`}
                            >
                              {a.full_name}
                            </Link>
                            {a.is_available && !top && <Badge tone="secondary">Disponible</Badge>}
                          </div>
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

      {!loading && !error && tab === "recomendados" && (
        <div className="mt-5">
          {candidates.length === 0 ? (
            <EmptyState
              icon={<UsersIcon size={28} />}
              title="Sin recomendados por ahora"
              subtitle="El sistema sigue buscando trabajadores disponibles para este turno en tiempo real."
            />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {shownCandidates.map((candidate) => (
                  <motion.div
                    key={candidate.profile_id}
                    layout={!reducedMotion}
                    animate={settle(candidate.profile_id)}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="relative rounded-[var(--radius-card)]"
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
