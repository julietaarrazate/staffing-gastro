"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import IdentityVerifiedBadge from "@/components/IdentityVerifiedBadge";
import { StarIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { formatDecimal1 } from "@/lib/format";
import { CANDIDATES, DISTANCIA_M, LOCAL, RELOJ } from "./fixtures";

/**
 * "Alguien libre, a pocas cuadras": el "va en camino" de la app
 * (components/employer/EnRouteMap.tsx) sobre un mapa real de Palermo Soho,
 * con el mismo estilo (Carto Voyager). El fondo es una imagen fija de ese
 * mapa (`public/landing/mapa-palermo.webp`, 560 × 420 a 2x, armada una vez con
 * MapLibre): se ve como la app sin cargar MapLibre en la landing.
 *
 * La escena se cuenta sin palabras, en unos 8 segundos (2026-10-23): sale una
 * onda desde Tu bar y cada punto aparece cuando la onda lo alcanza; tres
 * crecen (los que se postularon, Lucía última); Lucía se pone ámbar y viene
 * hacia el local con su línea recta (recta a propósito, como en la app: es la
 * distancia que falta, no el camino), mientras bajan los metros y los
 * minutos. Un relojito arriba pasa de 20:46 a 20:54 ✓, la hora del ticket de
 * la comanda. El pie aparece una sola vez, con Lucía en camino. Vuelve a
 * empezar si el mapa salió del todo. Con "reducir movimiento" se ve el final.
 */
const LOCAL_XY = { x: 0.62, y: 0.4 };

type Marca = { x: number; y: number; iniciales?: string };
const POSTULANTES: Marca[] = [
  { x: 0.3, y: 0.78, iniciales: "LM" },
  { x: 0.86, y: 0.2, iniciales: "DR" },
  { x: 0.36, y: 0.16, iniciales: "CP" },
];
const AVISADOS: Marca[] = [
  { x: 0.14, y: 0.36 }, { x: 0.8, y: 0.76 }, { x: 0.52, y: 0.9 }, { x: 0.93, y: 0.52 },
  { x: 0.26, y: 0.24 }, { x: 0.07, y: 0.7 }, { x: 0.72, y: 0.08 },
];

const LUCIA = CANDIDATES[0];
/** Cuánto tarda en acercarse y hasta dónde llega (fracción del camino). */
const VIAJE_MS = 5500;
const LLEGA = 0.68;
const RELOJES = [RELOJ.sinCubrir, RELOJ.avisado, RELOJ.postulantes, RELOJ.cubierto];

/** Coordenadas del dibujo de las líneas: el mapa es 4:3. */
const sx = (x: number) => x * 100;
const sy = (y: number) => y * 75;
/** Cuándo alcanza la onda a cada punto (la onda tarda 1,1 s en abrirse). */
const demoraOnda = (m: Marca) => `${Math.round((Math.hypot(m.x - LOCAL_XY.x, (m.y - LOCAL_XY.y) * 0.75) / 0.62) * 1100)}ms`;

export default function MapaCamino() {
  const caja = useRef<HTMLDivElement>(null);
  // 0: nadie · 1: avisados · 2: se postularon · 3: Lucía va en camino.
  // El servidor trae el final, así se lee completo sin JavaScript.
  const [fase, setFase] = useState(3);
  // Cuánto avanzó Lucía hacia el local (0 a LLEGA) y si ya llegó.
  const [avance, setAvance] = useState(LLEGA);
  const [llego, setLlego] = useState(true);

  useEffect(() => {
    const el = caja.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timers: ReturnType<typeof setTimeout>[] = [];
    let raf = 0;
    let corriendo = false;
    const parar = () => {
      timers.forEach(clearTimeout);
      timers = [];
      cancelAnimationFrame(raf);
      corriendo = false;
    };
    const desdeCero = () => {
      setFase(0);
      setAvance(0);
      setLlego(false);
    };
    const arrancar = () => {
      parar();
      corriendo = true;
      desdeCero();
      timers.push(setTimeout(() => setFase(1), 200));
      timers.push(setTimeout(() => setFase(2), 1500));
      timers.push(
        setTimeout(() => {
          setFase(3);
          const t0 = performance.now();
          const paso = (ahora: number) => {
            const k = Math.min(1, (ahora - t0) / VIAJE_MS);
            const suave = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
            setAvance(suave * LLEGA);
            if (k < 1) raf = requestAnimationFrame(paso);
            else setLlego(true);
          };
          raf = requestAnimationFrame(paso);
        }, 2800)
      );
    };
    desdeCero();
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio >= 0.4) {
          if (!corriendo) arrancar();
        } else if (!e.isIntersecting) {
          // Salió del todo: queda lista para empezar otra vez.
          parar();
          desdeCero();
        }
      },
      { threshold: [0, 0.4] }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      parar();
    };
  }, []);

  const origen = POSTULANTES[0];
  const lucia = {
    x: origen.x + (LOCAL_XY.x - origen.x) * avance,
    y: origen.y + (LOCAL_XY.y - origen.y) * avance,
  };
  const metros = Math.round((DISTANCIA_M * (1 - avance)) / 10) * 10;
  const eta = Math.max(1, Math.round(4 - 3 * (avance / LLEGA)));
  const reloj = RELOJES[fase];

  return (
    <section aria-labelledby="mapa-titulo" data-tone="light" className="landing-sec landing-sec-dos">
      <h2 id="mapa-titulo" className="landing-h2">
        Alguien libre, <span className="whitespace-nowrap">a pocas cuadras</span>
      </h2>
      <figure className="landing-mapa landing-sec-cosa">
        <div ref={caja} className="landing-mapa-calles">
          <Image src="/landing/mapa-palermo.webp" alt="" fill sizes="560px" className="object-cover" />
          <span aria-hidden className={cn("landing-mapa-reloj", fase >= 3 && "landing-cubierto")}>
            {reloj.hora.slice(0, 2)}
            <i className={cn(fase < 3 && "landing-titila")}>:</i>
            <span key={reloj.hora} className="landing-tic">
              {reloj.hora.slice(3)}
            </span>
            {fase >= 3 && " ✓"}
          </span>
          {fase === 1 && (
            <span aria-hidden className="landing-mapa-onda" style={{ left: `${LOCAL_XY.x * 100}%`, top: `${LOCAL_XY.y * 100}%` }} />
          )}
          {fase >= 3 && (
            <svg aria-hidden className="absolute inset-0 size-full" viewBox="0 0 100 75" preserveAspectRatio="none">
              <line
                x1={sx(lucia.x)}
                y1={sy(lucia.y)}
                x2={sx(LOCAL_XY.x)}
                y2={sy(LOCAL_XY.y)}
                className="landing-mapa-linea"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
          <div className="landing-mapa-local" style={{ left: `${LOCAL_XY.x * 100}%`, top: `${LOCAL_XY.y * 100}%` }}>
            <span>{LOCAL}</span>
            <i />
          </div>
          {AVISADOS.map((m, k) => (
            <span
              key={k}
              aria-hidden
              className={cn("landing-mapa-avisado", fase >= 1 && "landing-on", fase >= 3 && "landing-tenue")}
              style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, transitionDelay: fase === 1 ? demoraOnda(m) : undefined }}
            />
          ))}
          {POSTULANTES.map((m, k) => {
            const pos = k === 0 ? lucia : m;
            return (
              <span
                key={m.iniciales}
                aria-hidden
                className={cn(
                  "landing-mapa-persona",
                  fase === 1 && "landing-punto",
                  fase >= 2 && "landing-on",
                  fase >= 3 && k > 0 && "landing-tenue",
                  fase >= 3 && k === 0 && "landing-elegida"
                )}
                style={{
                  left: `${pos.x * 100}%`,
                  top: `${pos.y * 100}%`,
                  transitionDelay: fase === 1 ? demoraOnda(m) : fase === 2 ? `${(2 - k) * 160}ms` : undefined,
                }}
              >
                {k === 0 && fase >= 3 && <i className={cn("landing-mapa-halo", llego && "landing-quieto")} />}
                {m.iniciales}
              </span>
            );
          })}
          <small className="landing-mapa-credito">© OpenStreetMap · © CARTO</small>
        </div>
        <figcaption className="landing-mapa-pie">
          <div className={cn("landing-mapa-pie-dentro", fase >= 3 && "landing-on")}>
            <span className="landing-mapa-persona-pie">LM</span>
            <span className="min-w-0">
              <b className="block text-base leading-tight text-ink">{LUCIA.full_name.split(" ")[0]} va en camino</b>
              <small className="text-sm text-ink-mute">
                <span className="inline-flex items-center gap-1">
                  <StarIcon size={12} filled className="text-ink" />
                  {formatDecimal1(LUCIA.rating ?? 0)} · a {metros} m
                </span>
              </small>
              <span className="mt-1.5 block">
                <IdentityVerifiedBadge verified />
              </span>
            </span>
            <span className="landing-mapa-eta">~{eta} min</span>
          </div>
        </figcaption>
      </figure>
    </section>
  );
}
