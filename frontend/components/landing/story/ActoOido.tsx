"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { cn } from "@/lib/cn";
import CandidateCard from "@/components/CandidateCard";
import ShiftCard from "@/components/ShiftCard";
import { Avatar, ConfirmOverlay, Rating } from "@/components/ui";
import { formatKm } from "@/lib/format";
import { CANDIDATES, MAP_LOCAL, MAP_WORKERS, type RelojKey } from "./fixtures";
import RelojDelTurno from "./RelojDelTurno";
import { PhoneFrame, PricePin, PushNotice, StreetGrid, ToastLine, WorkerPin } from "./replicas";
import { setReloj } from "./relojStore";
import { Narration, SceneLabel, Stage, type NarrationItem } from "./Stage";
import { StaticFrame } from "./ActoPedido";
import { scrollToProgress, seg, useRange, useStage } from "./useStage";
import { useStoryShift } from "./useStoryShift";
import {
  easeIn,
  easeInOut,
  lerp,
  mapPoint,
  PHONE_W,
  phoneRect,
  stageBox,
  useStageLayout,
  type StageBox,
} from "./layout";

/* ACTO 3 · MATCH. El pico de la página.
 *
 * Abre sobre el mismo mapa del pedido: los tres que se postularon son ahora
 * pines ámbar, y cada pin se abre en su tarjeta (nadie aparece de la nada).
 * Las razones de Lucía se encienden junto con el dato que las respalda. El
 * comercio la asigna; del otro lado le llega a ella, confirma, y del botón
 * sale el "¡Oído!": la única burbuja con rebote y la única pantalla ámbar a
 * sangre de toda la landing. En ese instante el reloj se congela en 20:54. */

const T = {
  push: 0.05,
  cardsFrom: 0.12,
  cardsTo: 0.24,
  reasons: 0.27,
  assign: 0.39,
  swapFrom: 0.49,
  swapTo: 0.56,
  assigned: 0.58,
  confirm: 0.69,
  wipeFrom: 0.74,
  wipeTo: 0.85,
  shoutFrom: 0.8,
  shoutTo: 0.87,
};
const STOPS = [T.push, T.reasons, T.assign, T.assigned, T.confirm, T.wipeFrom] as const;
const RELOJ_POR_PASO: RelojKey[] = ["postulante", "postulantes", "postulantes", "asignado", "asignado", "asignado", "cubierto"];

const NARRACION: NarrationItem[] = [
  {
    title: "Elegís viendo por qué.",
    line: "Puntualidad, turnos hechos y distancia salen de turnos reales en Oído. Nada autodeclarado.",
  },
  {
    title: "Lo asignás. Ella confirma.",
    line: "Si no puede, lo rechaza y el turno vuelve a buscar.",
  },
];

// backend/app/modules/application/application/services.py (aviso de postulante)
const PUSH_POSTULANTES = {
  title: "3 postulantes para Mozo/a",
  body: "Camila P. se postuló a tu turno de Mozo/a. Entrá para ver a todos los postulantes y elegir.",
};
// backend/app/modules/shift/application/services.py (asignación)
const PUSH_ASIGNADO = {
  title: "Te asignaron un turno",
  body: "Te asignaron el turno “Mozo/a”. Confirmá tu asistencia.",
};

const ORDER = ["lucia", "diego", "camila"] as const;
const ROW_H = 64;

type Layout = StageBox & {
  colX: number;
  colW: number;
  top: number;
  cardH: number;
  /** Escala de la columna: 1 salvo en pantallas bajas, donde se achica para
   *  no pisar la narración. */
  cs: number;
  phone: { x: number; y: number; s: number };
};

function computeLayout(w: number, h: number, cardH: number, narrH?: number): Layout {
  const b = stageBox(w, h, narrH);
  const avail = b.visBottom - b.visTop;
  const colW = b.desktop ? Math.min(400, b.visW - PHONE_W - 48) : b.visW;
  // Encabezado + tarjeta + dos filas + el aviso de abajo.
  const total = 26 + cardH + 2 * (ROW_H + 10) + 62;
  const cs = Math.min(1, (avail + 24) / total);
  return {
    ...b,
    colX: b.visX,
    colW,
    top: b.visTop + Math.max(0, (avail - total * cs) / 2),
    cardH,
    cs,
    phone: phoneRect(b, b.desktop ? "right" : "center"),
  };
}

/** Rectángulo final de cada candidato en la columna. */
function slot(l: Layout, i: number) {
  const c = l.cs;
  const y0 = l.top + 26 * c;
  const x = l.colX + (l.colW * (1 - c)) / 2;
  if (i === 0) return { x, y: y0, w: l.colW, h: l.cardH };
  return { x, y: y0 + (l.cardH + 10 + (i - 1) * (ROW_H + 10)) * c, w: l.colW, h: ROW_H };
}

/** En escritorio la columna de candidatos va centrada mientras está sola y
 *  se corre a la izquierda cuando entra el celular de Lucía. */
function colShift(l: Layout, p: number) {
  if (!l.desktop) return 0;
  return ((l.visW - l.colW) / 2) * (1 - easeInOut(seg(p, T.swapFrom, T.swapTo)));
}

/* ── Versión animada ────────────────────────────────────────────────────── */

type Ring = { key: string; x: number; y: number; w: number; h: number; delay: number };

export function ActoOido() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const luciaRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const narrRef = useRef<HTMLDivElement>(null);
  const { progress, step, jumped } = useStage(sectionRef, STOPS);
  const { layout: L, ref: Lr } = useStageLayout(
    stageRef,
    (w, h) => computeLayout(w, h, luciaRef.current?.offsetHeight ?? 300, narrRef.current?.offsetHeight),
    [luciaRef, narrRef]
  );

  useEffect(() => {
    const p = progress.get();
    if (p > 0 && p < 1) setReloj(RELOJ_POR_PASO[step]);
  }, [step, progress]);

  // ── Momentos por tiempo ─────────────────────────────────────────────────
  const [rings, setRings] = useState<Ring[]>([]);
  const [pressed, setPressed] = useState<"asignar" | "confirmar" | null>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const [burst, setBurst] = useState(0);
  const prevStep = useRef(step);

  /** Dónde nace el "¡Oído!": el botón "Confirmar" del celular de Lucía. */
  function measureOrigin() {
    const stage = stageRef.current;
    const btn = confirmRef.current;
    if (!stage || !btn) return;
    const s = stage.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    const o = { x: b.left - s.left + b.width / 2, y: b.top - s.top + b.height / 2 };
    originRef.current = o;
    setOrigin(o);
  }

  /** Cada razón de Lucía se enciende junto con el dato que la respalda. */
  function highlightReasons() {
    const stage = stageRef.current;
    const card = luciaRef.current;
    if (!stage || !card) return;
    const s = stage.getBoundingClientRect();
    // Los anillos van adentro de la columna, que ya está corrida.
    const dx = colShift(Lr.current, progress.get());
    const pairs: [string, string][] = [
      ["del local", "0,6 km"],
      ["Muy puntual", "96% puntual"],
      ["turnos en Oído", "23 turnos"],
    ];
    const next: Ring[] = [];
    pairs.forEach(([reason, chip], i) => {
      [findText(card, reason), findChip(card, chip)].forEach((el, j) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        next.push({
          key: `${i}-${j}`,
          x: r.left - s.left - 4 - dx,
          y: r.top - s.top - 3,
          w: r.width + 8,
          h: r.height + 6,
          delay: i * 0.5067,
        });
      });
    });
    setRings(next);
  }

  // Lo que pasa al entrar a cada paso.
  useEffect(() => {
    const from = prevStep.current;
    prevStep.current = step;
    const forward = step === from + 1 && !jumped;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (step === 2 && forward) highlightReasons();
    // Los anillos son del paso de las razones: si se sigue de largo antes de
    // que terminen, no quedan dibujados encima de "Asignado".
    if (step !== 2) setRings([]);
    if (step === 3 && forward) {
      setPressed("asignar");
      timers.push(setTimeout(() => setPressed(null), 240));
    }
    if (step >= 5) {
      measureOrigin();
      if (step === 5 && forward) {
        setPressed("confirmar");
        timers.push(setTimeout(() => setPressed(null), 240));
        setBurst((b) => b + 1);
      }
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Mapa → tarjetas ─────────────────────────────────────────────────────
  const mapOpacity = useRange(progress, [T.cardsFrom + 0.02, T.cardsTo - 0.02], [1, 0]);
  const pushY = useRange(progress, [T.cardsFrom, T.cardsFrom + 0.03], [0, -30]);
  const pushOpacity = useRange(progress, [T.cardsFrom, T.cardsFrom + 0.03], [1, 0]);

  // ── Columna de candidatos → celular (en el celular, una cosa por vez) ───
  const colY = useTransform(progress, (p) => {
    const l = Lr.current;
    return l.desktop ? 0 : -(l.h * 0.5) * easeInOut(seg(p, T.swapFrom, T.swapTo));
  });
  const colX = useTransform(progress, (p) => colShift(Lr.current, p));
  const colOpacity = useTransform(progress, (p) => (Lr.current.desktop ? 1 : 1 - seg(p, T.swapFrom, T.swapFrom + 0.035)));
  const phoneY = useTransform(progress, (p) => {
    const l = Lr.current;
    const k = easeInOut(seg(p, T.swapFrom, T.swapTo));
    return l.desktop ? 0 : (1 - k) * l.h * 0.7;
  });
  const phoneX = useTransform(progress, (p) => {
    const l = Lr.current;
    return l.desktop ? (1 - easeInOut(seg(p, T.swapFrom, T.swapTo))) * 80 : 0;
  });
  const phoneOpacity = useRange(progress, [T.swapFrom, T.swapFrom + 0.03], [0, 1]);

  // ── El pico ─────────────────────────────────────────────────────────────
  const amberClip = useTransform(progress, (p) => {
    const l = Lr.current;
    const o = originRef.current ?? { x: l.phone.x + (PHONE_W * l.phone.s) / 2, y: l.phone.y + 420 * l.phone.s };
    const max = Math.hypot(Math.max(o.x, l.w - o.x), Math.max(o.y, l.h - o.y));
    const r = easeIn(seg(p, T.wipeFrom, T.wipeTo)) * max * 1.02;
    return `circle(${r.toFixed(1)}px at ${o.x.toFixed(1)}px ${o.y.toFixed(1)}px)`;
  });
  const shoutOpacity = useRange(progress, [T.shoutFrom, T.shoutTo], [0, 1]);
  const shoutScale = useRange(progress, [T.shoutFrom, T.shoutTo], [0.9, 1]);
  const lineOpacity = useRange(progress, [T.shoutTo - 0.02, T.shoutTo + 0.03], [0, 1]);
  const narrOpacity = useRange(progress, [T.confirm - 0.01, T.confirm + 0.02], [1, 0]);

  const [amberOn, setAmberOn] = useState(false);
  const [peak, setPeak] = useState(false);
  useMotionValueEvent(progress, "change", (p) => {
    const a = p > T.wipeTo - 0.03;
    const k = p > T.confirm - 0.01;
    setAmberOn((v) => (v === a ? v : a));
    setPeak((v) => (v === k ? v : k));
  });

  const headOpacity = useRange(progress, [T.cardsTo - 0.03, T.cardsTo], [0, 1]);
  const narrIndex = useNarrIndex(progress, [T.assign - 0.03]);
  const assignedShift = useStoryShift("asignado");

  return (
    <Stage
      ref={sectionRef}
      states={3.2}
      tone="light"
      label="Elegís viendo por qué"
      hideHeaderCta={peak}
      stageClassName="bg-background"
    >
      <div ref={stageRef} className="absolute inset-0">
        <SceneLabel className="absolute left-4 top-[3.25rem] z-20 sm:left-6 lg:left-12">
          {step >= 3 && !L.desktop && progress.get() > T.swapFrom ? "Lo que ve Lucía" : "Lo que ve tu bar"}
        </SceneLabel>

        {/* El mismo mapa del pedido, con los tres postulantes en ámbar */}
        <motion.div style={{ opacity: mapOpacity }} className="absolute inset-0" aria-hidden>
          <div
            className={cn("absolute overflow-hidden bg-[var(--mapa)]", !L.map.bleed && "rounded-[1.75rem]")}
            style={{ left: L.map.x, top: L.map.y, width: L.map.w, height: L.map.h }}
          >
            <StreetGrid />
          </div>
          {MAP_WORKERS.map((w) => {
            const pt = mapPoint(L.map, w.x, w.y);
            return (
              <span
                key={w.id}
                className={cn("absolute -translate-x-1/2 -translate-y-1/2", !w.candidato && "opacity-45")}
                style={{ left: pt.x, top: pt.y }}
              >
                <WorkerPin inicial={w.inicial} variant={w.candidato ? "candidato" : "avisado"} rating={w.rating} />
              </span>
            );
          })}
          <PricePin
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{ left: mapPoint(L.map, MAP_LOCAL.x, MAP_LOCAL.y).x, top: mapPoint(L.map, MAP_LOCAL.x, MAP_LOCAL.y).y }}
          />
        </motion.div>

        {/* "3 postulantes": cae desde el reloj, es el turno el que avisa */}
        <AnimatePresence>
          {step >= 1 && (
            <motion.div
              key="push"
              initial={jumped ? false : { y: -40, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4533, ease: [0.2, 0.8, 0.2, 1] }}
              className="absolute z-30"
              style={{ left: L.visX + (L.visW - Math.min(L.visW, 360)) / 2, top: L.visTop, width: Math.min(L.visW, 360) }}
            >
              <motion.div style={{ y: pushY, opacity: pushOpacity }}>
                <PushNotice title={PUSH_POSTULANTES.title} body={PUSH_POSTULANTES.body} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Los candidatos, en el orden del ranking */}
        <motion.div style={{ x: colX, y: colY, opacity: colOpacity }} className="absolute inset-0 z-10">
          <motion.p
            style={{ opacity: headOpacity, left: L.colX, top: L.top }}
            className="absolute font-mono text-label font-medium uppercase tracking-[0.14em] text-ink-mute"
          >
            Candidatos · 3
          </motion.p>
          {ORDER.map((id, i) => (
            <CandidateSlot key={id} id={id} i={i} progress={progress} layoutRef={Lr} layout={L}>
              {i === 0 ? (
                <motion.div
                  animate={{ scale: pressed === "asignar" ? 0.985 : 1 }}
                  transition={{ duration: 0.2 }}
                  className="relative rounded-[var(--radius-card)]"
                >
                  <div ref={luciaRef} inert>
                    <CandidateCard candidate={CANDIDATES[0]} onAssign={() => {}} recommended />
                  </div>
                  {/* "Asignar" del recomendado: el real queda adentro del
                      `inert`; éste lo cubre y es el que se puede tocar. */}
                  <button
                    type="button"
                    aria-label="Asignar a Lucía"
                    onClick={() => scrollToProgress(sectionRef.current, T.assign + 0.02)}
                    className="absolute inset-x-5 bottom-5 h-12 rounded-[var(--radius-btn)]"
                  />
                  {step >= 3 && <ConfirmOverlay label="Asignado" detail="Lucía M." />}
                </motion.div>
              ) : (
                <CandidateRow candidateIndex={i} />
              )}
            </CandidateSlot>
          ))}
          {rings.map((r) => (
            <motion.span
              key={r.key}
              aria-hidden
              className="pointer-events-none absolute z-30 rounded-full ring-2 ring-accent"
              style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
              initial={{ opacity: 0, scale: 1.15 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [1.15, 1, 1, 1] }}
              transition={{ duration: 1.4667, delay: r.delay, times: [0, 0.2, 0.75, 1] }}
            />
          ))}
          <AnimatePresence>
            {step === 3 && (
              <motion.div
                key="toast"
                initial={jumped ? false : { y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, delay: jumped ? 0 : 0.6 }}
                className="absolute z-30 flex justify-center"
                // Debajo de la última fila, pero nunca encima de la narración.
                style={{ left: L.colX, width: L.colW, top: Math.min(slot(L, 2).y + (ROW_H + 14) * L.cs, L.visBottom - 40) }}
              >
                <ToastLine className="text-xs">Turno asignado. El trabajador tiene que confirmar</ToastLine>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* El celular de Lucía */}
        <motion.div
          style={{ x: phoneX, y: phoneY, opacity: phoneOpacity }}
          className="absolute inset-0 z-20"
        >
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ transform: `translate(${L.phone.x}px, ${L.phone.y}px) scale(${L.phone.s})` }}
          >
            {L.desktop && (
              <SceneLabel className="absolute -top-7 left-2">Lo que ve Lucía</SceneLabel>
            )}
            <PhoneFrame hora={step >= 5 ? "20:54" : "20:53"}>
              <AsignadoScreen
                step={step}
                jumped={jumped}
                shift={assignedShift}
                pressed={pressed === "confirmar"}
                confirmRef={confirmRef}
                sectionRef={sectionRef}
              />
            </PhoneFrame>
          </div>
        </motion.div>

        {/* "¡Oído!": nace del botón, con el único rebote de la página */}
        <AnimatePresence>
          {step >= 5 && origin && (
            <motion.div
              key="oido-burst"
              className="pointer-events-none absolute z-[45]"
              style={{ left: origin.x, top: origin.y }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
            >
              <span key={`r${burst}`} aria-hidden>
                {["border-primary", "border-accent", "border-primary-strong"].map((c, i) => (
                  <span
                    key={c}
                    className={cn("absolute left-0 top-0 h-64 w-64 rounded-full border-[3px]", c)}
                    style={{ animation: `storyRing 1.2s cubic-bezier(.2,.8,.2,1) ${i * 0.16}s both` }}
                  />
                ))}
              </span>
              <motion.span
                initial={jumped ? false : { scale: 0.3, rotate: -6, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                // Mismo rebote, 4/3 más lento: la rigidez baja con el cuadrado
                // (520 × 0,5625) y la amortiguación con la raíz (20 × 0,75).
                transition={{ type: "spring", stiffness: 292.5, damping: 15 }}
                className="absolute bottom-6 left-0 block -translate-x-1/2 whitespace-nowrap rounded-[18px_18px_18px_5px] bg-night px-4 py-2 font-display text-2xl font-semibold text-white shadow-[0_14px_30px_rgba(20,17,24,0.35)]"
              >
                ¡Oído!
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* El ámbar a sangre, que sale de la burbuja */}
        <motion.div
          data-tone={amberOn ? "amber" : undefined}
          style={{ clipPath: amberClip }}
          className="absolute inset-0 z-50 bg-primary"
        >
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <motion.button
              type="button"
              aria-label="¡Oído! Repetir"
              onClick={() => setBurst((b) => b + 1)}
              style={{ opacity: shoutOpacity, scale: shoutScale }}
              className="font-display text-shout font-bold tracking-[-0.04em] text-ink"
            >
              <motion.span
                key={burst}
                className="block"
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.4667 }}
              >
                ¡Oído!
              </motion.span>
            </motion.button>
            <motion.div style={{ opacity: lineOpacity }} className="mt-4 max-w-[30ch] lg:mt-6">
              <p className="text-lg font-medium text-ink lg:text-2xl">
                Lucía confirmó. Tu turno de las 21 está cubierto.
              </p>
              <p className="mt-4 font-mono text-label font-medium uppercase tracking-[0.14em] text-ink/70">
                Historia ilustrativa · El objetivo de Oído es cubrir un turno en menos de 10 minutos
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* Una caja de verdad y no `contents`: con `display: contents` la
            opacidad no se aplica y la narración no se apagaba al confirmar. */}
        <motion.div style={{ opacity: narrOpacity }} className="pointer-events-none absolute inset-0 z-40">
          <Narration
            items={NARRACION}
            index={narrIndex}
            measureRef={narrRef}
            className={cn(
              "absolute",
              L.desktop
                ? "left-12 top-1/2 w-[calc(41.666%-6rem)] -translate-y-1/2"
                : "inset-x-4 bottom-[max(1.75rem,env(safe-area-inset-bottom))] sm:inset-x-6"
            )}
          />
        </motion.div>
      </div>
    </Stage>
  );
}

/** Un candidato que nace de su pin y termina en su lugar de la columna. */
function CandidateSlot({
  id,
  i,
  progress,
  layoutRef,
  layout,
  children,
}: {
  id: (typeof ORDER)[number];
  i: number;
  progress: MotionValue<number>;
  layoutRef: RefObject<Layout>;
  layout: Layout;
  children: React.ReactNode;
}) {
  const worker = MAP_WORKERS.find((w) => w.id === id)!;
  const from = T.cardsFrom + i * 0.025;
  const to = T.cardsTo - 0.03 + i * 0.025;
  const pose = (p: number) => {
    const l = layoutRef.current;
    const s = slot(l, i);
    const pin = mapPoint(l.map, worker.x, worker.y);
    const k = easeInOut(seg(p, from, to));
    const s0 = 38 / s.w;
    const sc = lerp(s0, l.cs, k);
    return {
      // El pin está en el mapa, fuera de la columna: se descuenta su corrimiento.
      x: lerp(pin.x - colShift(l, p) - (s.w * s0) / 2, s.x, k),
      y: lerp(pin.y - (s.h * s0) / 2, s.y, k),
      s: sc,
    };
  };
  const x = useTransform(progress, (p) => pose(p).x);
  const y = useTransform(progress, (p) => pose(p).y);
  const scale = useTransform(progress, (p) => pose(p).s);
  const opacity = useRange(progress, [from, from + 0.02], [0, 1]);
  return (
    <motion.div
      // El recomendado vuela por encima: los otros dos cruzan por detrás.
      style={{ x, y, scale, opacity, width: layout.colW, zIndex: 3 - i }}
      className="absolute left-0 top-0 origin-top-left"
    >
      {children}
    </motion.div>
  );
}

/** Los que no son el recomendado, en una fila: se ve el ranking sin tres
 *  tarjetas enteras. Mismos datos que su CandidateCard. */
function CandidateRow({ candidateIndex }: { candidateIndex: number }) {
  const c = CANDIDATES[candidateIndex];
  const nuevo = c.events_completed === 0;
  return (
    <div className="flex h-16 items-center gap-3 rounded-[var(--radius-card)] bg-card px-3.5 shadow-[var(--shadow-soft)] ring-1 ring-line">
      <Avatar src={null} name={c.full_name} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-strong font-bold text-ink">{c.full_name}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-ink/60">
          {nuevo ? <span>Nuevo en Oído</span> : <Rating value={c.rating} />}
          {c.distance_km != null && <span>· {formatKm(c.distance_km)}</span>}
          {!nuevo && <span>· {c.events_completed} turnos</span>}
        </div>
      </div>
      <span className="inline-flex h-9 items-center rounded-[var(--radius-btn)] px-3 text-sm font-semibold text-ink ring-1 ring-line">
        Asignar
      </span>
    </div>
  );
}

/** El celular de Lucía: le llega la asignación y la confirma. */
function AsignadoScreen({
  step,
  jumped,
  shift,
  pressed,
  confirmRef,
  sectionRef,
}: {
  step: number;
  jumped: boolean;
  shift: ReturnType<typeof useStoryShift>;
  pressed: boolean;
  confirmRef?: RefObject<HTMLButtonElement | null>;
  sectionRef: RefObject<HTMLElement | null>;
}) {
  const t = jumped ? { duration: 0 } : { duration: 0.4533, ease: [0.2, 0.8, 0.2, 1] as const };
  const confirmed = step >= 5;
  return (
    <div className="relative h-[504px] px-2.5">
      <AnimatePresence initial={false}>
        {step >= 3 && (
          <motion.div key="push" initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={t}>
            <PushNotice title={PUSH_ASIGNADO.title} body={PUSH_ASIGNADO.body} />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute inset-x-2.5 top-[6.5rem]">
        <div className="relative h-[330px] w-[240px]">
          <div className="absolute left-0 top-0 w-[320px] origin-top-left scale-[0.75]">
            <div inert>
              <ShiftCard shift={shift} perspective="worker">
                <div className="h-10" />
              </ShiftCard>
            </div>
            {/* Confirmar / Rechazar, como en "Mis turnos" (app/my-shifts):
                los reales van adentro de la tarjeta; éstos ocupan su lugar. */}
            <div className="absolute bottom-5 left-5 flex gap-2">
              <button
                ref={confirmRef}
                type="button"
                onClick={() => scrollToProgress(sectionRef.current, T.confirm + 0.02)}
                // El color de acción, como todo botón principal: el verde con
                // texto blanco daba 3,30:1. Y del botón ámbar nace el "¡Oído!".
                className={cn(
                  "inline-flex min-h-[40px] items-center rounded-[var(--radius-btn)] bg-primary px-4 text-sm font-semibold text-night transition-[transform,box-shadow] duration-200",
                  !confirmed && "shadow-[var(--shadow-primary)]",
                  pressed ? "scale-[0.96]" : "scale-100"
                )}
              >
                {confirmed ? "Confirmado" : "Confirmar"}
              </button>
              <span className="inline-flex min-h-[40px] items-center rounded-[var(--radius-btn)] bg-card px-4 text-sm font-semibold text-ink ring-1 ring-line">
                Rechazar
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function useNarrIndex(progress: MotionValue<number>, stops: number[]): number {
  const [i, setI] = useState(0);
  const ref = useRef(0);
  useMotionValueEvent(progress, "change", (p) => {
    let n = ref.current;
    while (n < stops.length && p >= stops[n] + 0.012) n++;
    while (n > 0 && p < stops[n - 1] - 0.012) n--;
    if (n !== ref.current) {
      ref.current = n;
      setI(n);
    }
  });
  return i;
}

function findText(root: HTMLElement, needle: string): HTMLElement | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeValue?.includes(needle)) return node.parentElement;
    node = walker.nextNode();
  }
  return null;
}

/** El chip cuyo texto completo es `text` (los chips arman su texto con
 *  varios nodos, así que se compara el `textContent` del elemento). */
function findChip(root: HTMLElement, text: string): HTMLElement | null {
  const all = root.querySelectorAll<HTMLElement>("span");
  for (const el of all) if (el.textContent?.trim() === text) return el;
  return null;
}

/* ── Versión estática ───────────────────────────────────────────────────── */

export function ActoOidoStatic() {
  const assignedShift = useStoryShift("asignado");
  return (
    <>
      <section aria-label="Elegís viendo por qué" data-tone="light" className="px-4 py-16 sm:px-6 lg:px-12 lg:py-24">
        <div className="mx-auto flex max-w-[64rem] flex-col gap-20">
          <StaticFrame reloj="postulantes" item={NARRACION[0]} label="Lo que ve tu bar">
            <div className="mx-auto flex max-w-[400px] flex-col gap-2.5">
              <div inert>
                <CandidateCard candidate={CANDIDATES[0]} onAssign={() => {}} recommended />
              </div>
              <CandidateRow candidateIndex={1} />
              <CandidateRow candidateIndex={2} />
            </div>
          </StaticFrame>
          <StaticFrame reloj="asignado" item={NARRACION[1]} label="Lo que ve Lucía">
            <div className="flex justify-center">
              <PhoneFrame hora="20:53">
                <AsignadoScreen step={4} jumped shift={assignedShift} pressed={false} sectionRef={{ current: null }} />
              </PhoneFrame>
            </div>
          </StaticFrame>
        </div>
      </section>
      <section
        aria-label="¡Oído!"
        data-tone="amber"
        data-hide-cta=""
        className="flex flex-col items-center bg-primary px-4 pb-10 pt-20 text-center lg:pt-28"
      >
        <RelojDelTurno at="cubierto" />
        <p className="mt-8 font-display text-shout font-bold tracking-[-0.04em] text-ink">¡Oído!</p>
        <p className="mt-4 max-w-[30ch] text-lg font-medium text-ink lg:text-2xl">
          Lucía confirmó. Tu turno de las 21 está cubierto.
        </p>
        <p className="mt-4 max-w-[40ch] font-mono text-label font-medium uppercase tracking-[0.14em] text-ink/70">
          Historia ilustrativa · El objetivo de Oído es cubrir un turno en menos de 10 minutos
        </p>
      </section>
    </>
  );
}
