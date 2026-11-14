"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveRefresh } from "@/lib/live-refresh";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { useTapGuard } from "@/lib/use-tap-guard";
import { formatShiftStartPhrase } from "@/lib/datetime";
import { Shift, ShiftApplication, WorkerProfile } from "@/lib/types";
import { getCurrentPosition } from "@/lib/geolocation";
import {
  getStoredLocation,
  originFor,
  type CurrentLocation,
} from "@/lib/current-location";
import ShiftCard from "@/components/ShiftCard";
import ShareShiftButton from "@/components/ShareShiftButton";
import ReviewBox from "@/components/ReviewBox";
import CompareShiftsModal from "@/components/worker/CompareShiftsModal";
import EnRouteToggle from "@/components/worker/EnRouteToggle";
import { ShiftCoveredIllustration } from "@/components/illustrations";
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
  BookmarkIcon,
  BriefcaseIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  MapPinIcon,
  MessageIcon,
  ScaleIcon,
} from "@/components/icons";

type Tab = "asignados" | "postulaciones" | "guardados";

// Tres columnas es lo que entra legible en el modal comparador sin achicar
// el texto de más — un cuarto turno pisaría la utilidad de comparar rápido.
const MAX_COMPARE = 3;

const APPLICATION_LABELS: Record<string, string> = {
  pendiente: "Postulado · esperando respuesta",
  aceptada: "¡Te eligieron!",
  rechazada: "No quedaste esta vez",
  retirada: "Retiraste la postulación",
};

const CONFIRM_COPY = {
  reject: { title: "¿Rechazar este turno?", yes: "Sí, rechazar" },
  "worker-cancel": { title: "¿Cancelar tu asignación?", yes: "Sí, cancelar" },
  "check-out": { title: "¿Marcar tu salida?", yes: "Sí, me fui" },
} as const;

// La consecuencia en una línea (docs/reference/REPUTATION.md: sólo cancelar
// una asignación ya confirmada suma una cancelación; rechazar antes de
// confirmar no).
function confirmCopy(path: "reject" | "worker-cancel" | "check-out"): string {
  if (path === "reject") return "El comercio va a buscar a otra persona para este turno.";
  if (path === "check-out") return "Das el turno por terminado. No se puede deshacer.";
  return "El comercio va a buscar a otra persona y esto cuenta como una cancelación en tu reputación.";
}

export default function MatchesPage() {
  const { token } = useRequireAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("asignados");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [applications, setApplications] = useState<ShiftApplication[]>([]);
  const [appShifts, setAppShifts] = useState<Record<string, Shift>>({});
  // Turnos guardados (pedido de Julieta: "guardar turnos ordenados por
  // fecha" — el backend ya los devuelve ordenados por fecha del turno, ver
  // `SavedShiftService.list_my_saved_shifts`).
  const [savedShifts, setSavedShifts] = useState<Shift[]>([]);
  // Comparador (evolución de "guardados": pedido original de Julieta era
  // "empezar a evaluar opciones que convengan" — una lista sola no
  // compara). Mismo origen que el feed para la distancia: perfil o "estoy
  // acá ahora", ver lib/current-location.ts.
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [here, setHere] = useState<CurrentLocation | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [lastGeoAction, setLastGeoAction] = useState<{ id: string; path: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [unsaving, setUnsaving] = useState<string | null>(null);
  const [applyingSaved, setApplyingSaved] = useState<string | null>(null);
  const [confirmWithdrawId, setConfirmWithdrawId] = useState<string | null>(null);
  // "Turno cubierto" (ART_DIRECTION.md §10.4): confirmar un turno asignado
  // antes no daba ningún feedback de éxito (ni toast) — se recargaba la
  // lista en silencio. Julieta: "seguí por ahí" con las 2 ilustraciones que
  // faltaban del set.
  const [justConfirmedId, setJustConfirmedId] = useState<string | null>(null);
  // Acción del trabajador que pide confirmación antes de mandarse (no tiene
  // vuelta atrás): rechazar, cancelar la asignación, marcar la salida.
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    path: "reject" | "worker-cancel" | "check-out";
  } | null>(null);
  // Último contenido del diálogo: se conserva mientras se anima el cierre.
  const [lastConfirmPath, setLastConfirmPath] = useState<"reject" | "worker-cancel" | "check-out">(
    "reject"
  );
  // Reloj para saber si el turno ya empezó ("Me fui" recién desde ahí).
  const [now, setNow] = useState(() => new Date());
  const { keyFor, clear: clearIdempotencyKey } = useIdempotencyKeys();
  // Un toque que cae sobre un botón recién aparecido no cuenta (U004): tras
  // "Llegué" la lista se redibuja y "Me fui" queda justo bajo el dedo.
  const tapGuard = useTapGuard();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  function pedirConfirmacion(id: string, path: "reject" | "worker-cancel" | "check-out") {
    void tapGuard.run(() => {
      setLastConfirmPath(path);
      setConfirmAction({ id, path });
    });
  }

  useEffect(() => setHere(getStoredLocation()), []);

  const latestLoad = useRef(0);
  // `silent` (recarga por un aviso, ver `lib/live-refresh.ts`): sin esqueleto
  // de carga y sin pisar lo que se ve con un error pasajero.
  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!token) return;
    // Último pedido gana: una respuesta vieja (una carga normal, o la de
    // `act()`, cruzada con una silenciosa) no pisa a la más nueva.
    const mine = ++latestLoad.current;
    if (!silent) setLoading(true);
    try {
      const [assigned, apps, saved, prof] = await Promise.all([
        api.get<Shift[]>("/shifts/mine", token),
        api.get<ShiftApplication[]>("/applications/mine", token).catch(() => []),
        api.get<Shift[]>("/saved-shifts", token).catch(() => []),
        api.get<WorkerProfile>("/workers/me/profile", token).catch(() => null),
      ]);
      if (mine !== latestLoad.current) return;
      setShifts(assigned);
      setApplications(apps);
      setSavedShifts(saved);
      setProfile(prof);
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
      if (mine === latestLoad.current && !silent) {
        setError(getErrorMessage(err, "Error al cargar tus matches"));
      }
    } finally {
      if (mine === latestLoad.current) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Al día con los avisos (G1, U014): el comercio cancela y «Llegué» deja de
  // ofrecerse sin tener que recargar. En pausa con una acción en curso o un
  // diálogo abierto, para no pisar una baja optimista ni lo que se decide.
  // También en pausa mientras corre una carga normal: una silenciosa la pisaría
  // por la guarda de «último pedido gana» y, si fallara sin avisar, la pantalla
  // quedaría sin su error ni «Reintentar».
  useLiveRefresh(load, {
    paused:
      loading ||
      busy !== null ||
      withdrawing !== null ||
      unsaving !== null ||
      applyingSaved !== null ||
      tapGuard.locked ||
      confirmWithdrawId !== null ||
      confirmAction !== null ||
      justConfirmedId !== null ||
      compareOpen,
  });

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
      if (path === "confirm") setJustConfirmedId(id);
      await load();
    } catch (err) {
      const msg = getErrorMessage(err, "No se pudo completar la acción");
      if (geo) setGeoError(msg);
      else toast(msg, "error");
      // También al fallar: el turno pudo cambiar (el comercio lo canceló, ya
      // estaba confirmado) y la pantalla no puede seguir ofreciendo el botón.
      // Silenciosa: sin esqueleto, y si falla no pisa el aviso de arriba.
      await load({ silent: true });
    } finally {
      setBusy(null);
    }
  }

  // Un pedido de retiro a la vez: el segundo toque del mismo botón (o el de
  // otro retiro) no manda otro pedido mientras el primero está en curso.
  const withdrawingRef = useRef(false);

  async function withdrawApplication(applicationId: string) {
    if (!token || withdrawingRef.current) return;
    withdrawingRef.current = true;
    setConfirmWithdrawId(null);
    setWithdrawing(applicationId);
    const removedAt = applications.findIndex((a) => a.id === applicationId);
    const removed = applications[removedAt];
    // Optimista: la sacamos de la lista ya (el usuario no espera al servidor
    // para dejar de ver la postulación que acaba de cancelar).
    setApplications((prev) => prev.filter((a) => a.id !== applicationId));
    try {
      await api.post(`/applications/${applicationId}/withdraw`, undefined, token);
      toast("Cancelaste tu postulación");
    } catch (err) {
      const yaNoEstaPendiente = err instanceof ApiError && (err.status === 400 || err.status === 404);
      if (yaNoEstaPendiente) {
        // Ya estaba retirada (o decidida): volver a mostrarla sería mentir.
        // La lista se pone al día con lo que dice el servidor.
        void load({ silent: true });
      } else if (removed) {
        // No se pudo cancelar de verdad: vuelve a su lugar (mismo índice), sin pisar otros
        // cambios de la lista.
        setApplications((prev) =>
          prev.some((a) => a.id === removed.id)
            ? prev
            : [...prev.slice(0, removedAt), removed, ...prev.slice(removedAt)]
        );
      }
      toast(getErrorMessage(err, "No se pudo cancelar la postulación"), "error");
    } finally {
      withdrawingRef.current = false;
      setWithdrawing(null);
    }
  }

  async function unsaveShift(shiftId: string) {
    if (!token) return;
    setUnsaving(shiftId);
    const previous = savedShifts;
    // Optimista: mismo criterio que `withdrawApplication` arriba.
    setSavedShifts((prev) => prev.filter((s) => s.id !== shiftId));
    try {
      await api.del(`/saved-shifts/${shiftId}`, undefined, token);
    } catch (err) {
      setSavedShifts(previous); // revertir: no se pudo sacar de verdad
      toast(getErrorMessage(err, "No se pudo sacar de guardados"), "error");
    } finally {
      setUnsaving(null);
    }
  }

  function toggleCompareSelection(shiftId: string) {
    setSelectedForCompare((prev) => {
      if (prev.includes(shiftId)) return prev.filter((id) => id !== shiftId);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, shiftId];
    });
  }

  function exitCompareMode() {
    setCompareMode(false);
    setSelectedForCompare([]);
  }

  async function applyToSavedShift(shift: Shift) {
    if (!token) return;
    setApplyingSaved(shift.id);
    try {
      await api.post(
        `/applications/shifts/${shift.id}`,
        undefined,
        token,
        undefined,
        keyFor(shift.id)
      );
      clearIdempotencyKey(shift.id);
      toast("¡Te postulaste! El comercio ya te puede ver");
      // Ya avanzó de "para evaluar" a "postulado" — sale de guardados solo
      // (fire-and-forget: si falla, el trabajador lo puede sacar a mano
      // igual, no vale la pena bloquear ni avisar por esto).
      api.del(`/saved-shifts/${shift.id}`, undefined, token).catch(() => {});
      setSavedShifts((prev) => prev.filter((s) => s.id !== shift.id));
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        clearIdempotencyKey(shift.id);
        toast("Ya te habías postulado a este turno");
        setSavedShifts((prev) => prev.filter((s) => s.id !== shift.id));
        return;
      }
      toast(getErrorMessage(err, "No se pudo enviar tu postulación"), "error");
    } finally {
      setApplyingSaved(null);
    }
  }

  // Postulaciones pendientes: las que todavía no se volvieron un turno asignado.
  const pending = applications.filter((a) => a.status === "pendiente");

  const origin = originFor(here, profile);
  // En el orden en que se fueron tocando (no el orden de la lista): más
  // fácil de seguir mientras se arma la comparación.
  const compareShifts = selectedForCompare
    .map((id) => savedShifts.find((s) => s.id === id))
    .filter((s): s is Shift => s !== undefined);

  return (
    <div className="app-container px-4 pb-10 pt-6">
      <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">Matches</h1>
      <p className="mt-0.5 text-sm text-ink/50">Tus turnos asignados, postulaciones y guardados.</p>

      <div className="mt-4 -mx-4 overflow-x-auto px-4 no-scrollbar">
        <SegmentedControl
          value={tab}
          onChange={(next) => {
            setTab(next);
            exitCompareMode();
          }}
          className="min-w-[420px]"
          options={[
            { value: "asignados", label: `Asignados${shifts.length > 0 ? ` (${shifts.length})` : ""}` },
            { value: "postulaciones", label: `Postulaciones${pending.length > 0 ? ` (${pending.length})` : ""}` },
            { value: "guardados", label: `Guardados${savedShifts.length > 0 ? ` (${savedShifts.length})` : ""}` },
          ]}
        />
      </div>

      {loading && <CardSkeletons />}
      {error && <ErrorBanner message={error} onRetry={() => load()} />}
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
                      onClick={() => pedirConfirmacion(shift.id, "reject")}
                      loading={busy === `${shift.id}:reject`}
                      disabled={busy !== null || tapGuard.locked}
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
                      onClick={() => void tapGuard.run(() => act(shift.id, "check-in", true))}
                      leftIcon={<MapPinIcon size={16} />}
                      loading={busy === `${shift.id}:check-in`}
                      disabled={busy !== null || tapGuard.locked}
                    >
                      Llegué
                    </Button>
                    <Button
                      size="sm"
                      variant="surface"
                      onClick={() => pedirConfirmacion(shift.id, "worker-cancel")}
                      leftIcon={<CloseIcon size={16} />}
                      loading={busy === `${shift.id}:worker-cancel`}
                      disabled={busy !== null || tapGuard.locked}
                    >
                      Cancelar mi asignación
                    </Button>
                  </div>
                )}
                {/* "Va en camino": debajo de "Llegué" y sólo con el turno
                    confirmado. El backend además exige estar dentro de las 2h
                    previas al inicio, así que en un turno de mañana el botón
                    devuelve el error explicando desde cuándo se puede. */}
                {shift.status === "confirmado" && (
                  <EnRouteToggle shiftId={shift.id} token={token} />
                )}
                {/* Legacy (ADR-0008): turnos que ya estaban "en camino" al
                    desplegar el cambio siguen pudiendo marcar llegada acá —
                    ya no es un paso que se ofrezca de entrada. */}
                {shift.status === "en_camino" && (
                  <Button
                    size="sm"
                    onClick={() => void tapGuard.run(() => act(shift.id, "check-in", true))}
                    leftIcon={<MapPinIcon size={16} />}
                    loading={busy === `${shift.id}:check-in`}
                    disabled={busy !== null || tapGuard.locked}
                  >
                    Marcar llegada
                  </Button>
                )}
                {shift.status === "check_in" &&
                  (new Date(shift.start_at) > now ? (
                    // Llegó temprano: la salida no tiene sentido antes de
                    // que empiece el turno (el servidor también la rechaza).
                    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-success-text">
                      <CheckIcon size={16} /> Llegada marcada · el turno empieza{" "}
                      {formatShiftStartPhrase(shift.start_at, now)}
                    </p>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => pedirConfirmacion(shift.id, "check-out")}
                      leftIcon={<MapPinIcon size={16} />}
                      loading={busy === `${shift.id}:check-out`}
                      disabled={busy !== null || tapGuard.locked}
                    >
                      Me fui
                    </Button>
                  ))}
                {/* Legacy (ADR-0008): idem, para turnos ya en "trabajando". */}
                {shift.status === "trabajando" && (
                  <Button
                    size="sm"
                    onClick={() => pedirConfirmacion(shift.id, "check-out")}
                    leftIcon={<MapPinIcon size={16} />}
                    loading={busy === `${shift.id}:check-out`}
                    disabled={busy !== null || tapGuard.locked}
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
              subtitle="Postulate a un turno desde Inicio. Acá vas a seguir su estado."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pending.map((application) => {
              const shift = appShifts[application.shift_id];
              if (!shift) return null;
              return (
                <ShiftCard key={application.id} shift={shift} perspective="worker">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-3 py-1.5 text-sm font-semibold text-primary-text">
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
                      onClick={() => void tapGuard.run(() => setConfirmWithdrawId(application.id))}
                      loading={withdrawing === application.id}
                      disabled={withdrawing !== null || tapGuard.locked}
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

      {!loading && !error && tab === "guardados" && (
        <div className="mt-5 pb-16">
          {savedShifts.length === 0 ? (
            <EmptyState
              icon={<BookmarkIcon size={28} />}
              title="No tenés turnos guardados"
              subtitle="Tocá el marcador en una tarjeta de Inicio para guardarla y decidir con calma después."
            />
          ) : (
            <>
              {/* Comparador (evolución de "guardados": el pedido original de
                  Julieta era "empezar a evaluar opciones que convengan" —
                  una lista sola no compara). Sólo tiene sentido con 2+
                  turnos guardados. */}
              {savedShifts.length > 1 && (
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => (compareMode ? exitCompareMode() : setCompareMode(true))}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition active:scale-95 ${
                      compareMode
                        ? "bg-primary/10 text-primary-text ring-primary/30"
                        : "bg-card text-ink/60 ring-line hover:bg-surface"
                    }`}
                  >
                    <ScaleIcon size={14} />
                    {compareMode ? "Cancelar comparación" : "Comparar"}
                  </button>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {savedShifts.map((shift) => {
                  const selected = selectedForCompare.includes(shift.id);
                  return (
                    <div key={shift.id} className="relative">
                      {compareMode && (
                        <button
                          type="button"
                          onClick={() => toggleCompareSelection(shift.id)}
                          disabled={!selected && selectedForCompare.length >= MAX_COMPARE}
                          aria-pressed={selected}
                          aria-label={selected ? "Sacar de la comparación" : "Sumar a la comparación"}
                          className={`absolute left-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-white transition disabled:opacity-40 ${
                            selected ? "bg-primary text-night" : "bg-white/95 text-ink/40 shadow-sm"
                          }`}
                        >
                          {selected ? <CheckIcon size={14} /> : null}
                        </button>
                      )}
                      <ShiftCard shift={shift} perspective="worker" showLifecycle={false}>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => applyToSavedShift(shift)}
                            loading={applyingSaved === shift.id}
                            disabled={applyingSaved !== null || unsaving !== null}
                          >
                            Postularme
                          </Button>
                          <ShareShiftButton shift={shift} shiftId={shift.id} />
                          <Button
                            size="sm"
                            variant="surface"
                            leftIcon={<CloseIcon size={16} />}
                            onClick={() => unsaveShift(shift.id)}
                            loading={unsaving === shift.id}
                            disabled={unsaving !== null || applyingSaved !== null}
                          >
                            Quitar de guardados
                          </Button>
                        </div>
                      </ShiftCard>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Barra flotante de comparación: aparece recién con 2+ elegidos (un
          turno solo no compara contra nada). Fija sobre el bottom nav
          (z-40, mismo nivel que otros overlays flotantes de la app). */}
      {compareMode && selectedForCompare.length >= 2 && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-4">
          <Button
            leftIcon={<ScaleIcon size={16} />}
            onClick={() => setCompareOpen(true)}
            className="shadow-[var(--shadow-float)]"
          >
            Comparar ({selectedForCompare.length})
          </Button>
        </div>
      )}

      <CompareShiftsModal
        shifts={compareShifts}
        origin={origin}
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
      />

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
            disabled={tapGuard.locked || withdrawing !== null}
            onClick={() => {
              if (!confirmWithdrawId) return;
              const id = confirmWithdrawId;
              void tapGuard.run(() => withdrawApplication(id));
            }}
          >
            Sí, cancelar
          </Button>
        </div>
      </Modal>

      {/* Acciones sin vuelta atrás del trabajador (U005): misma confirmación
          que retirar una postulación. */}
      <Modal
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={CONFIRM_COPY[lastConfirmPath].title}
      >
        <p className="text-sm text-ink/60">
          {confirmCopy(lastConfirmPath)}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="surface" size="sm" onClick={() => setConfirmAction(null)}>
            Volver
          </Button>
          <Button
            variant={lastConfirmPath === "check-out" ? "primary" : "danger"}
            size="sm"
            disabled={tapGuard.locked}
            onClick={() => {
              if (!confirmAction) return;
              const { id, path } = confirmAction;
              void tapGuard.run(async () => {
                setConfirmAction(null);
                await act(id, path, path === "check-out");
              });
            }}
          >
            {CONFIRM_COPY[lastConfirmPath].yes}
          </Button>
        </div>
      </Modal>

      {/* "Turno cubierto" (ART_DIRECTION.md §10.4): antes confirmar un turno
          asignado no daba ningún feedback de éxito. */}
      <Modal open={justConfirmedId !== null} onClose={() => setJustConfirmedId(null)}>
        <div className="flex flex-col items-center text-center">
          <ShiftCoveredIllustration size={56} color="var(--color-primary)" />
          <h3 className="mt-3 text-xl font-extrabold tracking-tight text-ink">¡Turno confirmado!</h3>
          <p className="mt-1 text-sm text-ink/60">Ya estás en la lista. Nos vemos en el turno.</p>
        </div>
        <div className="mt-5">
          <Button fullWidth onClick={() => setJustConfirmedId(null)}>
            Entendido
          </Button>
        </div>
      </Modal>
    </div>
  );
}
