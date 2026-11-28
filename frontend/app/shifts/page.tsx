"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { getErrorMessage, isPlanLimitError } from "@/lib/errors";
import { comercioSinPerfilTras400 } from "@/lib/perfil-faltante";
import { bienvenidaHref } from "@/lib/safe-next";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { useTapGuard } from "@/lib/use-tap-guard";
import { useLiveRefresh } from "@/lib/live-refresh";
import { coberturaPorEvento } from "@/lib/evento-cobertura";
import {
  cancelConfirmCopy,
  cancelEventConfirmCopy,
  isCancellable,
  withFreshState,
} from "@/lib/cancelar-turno";
import {
  FAMILY_ORDER,
  diaParaFamilia,
  familyOf,
  ordenMasAdelante,
  resumenPanel,
  tituloDelDia,
  turnosEnLaVista,
  type Family,
} from "@/lib/panel-comercio";
import { claveDeVista, claveDiaArgentina, diaEnPalabras, semanaArgentina, semanasHasta, turnosPorDia } from "@/lib/semana";
import { useNow } from "@/lib/use-now";
import { formatPayCompact } from "@/lib/pay";
import { SKILL_LABELS, STATUS_LABELS, Shift } from "@/lib/types";
import SemanaTira from "@/components/SemanaTira";
import MasAdelante, { type FilaFutura } from "@/components/MasAdelante";
import { CLASE_TONO, TONO_ESTADO } from "@/components/worker/TurnoSuave";
import TurnoPanel from "@/components/employer/TurnoPanel";
import CieloPanel from "@/components/employer/CieloPanel";
import ShiftActions from "@/components/ShiftActions";
import AIAssistantBar from "@/components/AIAssistantBar";
import PerfilFaltanteCard from "@/components/PerfilFaltanteCard";
import ReviewBox from "@/components/ReviewBox";
import CobroEnElTurno from "@/components/CobroEnElTurno";
import PlanLimitModal from "@/components/subscription/PlanLimitModal";
import ShiftPublishedNextSteps from "@/components/ShiftPublishedNextSteps";
import { payView } from "@/lib/pay";
import { noShowConfirmCopy } from "@/lib/turno-reofrecido";
import dynamic from "next/dynamic";
import type { TourStep } from "@/components/GuidedTour";
import { useTourPendiente } from "@/lib/use-tour-pendiente";
import { Button, CardSkeletons, ErrorBanner, Modal, Skeleton, useToast } from "@/components/ui";

// Recorrido de una sola vez: se baja sólo si hay algo que mostrar.
const GuidedTour = dynamic(() => import("@/components/GuidedTour"), { ssr: false });

/**
 * Los grupos de la lista, por estado (ya no hay pestañas: un enlace
 * `/shifts?tab=buscando`, del asistente, baja hasta el grupo). Los vacíos no
 * se muestran.
 */
const GRUPOS: Family[] = FAMILY_ORDER;
function esGrupo(value: string | null): value is Family {
  return value !== null && (GRUPOS as string[]).includes(value);
}

const TITULO_GRUPO: Record<Family, string> = {
  borrador: "Borradores",
  buscando: "Buscando personal",
  en_marcha: "En marcha",
  terminado: "Terminados",
  cancelado: "Cancelados",
};

/** Pedido de Julieta: el comercio no tenía nada parecido al mini-tour que ya
 * ve el trabajador al aterrizar en el feed por primera vez ("el onboarding
 * comercio no tiene los popups que te ayudan a conocer la app como en
 * empleado"). Mismo componente (`GuidedTour`), apuntando a lo mínimo para
 * entender el panel: cómo publicar, la semana que se toca (si ya hay turnos) y
 * dónde buscar candidatos directo. */
const EMPLOYER_PANEL_TOUR: TourStep[] = [
  {
    target: '[data-tour="shifts-publish"]',
    title: "Publicá tu primer turno",
    body: "Contanos el puesto, el horario y el pago. Te recomendamos los mejores candidatos disponibles cerca tuyo.",
  },
  {
    target: '[data-tour="shifts-tira"]',
    title: "Tu semana, día por día",
    body: "Tocá un día para ver sólo sus turnos, o pasá de semana con las flechas. Abajo, agrupados por estado.",
  },
  {
    target: '[data-tour="nav-search"]',
    title: "También podés buscar vos",
    body: "Si no querés esperar postulaciones, buscá candidatos disponibles directo desde acá.",
  },
];

/** El primer día: qué va a pasar, en tres pasos (maqueta `C-Panel-vacio`). */
const PRIMER_DIA = [
  { titulo: "Cantás el pedido", detalle: "Puesto, horario y cuánto pagás. Lleva un minuto." },
  {
    titulo: "Les avisamos a quienes están cerca",
    detalle: "Acá vas viendo quién se postula y cómo le fue antes.",
  },
  {
    titulo: "Elegís y te contestan «¡oído!»",
    detalle: "Se escriben por el chat y ves cuando sale para tu local.",
  },
];

type Action = "publish" | "cancel" | "finish" | "markPaid" | "noShow";

const ACTION_PATH: Record<Action, string> = {
  publish: "publish",
  cancel: "cancel",
  finish: "finish",
  markPaid: "mark-paid",
  noShow: "no-show",
};

export default function MyShiftsPage() {
  // useSearchParams exige un boundary de Suspense en build estático.
  return (
    <Suspense fallback={null}>
      <MyShiftsPanel />
    </Suspense>
  );
}

/** Cuánto se espera la relectura del turno al abrir «¿Cancelar este turno?». */
const CANCEL_RECHECK_TIMEOUT_MS = 5_000;

/** Cada cuánto se refresca el panel mientras alguien puede venir en camino. */
const EN_ROUTE_REFRESH_MS = 30_000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * ¿Puede este turno tener a alguien viajando ahora? Confirmado y dentro de la
 * ventana del "va en camino": desde 2h antes del inicio (`EN_ROUTE_WINDOW` del
 * backend) hasta 2h después, cuando el no-show automático ya lo resolvió.
 * Se evalúa en cada tick, no al renderizar: un turno de esta noche entra en la
 * ventana sin que la lista cambie.
 */
function mayBeOnTheWay(shift: Shift, now: number): boolean {
  if (shift.status !== "confirmado" && shift.status !== "en_camino") return false;
  if (shift.en_route_at != null) return true;
  const start = new Date(shift.start_at).getTime();
  return now >= start - 2 * HOUR_MS && now <= start + 2 * HOUR_MS;
}

function MyShiftsPanel() {
  const { token, user } = useRequireAuth({ roles: ["employer"] });
  const router = useRouter();
  const firstName = user?.full_name?.split(" ")[0];
  const toast = useToast();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [shifts, setShifts] = useState<Shift[]>([]);
  // La tira de días del cielo (`SemanaTira`, la misma de Mis turnos): qué
  // semana se ve (0 = la de hoy, en pasos de semanas) y, si se tocó uno, el
  // día (clave "YYYY-MM-DD" de Argentina). Sin día, la lista es la semana.
  const nowMs = useNow(30_000);
  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [diaElegido, setDiaElegido] = useState<string | null>(null);
  // Un enlace `/shifts?tab=buscando` (el asistente de IA, consultar_turnos)
  // baja hasta ese grupo: se guarda cuál hasta que la lista está dibujada.
  const [grupoPendiente, setGrupoPendiente] = useState<Family | null>(null);
  const grupoParam = searchParams.get("tab") ?? searchParams.get("familia");
  const grupoHandledRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // La cuenta del comercio todavía no tiene perfil (se cortó la bienvenida):
  // en vez del error del backend, el cartel que lleva a completarlo.
  const [sinPerfil, setSinPerfil] = useState(false);
  const tourPendiente = useTourPendiente("staffya_tour_employer_panel");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [planLimitMessage, setPlanLimitMessage] = useState<string | null>(null);
  const { keyFor, clear: clearIdempotencyKey, clearSiTermino } = useIdempotencyKeys();
  // Guarda contra el toque de más (ver `lib/use-tap-guard.ts`): el botón
  // principal de cada tarjeta está siempre en el mismo lugar y cambia de
  // acción con el estado. Un segundo toque después de «Cerrar turno» no
  // tiene que alcanzar a «Marcar como pagado» ni al «Cerrar turno» del turno
  // que subió a ese lugar.
  const tapGuard = useTapGuard();
  const [confirmNoShowId, setConfirmNoShowId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  // Mientras se relee el turno al abrir el diálogo de cancelar (`askCancel`).
  const [cancelChecking, setCancelChecking] = useState(false);
  const cancelCheckRef = useRef(0);
  const [confirmMarkPaidId, setConfirmMarkPaidId] = useState<string | null>(null);
  // U084: cancelar un evento entero. Mientras se relee el panel al abrir el
  // diálogo (`askCancelEvent`), el texto queda en espera.
  const [confirmEventId, setConfirmEventId] = useState<string | null>(null);
  const [eventChecking, setEventChecking] = useState(false);
  // Pantalla "esto es lo que sigue" (Fix 2, docs/planning/PULIDO_ROADMAP.md): guarda
  // el id del turno que se acaba de publicar DESDE ESTE PANEL (borrador →
  // publicado). Reemplaza el cartel de una sola vez ("ya estás buscando
  // personal...", launch-gate #88): esta versión es más rica y se muestra
  // cada vez que se publica, no sólo la primera vez (ver
  // `ShiftPublishedNextSteps` para la justificación completa).
  const [justPublishedId, setJustPublishedId] = useState<string | null>(null);

  const latestLoad = useRef(0);
  // `silent`: el refresco de fondo del "va en camino" no vuelve a mostrar el
  // esqueleto de carga ni pisa la lista con un error pasajero de red.
  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!token) return;
    // Último pedido gana: una respuesta vieja (una carga normal, o la de
    // `act()`, cruzada con una silenciosa) no pisa a la más nueva.
    const mine = ++latestLoad.current;
    if (!silent) setLoading(true);
    try {
      const data = await api.get<Shift[]>("/shifts/me", token);
      if (mine !== latestLoad.current) return;
      setShifts(data);
      setError(null);
      setSinPerfil(false);
    } catch (err) {
      // Un 400 puede ser «todavía no creaste tu comercio»: se confirma con el
      // perfil antes de decirlo.
      const sin = mine === latestLoad.current && (await comercioSinPerfilTras400(err, token));
      if (mine !== latestLoad.current) return;
      if (sin) {
        setSinPerfil(true);
        setError(null);
      } else if (!silent) {
        setError(getErrorMessage(err, "Error al cargar tus turnos"));
      }
    } finally {
      // El último pedido siempre baja el esqueleto (si uno normal quedó
      // pisado por uno silencioso, nadie más lo bajaría).
      if (mine === latestLoad.current) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // "Va en camino": mientras algún turno pueda tener a alguien viajando, el
  // panel se refresca solo — si no, el mapa es una foto y el comercio tiene
  // que recargar para ver si se movió. Sólo en ese caso: un panel sin turnos
  // por empezar no le pega al backend (la base es Neon con cuota: cada
  // request la despierta). Y sólo con la pestaña a la vista; al volver a
  // ella, refresca de una.
  const shiftsRef = useRef(shifts);
  useEffect(() => {
    shiftsRef.current = shifts;
  }, [shifts]);
  const hasConfirmed = shifts.some(
    (s) => s.status === "confirmado" || s.status === "en_camino"
  );
  useEffect(() => {
    if (!hasConfirmed) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (shiftsRef.current.some((s) => mayBeOnTheWay(s, now))) void load({ silent: true });
    };
    const timer = setInterval(refresh, EN_ROUTE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [hasConfirmed, load]);

  // Al día con los avisos (G1, U013): el trabajador confirma, se baja o llega y
  // el panel pasa solo, sin recargar. Al volver a la pestaña también (eso lo
  // resuelve el hook; antes lo hacía acá el listener de `visibilitychange`).
  // En pausa mientras hay un diálogo abierto o una acción en curso: la lista no
  // se mueve debajo de lo que la persona está decidiendo.
  // También en pausa mientras corre una carga normal (la primera, o la de
  // `act()`): una silenciosa la pisaría por la guarda de «último pedido gana» y,
  // si fallara, sin avisar, la pantalla quedaría sin su error ni «Reintentar».
  useLiveRefresh(load, {
    paused:
      loading ||
      busy !== null ||
      tapGuard.locked ||
      confirmNoShowId !== null ||
      confirmCancelId !== null ||
      confirmMarkPaidId !== null ||
      confirmEventId !== null ||
      planLimitMessage !== null ||
      justPublishedId !== null,
  });

  // Helper único para las acciones de estado del turno: registra qué tarjeta
  // está ocupada (para el indicador de carga), atrapa errores del POST (antes
  // se dejaban sin manejar) y refresca la lista al terminar. Pasa por la
  // guarda: no arranca si hay otra acción en curso, y cuando termina y la
  // lista se redibuja deja un instante en el que ninguna otra arranca.
  async function run(id: string, action: Action) {
    if (!token) return;
    const key = `${id}:${action}`;
    await tapGuard.run(async () => {
      setBusy(key);
      try {
        // Idempotencia (product/IDEMPOTENCIA_SPEC.md): mismo intento = misma
        // key mientras no haya terminado bien. La guarda frena el toque de
        // más del lado del cliente; este header cubre el reintento de red
        // del lado del servidor.
        await api.post(`/shifts/${id}/${ACTION_PATH[action]}`, undefined, token, undefined, keyFor(key));
        clearIdempotencyKey(key);
        await load();
        if (action === "publish") setJustPublishedId(id);
      } catch (err) {
        clearSiTermino(key, err);
        if (action === "publish" && isPlanLimitError(err)) {
          setPlanLimitMessage(getErrorMessage(err));
        } else {
          toast(getErrorMessage(err, "No se pudo completar la acción"), "error");
        }
        // También al fallar: el turno pudo cambiar (el trabajador se bajó, ya
        // estaba cancelado) y la pantalla no puede seguir ofreciendo el
        // botón. Silenciosa: sin esqueleto, y si falla no pisa el aviso.
        await load({ silent: true });
      } finally {
        setBusy(null);
      }
    });
  }

  /** «Ya llegó»: el comercio marca la llegada de quien no la marcó
   *  (puntualidad real, ADR-0008 act. 2026-11-26). */
  async function yaLlego(id: string, aHorario: boolean) {
    if (!token) return;
    const key = `${id}:yaLlego`;
    await tapGuard.run(async () => {
      setBusy(key);
      try {
        await api.post(`/shifts/${id}/company-check-in`, { on_time: aHorario }, token);
        await load();
      } catch (err) {
        toast(getErrorMessage(err, "No se pudo marcar la llegada"), "error");
        await load({ silent: true });
      } finally {
        setBusy(null);
      }
    });
  }

  async function confirmNoShow(id: string) {
    setConfirmNoShowId(null);
    await run(id, "noShow");
  }

  // «¿Cancelar este turno?» dice a quién se le avisa y si suma una
  // cancelación tardía, y eso depende del estado del turno AHORA, no del que
  // tenía cuando se cargó el panel: con la lista vieja, un turno que el
  // trabajador confirmó hace un minuto se cancelaba sin el aviso (y sumaba la
  // tardía), y uno del que se bajó prometía una tardía que no iba a existir.
  // Al abrir se relee ese turno; hasta que llega, el texto queda en espera y
  // el «Sí» apagado, así no se ve un texto que después cambia por otro.
  //
  // Si la relectura falla (sin red, backend dormido), se muestra el texto del
  // estado que el panel conoce y decide el servidor, como antes: no se
  // inventa un aviso de «puede sumarte…».
  async function askCancel(id: string) {
    setConfirmCancelId(id);
    if (!token) return;
    const check = ++cancelCheckRef.current;
    setCancelChecking(true);
    try {
      const fresh = await api.get<Shift>(`/shifts/${id}`, token, CANCEL_RECHECK_TIMEOUT_MS);
      // El diálogo se cerró (o se abrió otro) mientras llegaba: no se toca nada.
      if (cancelCheckRef.current !== check) return;
      setShifts((prev) => prev.map((s) => (s.id === id ? withFreshState(s, fresh) : s)));
      if (!isCancellable(fresh.status)) {
        // Terminó, se canceló o quedó sin cubrir mientras el panel estaba
        // abierto: la tarjeta ya muestra el estado nuevo.
        setConfirmCancelId(null);
        toast(
          fresh.status === "check_out"
            ? "La persona ya marcó la salida: este turno se finaliza y se paga, no se cancela."
            : "Este turno ya no se puede cancelar.",
          "info"
        );
      }
    } catch {
      // Sin dato fresco: vale el estado conocido (ver arriba).
    } finally {
      if (cancelCheckRef.current === check) setCancelChecking(false);
    }
  }

  function closeCancel() {
    cancelCheckRef.current += 1;
    setCancelChecking(false);
    setConfirmCancelId(null);
  }

  async function confirmCancel(id: string) {
    closeCancel();
    await run(id, "cancel");
  }

  // Cancelar un evento entero (U084): mismas reglas que cada puesto, y el
  // texto dice cuántos puestos se cancelan y cuántas tardías suma. Igual que
  // `askCancel`, al abrir se relee el panel para que ese texto sea el de ahora.
  async function askCancelEvent(eventId: string) {
    // Abrir pasa por la guarda (como «Marcar como pagado»): el segundo toque
    // de un doble toque no confirma. La relectura va afuera, para que la
    // guarda no siga trabada mientras llega.
    const opened = await tapGuard.run(() => setConfirmEventId(eventId));
    if (!opened) return;
    setEventChecking(true);
    try {
      await load({ silent: true });
    } finally {
      setEventChecking(false);
    }
  }

  async function confirmCancelEvent(eventId: string) {
    if (!token) return;
    const key = `${eventId}:cancel-event`;
    await tapGuard.run(async () => {
      setConfirmEventId(null);
      setBusy(key);
      try {
        await api.post(`/shifts/events/${eventId}/cancel`, undefined, token, undefined, keyFor(key));
        clearIdempotencyKey(key);
        toast("Cancelaste el evento.", "success");
      } catch (err) {
        toast(getErrorMessage(err, "No se pudo cancelar el evento"), "error");
      } finally {
        // También al fallar: algún puesto pudo haber cambiado.
        await load({ silent: true });
        setBusy(null);
      }
    });
  }

  // «Marcar como pagado» no se puede deshacer y le avisa al trabajador que
  // cobró: primero se pregunta. Abrir el diálogo también pasa por la guarda,
  // así el toque que cae justo después de «Cerrar turno» no lo abre, y el
  // segundo toque de un doble toque no lo confirma ni lo cierra (durante ese
  // instante el «Sí» está deshabilitado y tocar afuera no hace nada).
  function askMarkPaid(id: string) {
    void tapGuard.run(() => setConfirmMarkPaidId(id));
  }

  async function confirmMarkPaid(id: string) {
    setConfirmMarkPaidId(null);
    await run(id, "markPaid");
  }

  // La semana que se ve y, adentro, el día elegido (uno que ya no está en la
  // semana —pasó la medianoche del domingo con la pantalla abierta— se da por
  // soltado). Todo en el día de Argentina.
  const semana = semanaArgentina(now, semanaOffset);
  const dia = diaElegido && semana.some((d) => d.clave === diaElegido) ? diaElegido : null;
  const vistos = turnosEnLaVista(shifts, semana, dia, now);
  // Agrupa por familia lo que se ve; la lista y los títulos leen de acá.
  const families = (() => {
    const grouped: Record<Family, Shift[]> = {
      borrador: [],
      buscando: [],
      en_marcha: [],
      terminado: [],
      cancelado: [],
    };
    for (const shift of vistos) grouped[familyOf(shift.status)].push(shift);
    return grouped;
  })();
  const claveInicio = semana[0].clave;
  const claveFin = semana[6].clave;
  const hayAntes = shifts.some((s) => claveDeVista(s, now) < claveInicio);
  const conteoPorDia = useMemo(() => turnosPorDia(shifts.map((s) => claveDeVista(s, now))), [shifts, now]);
  // «Más adelante»: lo de semanas que vienen, los que buscan personal primero.
  const futuros: FilaFutura[] = ordenMasAdelante(shifts, claveFin).map((s) => ({
    id: s.id,
    clave: claveDiaArgentina(s.start_at),
    puesto: SKILL_LABELS[s.position],
    estado: familyOf(s.status) === "buscando" ? "Buscando" : STATUS_LABELS[s.status],
    tono: CLASE_TONO[TONO_ESTADO[s.status] ?? "azul"],
    pago: formatPayCompact(s),
  }));
  const irADia = (clave: string) => {
    setSemanaOffset(semanasHasta(clave, now));
    setDiaElegido(clave);
    window.scrollTo({ top: 0 });
  };

  // Enlace a un grupo (`?tab=buscando`): con la lista cargada, si de ese grupo
  // no hay nada en la semana que se ve salta a la semana del turno que más
  // cerca está, y después baja hasta el grupo. Saca el parámetro de la URL
  // (sin sumar historial): una recarga no vuelve a saltar y el mismo enlace
  // funciona otra vez. Si la carga falló no se da por procesado.
  useEffect(() => {
    if (!grupoParam) {
      grupoHandledRef.current = null;
      return;
    }
    if (loading || error || sinPerfil || grupoHandledRef.current === grupoParam) return;
    grupoHandledRef.current = grupoParam;
    if (esGrupo(grupoParam)) {
      const diaDelGrupo = diaParaFamilia(shifts, grupoParam, semanaArgentina(now), now);
      if (diaDelGrupo) setSemanaOffset(semanasHasta(diaDelGrupo, now));
      setDiaElegido(null);
      setGrupoPendiente(grupoParam);
    }
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete("tab");
    rest.delete("familia");
    const qs = rest.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [grupoParam, loading, error, sinPerfil, shifts, now, router, pathname, searchParams]);

  // Ya dibujada la semana, baja hasta el grupo.
  useEffect(() => {
    if (!grupoPendiente) return;
    const el = document.querySelector(`[data-family="${grupoPendiente}"]`);
    if (el) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    }
    setGrupoPendiente(null);
  }, [grupoPendiente, semanaOffset, dia]);

  // Progreso de cobertura por evento (publicación masiva, /shifts/new-event):
  // cruza TODAS las familias — un evento de 6 roles puede tener 4 ya
  // confirmados y 2 todavía buscando, repartidos en pestañas distintas. No
  // cuenta los cancelados; «cubiertos» son los confirmados en adelante
  // (`lib/evento-cobertura.ts`).
  const eventGroups = useMemo(() => coberturaPorEvento(shifts), [shifts]);

  const cancelCopy = cancelConfirmCopy(
    confirmCancelId ? shifts.find((s) => s.id === confirmCancelId) : undefined
  );
  const eventCopy = cancelEventConfirmCopy(
    confirmEventId ? shifts.filter((s) => s.event_id === confirmEventId) : []
  );
  const payingShift = confirmMarkPaidId
    ? shifts.find((s) => s.id === confirmMarkPaidId)
    : undefined;
  const payingWorkerName = payingShift?.worker_name ?? null;
  const noShowShift = confirmNoShowId
    ? shifts.find((s) => s.id === confirmNoShowId)
    : undefined;

  // Se listan sólo los grupos con contenido (no tiene sentido mostrar cuatro
  // estados vacíos apilados).
  const visibleFamilies: Family[] = GRUPOS.filter((family) => families[family].length > 0);
  // Lo que responde el cielo: sólo cuando la lista está cargada y es de fiar.
  const cargado = !loading && !error && !sinPerfil;
  const resumen = useMemo(() => (cargado ? resumenPanel(shifts) : null), [cargado, shifts]);
  const titulo = useMemo(() => (cargado ? tituloDelDia(shifts, dia, now) : null), [cargado, shifts, dia, now]);

  return (
    // Desde el 2026-11-20 el panel lleva la dirección suave (ADR-0028,
    // maquetas `C-Panel*`): arriba el cielo, hondo mientras hay turnos en
    // curso, con el número de turnos de hoy y sus tres estados; debajo la
    // hoja, con los turnos como filas suaves (`employer/TurnoPanel`). Del
    // 2026-11-18 al 20 fue «con relieve» (saludo en brocha, comandas de papel
    // colgando del riel). La lógica no cambió.
    <div className="estilo-suave mx-auto flex min-h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] max-w-md flex-col md:min-h-[calc(100dvh-var(--chrome-top))] md:max-w-5xl md:px-4 md:pt-4">
      <CieloPanel
        nombre={firstName}
        resumen={resumen}
        titulo={titulo}
        conAcciones={!loading && !sinPerfil}
        vacio={cargado && shifts.length === 0}
        tira={
          cargado && shifts.length > 0 ? (
            <div data-tour="shifts-tira">
              <SemanaTira
                dias={semana}
                turnosPorDia={conteoPorDia}
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
          ) : null
        }
      />

      {/* La hoja sube 28 px sobre el cielo y lleva todo lo que se toca. */}
      <div className="hoja -mt-7 flex-1 px-4 pb-10 pt-5 md:px-6">
      {sinPerfil && !loading && (
        <PerfilFaltanteCard
          title="Te falta completar tu comercio"
          body="Cargá el nombre y la ubicación para publicar turnos y que te encuentren los candidatos."
          actionLabel="Completar mi comercio"
          href={bienvenidaHref("/shifts")}
        />
      )}

      {/* Arriba, sólo lo que se hace desde acá (2026-09-28, diagnóstico de
          sobrecarga): Publicar y Evento (en el cielo) y el asistente. */}
      {!sinPerfil && (
        <div className="panel-asistente">
          <AIAssistantBar />
        </div>
      )}

      {loading && <CardSkeletons />}
      {error && !sinPerfil && <ErrorBanner message={error} onRetry={() => load()} />}

      {/* El primer día (maqueta `C-Panel-vacio`): la acción está en el cielo
          («Publicar turno», el ámbar) y la hoja cuenta qué va a pasar, en
          tres pasos. */}
      {!loading && !error && !sinPerfil && shifts.length === 0 && (
        <section className="mt-7" data-testid="panel-primer-dia">
          <h2 className="titulo-seccion">Así sale un turno</h2>
          {/* En la compu los tres pasos van en fila, uno por columna. */}
          <ol className="mt-5 flex flex-col gap-5 md:max-w-xl lg:grid lg:max-w-none lg:grid-cols-3 lg:gap-8">
            {PRIMER_DIA.map((paso, i) => (
              <li key={paso.titulo} className="flex gap-3.5">
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-body font-extrabold text-primary-text"
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-fila font-bold text-ink">{paso.titulo}</p>
                  <p className="text-sm leading-snug text-ink-soft">{paso.detalle}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {!loading && !error && !sinPerfil && eventGroups.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {eventGroups.map((event) => (
            <div key={event.eventId} className="turno-fila flex items-center justify-between gap-3 px-4 py-3">
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{event.name}</p>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                  event.covered === event.total
                    ? "bg-success-tint text-success-text"
                    : "bg-primary-tint text-primary-text"
                }`}
              >
                {event.covered}/{event.total} cubiertos
              </span>
              {shifts.some((s) => s.event_id === event.eventId && isCancellable(s.status)) && (
                <button
                  type="button"
                  onClick={() => void askCancelEvent(event.eventId)}
                  disabled={busy !== null || tapGuard.locked}
                  aria-label={`Cancelar el evento ${event.name}`}
                  className="-my-2 -mr-2 min-h-[44px] shrink-0 rounded-full px-2 text-sm font-semibold text-danger-text hover:underline disabled:opacity-50"
                >
                  Cancelar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && !error && !sinPerfil && shifts.length > 0 && (
        <>
          {/* Las familias se acomodan en la MISMA grilla que las filas, y
              cada una ocupa tantas columnas como turnos tiene (hasta el
              ancho completo). Antes cada familia abría su propia grilla en
              una fila nueva: con un turno por familia, a 768px quedaba una
              tarjeta de 360px y media pantalla vacía, grupo tras grupo
              (auditoría visual 2026-09-24, A3). Ahora dos familias de un
              turno cada una comparten fila, cada una con su título. */}
          {vistos.length === 0 && (
            <p data-testid="dia-vacio" role="status" className="py-6 text-center text-body font-medium text-ink-soft">
              {dia ? `Nada el ${diaEnPalabras(dia)}` : "Nada en esta semana"}
            </p>
          )}
          <div
            data-testid="shifts-panel-list"
            className="mt-6 grid items-start gap-x-4 gap-y-7 md:grid-cols-2"
          >
            {/* En la compu, dos columnas como mucho (escritorio, renglón 1,
                2026-11-24): en el marco de 1024 px, tres dejaban tarjetas de
                ~300 px que partían el horario y la persona en dos líneas. */}
            {visibleFamilies.map((family) => {
              const list = families[family];
              const span = list.length >= 2 ? "md:col-span-2" : "";
              const cols = list.length >= 2 ? "md:grid-cols-2" : "";
              return (
                <section key={family} className={`min-w-0 scroll-mt-4 ${span}`} data-family={family}>
                  <h2 className="titulo-seccion mb-3">
                    {TITULO_GRUPO[family]}
                    <span className="ml-1.5 text-sm font-semibold text-ink-soft">{list.length}</span>
                  </h2>

                  <div className={`grid grid-cols-1 items-start gap-3 ${cols}`}>
                    {list.map((shift) => (
                      <TurnoPanel key={shift.id} shift={shift}>
                        <ShiftActions
                          shift={shift}
                          busy={busy}
                          locked={tapGuard.locked}
                          onRun={run}
                          onMarkPaid={() => askMarkPaid(shift.id)}
                          onNoShow={() => setConfirmNoShowId(shift.id)}
                          onYaLlego={(aHorario) => void yaLlego(shift.id, aHorario)}
                          onCancel={() => void askCancel(shift.id)}
                        />
                        {(shift.status === "finalizado" || shift.status === "pagado") && (
                          <div className="mt-3 flex flex-col gap-2">
                            <CobroEnElTurno shift={shift} />
                            <ReviewBox shiftId={shift.id} />
                          </div>
                        )}
                      </TurnoPanel>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <MasAdelante filas={futuros} onElegir={irADia} />
        </>
      )}
      </div>

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
        {/* Qué pasa con el turno depende de cuánto horario le queda (U080). */}
        <p className="text-sm text-ink/60">
          {noShowShift
            ? noShowConfirmCopy(noShowShift)
            : "El turno se libera para volver a buscar personal y le va a impactar la reputación al trabajador. Esta acción queda registrada."}
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

      <Modal
        open={confirmCancelId !== null}
        onClose={closeCancel}
        title="¿Cancelar este turno?"
      >
        {cancelChecking ? (
          // Texto en espera mientras se relee el turno (ver `askCancel`).
          <div role="status" aria-busy="true" data-testid="cancel-checking">
            <span className="sr-only">Revisando el estado del turno…</span>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
          </div>
        ) : (
          <>
            <p className="text-sm text-ink/60">{cancelCopy.body}</p>
            {/* El costo va antes de confirmar y sólo cuando aplica (ADR-0007:
                cancelar con el trabajador ya confirmado). */}
            {cancelCopy.lateCancellation && (
              <p className="mt-2 text-sm font-semibold text-ink">{cancelCopy.lateCancellation}</p>
            )}
          </>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="surface" size="sm" onClick={closeCancel}>
            Volver
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={cancelChecking}
            onClick={() => confirmCancelId && confirmCancel(confirmCancelId)}
          >
            Sí, cancelar turno
          </Button>
        </div>
      </Modal>

      <Modal
        open={confirmEventId !== null}
        onClose={() => {
          if (!tapGuard.locked) setConfirmEventId(null);
        }}
        title="¿Cancelar el evento entero?"
      >
        {eventChecking ? (
          <div role="status" aria-busy="true" data-testid="cancel-event-checking">
            <span className="sr-only">Revisando el estado del evento…</span>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
          </div>
        ) : eventCopy.count === 0 ? (
          <p className="text-sm text-ink/60">Este evento ya no tiene puestos para cancelar.</p>
        ) : (
          <>
            <p className="text-sm text-ink/60">{eventCopy.body}</p>
            {eventCopy.lateCancellation && (
              <p className="mt-2 text-sm font-semibold text-ink">{eventCopy.lateCancellation}</p>
            )}
          </>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="surface" size="sm" onClick={() => setConfirmEventId(null)}>
            Volver
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={eventChecking || tapGuard.locked || eventCopy.count === 0}
            onClick={() => confirmEventId && confirmCancelEvent(confirmEventId)}
          >
            Sí, cancelar evento
          </Button>
        </div>
      </Modal>

      <Modal
        open={confirmMarkPaidId !== null}
        onClose={() => {
          if (!tapGuard.locked) setConfirmMarkPaidId(null);
        }}
        title="¿Ya le pagaste este turno?"
      >
        <p className="text-sm text-ink/60">
          Se le avisa {payingWorkerName ? `a ${payingWorkerName}` : "al trabajador"} que ya cobró
          este turno y no vas a poder deshacerlo.
        </p>
        {/* Turno reofrecido (U080): lo que corresponde pagar es lo que
            restaba desde la llegada, no el monto publicado. */}
        {payingShift && payView(payingShift).kind === "prorrateado" && (
          <p className="mt-2 text-sm font-semibold text-ink">
            Corresponde pagar {payView(payingShift).amount}: lo que restaba del turno desde su
            llegada.
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="surface" size="sm" onClick={() => setConfirmMarkPaidId(null)}>
            Volver
          </Button>
          <Button
            size="sm"
            disabled={tapGuard.locked}
            onClick={() => confirmMarkPaidId && confirmMarkPaid(confirmMarkPaidId)}
          >
            Sí, ya le pagué
          </Button>
        </div>
      </Modal>

      {!loading && tourPendiente && <GuidedTour steps={EMPLOYER_PANEL_TOUR} storageKey="staffya_tour_employer_panel" />}
    </div>
  );
}
