"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { cn } from "@/lib/cn";
import OpportunityCard from "@/components/worker/OpportunityCard";
import { MAP_LOCAL, MAP_WORKERS, mapDistance, type RelojKey } from "./fixtures";
import RelojDelTurno from "./RelojDelTurno";
import { DescribeBox, PhoneFrame, PricePin, PushNotice, StreetGrid, ToastLine, WorkerPin } from "./replicas";
import { setReloj } from "./relojStore";
import { Narration, SceneLabel, Stage, type NarrationItem } from "./Stage";
import { scrollToProgress, seg, useRange, useStage } from "./useStage";
import { easeInOut, lerp, mapPoint, phoneRect, stageBox, useStageLayout, type StageBox } from "./layout";
import { useStoryShift } from "./useStoryShift";

/* ACTO 2 · DESCUBRIMIENTO.
 *
 * Cada paso sale del anterior, nada aparece de la nada:
 *   la frase se escribe → sus tres partes vuelan a los campos de la tarjeta
 *   real → la tarjeta se achica hasta ser su propio pin en el mapa → del pin
 *   salen ondas y el frente de onda va encendiendo a los avisados → el pin de
 *   Lucía se abre en su celular → le cae la push y se postula. */

const T = {
  typeFrom: 0.05,
  typeTo: 0.185,
  complete: 0.2, // "Completar" + "Leyendo tu pedido…"
  cardFrom: 0.215,
  cardTo: 0.265,
  fields: 0.275, // las partes vuelan a los campos
  focusFrom: 0.3,
  focusTo: 0.34,
  publish: 0.35,
  toPinFrom: 0.38,
  toPinTo: 0.46,
  streetsFrom: 0.42,
  streetsTo: 0.53,
  wavesFrom: 0.47,
  wavesTo: 0.6,
  avisado: 0.6,
  luciaFrom: 0.655,
  luciaTo: 0.685,
  wipeFrom: 0.69,
  wipeTo: 0.76,
  push: 0.775,
  card: 0.83,
  applied: 0.905,
};
const STOPS = [T.typeFrom, T.complete, T.fields, T.publish, T.avisado, T.push, T.card, T.applied] as const;
const RELOJ_POR_PASO: RelojKey[] = [
  "sinCubrir",
  "pidiendo",
  "pidiendo",
  "pidiendo",
  "publicado",
  "avisado",
  "avisado",
  "avisado",
  "postulante",
];

const NARRACION: NarrationItem[] = [
  {
    title: "Lo pedís en una frase.",
    line: "Como se lo dirías a alguien. Oído arma el turno y vos lo revisás antes de publicar.",
  },
  {
    title: "Le avisamos a quien está cerca.",
    line: "Primero a los 10 más indicados para el puesto, por cercanía, reputación y puntualidad.",
  },
  {
    title: "Y le llega al celular.",
    line: "Cuánto paga, a qué hora y a qué distancia. Se postula con un toque.",
  },
];

const PEDIDO_LEN = "Necesito un mozo hoy de 21 a 2, pago 70.000".length;

/** Tamaño natural de la tarjeta real (alto fijo, como en el mazo del feed;
 *  sin "Cómo llegar" porque el turno de la historia no tiene coordenadas). */
const CARD_W = 320;
const CARD_H = 380;

const PUSH_TURNO = {
  // backend/app/modules/shift/application/services.py (aviso a los cercanos)
  title: "Turno de Mozo/a cerca tuyo",
  body: "Tu bar está buscando Mozo/a. Entrá y postulate antes de que lo tomen.",
};

/* ── Composición ────────────────────────────────────────────────────────── */

type Layout = StageBox & {
  boxW: number;
  boxH: number;
  /** Escala de la tarjeta con el cuadro arriba (A) y sola (B). */
  sA: number;
  sB: number;
  /** Arriba del bloque cuadro + tarjeta, centrado en la zona del producto. */
  topA: number;
  topB: number;
  /** El cuadro solo, centrado, mientras todavía no hay tarjeta. */
  top0: number;
  phone: { x: number; y: number; s: number };
};

function computeLayout(w: number, h: number, boxH: number): Layout {
  const b = stageBox(w, h);
  const avail = b.visBottom - b.visTop;
  const boxW = Math.min(b.visW, 440);
  const sA = Math.min(b.desktop ? 1.1 : 1, (avail - boxH - 14) / CARD_H, b.visW / CARD_W);
  const sB = Math.min(b.desktop ? 1.15 : 1, (avail - 62) / CARD_H, b.visW / CARD_W);
  const topA = b.visTop + Math.max(0, (avail - (boxH + 14 + CARD_H * sA)) / 2);
  const topB = b.visTop + Math.max(0, (avail - (CARD_H * sB + 62)) / 2);
  const top0 = b.visTop + Math.max(0, (avail - boxH) / 2);
  return { ...b, boxW, boxH, sA, sB, topA, topB, top0, phone: phoneRect(b) };
}

/* ── Versión animada ────────────────────────────────────────────────────── */

type Flight = { key: string; text: string; fx: number; fy: number; tx: number; ty: number; delay: number };
type Glow = { key: string; x: number; y: number; w: number; h: number; delay: number };

export function ActoPedido() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const { progress, step, jumped } = useStage(sectionRef, STOPS);
  const { layout: L, ref: Lr } = useStageLayout(
    stageRef,
    (w, h) => computeLayout(w, h, boxRef.current?.offsetHeight ?? 150),
    [boxRef]
  );
  const shift = useStoryShift("publicado");

  // Reloj del turno: sólo escribe mientras la escena está en pantalla.
  useEffect(() => {
    const p = progress.get();
    if (p > 0 && p < 1) setReloj(RELOJ_POR_PASO[step]);
  }, [step, progress]);

  // La frase se escribe con el scroll (sin re-render por cada evento: sólo
  // cuando cambia la cantidad de letras).
  const [chars, setChars] = useState(0);
  useMotionValueEvent(progress, "change", (p) => {
    const next = Math.round(seg(p, T.typeFrom, T.typeTo) * PEDIDO_LEN);
    setChars((c) => (c === next ? c : next));
  });

  // Momentos por tiempo, al entrar a un paso (salvo que se haya llegado de
  // un salto, en cuyo caso se muestra el estado final directo).
  const [loading, setLoading] = useState(false);
  const [pressed, setPressed] = useState<"completar" | "publicar" | "postular" | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [glows, setGlows] = useState<Glow[]>([]);
  const prevStep = useRef(step);

  /** Las tres partes de la frase vuelan desde el cuadro hasta su campo en la
   *  tarjeta real. Se mide una sola vez, al entrar al paso. */
  function launchFlights() {
    const stage = stageRef.current;
    const box = boxRef.current;
    const card = cardRef.current;
    if (!stage || !box || !card) return;
    const s = stage.getBoundingClientRect();
    const targets = [findText(card, "Mozo/a"), findText(card, "21:00"), findText(card, "$70.000")];
    const next: Flight[] = [];
    const nextGlows: Glow[] = [];
    box.querySelectorAll<HTMLElement>("[data-parte]").forEach((el, i) => {
      const target = targets[i];
      if (!target) return;
      const a = el.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      next.push({
        key: `f${i}`,
        text: el.textContent ?? "",
        fx: a.left - s.left,
        fy: a.top - s.top,
        tx: b.left - s.left,
        ty: b.top - s.top + (b.height - a.height) / 2,
        delay: i * 0.08,
      });
      nextGlows.push({
        key: `g${i}`,
        x: b.left - s.left - 4,
        y: b.top - s.top - 2,
        w: b.width + 8,
        h: b.height + 4,
        delay: 0.36 + i * 0.08,
      });
    });
    setFlights(next);
    setGlows(nextGlows);
  }

  // Lo que pasa al entrar a cada paso.
  useEffect(() => {
    const from = prevStep.current;
    prevStep.current = step;
    const forward = step === from + 1 && !jumped;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const press = (which: NonNullable<typeof pressed>) => {
      setPressed(which);
      timers.push(setTimeout(() => setPressed(null), 160));
    };
    if (step === 2 && forward) {
      press("completar");
      setLoading(true);
      timers.push(setTimeout(() => setLoading(false), 650));
    } else if (step !== 2) {
      setLoading(false);
    }
    if (step === 3 && forward) launchFlights();
    if (step < 3) {
      setFlights([]);
      setGlows([]);
    }
    if (step === 4 && forward) press("publicar");
    if (step === 8 && forward) press("postular");
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Cuadro y tarjeta ────────────────────────────────────────────────────
  const boxX = (L.visW - L.boxW) / 2 + L.visX;
  // El cuadro arranca solo y centrado; cuando "Completar" arma la tarjeta,
  // sube para hacerle lugar (y la tarjeta sale de su borde de abajo).
  const boxTop = (p: number) => {
    const l = Lr.current;
    return lerp(l.top0, l.topA, easeInOut(seg(p, T.complete, T.cardTo)));
  };
  const boxY = useTransform(progress, (p) => {
    const l = Lr.current;
    return boxTop(p) - (l.boxH + 24) * easeInOut(seg(p, T.focusFrom, T.focusTo));
  });
  const boxOpacity = useRange(progress, [T.focusFrom, T.focusTo - 0.01], [1, 0]);

  const cardPose = (p: number) => {
    const l = Lr.current;
    const a = { s: l.sA, x: l.visX + (l.visW - CARD_W * l.sA) / 2, y: boxTop(p) + l.boxH + 14 };
    const b = { s: l.sB, x: l.visX + (l.visW - CARD_W * l.sB) / 2, y: l.topB };
    const pinS = 0.1;
    const lp = mapPoint(l.map, MAP_LOCAL.x, MAP_LOCAL.y);
    const c = { s: pinS, x: lp.x - (CARD_W * pinS) / 2, y: lp.y - (CARD_H * pinS) / 2 - 10 };
    const f = easeInOut(seg(p, T.focusFrom, T.focusTo));
    const k = easeInOut(seg(p, T.toPinFrom, T.toPinTo));
    const ab = { s: lerp(a.s, b.s, f), x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) };
    return { s: lerp(ab.s, c.s, k), x: lerp(ab.x, c.x, k), y: lerp(ab.y, c.y, k) };
  };
  const cardX = useTransform(progress, (p) => cardPose(p).x);
  const cardY = useTransform(progress, (p) => cardPose(p).y);
  const cardS = useTransform(progress, (p) => cardPose(p).s);
  const cardOpacity = useRange(progress, [T.cardFrom - 0.005, T.cardFrom, T.toPinTo - 0.02, T.toPinTo], [0, 1, 1, 0]);
  const cardClip = useTransform(progress, (p) => {
    const e = easeInOut(seg(p, T.cardFrom, T.cardTo));
    return `inset(0px 0px ${((1 - e) * 100).toFixed(2)}% 0px round 16px)`;
  });

  const btnY = useTransform(progress, (p) => {
    const l = Lr.current;
    return l.topB + CARD_H * l.sB + 14 + 18 * (1 - easeInOut(seg(p, T.focusFrom, T.focusTo)));
  });
  const btnOpacity = useRange(progress, [T.focusTo - 0.02, T.focusTo, T.toPinFrom, T.toPinFrom + 0.02], [0, 1, 1, 0]);

  // ── Mapa ────────────────────────────────────────────────────────────────
  const mapOpacity = useRange(progress, [T.toPinFrom, T.toPinFrom + 0.03], [0, 1]);
  const reveal = useTransform(progress, (p) => {
    const l = Lr.current;
    const lp = mapPoint(l.map, MAP_LOCAL.x, MAP_LOCAL.y);
    const r = easeInOut(seg(p, T.streetsFrom, T.streetsTo)) * Math.hypot(l.map.w, l.map.h) * 0.62;
    return `circle(${r.toFixed(1)}px at ${(lp.x - l.map.x).toFixed(1)}px ${(lp.y - l.map.y).toFixed(1)}px)`;
  });
  const pinOpacity = useRange(progress, [T.toPinTo - 0.02, T.toPinTo], [0, 1]);
  const pinScale = useRange(progress, [T.toPinTo - 0.02, T.toPinTo, T.toPinTo + 0.02], [0.6, 1.12, 1]);

  // Frente de onda (en unidades del mapa) y quién ya recibió el aviso.
  const WAVE_MAX = 62;
  const [reached, setReached] = useState(0);
  useMotionValueEvent(progress, "change", (p) => {
    const front = seg(p, T.wavesFrom, T.wavesTo) * WAVE_MAX;
    let mask = 0;
    MAP_WORKERS.forEach((w, i) => {
      if (mapDistance(w) <= front) mask |= 1 << i;
    });
    setReached((m) => (m === mask ? m : mask));
  });
  const luciaScale = useRange(progress, [T.luciaFrom, T.luciaTo], [1, 1.6]);

  // ── Celular de Lucía ────────────────────────────────────────────────────
  const lucia = MAP_WORKERS[0];
  const phoneClip = useTransform(progress, (p) => {
    const l = Lr.current;
    const { x: lx, y: ly } = mapPoint(l.map, lucia.x, lucia.y);
    const max = Math.hypot(Math.max(lx, l.w - lx), Math.max(ly, l.h - ly));
    const r = Math.pow(seg(p, T.wipeFrom, T.wipeTo), 2) * max;
    return `circle(${r.toFixed(1)}px at ${lx.toFixed(1)}px ${ly.toFixed(1)}px)`;
  });

  const narrIndex = useNarrIndex(progress, [T.toPinFrom - 0.02, T.luciaFrom]);

  return (
    <Stage ref={sectionRef} states={3.2} tone="light" label="Lo pedís en una frase" stageClassName="bg-background">
      <div ref={stageRef} className="absolute inset-0">
        <SceneLabel className="absolute left-4 top-[3.25rem] z-20 sm:left-6 lg:left-12">
          {narrIndex === 2 ? "Lo que ve Lucía" : "Lo que ve tu bar"}
        </SceneLabel>

        {/* Mapa (debajo de todo: la tarjeta se achica encima de él) */}
        <motion.div
          style={{ opacity: mapOpacity, left: L.map.x, top: L.map.y, width: L.map.w, height: L.map.h }}
          className={cn("absolute", !L.map.bleed && "overflow-hidden rounded-[1.75rem]")}
          aria-hidden
        >
          <motion.div style={{ clipPath: reveal }} className="absolute inset-0 bg-[#ece6da]">
            <StreetGrid />
          </motion.div>
          <p className="absolute bottom-3 right-4 font-mono text-label uppercase tracking-[0.14em] text-ink-mute">
            Ubicaciones aproximadas
          </p>
        </motion.div>

        {/* Ondas desde el pin del local */}
        {[0, 1, 2].map((i) => (
          <Wave key={i} progress={progress} i={i} layout={L} />
        ))}

        {/* Avisados */}
        {MAP_WORKERS.map((w, i) => {
          const on = (reached & (1 << i)) !== 0;
          const isLucia = w.id === "lucia";
          return (
            <motion.div
              key={w.id}
              aria-hidden
              className="absolute z-10"
              style={{
                left: mapPoint(L.map, w.x, w.y).x,
                top: mapPoint(L.map, w.x, w.y).y,
                x: "-50%",
                y: "-50%",
                scale: isLucia ? luciaScale : undefined,
              }}
            >
              <motion.div
                initial={false}
                animate={on ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                transition={jumped ? { duration: 0 } : { duration: 0.42, ease: [0.3, 1.4, 0.5, 1] }}
              >
                <WorkerPin inicial={w.inicial} variant="avisado" />
              </motion.div>
            </motion.div>
          );
        })}

        {/* El pin del turno, donde termina la tarjeta */}
        <motion.div
          aria-hidden
          className="absolute z-10"
          style={{
            left: mapPoint(L.map, MAP_LOCAL.x, MAP_LOCAL.y).x,
            top: mapPoint(L.map, MAP_LOCAL.x, MAP_LOCAL.y).y,
            x: "-50%",
            y: "-100%",
            opacity: pinOpacity,
            scale: pinScale,
          }}
        >
          <PricePin />
        </motion.div>

        {/* Cuadro "Describilo y lo completamos" */}
        <motion.div
          style={{ left: boxX, top: 0, y: boxY, width: L.boxW, opacity: boxOpacity }}
          className="absolute z-20"
        >
          <DescribeBox
            ref={boxRef}
            chars={chars}
            marked={step >= 3}
            loading={loading}
            pressed={pressed === "completar"}
            caret={step < 2}
            onComplete={() => scrollToProgress(sectionRef.current, T.complete + 0.02)}
          />
        </motion.div>

        {/* La tarjeta real, tal cual la va a ver la gente */}
        <motion.div
          style={{ x: cardX, y: cardY, scale: cardS, opacity: cardOpacity, clipPath: cardClip }}
          className="absolute left-0 top-0 z-20 origin-top-left"
        >
          <div ref={cardRef} inert className="h-[380px] w-[320px]">
            <OpportunityCard shift={shift} />
          </div>
        </motion.div>

        {/* "Publicar turno" */}
        <motion.div
          style={{ y: btnY, opacity: btnOpacity, left: L.visX + (L.visW - Math.max(220, CARD_W * L.sB)) / 2, width: Math.max(220, CARD_W * L.sB) }}
          className="absolute top-0 z-20"
        >
          <button
            type="button"
            onClick={() => scrollToProgress(sectionRef.current, T.publish + 0.02)}
            className={cn(
              "flex h-12 w-full items-center justify-center rounded-[var(--radius-btn)] bg-night text-body font-semibold text-white transition-transform duration-150",
              pressed === "publicar" ? "scale-[0.96]" : "scale-100"
            )}
          >
            Publicar turno
          </button>
        </motion.div>

        {/* Las partes de la frase en vuelo, y el brillo en el campo donde caen */}
        {flights.map((f) => (
          <motion.span
            key={f.key}
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 z-30 whitespace-nowrap rounded-[4px] bg-manteca px-0.5 text-sm font-semibold text-ink shadow-[0_6px_16px_rgba(106,90,18,0.25)]"
            initial={{ x: f.fx, y: f.fy, opacity: 1, scale: 1 }}
            animate={{ x: f.tx, y: f.ty, opacity: [1, 1, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 0.46, delay: f.delay, ease: [0.2, 0.8, 0.2, 1], opacity: { times: [0, 0.8, 1], duration: 0.5, delay: f.delay } }}
          >
            {f.text}
          </motion.span>
        ))}
        {glows.map((g) => (
          <motion.span
            key={g.key}
            aria-hidden
            className="pointer-events-none absolute z-30 rounded-md bg-manteca/70 mix-blend-multiply"
            style={{ left: g.x, top: g.y, width: g.w, height: g.h }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1, delay: g.delay, times: [0, 0.2, 1] }}
          />
        ))}

        {/* El celular de Lucía, que se abre desde su pin */}
        <motion.div style={{ clipPath: phoneClip }} className="absolute inset-0 z-40 bg-surface">
          <SceneLabel className="absolute left-4 top-[3.25rem] sm:left-6 lg:left-12">Lo que ve Lucía</SceneLabel>
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ transform: `translate(${L.phone.x}px, ${L.phone.y}px) scale(${L.phone.s})` }}
          >
            <PhoneFrame hora="20:48">
              <LuciaScreen step={step} jumped={jumped} pressed={pressed === "postular"} sectionRef={sectionRef} />
            </PhoneFrame>
          </div>
        </motion.div>

        {/* Narración */}
        <Narration
          items={NARRACION}
          index={narrIndex}
          className={cn(
            "absolute z-50",
            L.desktop
              ? "left-12 top-1/2 w-[calc(41.666%-6rem)] -translate-y-1/2"
              : "inset-x-4 bottom-[max(1.75rem,env(safe-area-inset-bottom))] sm:inset-x-6"
          )}
        />
      </div>
    </Stage>
  );
}

/** Índice de narración por umbrales de progreso (con el mismo margen que los
 *  pasos, para que el texto no titile en el borde). */
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

function Wave({ progress, i, layout: L }: { progress: MotionValue<number>; i: number; layout: StageBox }) {
  const from = 0.47 + i * 0.028;
  const to = from + 0.1;
  const scale = useRange(progress, [from, to], [0.05, 1]);
  const opacity = useRange(progress, [from, from + 0.01, to], [0, 0.9, 0]);
  const size = L.map.size * 1.24;
  return (
    <motion.span
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-[5] rounded-full border-2",
        i === 1 ? "border-manteca" : "border-primary"
      )}
      style={{
        left: mapPoint(L.map, MAP_LOCAL.x, MAP_LOCAL.y).x - size / 2,
        top: mapPoint(L.map, MAP_LOCAL.x, MAP_LOCAL.y).y - size / 2,
        width: size,
        height: size,
        scale,
        opacity,
      }}
    />
  );
}

/** La pantalla del celular de Lucía: le cae la push, se abre la tarjeta y se
 *  postula. */
function LuciaScreen({
  step,
  jumped,
  pressed,
  sectionRef,
}: {
  step: number;
  jumped: boolean;
  pressed: boolean;
  sectionRef: RefObject<HTMLElement | null>;
}) {
  const shift = useStoryShift("publicado");
  const t = jumped ? { duration: 0 } : { duration: 0.34, ease: [0.2, 0.8, 0.2, 1] as const };
  return (
    <div className="relative h-[504px] px-2.5">
      <AnimatePresence initial={false}>
        {step >= 6 && (
          <motion.div
            key="push"
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -24, opacity: 0 }}
            transition={t}
          >
            <PushNotice title={PUSH_TURNO.title} body={PUSH_TURNO.body} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {step >= 7 && (
          <motion.div
            key="card"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={t}
            className="absolute inset-x-2.5 top-[7.25rem]"
          >
            <div className="h-[285px] w-[240px]">
              <div inert className="h-[380px] w-[320px] origin-top-left scale-[0.75]">
                <OpportunityCard shift={shift} distanceKm={0.6} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => scrollToProgress(sectionRef.current, T.applied + 0.02)}
              className={cn(
                "mt-2.5 flex h-11 w-full items-center justify-center rounded-[var(--radius-btn)] bg-primary text-sm font-semibold text-night shadow-[var(--shadow-primary)] transition-transform duration-150",
                pressed ? "scale-[0.96]" : "scale-100"
              )}
            >
              Postularme
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {step >= 8 && (
          <motion.div
            key="toast"
            initial={{ y: 16, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={t}
            className="absolute inset-x-2 bottom-[6.5rem] flex justify-center"
          >
            <ToastLine className="px-3 py-2.5 text-xs">¡Te postulaste! El comercio ya te puede ver</ToastLine>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** El elemento más profundo cuyo texto contiene `needle`. */
function findText(root: HTMLElement, needle: string): HTMLElement | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeValue?.includes(needle)) return node.parentElement;
    node = walker.nextNode();
  }
  return null;
}

/* ── Versión estática ───────────────────────────────────────────────────── */

export function ActoPedidoStatic() {
  const shift = useStoryShift("publicado");
  return (
    <section aria-label="Lo pedís en una frase" data-tone="light" className="px-4 py-16 sm:px-6 lg:px-12 lg:py-24">
      <div className="mx-auto flex max-w-[64rem] flex-col gap-20">
        <StaticFrame reloj="publicado" item={NARRACION[0]} label="Lo que ve tu bar">
          <div className="flex flex-col items-center gap-4">
            <DescribeBox chars={PEDIDO_LEN} marked loading={false} pressed={false} caret={false} className="w-full max-w-[440px]" />
            <div inert className="h-[380px] w-[320px] max-w-full">
              <OpportunityCard shift={shift} />
            </div>
          </div>
        </StaticFrame>
        <StaticFrame reloj="avisado" item={NARRACION[1]} label="Lo que ve tu bar">
          <div className="relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-[1.75rem] bg-[#ece6da]" aria-hidden>
            <StreetGrid />
            {[0.32, 0.52, 0.72].map((r) => (
              <span
                key={r}
                className="absolute rounded-full border-2 border-primary/40"
                style={{ left: `${50 - r * 50}%`, top: `${50 - r * 50}%`, width: `${r * 100}%`, height: `${r * 100}%` }}
              />
            ))}
            {MAP_WORKERS.map((w) => (
              <span key={w.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${w.x}%`, top: `${w.y}%` }}>
                <WorkerPin inicial={w.inicial} variant="avisado" />
              </span>
            ))}
            <PricePin className="absolute -translate-x-1/2 -translate-y-full" style={{ left: "50%", top: "50%" }} />
            <p className="absolute bottom-3 right-4 font-mono text-label uppercase tracking-[0.14em] text-ink-mute">
              Ubicaciones aproximadas
            </p>
          </div>
        </StaticFrame>
        <StaticFrame reloj="postulante" item={NARRACION[2]} label="Lo que ve Lucía">
          <div className="flex justify-center">
            <PhoneFrame hora="20:48">
              <LuciaScreen step={8} jumped pressed={false} sectionRef={{ current: null }} />
            </PhoneFrame>
          </div>
        </StaticFrame>
      </div>
    </section>
  );
}

export function StaticFrame({
  reloj,
  item,
  label,
  children,
}: {
  reloj: RelojKey;
  item: NarrationItem;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:items-center lg:gap-12">
      <div className="lg:col-span-5">
        <RelojDelTurno at={reloj} />
        <SceneLabel className="mt-3">Historia ilustrativa · {label}</SceneLabel>
        <p className="mt-5 font-display text-h1 font-semibold tracking-[-0.02em] text-ink lg:text-display">{item.title}</p>
        <p className="mt-2 max-w-[38ch] text-body text-ink-soft lg:text-lg">{item.line}</p>
      </div>
      <div className="lg:col-span-7">{children}</div>
    </div>
  );
}
