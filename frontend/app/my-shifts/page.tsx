"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { Shift, ShiftApplication } from "@/lib/types";
import { getCurrentPosition } from "@/lib/geolocation";
import ShiftCard from "@/components/ShiftCard";
import ShareShiftButton from "@/components/ShareShiftButton";
import ReviewBox from "@/components/ReviewBox";
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
  BriefcaseIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  MapPinIcon,
  MessageIcon,
} from "@/components/icons";

type Tab = "asignados" | "postulaciones";

const APPLICATION_LABELS: Record<string, string> = {
  pendiente: "Postulado · esperando respuesta",
  aceptada: "¡Te eligieron!",
  rechazada: "No quedaste esta vez",
  retirada: "Retiraste la postulación",
};

export default function MatchesPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("asignados");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [applications, setApplications] = useState<ShiftApplication[]>([]);
  const [appShifts, setAppShifts] = useState<Record<string, Shift>>({});
  const [error, setError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [lastGeoAction, setLastGeoAction] = useState<{ id: string; path: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [confirmWithdrawId, setConfirmWithdrawId] = useState<string | null>(null);
  const { keyFor, clear: clearIdempotencyKey } = useIdempotencyKeys();

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [assigned, apps] = await Promise.all([
        api.get<Shift[]>("/shifts/mine", token),
        api.get<ShiftApplication[]>("/applications/mine", token).catch(() => []),
      ]);
      setShifts(assigned);
      setApplications(apps);
      // El turno ya viene embebido en cada postulación (campo `shift`): un solo
      // GET /applications/mine, sin el N+1 de un GET /shifts/{id} por
      // postulación (cada uno pagando el round-trip a la base remota).
      const resolved: Record<string, Shift> = {};
      for (const a of apps) {
        if (a.shift) resolved[a.shift_id] = a.shift;
      }
      setAppShifts(resolved);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "Error al cargar tus matches"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, path: string, geo = false) {
    if (!token) return;
    const key = `${id}:${path}`;
    setBusy(key);
    if (geo) {
      setGeoError(null);
      setLastGeoAction({ id, path });
    }
    try {
      let body: { latitude: number; longitude: number } | undefined;
      if (geo) {
        // La geolocalización tiene sus propios mensajes en español (ver
        // lib/geolocation.ts): los conservamos tal cual, sin pasarlos por
        // getErrorMessage (que los pisaría con el genérico de red). El busy
        // sigue activo mientras esperamos getCurrentPosition() para evitar
        // un doble-tap durante esos segundos.
        try {
          body = await getCurrentPosition();
        } catch (err) {
          setGeoError(err instanceof Error ? err.message : "No pudimos acceder a tu ubicación.");
          return;
        }
      }
      // Idempotencia (product/IDEMPOTENCIA_SPEC.md): mismo intento (mismo
      // turno+acción) = misma key mientras no haya terminado bien.
      await api.post(`/shifts/${id}/${path}`, body, token, undefined, keyFor(key));
      clearIdempotencyKey(key);
      if (geo) setLastGeoAction(null);
      await load();
    } catch (err) {
      const msg = getErrorMessage(err, "No se pudo completar la acción");
      if (geo) setGeoError(msg);
      else toast(msg, "error");
    } finally {
      setBusy(null);
    }
  }

  async function withdrawApplication(applicationId: string) {
    if (!token) return;
    setConfirmWithdrawId(null);
    setWithdrawing(applicationId);
    const previous = applications;
    // Optimista: la sacamos de la lista ya (el usuario no espera al servidor
    // para dejar de ver la postulación que acaba de cancelar).
    setApplications((prev) => prev.filter((a) => a.id !== applicationId));
    try {
      await api.post(`/applications/${applicationId}/withdraw`, undefined, token);
      toast("Cancelaste tu postulación");
    } catch (err) {
      setApplications(previous); // revertir: no se pudo cancelar de verdad
      toast(getErrorMessage(err, "No se pudo cancelar la postulación"), "error");
    } finally {
      setWithdrawing(null);
    }
  }

  // Postulaciones pendientes: las que todavía no se volvieron un turno asignado.
  const pending = applications.filter((a) => a.status === "pendiente");

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-6 md:max-w-6xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Matches</h1>
      <p className="mt-0.5 text-sm text-ink/50">Tus turnos asignados y tus postulaciones.</p>

      <div className="mt-4">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: "asignados", label: `Asignados${shifts.length > 0 ? ` (${shifts.length})` : ""}` },
            { value: "postulaciones", label: `Postulaciones${pending.length > 0 ? ` (${pending.length})` : ""}` },
          ]}
        />
      </div>

      {loading && <CardSkeletons />}
      {error && <ErrorBanner message={error} onRetry={load} />}
      {geoError && (
        <ErrorBanner
          message={geoError}
          onRetry={
            lastGeoAction ? () => act(lastGeoAction.id, lastGeoAction.path, true) : undefined
          }
        />
      )}

      {!loading && !error && tab === "asignados" && (
        <div className="mt-5">
          {shifts.length === 0 ? (
            <EmptyState
              icon={<BriefcaseIcon size={28} />}
              title="Todavía no tenés turnos asignados"
              subtitle="Cuando un comercio te elija de entre los postulantes, el turno aparece acá."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shifts.map((shift) => (
              <ShiftCard key={shift.id} shift={shift} perspective="worker">
                {shift.status !== "cancelado" && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    <Link
                      href={`/chats/${shift.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-semibold text-ink/70 ring-1 ring-line"
                    >
                      <MessageIcon size={16} /> Chatear
                    </Link>
                  </div>
                )}
                {shift.status === "asignado" && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => act(shift.id, "confirm")}
                      loading={busy === `${shift.id}:confirm`}
                      disabled={busy !== null}
                    >
                      Confirmar
                    </Button>
                    <Button
                      size="sm"
                      variant="surface"
                      onClick={() => act(shift.id, "reject")}
                      loading={busy === `${shift.id}:reject`}
                      disabled={busy !== null}
                    >
                      Rechazar
                    </Button>
                  </div>
                )}
                {shift.status === "confirmado" && (
                  <div className="flex flex-wrap gap-2">
                    {/* ADR-0008: antes eran 4 toques (salir → llegada →
                        empezar a trabajar → salida) — el paso "Salir hacia
                        el turno" no sumaba nada real y bajaba la adhesión
                        (gente que sí llegaba pero se olvidaba de tocarlo).
                        "Llegué" marca la ubicación real directo. */}
                    <Button
                      size="sm"
                      onClick={() => act(shift.id, "check-in", true)}
                      leftIcon={<MapPinIcon size={16} />}
                      loading={busy === `${shift.id}:check-in`}
                      disabled={busy !== null}
                    >
                      Llegué
                    </Button>
                    <Button
                      size="sm"
                      variant="surface"
                      onClick={() => act(shift.id, "worker-cancel")}
                      leftIcon={<CloseIcon size={16} />}
                      loading={busy === `${shift.id}:worker-cancel`}
                      disabled={busy !== null}
                    >
                      Cancelar mi asignación
                    </Button>
                  </div>
                )}
                {/* Legacy (ADR-0008): turnos que ya estaban "en camino" al
                    desplegar el cambio siguen pudiendo marcar llegada acá —
                    ya no es un paso que se ofrezca de entrada. */}
                {shift.status === "en_camino" && (
                  <Button
                    size="sm"
                    onClick={() => act(shift.id, "check-in", true)}
                    leftIcon={<MapPinIcon size={16} />}
                    loading={busy === `${shift.id}:check-in`}
                    disabled={busy !== null}
                  >
                    Marcar llegada
                  </Button>
                )}
                {shift.status === "check_in" && (
                  <Button
                    size="sm"
                    onClick={() => act(shift.id, "check-out", true)}
                    leftIcon={<MapPinIcon size={16} />}
                    loading={busy === `${shift.id}:check-out`}
                    disabled={busy !== null}
                  >
                    Me fui
                  </Button>
                )}
                {/* Legacy (ADR-0008): idem, para turnos ya en "trabajando". */}
                {shift.status === "trabajando" && (
                  <Button
                    size="sm"
                    onClick={() => act(shift.id, "check-out", true)}
                    leftIcon={<MapPinIcon size={16} />}
                    loading={busy === `${shift.id}:check-out`}
                    disabled={busy !== null}
                  >
                    Marcar salida
                  </Button>
                )}
                {shift.status === "check_out" && (
                  <p className="text-sm text-ink/50">Esperando que el comercio cierre el turno.</p>
                )}
                {(shift.status === "finalizado" || shift.status === "pagado") && (
                  <div className="flex flex-col gap-2">
                    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-success-text">
                      <CheckIcon size={16} /> {shift.status === "pagado" ? "Turno pagado" : "Turno finalizado"}
                    </p>
                    <ReviewBox shiftId={shift.id} />
                  </div>
                )}
              </ShiftCard>
            ))}
            </div>
          )}
        </div>
      )}

      {!loading && !error && tab === "postulaciones" && (
        <div className="mt-5">
          {pending.length === 0 ? (
            <EmptyState
              icon={<ClockIcon size={28} />}
              title="No tenés postulaciones activas"
              subtitle="Deslizá turnos a la derecha en Inicio para postularte. Acá vas a seguir su estado."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pending.map((application) => {
              const shift = appShifts[application.shift_id];
              if (!shift) return null;
              return (
                <ShiftCard key={application.id} shift={shift} perspective="worker">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-semibold text-primary-text">
                      <ClockIcon size={15} /> {APPLICATION_LABELS[application.status]}
                    </p>
                    {/* Compartir a un colega: este turno sigue abierto, pasarlo
                        por WhatsApp suma gente a la plataforma (mismas piezas
                        que el feed y la página pública). */}
                    <ShareShiftButton shift={shift} shiftId={shift.id} />
                    <Button
                      size="sm"
                      variant="surface"
                      leftIcon={<CloseIcon size={16} />}
                      onClick={() => setConfirmWithdrawId(application.id)}
                      loading={withdrawing === application.id}
                      disabled={withdrawing !== null}
                    >
                      Cancelar postulación
                    </Button>
                  </div>
                </ShiftCard>
              );
            })}
            </div>
          )}
        </div>
      )}

      <Modal
        open={confirmWithdrawId !== null}
        onClose={() => setConfirmWithdrawId(null)}
        title="¿Cancelar tu postulación?"
      >
        <p className="text-sm text-ink/60">
          El comercio ya no te va a ver como candidato para este turno. Si
          sigue abierto, podés volver a postularte más adelante.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="surface" size="sm" onClick={() => setConfirmWithdrawId(null)}>
            Volver
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => confirmWithdrawId && withdrawApplication(confirmWithdrawId)}
          >
            Sí, cancelar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
