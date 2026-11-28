"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNow } from "@/lib/use-now";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLiveRefresh } from "@/lib/live-refresh";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { postulacionEnviada } from "@/lib/applications";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { useTapGuard } from "@/lib/use-tap-guard";
import { formatShiftStartPhrase, isTodayInArgentina } from "@/lib/datetime";
import { claveDeVista, diaEnPalabras, semanaArgentina, semanasHasta, turnosPorDia } from "@/lib/semana";
import MasAdelante, { type FilaFutura } from "@/components/MasAdelante";
import SemanaTira from "@/components/SemanaTira";
import { autoFinishWorkerNote } from "@/lib/shift-next-step";
import { SKILL_LABELS, STATUS_LABELS, Shift, ShiftApplication, WorkerProfile } from "@/lib/types";
import { formatPayCompact } from "@/lib/pay";
import { getCurrentPosition } from "@/lib/geolocation";
import {
  getStoredLocation,
  originFor,
  type CurrentLocation,
} from "@/lib/current-location";
import TurnoSuave, { CLASE_TONO, TONO_ESTADO } from "@/components/worker/TurnoSuave";
import ShareShiftButton from "@/components/ShareShiftButton";
import ReviewBox from "@/components/ReviewBox";
import CobroDeLaPersona from "@/components/CobroDeLaPersona";
import EnRouteToggle from "@/components/worker/EnRouteToggle";
import { ShiftCoveredIllustration } from "@/components/illustrations";
import dynamic from "next/dynamic";
import {
  Button,
  CardSkeletons,
  EmptyState,
  ErrorState,
  Modal,
  NubesCielo,
  SegmentedControl,
  useToast,
} from "@/components/ui";
import {
  BookmarkIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  MapPinIcon,
  MessageIcon,
  ScaleIcon,
} from "@/components/icons";

const CompareShiftsModal = dynamic(() => import("@/components/worker/CompareShiftsModal"), { ssr: false });

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

// Una postulación pendiente sólo «espera respuesta» mientras el turno sigue
// abierto (U088). Si el turno se cerró sin llegar a nadie, decirlo.
// Ventana en que el backend acepta «va en camino» (EN_ROUTE_WINDOW).
const EN_ROUTE_WINDOW_MS = 2 * 60 * 60 * 1000;
// Desde cuándo el backend deja marcar la llegada: espeja EARLY_CHECKIN_WINDOW
// (backend/app/modules/shift/domain/entities.py).
const EARLY_CHECKIN_WINDOW_MS = 30 * 60 * 1000;
const OPEN_SHIFT_STATUSES = ["publicado", "buscando_personal"];

function closedShiftLabel(status: string): string {
  if (status === "cancelado") return "El comercio canceló el turno";
  if (status === "no_cubierto") return "El turno se cerró sin cubrir";
  return "El turno ya no está abierto";
}

// Estados terminados: en «Asignados» van aparte, debajo de lo que hay que hacer (U066).
const FINISHED_STATUSES = ["finalizado", "pagado", "cancelado", "no_cubierto"];
// Ya en marcha: va en la tarjeta de hoy aunque haya empezado ayer (un turno
// de noche que cruza la medianoche).
const EN_MARCHA_STATUSES = ["en_camino", "check_in", "trabajando"];
// Lo que no es la acción de la pantalla: relleno suave y letra azul hondo
// (`.boton-quieto`, ADR-0028). El único ámbar es el de la tarjeta de hoy.
const QUIETO = "boton-quieto";

const CONFIRM_COPY = {
  reject: { title: "¿Rechazar este turno?", yes: "Sí, rechazar" },
  "worker-cancel": { title: "¿Cancelar tu asignación?", yes: "Sí, cancelar" },
  "check-out": { title: "¿Marcar tu salida?", yes: "Sí, me fui" },
} as const;

// La consecuencia en una línea (docs/reference/REPUTATION.md: cancelar una
// asignación ya confirmada suma una cancelación, salvo que se avise con 24
// horas o más; rechazar antes de confirmar no suma).
function confirmCopy(path: "reject" | "worker-cancel" | "check-out", conAviso = false): string {
  if (path === "reject") return "El comercio va a buscar a otra persona para este turno.";
  if (path === "check-out") return "Das el turno por terminado. No se puede deshacer.";
  // Avisar con tiempo no pesa (ADR-0031), hasta dos veces cada 30 días: lo
  // decide el backend (`cancel_with_notice`), que ya descuenta el tope.
  if (conAviso) {
    return "El comercio va a buscar a otra persona. Como avisás con tiempo, no suma a tus cancelaciones. Vale dos veces cada 30 días.";
  }
  return "El comercio va a buscar a otra persona. Esta cancelación suma a las cancelaciones que los comercios ven en tu perfil.";
}

export default function MatchesPage() {
  // `useSearchParams` pide Suspense en las rutas prerenderizadas.
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 pb-10 pt-6 md:max-w-5xl" />}>
      <MatchesContent />
    </Suspense>
  );
}

function MatchesContent() {
  const { token } = useRequireAuth({ roles: ["worker"] });
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("asignados");
  // La tira de días del cielo: qué semana se ve (0 = la de hoy, en pasos de
  // semanas) y, si se tocó uno, el día (clave "YYYY-MM-DD" de Argentina).
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [diaElegido, setDiaElegido] = useState<string | null>(null);
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
  // Turnos que están compartiendo «voy en camino» (decide cuál botón va ámbar).
  const [sharingIds, setSharingIds] = useState<Set<string>>(() => new Set());
  // Turno resaltado un momento al abrir con `?turno=` (recordatorios).
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const turnoHandledRef = useRef<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const turnoParam = searchParams.get("turno");
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  // El modal se baja la primera vez que se abre y queda montado para que la
  // salida se anime.
  const [compareMounted, setCompareMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Falla de una parte que no es «Asignados»: sólo degrada su propia pestaña.
  const [appsError, setAppsError] = useState(false);
  const [savedError, setSavedError] = useState(false);
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
  const nowMs = useNow(30_000);
  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const {
    keyFor,
    clear: clearIdempotencyKey,
    clearSiTermino,
    recordar,
    recordado,
  } = useIdempotencyKeys();
  // Un toque que cae sobre un botón recién aparecido no cuenta (U004): tras
  // "Llegué" la lista se redibuja y "Me fui" queda justo bajo el dedo.
  const tapGuard = useTapGuard();

  // Si cancelar ahora cuenta o no lo dice el backend; se fija al abrir el
  // cartel para que el texto no cambie mientras se cierra.
  const [lastConAviso, setLastConAviso] = useState(false);

  function pedirConfirmacion(id: string, path: "reject" | "worker-cancel" | "check-out") {
    void tapGuard.run(() => {
      setLastConfirmPath(path);
      setLastConAviso(
        path === "worker-cancel" && shifts.find((s) => s.id === id)?.cancel_with_notice === true,
      );
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
    if (!silent) {
      // Al reintentar se limpia el error: no se ven esqueletos y error juntos.
      setError(null);
      setAppsError(false);
      setSavedError(false);
      setLoading(true);
    }
    try {
      // Sólo `/shifts/mine` es imprescindible: quien tiene un turno asignado lo
      // sigue viendo aunque fallen las postulaciones o los guardados, que
      // degradan su propia pestaña (y nunca se toman por vacías).
      const [assigned, appsR, savedR, prof] = await Promise.all([
        api.get<Shift[]>("/shifts/mine", token),
        api.get<ShiftApplication[]>("/applications/mine", token).then((v) => ({ ok: true as const, v }), () => ({ ok: false as const })),
        api.get<Shift[]>("/saved-shifts", token).then((v) => ({ ok: true as const, v }), () => ({ ok: false as const })),
        api.get<WorkerProfile>("/workers/me/profile", token).catch(() => null),
      ]);
      if (mine !== latestLoad.current) return;
      // Si falló, se conserva lo que ya había (una recarga silenciosa no lo borra
      // ni levanta el aviso: el pedido de arriba ya lo dijo, si hacía falta).
      setShifts(assigned);
      setProfile(prof);
      setAppsError((prev) => (appsR.ok ? false : silent ? prev : true));
      setSavedError((prev) => (savedR.ok ? false : silent ? prev : true));
      if (savedR.ok) setSavedShifts(savedR.v);
      if (appsR.ok) {
        setApplications(appsR.v);
        // El turno ya viene embebido en cada postulación (campo `shift`): un solo
        // GET /applications/mine, sin el N+1 de un GET /shifts/{id} por
        // postulación (cada uno pagando el round-trip a la base remota).
        const resolved: Record<string, Shift> = {};
        for (const a of appsR.v) {
          if (a.shift) resolved[a.shift_id] = a.shift;
        }
        setAppShifts(resolved);
      }
      setError(null);
    } catch (err) {
      if (mine === latestLoad.current && !silent) {
        setError(getErrorMessage(err, "Error al cargar tus turnos"));
      }
    } finally {
      if (mine === latestLoad.current) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Recordatorios (`/my-shifts?turno=<id>`): con la lista ya cargada, abre
  // «Asignados» y resalta esa tarjeta (si el turno no está, no pasa nada).
  // Después saca el parámetro de la URL (sin sumar historial): una recarga no
  // vuelve a saltar y el mismo aviso funciona otra vez. Si la carga falló no
  // se da por procesado: se reintenta cuando la lista llegue.
  useEffect(() => {
    if (!turnoParam) {
      turnoHandledRef.current = null;
      return;
    }
    if (loading || error || turnoHandledRef.current === turnoParam) return;
    turnoHandledRef.current = turnoParam;
    const deAviso = shifts.find((s) => s.id === turnoParam);
    if (deAviso) {
      setTab("asignados");
      // La tarjeta tiene que estar en lo que se ve: va a su semana, sin día elegido.
      setSemanaOffset(semanasHasta(claveDeVista(deAviso, now), now));
      setDiaElegido(null);
      setHighlightId(turnoParam);
    }
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete("turno");
    const qs = rest.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [turnoParam, loading, error, shifts, now, router, pathname, searchParams]);

  // Resaltado: baja a la tarjeta (ya dibujada en «Asignados») y la deja
  // marcada 3,5 s. Su temporizador sólo se corta al cambiar de resaltado o al
  // salir: una recarga silenciosa de `shifts` no lo toca.
  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`turno-${highlightId}`);
    if (el) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    }
    const t = setTimeout(() => setHighlightId(null), 3500);
    return () => clearTimeout(t);
  }, [highlightId]);

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
    try {
      // Idempotencia (product/IDEMPOTENCIA_SPEC.md): mismo intento (mismo
      // turno+acción) = misma key mientras no haya terminado.
      const idemKey = keyFor(key);
      type Posicion = { latitude: number; longitude: number };
      let body: Posicion | undefined = geo ? recordado<Posicion>(key) : undefined;
      // En un reintento (la respuesta se perdió) se manda la posición del
      // primer intento: leer el GPS de nuevo cambia los decimales, el cuerpo
      // ya no coincide con el de la key y el servidor contesta «pedido
      // distinto» aunque la llegada sí quedó registrada (CON-01).
      if (geo && !body) {
        // La geolocalización tiene sus propios mensajes en español (ver
        // lib/geolocation.ts): los conservamos tal cual, sin pasarlos por
        // getErrorMessage (que los pisaría con el genérico de red). El busy
        // sigue activo mientras esperamos getCurrentPosition() para evitar
        // un doble-tap durante esos segundos.
        try {
          body = await getCurrentPosition();
          recordar(key, body);
        } catch (err) {
          // Para resolverlo hay que ir a los permisos del navegador: el aviso
          // queda más tiempo a la vista.
          toast(err instanceof Error ? err.message : "No pudimos acceder a tu ubicación.", "error", 8000);
          return;
        }
      }
      await api.post(`/shifts/${id}/${path}`, body, token, undefined, idemKey);
      clearIdempotencyKey(key);
      if (path === "confirm") setJustConfirmedId(id);
      if (path === "reconfirm") {
        toast("Tu disponibilidad quedó actualizada. El comercio ya puede ver tu respuesta.", "success");
      }
      await load();
    } catch (err) {
      // Un error definitivo cierra el intento; uno de red lo deja abierto
      // para que el reintento sea el mismo.
      clearSiTermino(key, err);
      toast(getErrorMessage(err, "No se pudo completar la acción"), "error");
      // También al fallar: el turno pudo cambiar (el comercio lo canceló, ya
      // estaba confirmado) y la pantalla no puede seguir ofreciendo el botón.
      // Silenciosa: sin esqueleto, y si falla no pisa el aviso.
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
    // U088: si el turno ya no se abre, «Quitar de la lista» no cancela nada
    // real: el aviso no puede decir «Cancelaste».
    const closedStatus = removed ? appShifts[removed.shift_id]?.status : undefined;
    const wasClosed = closedStatus !== undefined && !OPEN_SHIFT_STATUSES.includes(closedStatus);
    // Optimista: la sacamos de la lista ya (el usuario no espera al servidor
    // para dejar de ver la postulación que acaba de cancelar).
    setApplications((prev) => prev.filter((a) => a.id !== applicationId));
    try {
      await api.post(`/applications/${applicationId}/withdraw`, undefined, token);
      toast(wasClosed ? "Quitamos la postulación de tu lista" : "Cancelaste tu postulación");
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
      toast(getErrorMessage(err, wasClosed ? "No se pudo quitar la postulación" : "No se pudo cancelar la postulación"), "error");
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
      toast(postulacionEnviada(shift.company_name));
      // Ya avanzó de "para evaluar" a "postulado" — sale de guardados solo.
      // Si falla, el trabajador lo puede sacar a mano: no se avisa. Pero se
      // espera a que termine antes de releer: si no, la relectura le ganaba
      // al borrado y el turno recién postulado volvía a aparecer en
      // Guardados (visto como prueba intermitente en CI, 2026-11-27).
      setSavedShifts((prev) => prev.filter((s) => s.id !== shift.id));
      await api.del(`/saved-shifts/${shift.id}`, undefined, token).catch(() => {});
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        clearIdempotencyKey(shift.id);
        toast("Ya te habías postulado a este turno");
        setSavedShifts((prev) => prev.filter((s) => s.id !== shift.id));
        return;
      }
      toast(getErrorMessage(err, "No se pudo enviar tu postulación"), "error");
      // Si el turno ya se cubrió o se canceló, la lista de guardados se relee
      // para que deje de ofrecerlo (VIE-03).
      void load({ silent: true });
    } finally {
      setApplyingSaved(null);
    }
  }

  // Un solo ámbar por tarjeta, el de la acción que se puede usar ahora (el
  // backend sólo acepta «va en camino» desde 2 h antes y la llegada desde
  // 30 min antes): más de 2 h, ninguno; de 2 h a 30 min, «Voy en camino» (si
  // todavía no comparte); desde 30 min, «Llegué».
  function arrivalPhase(shift: Shift): "lejos" | "en_camino" | "llegada" {
    const faltan = new Date(shift.start_at).getTime() - now.getTime();
    if (faltan <= EARLY_CHECKIN_WINDOW_MS) return "llegada";
    if (faltan <= EN_ROUTE_WINDOW_MS) return "en_camino";
    return "lejos";
  }

  const setEnRouteSharing = useCallback((shiftId: string, on: boolean) => {
    setSharingIds((prev) => {
      if (prev.has(shiftId) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(shiftId);
      else next.delete(shiftId);
      return next;
    });
  }, []);

  function renderAssigned(shift: Shift, destacado = false) {
    const fase = arrivalPhase(shift);
    const size = destacado ? "md" : "sm";
    // Un solo ámbar por pantalla: el de la tarjeta de hoy. En una fila, la
    // misma acción va quieta.
    const accion = (activa = true) =>
      destacado && activa
        ? ({ variant: "primary", className: "flex-1" } as const)
        : ({ variant: "surface", className: destacado ? `${QUIETO} flex-1` : QUIETO } as const);
    return (
      <div
        key={shift.id}
        id={`turno-${shift.id}`}
        // El anillo del turno resaltado (`?turno=`), despegado de la tarjeta.
        className={`scroll-mt-24 transition-shadow motion-reduce:transition-none ${
          destacado ? "rounded-[24px]" : "rounded-[18px]"
        } ${highlightId === shift.id ? "ring-2 ring-primary-text ring-offset-4 ring-offset-card" : ""}`}
      >
        <TurnoSuave shift={shift} destacado={destacado}>
          <div className="flex flex-wrap gap-2">
            {shift.status !== "cancelado" && (
              <Link
                href={`/chats/${shift.id}`}
                className={`boton ${QUIETO} inline-flex items-center justify-center gap-1.5 font-semibold transition active:scale-95 ${
                  destacado ? "min-h-[48px] px-4 text-body" : "min-h-[40px] px-3 text-sm"
                }`}
              >
                <MessageIcon size={destacado ? 18 : 16} /> Chatear
              </Link>
            )}
            {shift.status === "asignado" && (
              <>
                <Button
                  size={size}
                  variant="secondary"
                  className={destacado ? "flex-1" : undefined}
                  onClick={() => act(shift.id, "confirm")}
                  loading={busy === `${shift.id}:confirm`}
                  disabled={busy !== null}
                >
                  Confirmar
                </Button>
                <Button
                  size={size}
                  variant="surface"
                  className={QUIETO}
                  onClick={() => pedirConfirmacion(shift.id, "reject")}
                  loading={busy === `${shift.id}:reject`}
                  disabled={busy !== null || tapGuard.locked}
                >
                  Rechazar
                </Button>
              </>
            )}
            {shift.status === "confirmado" && shift.reconfirmation_pending && (
              // Reconfirmación antes del turno (ADR-0031, P3): la pregunta
              // ocupa el renglón entero, arriba de las acciones de siempre.
              <div data-reconfirmar className="w-full rounded-[14px] bg-surface p-3">
                <p className="text-sm font-bold text-ink">¿Seguís disponible para este turno?</p>
                <p className="mt-0.5 text-caption text-ink-soft">
                  Indicá si mantenés tu disponibilidad para que el comercio pueda organizarse.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="surface"
                    className={QUIETO}
                    onClick={() => void tapGuard.run(() => act(shift.id, "reconfirm"))}
                    leftIcon={<CheckIcon size={16} />}
                    loading={busy === `${shift.id}:reconfirm`}
                    disabled={busy !== null || tapGuard.locked}
                  >
                    Sí, sigo disponible
                  </Button>
                  <Button
                    size="sm"
                    variant="surface"
                    className={QUIETO}
                    onClick={() => pedirConfirmacion(shift.id, "worker-cancel")}
                    loading={busy === `${shift.id}:worker-cancel`}
                    disabled={busy !== null || tapGuard.locked}
                  >
                    Ya no estoy disponible
                  </Button>
                </div>
              </div>
            )}
            {shift.status === "confirmado" && (
              <>
                {/* ADR-0008: antes eran 4 toques (salir → llegada →
                    empezar a trabajar → salida) — el paso "Salir hacia
                    el turno" no sumaba nada real y bajaba la adhesión
                    (gente que sí llegaba pero se olvidaba de tocarlo).
                    "Llegué" marca la ubicación real directo. */}
                <Button
                  size={size}
                  {...accion(fase === "llegada")}
                  onClick={() => void tapGuard.run(() => act(shift.id, "check-in", true))}
                  leftIcon={<MapPinIcon size={16} />}
                  loading={busy === `${shift.id}:check-in`}
                  disabled={busy !== null || tapGuard.locked || fase !== "llegada"}
                >
                  Llegué
                </Button>
                <Button
                  size="sm"
                  variant="surface"
                  className={`${QUIETO} ${destacado ? "min-h-[48px]" : ""}`}
                  onClick={() => pedirConfirmacion(shift.id, "worker-cancel")}
                  leftIcon={<CloseIcon size={16} />}
                  loading={busy === `${shift.id}:worker-cancel`}
                  disabled={busy !== null || tapGuard.locked}
                >
                  Cancelar mi asignación
                </Button>
              </>
            )}
            {/* Legacy (ADR-0008): turnos que ya estaban "en camino" al
                desplegar el cambio siguen pudiendo marcar llegada acá —
                ya no es un paso que se ofrezca de entrada. */}
            {shift.status === "en_camino" && (
              <Button
                size={size}
                {...accion()}
                onClick={() => void tapGuard.run(() => act(shift.id, "check-in", true))}
                leftIcon={<MapPinIcon size={16} />}
                loading={busy === `${shift.id}:check-in`}
                disabled={busy !== null || tapGuard.locked}
              >
                Marcar llegada
              </Button>
            )}
            {/* Llegó temprano: la salida no tiene sentido antes de que
                empiece el turno (el servidor también la rechaza). */}
            {shift.status === "check_in" && new Date(shift.start_at) <= now && (
              <Button
                size={size}
                {...accion()}
                onClick={() => pedirConfirmacion(shift.id, "check-out")}
                leftIcon={<MapPinIcon size={16} />}
                loading={busy === `${shift.id}:check-out`}
                disabled={busy !== null || tapGuard.locked}
              >
                Me fui
              </Button>
            )}
            {/* Legacy (ADR-0008): idem, para turnos ya en "trabajando". */}
            {shift.status === "trabajando" && (
              <Button
                size={size}
                {...accion()}
                onClick={() => pedirConfirmacion(shift.id, "check-out")}
                leftIcon={<MapPinIcon size={16} />}
                loading={busy === `${shift.id}:check-out`}
                disabled={busy !== null || tapGuard.locked}
              >
                Marcar salida
              </Button>
            )}
          </div>
          {shift.status === "confirmado" && fase !== "llegada" && (
            <p className="mt-2 text-xs text-ink-soft">Se habilita 30 min antes del turno.</p>
          )}
          {/* "Va en camino": debajo de "Llegué" y sólo con el turno
              confirmado. El backend además exige estar dentro de las 2h
              previas al inicio, así que en un turno de mañana el botón
              devuelve el error explicando desde cuándo se puede. */}
          {shift.status === "confirmado" && (
            <EnRouteToggle
              shiftId={shift.id}
              token={token}
              prominent={destacado && fase === "en_camino"}
              lastSharedAt={shift.en_route_at}
              onSharingChange={(on) => setEnRouteSharing(shift.id, on)}
            />
          )}
          {shift.status === "check_in" && new Date(shift.start_at) > now && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-success-text">
              <CheckIcon size={16} /> Llegada marcada · el turno empieza{" "}
              {formatShiftStartPhrase(shift.start_at, now)}
            </p>
          )}
          {shift.status === "check_out" && (
            // Con el plazo es información que la persona tiene que poder leer bien.
            <p className="mt-2 text-sm text-ink-soft">{autoFinishWorkerNote(shift.check_out_at, now)}</p>
          )}
          {(shift.status === "finalizado" || shift.status === "pagado") && (
            <div className="mt-2 flex flex-col gap-2">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-success-text">
                <CheckIcon size={16} /> {shift.status === "pagado" ? "Turno pagado" : "Turno finalizado"}
              </p>
              {/* «¿Ya cobraste?»: primero lo que importa a la persona (la plata),
                  después calificar. */}
              <CobroDeLaPersona shift={shift} now={now} onChanged={() => load({ silent: true })} />
              <ReviewBox shiftId={shift.id} />
            </div>
          )}
        </TurnoSuave>
      </div>
    );
  }

  // Postulaciones pendientes: las que todavía no se volvieron un turno asignado.
  const pending = applications.filter((a) => a.status === "pendiente");

  // La tira de días filtra las tres pestañas por la fecha del turno (hora de
  // Argentina): sin día elegido, la semana que se ve; con uno, sólo ese día.
  // Los contadores de las pestañas siguen contando todo. Los puntitos de la
  // tira, las flechas y «Más adelante» son de la pestaña que se mira.
  const fuente: { shift: Shift; estado: string; tono: string }[] =
    tab === "asignados"
      ? shifts.map((s) => ({ shift: s, estado: STATUS_LABELS[s.status], tono: CLASE_TONO[TONO_ESTADO[s.status] ?? "azul"] }))
      : tab === "postulaciones"
        ? pending.flatMap((a) => {
            const s = appShifts[a.shift_id];
            return s ? [{ shift: s, estado: APPLICATION_LABELS[a.status] ?? "Pendiente", tono: CLASE_TONO.azul }] : [];
          })
        : savedShifts.map((s) => ({ shift: s, estado: "Guardado", tono: CLASE_TONO.azul }));
  const semana = semanaArgentina(now, semanaOffset);
  const clavesSemana = new Set(semana.map((d) => d.clave));
  // Un día elegido que ya no está en la semana que se ve (pasó la medianoche
  // del domingo con la pantalla abierta) se da por soltado.
  const dia = diaElegido && clavesSemana.has(diaElegido) ? diaElegido : null;
  const enLaVista = (s: Shift) => {
    const c = claveDeVista(s, now);
    return dia ? c === dia : clavesSemana.has(c);
  };
  const turnosDelDia = turnosPorDia(fuente.map((f) => claveDeVista(f.shift, now)));
  const primerDia = semana[0].clave;
  const ultimoDia = semana[6].clave;
  const hayAntes = fuente.some((f) => claveDeVista(f.shift, now) < primerDia);
  // «Más adelante»: lo de semanas que vienen, en filas de una línea.
  const futuros: FilaFutura[] = fuente
    .filter((f) => claveDeVista(f.shift, now) > ultimoDia)
    .sort((a, b) => new Date(a.shift.start_at).getTime() - new Date(b.shift.start_at).getTime())
    .map((f) => ({
      id: f.shift.id,
      clave: claveDeVista(f.shift, now),
      puesto: SKILL_LABELS[f.shift.position],
      estado: f.estado,
      tono: f.tono,
      pago: formatPayCompact(f.shift),
    }));
  const irADia = (clave: string) => {
    setSemanaOffset(semanasHasta(clave, now));
    setDiaElegido(clave);
    window.scrollTo({ top: 0 });
  };
  const sinNadaVisible = fuente.length > 0 && !fuente.some((f) => enLaVista(f.shift));
  const diaVacio = (
    <p data-testid="dia-vacio" role="status" className="py-6 text-center text-body font-medium text-ink-soft">
      {dia ? `Nada el ${diaEnPalabras(dia)}` : "Nada en esta semana"}
    </p>
  );
  const vistos = shifts.filter(enLaVista);
  const activeShifts = vistos.filter((s) => !FINISHED_STATUSES.includes(s.status));
  const finishedShifts = vistos.filter((s) => FINISHED_STATUSES.includes(s.status));
  // La tarjeta de hoy lleva su propio cielo y el único ámbar. Es, en orden:
  // 1. el turno en marcha (si hubiera dos, el que empezó último);
  // 2. si no, el próximo por empezar: el primero de los asignados o
  //    confirmados que empiezan hoy o a los que ya se puede avisar «voy en
  //    camino» (uno de la madrugada, visto a las 23:30).
  // Queda afuera lo que no tiene acción ahora: la salida ya marcada
  // (`check_out`) y un turno sin confirmar o sin llegada que empezó hace más
  // de 2 h (el servidor lo cierra solo a esa altura).
  const porInicio = (a: Shift, b: Shift) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
  const enMarcha = activeShifts.filter((s) => EN_MARCHA_STATUSES.includes(s.status)).sort(porInicio);
  const porEmpezar = activeShifts
    .filter((s) => {
      if (s.status !== "asignado" && s.status !== "confirmado") return false;
      const faltan = new Date(s.start_at).getTime() - now.getTime();
      if (faltan < -EN_ROUTE_WINDOW_MS) return false;
      return isTodayInArgentina(s.start_at, now) || faltan <= EN_ROUTE_WINDOW_MS;
    })
    .sort(porInicio);
  const turnoDeHoy = enMarcha[enMarcha.length - 1] ?? porEmpezar[0] ?? null;
  const otrosActivos = activeShifts.filter((s) => s.id !== turnoDeHoy?.id).sort(porInicio);

  const origin = originFor(here, profile);
  // En el orden en que se fueron tocando (no el orden de la lista): más
  // fácil de seguir mientras se arma la comparación.
  const compareShifts = selectedForCompare
    .map((id) => savedShifts.find((s) => s.id === id))
    .filter((s): s is Shift => s !== undefined);

  return (
    // Desde el 2026-11-20 con la dirección suave (ADR-0028, maqueta
    // `T-Mis-turnos`): un cielo medio con la semana (hoy y los días con
    // turno), y debajo la hoja con las pestañas; el turno de hoy es una
    // tarjeta con su propio cielo y los cuatro pasos, y los demás son filas
    // (`worker/TurnoSuave`). Del 2026-11-18 al 20 fue «con relieve» (título
    // en brocha sobre la banda azul y cada turno como comanda). La lógica y
    // las acciones no cambiaron.
    <div className="estilo-suave mx-auto flex min-h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] max-w-md flex-col md:min-h-[calc(100dvh-var(--chrome-top))] md:max-w-5xl md:px-4 md:pt-4">
      <div className="app-cielo cielo-limpio px-5 pb-11 pt-5 md:rounded-t-[28px] md:px-6 md:pt-6">
        {/* Una sola nube, que asoma por arriba. No se sale por el costado
            (ni cuando deriva): `overflow-audit` mide cada elemento contra el
            ancho de la pantalla. */}
        <NubesCielo nubes={[{ forma: "a", ancho: 190, pos: { right: 24, top: -52 } }]} />
        <h1 className="titulo-pantalla break-words">Mis turnos</h1>
        <div className="mt-4">
          <SemanaTira
            dias={semana}
            turnosPorDia={turnosDelDia}
            elegido={dia}
            onElegir={setDiaElegido}
            onSemana={(paso) => {
              setSemanaOffset((o) => o + paso);
              setDiaElegido(null);
            }}
            esActual={semanaOffset === 0}
            hayAntes={hayAntes}
            hayDespues={futuros.length > 0}
            onVolver={() => {
              setSemanaOffset(0);
              setDiaElegido(null);
            }}
          />
        </div>
      </div>

      {/* La hoja sube 28 px sobre el cielo y lleva todo lo que se toca. */}
      <div className="hoja -mt-7 flex-1 px-4 pb-10 pt-2 md:px-6">
        <SegmentedControl
          value={tab}
          onChange={(next) => {
            setTab(next);
            exitCompareMode();
          }}
          options={[
            { value: "asignados", label: "Asignados", count: shifts.length },
            {
              value: "postulaciones",
              label: "Postulaciones",
              count: pending.filter((a) => {
                const st = appShifts[a.shift_id]?.status;
                return st !== undefined && OPEN_SHIFT_STATUSES.includes(st);
              }).length,
            },
            { value: "guardados", label: "Guardados", count: savedShifts.length },
          ]}
        />

      {loading && <CardSkeletons />}
      {error && <ErrorState onRetry={() => load()} />}

      {!loading && !error && tab === "asignados" && (
        <div className="mt-5">
          {shifts.length === 0 ? (
            // Sin `icon`: va el pinche, lo que espera turno (firma de la app,
            // 2026-11-28). El maletín era de oficina.
            <EmptyState
              title="Todavía no hay turno a tu nombre"
              subtitle="Cuando un local te elija, queda clavado acá, con el horario y cómo llegar."
            />
          ) : (
            activeShifts.length > 0 && (
              <>
                {/* Oculto: los puestos de las comandas son h3 y no tienen que
                    saltar desde el h1. */}
                <h2 className="sr-only">Asignados</h2>
                {/* En la compu (escritorio, renglones 5 y 11): con tarjeta de hoy,
                    dos columnas explícitas (hoy a la izquierda, los demás en
                    orden cronológico a la derecha), así ninguna salta de
                    columna cuando una tarjeta cambia de alto; sin ella, una
                    grilla de dos por fila. */}
                {turnoDeHoy ? (
                  <div data-testid="turnos-activos" className="flex flex-col gap-3 md:grid md:grid-cols-2 md:items-start">
                    {renderAssigned(turnoDeHoy, true)}
                    {otrosActivos.length > 0 && (
                      <div className="flex flex-col gap-3">{otrosActivos.map((s) => renderAssigned(s))}</div>
                    )}
                  </div>
                ) : (
                  <div data-testid="turnos-activos" className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
                    {otrosActivos.map((s) => renderAssigned(s))}
                  </div>
                )}
              </>
            )
          )}
          {sinNadaVisible && diaVacio}
          {/* U066: lo terminado (pagado, cancelado, no cubierto) va aparte,
              debajo de lo que todavía hay que hacer. */}
          {finishedShifts.length > 0 && (
            <>
              <h2
                className={`titulo-seccion mb-3 ${activeShifts.length > 0 ? "mt-8" : ""}`}
              >
                Terminados
              </h2>
              <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
                {finishedShifts.map((s) => renderAssigned(s))}
              </div>
            </>
          )}
          <MasAdelante filas={futuros} onElegir={irADia} />
        </div>
      )}

      {!loading && !error && tab === "postulaciones" && (
        <div className="mt-5">
          {appsError ? (
            <ErrorState onRetry={() => load()} />
          ) : pending.length === 0 ? (
            <EmptyState
              icon={<ClockIcon size={28} />}
              title="No tenés postulaciones activas"
              subtitle="Postulate a un turno desde Inicio. Acá vas a seguir su estado."
            />
          ) : (
            <>
            <h2 className="sr-only">Postulaciones</h2>
            {profile?.verificacion_requerida && !profile.identidad_verificada && (
              // Postularse es libre, pero sin la identidad verificada el
              // comercio no puede elegirla (2026-11-26).
              <div
                role="status"
                data-testid="falta-verificar"
                className="mb-3 rounded-[14px] bg-surface p-4"
              >
                {profile.verificacion_en_revision ? (
                  <>
                    <p className="text-sm font-bold text-ink">Estamos revisando tu identidad</p>
                    <p className="mt-1 text-caption text-ink-soft">
                      Ya recibimos tu DNI y tu selfie. Cuando una persona del equipo
                      los apruebe, el comercio va a poder elegirte.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-ink">Te falta verificar tu identidad</p>
                    <p className="mt-1 text-caption text-ink-soft">
                      Ya te postulaste, pero el comercio sólo puede elegirte cuando
                      tu identidad esté verificada. Cargás tu DNI y una selfie en
                      unos minutos, y la revisa una persona del equipo.
                    </p>
                    <Link
                      href="/profile"
                      className="mt-2 inline-block text-sm font-bold text-ink underline underline-offset-2"
                    >
                      Verificar mi identidad
                    </Link>
                  </>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
            {pending.map((application) => {
              const shift = appShifts[application.shift_id];
              if (!shift || !enLaVista(shift)) return null;
              const isOpen = OPEN_SHIFT_STATUSES.includes(shift.status);
              return (
                <TurnoSuave key={application.id} shift={shift}>
                  {isOpen ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="chip-suave text-primary-text">
                        <ClockIcon size={15} /> {APPLICATION_LABELS[application.status]}
                      </p>
                      {/* Compartir a un colega: este turno sigue abierto, pasarlo
                          por WhatsApp suma gente a la plataforma (mismas piezas
                          que el feed y la página pública). */}
                      <ShareShiftButton shift={shift} shiftId={shift.id} />
                      <Button
                        size="sm"
                        variant="surface"
                        className={QUIETO}
                        leftIcon={<CloseIcon size={16} />}
                        onClick={() => void tapGuard.run(() => setConfirmWithdrawId(application.id))}
                        loading={withdrawing === application.id}
                        disabled={withdrawing !== null || tapGuard.locked}
                      >
                        Cancelar postulación
                      </Button>
                    </div>
                  ) : (
                    // U088: el turno ya no se abre; no hay nada que esperar.
                    // Sin compartir (nadie puede postularse) y con una sola
                    // acción: sacarlo de la lista.
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="chip-suave text-ink-soft">
                        <CloseIcon size={15} /> {closedShiftLabel(shift.status)}
                      </p>
                      <Button
                        size="sm"
                        variant="surface"
                        className={QUIETO}
                        onClick={() => void tapGuard.run(() => withdrawApplication(application.id))}
                        loading={withdrawing === application.id}
                        disabled={withdrawing !== null || tapGuard.locked}
                      >
                        Quitar de la lista
                      </Button>
                    </div>
                  )}
                </TurnoSuave>
              );
            })}
            </div>
            {sinNadaVisible && diaVacio}
            <MasAdelante filas={futuros} onElegir={irADia} />
            </>
          )}
        </div>
      )}

      {!loading && !error && tab === "guardados" && (
        <div className="mt-5 pb-16">
          {savedError ? (
            <ErrorState onRetry={() => load()} />
          ) : savedShifts.length === 0 ? (
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
                    aria-pressed={compareMode}
                    className={`boton ${QUIETO} inline-flex min-h-[40px] items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition active:scale-95`}
                  >
                    <ScaleIcon size={14} />
                    {compareMode ? "Cancelar comparación" : "Comparar"}
                  </button>
                </div>
              )}

              <h2 className="sr-only">Guardados</h2>
              <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
                {savedShifts.filter(enLaVista).map((shift) => {
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
                          // Arriba a la derecha, por fuera de la fila: adentro
                          // tapaba el estado.
                          className={`absolute -right-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-card transition disabled:opacity-40 ${
                            // Sin elegir va con borde azul: sobre la hoja, el
                            // círculo blanco no se veía.
                            selected ? "bg-primary-text text-card" : "bg-card text-ink/40 ring-primary-text"
                          }`}
                        >
                          {selected ? <CheckIcon size={14} /> : null}
                        </button>
                      )}
                      <TurnoSuave shift={shift} showLifecycle={false}>
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Quieto: con un «Postularme» ámbar por fila, la
                              pantalla tenía tantos ámbar como guardados. */}
                          <Button
                            size="sm"
                            variant="surface"
                            className={QUIETO}
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
                            className={QUIETO}
                            leftIcon={<CloseIcon size={16} />}
                            onClick={() => unsaveShift(shift.id)}
                            loading={unsaving === shift.id}
                            disabled={unsaving !== null || applyingSaved !== null}
                          >
                            Quitar de guardados
                          </Button>
                        </div>
                      </TurnoSuave>
                    </div>
                  );
                })}
              </div>
              {sinNadaVisible && diaVacio}
              <MasAdelante filas={futuros} onElegir={irADia} />
            </>
          )}
        </div>
      )}

      </div>

      {/* Barra flotante de comparación: aparece recién con 2+ elegidos (un
          turno solo no compara contra nada). Fija sobre el bottom nav
          (z-40, mismo nivel que otros overlays flotantes de la app). */}
      {compareMode && selectedForCompare.length >= 2 && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-4">
          <Button
            // Neutro: el ámbar queda para la acción del turno de hoy.
            variant="surface"
            leftIcon={<ScaleIcon size={16} />}
            onClick={() => {
              setCompareMounted(true);
              setCompareOpen(true);
            }}
            className="shadow-[var(--shadow-float)]"
          >
            Comparar ({selectedForCompare.length})
          </Button>
        </div>
      )}

      {compareMounted && (
        <CompareShiftsModal
          shifts={compareShifts}
          origin={origin}
          open={compareOpen}
          onClose={() => setCompareOpen(false)}
        />
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
          {confirmCopy(lastConfirmPath, lastConAviso)}
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
          <ShiftCoveredIllustration size={56} color="var(--color-primary-text)" />
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
