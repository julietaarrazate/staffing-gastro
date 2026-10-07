"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { cn } from "@/lib/cn";
import ShiftCard from "@/components/ShiftCard";
import { DrawnCheck } from "@/components/ui";
import { MapPinIcon } from "@/components/icons";
import { estimateArrivalMin } from "@/lib/map/travel-time";
import type { RelojKey } from "./fixtures";
import { PushNotice, StreetGrid } from "./replicas";
import { setReloj } from "./relojStore";
import { Narration, SceneLabel, Stage, type NarrationItem } from "./Stage";
import { StaticFrame } from "./ActoPedido";
import { scrollToProgress, seg, useStage } from "./useStage";
import { useStoryShift } from "./useStoryShift";
import { easeInOut, stageBox, useStageLayout, type StageBox } from "./layout";

/* ACTO 4 · CONFIRMACIÓN. La calma después del pico.
 *
 * El mismo turno, ahora en el panel del local. Responde la ansiedad que
 * sigue ("¿viene o no viene?") con lo que la app hace de verdad: ella prende
 * "Voy en camino" y en la tarjeta del local aparece su última posición. El
 * punto SALTA (cada salto es una posición nueva que ella manda), nunca se
 * desliza por las calles: la línea es recta y el tiempo lleva "~". Al marcar
 * "Llegué", la posición se borra. */

const T = {
  sharing: 0.08,
  jump1: 0.22,
  jump2: 0.33,
  jump3: 0.44,
  arrived: 0.57,
  clear: 0.68,
};
const STOPS = [T.sharing, T.jump1, T.jump2, T.jump3, T.arrived, T.clear] as const;
const RELOJ_POR_PASO: RelojKey[] = ["cubierto", "enCamino", "enCamino", "enCamino", "enCamino", "llego", "llego"];

/** Distancia de Lucía al local en cada posición que manda (km). La primera
 *  coincide con la de su tarjeta de candidata. */
const DISTANCIAS = [0.6, 0.42, 0.26, 0.12];
/** Dónde está en el mapa chico (0–1), sobre la recta hasta el local. */
const DESDE = { x: 0.16, y: 0.78 };
const LOCAL = { x: 0.74, y: 0.34 };

const NARRACION: NarrationItem[] = [
  {
    title: "La ves llegar.",
    line: "Lo prende ella cuando sale. Ves sólo su última posición, nunca el recorrido.",
  },
  {
    title: "Llegó. Queda registrado.",
    line: "Marca “Llegué” y queda la hora, con su ubicación. Al llegar, deja de compartirse.",
  },
];

// backend/app/modules/shift/application/services.py (primer aviso de "va en camino")
const PUSH_SALIO = {
  title: "Lucía salió para tu local",
  body: "Está a menos de 1 km. Seguilo en el turno “Mozo/a”.",
};

type Layout = StageBox & {
  colX: number;
  colW: number;
  top: number;
  s: number;
  panel: { x: number; y: number; w: number };
};

/** Alto aproximado de la tarjeta del local con el mapa abierto, al ancho
 *  del celular. Se usa sólo para decidir la escala. */
const CARD_FULL_MOBILE = 500;
const PANEL_MOBILE = 132;

function computeLayout(w: number, h: number): Layout {
  const b = stageBox(w, h);
  const avail = b.visBottom - b.visTop;
  if (b.desktop) {
    // En escritorio la tarjeta va un poco más grande que en la app: es la
    // protagonista de la escena y la columna tiene lugar de sobra.
    const s = Math.max(1, Math.min(1.15, avail / 600, (b.visW - 340) / 380));
    const colW = Math.round(Math.min(380 * s, b.visW - 340));
    const gap = Math.min(56, b.visW - colW - 300);
    const panelW = Math.min(320, b.visW - colW - gap);
    const total = colW + gap + panelW;
    const colX = b.visX + (b.visW - total) / 2;
    return {
      ...b,
      colX,
      colW,
      top: b.visTop + Math.max(0, (avail - 560 * s) / 2),
      s,
      panel: { x: colX + colW + gap, y: b.visTop + Math.max(0, (avail - 300) / 2), w: panelW },
    };
  }
  const s = Math.min(1, (avail - PANEL_MOBILE - 12) / CARD_FULL_MOBILE);
  const colW = b.visW;
  return {
    ...b,
    colX: b.visX,
    colW,
    top: b.visTop,
    s,
    panel: { x: b.visX, y: b.visBottom - PANEL_MOBILE + 8, w: b.visW },
  };
}

/* ── Versión animada ────────────────────────────────────────────────────── */

export function ActoLlegada() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { progress, step, jumped } = useStage(sectionRef, STOPS);
  const { layout: L } = useStageLayout(stageRef, computeLayout);

  // En el celular, el panel de Lucía va pegado abajo de la tarjeta: cuando el
  // mapa se abre la empuja, y cuando se borra (al llegar) sube con ella.
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(0);
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCardH(el.offsetHeight));
    ro.observe(el);
    setCardH(el.offsetHeight);
    return () => ro.disconnect();
  }, []);
  const panelTop = L.desktop || !cardH ? L.panel.y : Math.min(L.panel.y, L.top + cardH * L.s + 20);

  useEffect(() => {
    const p = progress.get();
    if (p > 0 && p < 1) setReloj(RELOJ_POR_PASO[step]);
  }, [step, progress]);

  // Ella decide si comparte: el control de abajo es lo único que se puede
  // tocar en esta escena. Al llegar se corta solo.
  const [sharingChoice, setSharingChoice] = useState(true);
  const arrived = step >= 5;
  const sharing = step >= 1 && !arrived && sharingChoice;
  const jump = Math.max(0, Math.min(3, step - 1));

  const [pressed, setPressed] = useState(false);
  const prevStep = useRef(step);
  useEffect(() => {
    const from = prevStep.current;
    prevStep.current = step;
    if (step === 5 && step === from + 1 && !jumped) {
      setPressed(true);
      const id = setTimeout(() => setPressed(false), 180);
      return () => clearTimeout(id);
    }
    if (step <= 1) setSharingChoice(true);
  }, [step, jumped]);

  const status = arrived ? "check_in" : "confirmado";
  const shift = useStoryShift(status, { company_name: "Tu bar", worker_name: "Lucía" });
  const hint = arrived ? "Llegó al local." : "Confirmó. Te avisamos cuando salga para allá.";

  // Apertura: un círculo de lienzo que se abre desde donde estaba el
  // "¡Oído!" (el centro) y tapa el ámbar. Se abre mientras la escena sube,
  // antes de fijarse: así no queda una pantalla de ámbar vacío entre la banda
  // y la tarjeta.
  const { scrollYProgress: entering } = useScroll({ target: sectionRef, offset: ["start end", "start start"] });
  const openClip = useTransform(entering, (e) => {
    const r = easeInOut(seg(e, 0.25, 1)) * 75;
    return `circle(${r.toFixed(2)}% at 50% 50%)`;
  });
  const [lit, setLit] = useState(false);
  useMotionValueEvent(entering, "change", (e) => {
    const next = e > 0.8;
    setLit((v) => (v === next ? v : next));
  });

  const narrIndex = step >= 5 ? 1 : 0;
  const t = jumped ? { duration: 0 } : { duration: 0.34, ease: [0.2, 0.8, 0.2, 1] as const };

  return (
    <Stage ref={sectionRef} states={2.4} tone={lit ? "light" : "amber"} label="La ves llegar" stageClassName="bg-primary">
      <div ref={stageRef} className="absolute inset-0">
        <motion.div style={{ clipPath: openClip }} className="absolute inset-0 bg-background">
          <SceneLabel className="absolute left-4 top-[3.25rem] sm:left-6 lg:left-12">Lo que ve tu bar</SceneLabel>

          {/* La tarjeta real del panel del local */}
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              transform: `translate(${L.colX}px, ${L.top}px) scale(${L.s})`,
              width: L.colW / L.s,
            }}
          >
            <div ref={cardRef} inert>
              <ShiftCard shift={shift} perspective="employer">
                <p className="text-sm text-ink/60">{hint}</p>
                <AnimatePresence initial={false}>
                  {(sharing || (arrived && step < 6)) && (
                    <motion.div
                      key="mapa"
                      initial={jumped ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: jumped ? 0 : 0.42, ease: [0.2, 0.8, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="pt-3">
                        <EnRouteMapReplica jump={jump} arrived={arrived} jumped={jumped} compact={!L.desktop} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </ShiftCard>
            </div>
          </div>

          {/* "Lucía salió para tu local" */}
          <AnimatePresence>
            {step >= 1 && step <= 2 && (
              <motion.div
                key="push"
                initial={jumped ? false : { y: -36, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -24, opacity: 0 }}
                transition={t}
                className="absolute z-30"
                style={{
                  left: L.desktop ? L.colX : L.visX,
                  top: L.visTop - 8,
                  width: L.desktop ? L.colW : L.visW,
                }}
              >
                <PushNotice title={PUSH_SALIO.title} body={PUSH_SALIO.body} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Lo que ve Lucía: el control de "Voy en camino" y "Llegué" */}
          <div className="absolute z-20" style={{ left: L.panel.x, top: panelTop, width: L.panel.w }}>
            <SceneLabel>Lo que ve Lucía</SceneLabel>
            <div className="mt-2 flex flex-col gap-2">
              {!arrived ? (
                <ToggleReplica
                  sharing={sharing}
                  compact={!L.desktop}
                  disabled={step < 1}
                  onToggle={() => setSharingChoice((v) => !v)}
                />
              ) : null}
              <button
                type="button"
                disabled={arrived}
                onClick={() => scrollToProgress(sectionRef.current, T.arrived + 0.02)}
                className={cn(
                  "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[var(--radius-btn)] px-4 text-sm font-semibold transition-[transform,background-color,color] duration-200",
                  arrived
                    ? "bg-success-tint text-success-text"
                    : "bg-primary text-night shadow-[var(--shadow-primary)]",
                  pressed ? "scale-[0.96]" : "scale-100"
                )}
              >
                {arrived ? <DrawnCheck size={16} animate={!jumped} /> : <MapPinIcon size={16} />}
                {arrived ? "Llegaste" : "Llegué"}
              </button>
            </div>
          </div>
        </motion.div>

        <Narration
          items={NARRACION}
          index={narrIndex}
          className={cn(
            "absolute z-40 transition-opacity duration-300",
            lit ? "opacity-100" : "opacity-0",
            L.desktop
              ? "left-12 top-1/2 w-[calc(41.666%-6rem)] -translate-y-1/2"
              : "inset-x-4 bottom-[max(1.75rem,env(safe-area-inset-bottom))] sm:inset-x-6"
          )}
        />
      </div>
    </Stage>
  );
}

/**
 * El mapa chico de "va en camino" (components/employer/EnRouteMap.tsx), sin
 * MapLibre: las mismas calles de toda la historia, el local como cuadrado
 * negro, ella como punto ámbar con halo y una línea RECTA punteada (la app no
 * calcula rutas). El tiempo sale de la misma estimación que usa la app.
 */
function EnRouteMapReplica({
  jump,
  arrived,
  jumped,
  compact,
}: {
  jump: number;
  arrived: boolean;
  jumped: boolean;
  compact: boolean;
}) {
  const k = arrived ? 1 : [0, 0.32, 0.62, 0.85][jump];
  const pos = { x: DESDE.x + (LOCAL.x - DESDE.x) * k, y: DESDE.y + (LOCAL.y - DESDE.y) * k };
  const km = DISTANCIAS[jump];
  const eta = estimateArrivalMin(km);
  const t = jumped ? { duration: 0 } : { duration: 0.25, ease: [0.2, 0, 0, 1] as const };
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] ring-1 ring-line">
      <div className={cn("relative w-full bg-[#ece6da]", compact ? "h-28" : "h-36")}>
        <StreetGrid />
        <svg className="absolute inset-0 h-full w-full" aria-hidden>
          <motion.line
            x1={`${LOCAL.x * 100}%`}
            y1={`${LOCAL.y * 100}%`}
            initial={false}
            animate={{ x2: `${pos.x * 100}%`, y2: `${pos.y * 100}%`, opacity: arrived ? 0 : 0.7 }}
            transition={t}
            stroke="#d97706"
            strokeWidth={2}
            strokeDasharray="4 4"
          />
        </svg>
        <span
          className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-[4px] border-2 border-white bg-night shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
          style={{ left: `${LOCAL.x * 100}%`, top: `${LOCAL.y * 100}%` }}
        />
        <motion.span
          className="absolute flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
          initial={false}
          animate={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, scale: arrived ? 0 : 1 }}
          transition={t}
        >
          <span className="absolute -inset-2 rounded-full bg-primary/25 [animation:puckHalo_2s_ease-out_infinite]" />
          <span className="h-4 w-4 rounded-full border-[3px] border-white bg-primary shadow-[0_2px_6px_rgba(0,0,0,0.3)]" />
        </motion.span>
        {arrived && (
          <span
            className="absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card text-success-text shadow-[var(--shadow-soft)]"
            style={{ left: `${LOCAL.x * 100}%`, top: `${LOCAL.y * 100}%` }}
          >
            <DrawnCheck size={22} animate={!jumped} />
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 bg-card px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{arrived ? "Lucía llegó" : "Lucía va en camino"}</p>
          <p className="text-xs text-ink/60">
            {arrived ? "Marcó su llegada · recién" : `a ${Math.round(km * 1000)} m · recién`}
          </p>
        </div>
        <p className="shrink-0 text-right text-sm font-bold tabular-nums text-ink">
          {arrived ? "" : eta === null ? "Llegando" : `~${eta} min`}
        </p>
      </div>
    </div>
  );
}

/** El control de "Voy en camino" de Lucía (components/worker/EnRouteToggle.tsx).
 *  En el celular, sin la línea de explicación. */
function ToggleReplica({
  sharing,
  compact,
  disabled,
  onToggle,
}: {
  sharing: boolean;
  compact: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={cn("rounded-[var(--radius-card)] bg-surface ring-1 ring-line", compact ? "p-2.5" : "p-3.5")}>
      <div className={cn("flex gap-2.5", compact ? "items-center" : "items-start")}>
        <span
          aria-hidden
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
            compact ? "" : "mt-0.5",
            sharing ? "bg-primary text-night" : "bg-card text-ink/45"
          )}
        >
          <MapPinIcon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            {sharing ? "Estás avisando que vas en camino" : "Avisá que vas en camino"}
          </p>
          {!compact && (
            <p className="mt-0.5 text-xs text-ink/60">
              {sharing
                ? "El comercio ve que estás llegando. Se corta solo cuando marcás tu llegada."
                : "El comercio ve dónde estás mientras viajás, hasta que marcás tu llegada. Podés cortarlo cuando quieras."}
            </p>
          )}
        </div>
        {compact && (
          <button
            type="button"
            disabled={disabled}
            onClick={onToggle}
            className="inline-flex min-h-[40px] shrink-0 items-center rounded-[var(--radius-btn)] bg-card px-3 text-xs font-semibold text-ink ring-1 ring-line"
          >
            {sharing ? "Dejar de compartir" : "Voy en camino"}
          </button>
        )}
      </div>
      {!compact && (
        <button
          type="button"
          disabled={disabled}
          onClick={onToggle}
          className={cn(
            "mt-3 inline-flex min-h-[40px] w-full items-center justify-center rounded-[var(--radius-btn)] px-4 text-sm font-semibold",
            sharing ? "bg-card text-ink ring-1 ring-line" : "bg-primary text-night shadow-[var(--shadow-primary)]"
          )}
        >
          {sharing ? "Dejar de compartir" : "Voy en camino"}
        </button>
      )}
    </div>
  );
}

/* ── Versión estática ───────────────────────────────────────────────────── */

export function ActoLlegadaStatic() {
  const enCamino = useStoryShift("confirmado");
  const llego = useStoryShift("check_in");
  return (
    <section aria-label="La ves llegar" data-tone="light" className="px-4 py-16 sm:px-6 lg:px-12 lg:py-24">
      <div className="mx-auto flex max-w-[64rem] flex-col gap-20">
        <StaticFrame reloj="enCamino" item={NARRACION[0]} label="Lo que ve tu bar">
          <div inert className="mx-auto max-w-[400px]">
            <ShiftCard shift={enCamino} perspective="employer">
              <p className="text-sm text-ink/60">Confirmó. Te avisamos cuando salga para allá.</p>
              <div className="pt-3">
                <EnRouteMapReplica jump={1} arrived={false} jumped compact={false} />
              </div>
            </ShiftCard>
          </div>
        </StaticFrame>
        <StaticFrame reloj="llego" item={NARRACION[1]} label="Lo que ve tu bar">
          <div inert className="mx-auto max-w-[400px]">
            <ShiftCard shift={llego} perspective="employer">
              <p className="text-sm text-ink/60">Llegó al local.</p>
            </ShiftCard>
          </div>
        </StaticFrame>
      </div>
    </section>
  );
}
