"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from "motion/react";
import { cn } from "@/lib/cn";
import { setReloj } from "./relojStore";
import { Stage, type Tone } from "./Stage";
import { seg, useRange, useStage } from "./useStage";

/* ACTO 1 · HERO + URGENCIA.
 *
 * El primer cuadro es el hero (qué es, para quién, los dos botones) con una
 * ventana a un viernes a la noche abajo (al costado en escritorio), donde el
 * mozo está escribiendo. El primer gesto de scroll ya hace algo: la noche
 * crece desde su ventana y se traga la página, llega el mensaje "Perdón, hoy
 * no llego." y, al cerrarse la noche en un círculo dentro de la burbuja, la
 * burbuja se condensa en el reloj del turno. El problema se convierte en el
 * protagonista de la historia. */

export const HERO_CTA_ID = "hero-ctas";

/** Umbrales del acto (progreso 0→1 de la sección). */
const T = {
  covered: 0.3, // la noche tapó todo
  message: 0.36, // llega el mensaje
  narration: 0.44,
  closeFrom: 0.74, // la noche se cierra en círculo
  closeTo: 0.95,
  reloj: 0.91,
};
const STOPS = [T.message, T.narration, T.reloj] as const;

export function HeroCopy({ className }: { className?: string }) {
  return (
    <div className={cn("no-select", className)}>
      <p className="font-mono text-label font-medium uppercase tracking-[0.14em] text-ink-mute">
        Beta en CABA
      </p>
      <h1 className="mt-3 font-display text-poster tracking-[-0.03em] text-ink [text-wrap:balance] lg:text-hero">
        <span className="font-medium">Personal gastronómico,</span>{" "}
        <span className="block font-bold">ya.</span>
      </h1>
      <p className="mt-5 max-w-[34ch] text-lg leading-[1.45] text-ink-soft lg:text-xl">
        Pedís el turno en una frase y le avisamos a la gente de gastronomía que está cerca. Vos
        elegís a quién.
      </p>
      <div id={HERO_CTA_ID} className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/register?rol=comercio"
          data-cta="hero"
          className="inline-flex h-[52px] items-center justify-center rounded-[var(--radius-btn)] bg-primary px-7 text-base font-semibold text-night shadow-[var(--shadow-primary)] transition active:scale-[0.96] hover:brightness-[1.04] lg:h-14"
        >
          Necesito personal
        </Link>
        <Link
          href="/register?rol=trabajador"
          data-cta="hero"
          className="inline-flex h-12 items-center justify-center rounded-[var(--radius-btn)] px-7 text-base font-semibold text-ink ring-1 ring-ink/20 transition active:scale-[0.96] hover:bg-surface lg:h-14"
        >
          Quiero trabajar
        </Link>
      </div>
      <p className="mt-4 font-mono text-label font-medium uppercase tracking-[0.14em] text-ink-mute">
        Sin comisión por turno · Empezás gratis
      </p>
    </div>
  );
}

/** La burbuja de Martín. `typing` muestra los tres puntitos (la única espera
 *  en bucle de la página); si no, el mensaje. */
export function MartinBubble({ typing, className }: { typing: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "w-[min(300px,calc(100vw-32px))] rounded-[22px_22px_22px_6px] bg-[#26211b] px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.35)]",
        className
      )}
    >
      <p className="font-mono text-label uppercase tracking-[0.14em] text-[#b3a999]">Martín · mozo</p>
      {typing ? (
        <p className="story-typing mt-2 flex h-[30px] items-center gap-1.5" aria-label="escribiendo">
          <span className="h-2 w-2 rounded-full bg-white/80" />
          <span className="h-2 w-2 rounded-full bg-white/80" />
          <span className="h-2 w-2 rounded-full bg-white/80" />
        </p>
      ) : (
        <p className="mt-1.5 text-2xl leading-tight text-white">Perdón, hoy no llego.</p>
      )}
      <p className="mt-1 text-right font-mono text-metadata tracking-[0.05em] text-[#7d7468]">20:46</p>
    </div>
  );
}

/* ── Versión estática (servidor, sin JS, reducir movimiento) ────────────── */

export function ActoNocheStatic() {
  return (
    <>
      <section
        aria-label="Inicio"
        data-tone="light"
        className="relative flex min-h-[calc(100svh-var(--lht))] flex-col lg:grid lg:grid-cols-12"
      >
        <div className="px-4 pb-8 pt-6 sm:px-6 lg:col-span-7 lg:flex lg:items-center lg:px-12 lg:py-16">
          <HeroCopy />
        </div>
        <div
          data-tone="night"
          className="flex flex-1 flex-col gap-4 bg-night px-4 pb-8 pt-6 sm:px-6 lg:col-span-5 lg:items-center lg:justify-center lg:px-10"
        >
          <p className="font-mono text-label uppercase tracking-[0.14em] text-[#F1E7A0]">Viernes · 20:46</p>
          <MartinBubble typing className="[animation:storyBubbleIn_.45s_cubic-bezier(.2,.8,.2,1)_.4s_both]" />
        </div>
      </section>
      <section
        aria-label="Urgencia"
        data-tone="night"
        className="flex flex-col items-start gap-8 bg-night px-4 py-20 sm:px-6 lg:items-center lg:py-28"
      >
        <p className="font-mono text-label uppercase tracking-[0.14em] text-[#F1E7A0]">Viernes · salón lleno</p>
        <p className="font-display text-poster font-normal tracking-[-0.03em] text-white">20:46</p>
        <MartinBubble typing={false} />
        <p className="max-w-[22ch] font-display text-h1 font-medium text-white lg:text-center">
          Arrancás a las 21. Y te escribe el mozo.
        </p>
      </section>
    </>
  );
}

/* ── Versión animada ────────────────────────────────────────────────────── */

type Box = { w: number; h: number; bandTop: number; bandLeft: number; desktop: boolean; bw: number; bh: number };

function useMeasure(stageRef: RefObject<HTMLDivElement | null>, copyRef: RefObject<HTMLDivElement | null>, bubbleRef: RefObject<HTMLDivElement | null>) {
  const box = useRef<Box>({ w: 390, h: 788, bandTop: 480, bandLeft: 0, desktop: false, bw: 300, bh: 110 });
  const [, force] = useState(0);
  useLayoutEffect(() => {
    const measure = () => {
      const stage = stageRef.current;
      const copy = copyRef.current;
      const bubble = bubbleRef.current;
      if (!stage || !copy) return;
      const s = stage.getBoundingClientRect();
      const c = copy.getBoundingClientRect();
      const desktop = window.matchMedia("(min-width: 1024px)").matches;
      box.current = {
        w: s.width,
        h: s.height,
        bandTop: desktop ? 0 : Math.min(s.height - 120, c.bottom - s.top + 28),
        bandLeft: desktop ? Math.round(s.width * (7 / 12)) : 0,
        desktop,
        bw: bubble?.offsetWidth ?? 300,
        bh: bubble?.offsetHeight ?? 110,
      };
      force((n) => n + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    if (copyRef.current) ro.observe(copyRef.current);
    return () => ro.disconnect();
  }, [stageRef, copyRef, bubbleRef]);
  return box;
}

export function ActoNoche() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const { progress, step, jumped } = useStage(sectionRef, STOPS);
  const box = useMeasure(stageRef, copyRef, bubbleRef);
  const [tone, setTone] = useState<Tone>("light");

  // El encabezado se pinta de noche sólo cuando la noche ya tapa su borde.
  useMotionValueEvent(progress, "change", (p) => {
    const covering = easeInOut(seg(p, 0.01, T.covered)) > 0.85;
    const closing = easeIn(seg(p, T.closeFrom, T.closeTo)) > 0.35;
    const next: Tone = covering && !closing ? "night" : "light";
    setTone((t) => (t === next ? t : next));
  });

  // El reloj aparece cuando la burbuja termina de condensarse en él.
  useMotionValueEvent(progress, "change", (p) => setReloj(p >= T.reloj ? "sinCubrir" : null));
  useEffect(() => {
    setReloj(progress.get() >= T.reloj ? "sinCubrir" : null);
  }, [progress]);

  const expand = useTransform(progress, (p) => easeInOut(seg(p, 0.01, T.covered)));

  // Dónde está la burbuja (centro y escala) en cada punto del scroll: de su
  // lugar en la ventana al centro, y al cerrarse la noche, al lugar del reloj.
  // El círculo de la noche se cierra siempre CENTRADO en la burbuja: la noche
  // entera se mete adentro del mensaje, y el mensaje se vuelve el reloj.
  const pose = (p: number) => {
    const b = box.current;
    const t = easeInOut(seg(p, 0.06, T.message - 0.02));
    const c = easeInOut(seg(p, T.closeFrom, T.closeTo));
    const from = bubbleCenter(b, 0);
    const mid = bubbleCenter(b, 1);
    const to = relojCenter(b);
    const grown = 1 + 0.12 * t;
    if (c > 0) {
      return {
        x: mid.x + (to.x - mid.x) * c,
        y: mid.y + (to.y - mid.y) * c,
        s: grown + (0.3 - grown) * c,
      };
    }
    return { x: from.x + (mid.x - from.x) * t, y: from.y + (mid.y - from.y) * t, s: grown };
  };

  // Recorte de la noche: primero crece desde su ventana (inset), después se
  // cierra en un círculo que sigue a la burbuja.
  const clip = useTransform(progress, (p) => {
    const b = box.current;
    const c = easeIn(seg(p, T.closeFrom, T.closeTo));
    if (c > 0) {
      const { x, y } = pose(p);
      const r = Math.hypot(Math.max(x, b.w - x), Math.max(y, b.h - y)) * (1 - c);
      return `circle(${r.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`;
    }
    const e = easeInOut(seg(p, 0.01, T.covered));
    return `inset(${(b.bandTop * (1 - e)).toFixed(1)}px 0px 0px ${(b.bandLeft * (1 - e)).toFixed(1)}px)`;
  });

  const copyOpacity = useRange(progress, [0, 0.22], [1, 0]);
  const copyScale = useRange(progress, [0, 0.22], [1, 0.97]);

  const bx = useTransform(progress, (p) => pose(p).x - box.current.bw / 2);
  const by = useTransform(progress, (p) => pose(p).y - box.current.bh / 2);
  const bscale = useTransform(progress, (p) => pose(p).s);
  const bopacity = useRange(progress, [T.reloj - 0.03, T.reloj + 0.02], [1, 0]);

  // Hora: chica en la ventana, grande arriba cuando la noche tapa todo.
  const smallOpacity = useRange(expand, [0, 0.4], [1, 0]);
  const bigOpacity = useRange(progress, [0.2, 0.32, T.closeFrom, T.closeFrom + 0.06], [0, 1, 1, 0]);
  const bigY = useRange(progress, [0.2, 0.34], [24, 0]);
  const narrOpacity = useRange(progress, [T.narration, T.narration + 0.04, T.closeFrom, T.closeFrom + 0.05], [0, 1, 1, 0]);
  const narrY = useRange(progress, [T.narration, T.narration + 0.05], [16, 0]);

  const typing = step < 1;
  const shake = useMotionValue(0);
  useEffect(() => {
    if (step === 1 && !jumped) {
      animate(shake, [0, -6, 6, -4, 4, 0], { duration: 0.3, ease: "easeInOut" });
    }
  }, [step, jumped, shake]);

  return (
    <Stage ref={sectionRef} states={2.2} tone={tone} label="Inicio" stageClassName="bg-background">
      <div ref={stageRef} className="absolute inset-0">
        {/* Hero */}
        <motion.div
          ref={copyRef}
          style={{ opacity: copyOpacity, scale: copyScale }}
          className="absolute inset-x-0 top-0 origin-top px-4 pt-6 sm:px-6 lg:bottom-0 lg:right-[41.666%] lg:flex lg:items-center lg:px-12 lg:pt-0"
        >
          <HeroCopy />
        </motion.div>

        {/* La noche */}
        <motion.div
          data-tone={tone === "night" ? "night" : undefined}
          style={{ clipPath: clip }}
          className="absolute inset-0 bg-night"
        >
          <motion.p
            style={{ opacity: smallOpacity, top: box.current.desktop ? undefined : box.current.bandTop + 22 }}
            className="absolute left-4 font-mono text-label uppercase tracking-[0.14em] text-[#F1E7A0] sm:left-6 lg:left-[calc(58.333%+2.5rem)] lg:top-10"
          >
            Viernes · 20:46
          </motion.p>
          <motion.div
            style={{ opacity: bigOpacity, y: bigY }}
            className="absolute inset-x-0 top-[9%] flex flex-col items-center gap-2 text-center"
          >
            <p className="font-mono text-label uppercase tracking-[0.14em] text-[#F1E7A0]">
              Viernes · salón lleno
            </p>
            <p className="font-display text-[length:var(--text-poster)] font-normal leading-none tracking-[-0.03em] text-white lg:text-[length:var(--text-hero)]">
              20:46
            </p>
          </motion.div>
          <motion.p
            style={{ opacity: narrOpacity, y: narrY }}
            className="absolute inset-x-4 bottom-[max(2rem,env(safe-area-inset-bottom))] text-center font-display text-h1 font-medium text-white sm:bottom-12 lg:text-4xl lg:leading-tight"
          >
            Arrancás a las 21. Y te escribe el mozo.
          </motion.p>
        </motion.div>

        {/* La burbuja vive afuera del recorte para poder viajar al reloj */}
        <motion.div
          ref={bubbleRef}
          style={{ x: bx, y: by, scale: bscale, opacity: bopacity }}
          className="absolute left-0 top-0 origin-center will-change-transform"
        >
          <motion.div style={{ x: shake }}>
            <MartinBubble typing={typing} className="[animation:storyBubbleIn_.45s_cubic-bezier(.2,.8,.2,1)_.4s_both]" />
          </motion.div>
        </motion.div>
      </div>
    </Stage>
  );
}

function bubbleCenter(b: Box, phase: 0 | 1) {
  if (phase === 1) return { x: b.w / 2, y: b.h * 0.47 };
  if (b.desktop) return { x: b.bandLeft + (b.w - b.bandLeft) / 2, y: b.h * 0.52 };
  return { x: 16 + b.bw / 2, y: b.bandTop + 58 + b.bh / 2 };
}

/** Centro del reloj fijo, en coordenadas del escenario (que arranca debajo
 *  del encabezado). Aproximado: el reloj todavía no está en pantalla. */
function relojCenter(b: Box) {
  const left = b.desktop ? 48 : b.w >= 640 ? 24 : 16;
  const width = b.w >= 640 ? 270 : 196;
  return { x: left + width / 2, y: 20 };
}

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function easeIn(t: number) {
  return t * t * t;
}

