"use client";

import ListaMapa from "@/components/worker/ListaMapa";
import dynamic from "next/dynamic";
import { useEsCompu } from "@/lib/use-es-compu";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
  sortByDistance,
} from "@/lib/current-location";
import { sortByBestPay } from "@/lib/pay";
import { FlameIcon, StarIcon } from "@/components/icons";
import OportunidadFila from "@/components/worker/OportunidadFila";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { EmptyState, ErrorBanner, NubesCielo, Skeleton, useToast } from "@/components/ui";
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
 * Con la dirección suave (ADR-0028) desde el 2026-11-20: el cielo corto con el
 * título en letra normal y los rubros como chips de vidrio (el elegido, en
 * azul hondo); debajo sube la hoja con los dos filtros, cuántos turnos hay y
 * cada turno como fila suave con el pago en grande (`OportunidadFila`). Del
 * 2026-11-19 al 20 fue «con relieve» (título en brocha, pestañas con raya y
 * comandas). Qué se pide, cómo se filtra y qué hace cada botón no cambió.
 */

const ShiftMap = dynamic(() => import("@/components/worker/ShiftMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-surface" />,
});

// Último recurso para abrir el mapa: sin ubicación ni turnos con coordenadas.
const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816]; // Obelisco


/** El turno resaltado en la compu (por un pin, el mouse o el teclado) y si la
 *  cámara lo acompaña. Vive fuera de React: resaltar una fila no vuelve a
 *  dibujar la página ni la lista; sólo el mapa se entera (`useSyncExternalStore`)
 *  y la fila se marca a mano con `data-elegido`. */
type Resaltado = { id: string | null; seguir: boolean };
function crearResaltado() {
  let actual: Resaltado = { id: null, seguir: false };
  let bloqueadoHasta = 0;
  const oyentes = new Set<() => void>();
  return {
    leer: () => actual,
    suscribir(fn: () => void) {
      oyentes.add(fn);
      return () => void oyentes.delete(fn);
    },
    poner(id: string | null, seguir: boolean) {
      if (actual.id === id && actual.seguir === seguir) return;
      actual = { id, seguir };
      oyentes.forEach((fn) => fn());
    },
    /** Elegido desde el mapa: la lista se desplaza y el mouse queda sobre otra
     *  fila; un rato después de elegir se ignora el hover. */
    bloquearHover: () => void (bloqueadoHasta = Date.now() + 700),
    hoverBloqueado: () => Date.now() < bloqueadoHasta,
  };
}
type StoreResaltado = ReturnType<typeof crearResaltado>;

/** El mapa de turnos al lado de la lista (`lg`). Memoizado: sólo se redibuja si
 *  cambian los turnos o el centro, o el turno resaltado (que lee del store). */
const MapaLateral = memo(function MapaLateral({
  shifts,
  center,
  sinOrigen,
  store,
  onSelect,
}: {
  shifts: Shift[];
  center: [number, number];
  sinOrigen: boolean;
  store: StoreResaltado;
  onSelect: (id: string) => void;
}) {
  const { id, seguir } = useSyncExternalStore(store.suscribir, store.leer, store.leer);
  return (
    <aside
      aria-label="Mapa de turnos"
      data-testid="buscar-mapa"
      className="buscar-mapa-lateral relative overflow-hidden lg:sticky lg:top-[calc(var(--chrome-top)+1rem)]"
    >
      <ShiftMap shifts={shifts} center={center} activeId={id} onSelect={onSelect} followActive={seguir} sinOrigen={sinOrigen} />
    </aside>
  );
});

/** Un chip de filtro: de vidrio sobre el cielo (`vidrio`) o suave en la hoja.
 *  El elegido va en azul hondo (`.chip-elegido`); el ámbar queda para la
 *  acción. 44 px de alto, que es lo que se toca. */
function chipClass(active: boolean, vidrio = false): string {
  return `${vidrio ? "chip-vidrio" : "chip-suave"} chip-filtro${active ? " chip-elegido" : ""}`;
}

/** El nombre del rubro como cabe bajo su ícono (la tecla mide 76 px). */
const NOMBRE_CORTO: Record<WorkerSkill, string> = {
  mozo: "Mozo/a",
  bartender: "Barra",
  barista: "Barista",
  runner: "Runner",
  cocinero: "Cocina",
  cajero: "Caja",
  recepcionista: "Recepción",
  personal_eventos: "Eventos",
  ayudante_cocina: "Ayudante",
  personal_salon: "Salón",
};

/** Cuántos turnos hay y en qué orden están, en una frase. */
function resumen(cantidad: number, opts: { urgentes: boolean; porPago: boolean; conOrigen: boolean }): string {
  const cuantos = `${cantidad} ${cantidad === 1 ? "turno" : "turnos"}${opts.urgentes ? (cantidad === 1 ? " urgente" : " urgentes") : ""}`;
  if (cantidad < 2) return cuantos;
  if (opts.porPago) return `${cuantos}, primero los que mejor pagan por hora`;
  if (!opts.conOrigen) return opts.urgentes ? cuantos : `${cuantos}, primero los urgentes`;
  return opts.urgentes
    ? `${cuantos}, del más cercano al más lejano`
    : `${cuantos}, primero los urgentes y después los más cercanos`;
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
  // En la compu, el mapa al lado: el turno resaltado (por el pin o por pasar el
  // mouse sobre su fila) y si la cámara lo acompaña (sólo cuando se toca un pin).
  const esCompu = useEsCompu();
  const [resaltado] = useState(crearResaltado);
  const listaRef = useRef<HTMLDivElement>(null);
  // La fila resaltada se marca en el DOM, sin pasar por el estado de la página.
  useEffect(() => {
    let marcada: Element | null = null;
    const marcar = () => {
      const { id } = resaltado.leer();
      marcada?.removeAttribute("data-elegido");
      marcada = id ? (listaRef.current?.querySelector(`[data-turno-id="${CSS.escape(id)}"]`) ?? null) : null;
      marcada?.setAttribute("data-elegido", "");
    };
    return resaltado.suscribir(marcar);
  }, [resaltado]);

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

  const stored = getStoredLocation();
  const originLat = stored?.latitude ?? profile?.latitude ?? null;
  const originLng = stored?.longitude ?? profile?.longitude ?? null;
  const origin = useMemo<[number, number] | null>(
    () => (originLat != null && originLng != null ? [originLat, originLng] : null),
    [originLat, originLng]
  );
  const sortedShifts = useMemo(() => {
    const byDistance = sortByDistance(shifts, origin);
    const sorted = sort === "pay" ? sortByBestPay(byDistance) : byDistance;
    return urgentOnly ? sorted.filter((s) => s.urgent) : sorted;
  }, [shifts, origin, sort, urgentOnly]);
  // Si cambia la lista (filtro, orden, turnos nuevos) o se pasa a celular, se
  // suelta el resaltado: su fila puede haber desaparecido y el pin quedaría
  // activo sin fila marcada.
  useEffect(() => {
    resaltado.poner(null, false);
  }, [resaltado, sortedShifts, esCompu]);

  // El mapa abre donde está la persona; sin ubicación, en el primer turno con
  // coordenadas (y sin el punto azul, que no sería ella).
  const primeroConCoords = sortedShifts.find((s) => s.latitude != null && s.longitude != null);
  const centroLat = origin?.[0] ?? primeroConCoords?.latitude ?? DEFAULT_CENTER[0];
  const centroLng = origin?.[1] ?? primeroConCoords?.longitude ?? DEFAULT_CENTER[1];
  const centro = useMemo<[number, number]>(() => [centroLat, centroLng], [centroLat, centroLng]);

  const elegirEnMapa = useMemo(
    () => (id: string) => {
      resaltado.bloquearHover();
      resaltado.poner(id, true);
      const fila = listaRef.current?.querySelector(`[data-turno-id="${CSS.escape(id)}"]`);
      fila?.scrollIntoView({ block: "center", behavior: "smooth" });
    },
    [resaltado]
  );
  // Con el mouse o el teclado sobre una fila: se resalta su pin (la cámara no se mueve).
  const resaltarFila = (id: string) => {
    if (!resaltado.hoverBloqueado()) resaltado.poner(id, false);
  };

  return (
    <div className="estilo-suave mx-auto flex min-h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] max-w-md flex-col md:min-h-[calc(100dvh-var(--chrome-top))] md:max-w-5xl md:px-4 md:pt-4">
      {/* El cielo corto: el título y la frase. Los rubros van en la hoja. La
          hoja sube 28 px encima. */}
      <div className="app-cielo cielo-limpio px-4 pb-10 pt-5 md:rounded-t-[28px] md:px-6 md:pt-6">
        <NubesCielo nubes={[{ forma: "a", ancho: 250, pos: { right: -100, top: -66 } }]} />
        {/* El título y, a su lado, el conmutador Lista / Mapa. */}
        <div className="flex items-start justify-between gap-3">
          <h1 className="titulo-pantalla min-w-0 break-words">Buscar turnos</h1>
          <ListaMapa actual="lista" className="shrink-0" />
        </div>
        <p className="mt-1 text-sm">Explorá oportunidades de cualquier rubro, no sólo el tuyo.</p>
      </div>

      <div className="hoja -mt-7 flex-1 px-4 pb-8 pt-5 md:px-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="min-w-0">
        {/* Accesos por rubro: una tecla suave con el ícono y el nombre corto de
            cada rubro. Tocar una filtra; tocarla de nuevo la suelta (no hay
            «Todos»). Un carril que se desliza en el celular; en la compu, donde
            no hay cómo deslizarlo, bajan de renglón. */}
        <div
          role="group"
          aria-label="Rubro"
          data-testid="buscar-rubros"
          className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto scroll-px-4 px-4 pb-3 pt-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
        >
          {WORKER_SKILLS.map((sk) => {
            const { Icon } = SKILL_ACCENT[sk];
            const elegido = skill === sk;
            return (
              <button
                key={sk}
                type="button"
                aria-pressed={elegido}
                aria-label={SKILL_LABELS[sk]}
                onClick={() => setSkill(elegido ? "" : sk)}
                className="tecla-rubro"
              >
                <span aria-hidden className="tecla-rubro-icono">
                  <Icon size={22} />
                </span>
                <span aria-hidden className="tecla-rubro-nombre">
                  {NOMBRE_CORTO[sk]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1 md:-mx-6 md:px-6">
          <button
            type="button"
            role="switch"
            aria-checked={urgentOnly}
            onClick={() => setUrgentOnly((v) => !v)}
            className={chipClass(urgentOnly)}
          >
            <FlameIcon size={14} /> Urgentes
          </button>
          <button
            type="button"
            aria-pressed={sort === "pay"}
            onClick={() => setSort((v) => (v === "pay" ? "nearby" : "pay"))}
            className={chipClass(sort === "pay")}
          >
            <StarIcon size={14} filled /> Mejores pagos
          </button>
        </div>

        {error && (
          <div className="mt-4">
            <ErrorBanner message={error} onRetry={() => load()} />
          </div>
        )}

        <div className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-[156px] w-full rounded-[18px]" />
              ))}
            </div>
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
            <>
              <p data-testid="buscar-resumen" className="mb-3 text-caption font-medium text-ink-soft">
                {resumen(sortedShifts.length, { urgentes: urgentOnly, porPago: sort === "pay", conOrigen: origin !== null })}
              </p>
              {/* Cada turno es una fila suave con el pago en grande. Un solo
                  ámbar por pantalla: «Postularme» va en ámbar en el primero de
                  la lista y quieto en los demás (como «Elegir» en Candidatos). */}
              <div
                ref={listaRef}
                className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-1"
                onMouseLeave={esCompu ? () => resaltado.poner(null, false) : undefined}
                onBlurCapture={
                  esCompu
                    ? (e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) resaltado.poner(null, false);
                      }
                    : undefined
                }
              >
                {sortedShifts.map((shift, i) => (
                  <div
                    key={shift.id}
                    data-turno-id={shift.id}
                    onMouseEnter={esCompu ? () => resaltarFila(shift.id) : undefined}
                    onFocusCapture={esCompu ? () => resaltarFila(shift.id) : undefined}
                    className="fila-buscar-celda"
                  >
                    <OportunidadFila
                      shift={shift}
                      distanceKm={distanceOf(shift, origin)}
                      destacado={i === 0}
                      applying={decidingId === shift.id}
                      onApply={() => handleDecide(shift, "like")}
                      onPass={() => handleDecide(shift, "pass")}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        </div>

        {/* En la compu, el mapa al lado de la lista (escritorio, renglón 4/10):
            los turnos con su pago en el pin; tocar un pin resalta su fila. Pegado
            arriba mientras se baja por la lista. En el celular no se monta. */}
        {esCompu && (
          <MapaLateral shifts={sortedShifts} center={centro} sinOrigen={origin === null} store={resaltado} onSelect={elegirEnMapa} />
        )}
      </div>
    </div>
  );
}
