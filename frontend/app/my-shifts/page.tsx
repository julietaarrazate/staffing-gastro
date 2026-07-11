"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { Shift, ShiftApplication } from "@/lib/types";
import { getCurrentPosition } from "@/lib/geolocation";
import ShiftCard from "@/components/ShiftCard";
import ReviewBox from "@/components/ReviewBox";
import {
  Button,
  CardSkeletons,
  EmptyState,
  ErrorBanner,
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
  PlayIcon,
  RouteIcon,
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
      // Resuelve el detalle de cada turno postulado (para mostrar la tarjeta).
      const entries = await Promise.all(
        apps.map(async (a) => {
          try {
            return [a.shift_id, await api.get<Shift>(`/shifts/${a.shift_id}`, token)] as const;
          } catch {
            return null;
          }
        })
      );
      setAppShifts(Object.fromEntries(entries.filter((e): e is [string, Shift] => e !== null)));
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
      await api.post(`/shifts/${id}/${path}`, body, token);
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

  // Postulaciones pendientes: las que todavía no se volvieron un turno asignado.
  const pending = applications.filter((a) => a.status === "pendiente");

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">Matches</h1>
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
        <div className="mt-5 grid gap-4">
          {shifts.length === 0 ? (
            <EmptyState
              icon={<BriefcaseIcon size={28} />}
              title="Todavía no tenés turnos asignados"
              subtitle="Cuando un comercio te elija de entre los postulantes, el turno aparece acá."
            />
          ) : (
            shifts.map((shift) => (
              <ShiftCard key={shift.id} shift={shift}>
                {shift.status !== "cancelado" && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    <Link
                      href={`/chats/${shift.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200"
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
                    <Button
                      size="sm"
                      onClick={() => act(shift.id, "depart")}
                      leftIcon={<RouteIcon size={16} />}
                      loading={busy === `${shift.id}:depart`}
                      disabled={busy !== null}
                    >
                      Salir hacia el turno
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
                    variant="secondary"
                    onClick={() => act(shift.id, "start-working")}
                    leftIcon={<PlayIcon size={15} />}
                    loading={busy === `${shift.id}:start-working`}
                    disabled={busy !== null}
                  >
                    Empezar a trabajar
                  </Button>
                )}
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
                  <p className="text-sm text-zinc-500">Esperando que el comercio cierre el turno.</p>
                )}
                {(shift.status === "finalizado" || shift.status === "pagado") && (
                  <div className="flex flex-col gap-2">
                    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary">
                      <CheckIcon size={16} /> {shift.status === "pagado" ? "Turno pagado" : "Turno finalizado"}
                    </p>
                    <ReviewBox shiftId={shift.id} />
                  </div>
                )}
              </ShiftCard>
            ))
          )}
        </div>
      )}

      {!loading && !error && tab === "postulaciones" && (
        <div className="mt-5 grid gap-4">
          {pending.length === 0 ? (
            <EmptyState
              icon={<ClockIcon size={28} />}
              title="No tenés postulaciones activas"
              subtitle="Deslizá turnos a la derecha en Inicio para postularte. Acá vas a seguir su estado."
            />
          ) : (
            pending.map((application) => {
              const shift = appShifts[application.shift_id];
              if (!shift) return null;
              return (
                <ShiftCard key={application.id} shift={shift}>
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-semibold text-primary">
                    <ClockIcon size={15} /> {APPLICATION_LABELS[application.status]}
                  </p>
                </ShiftCard>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
