"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { CANDIDATES, LOCAL } from "./fixtures";

/**
 * "A pocas cuadras de tu local hay alguien libre para hoy" (2026-10-18): el
 * mapa de "va en camino" de la app (components/employer/EnRouteMap.tsx) sobre
 * un pedazo de Palermo dibujado. Primero aparecen los avisados, después los
 * tres que se postularon con una línea recta a Tu bar (recta a propósito,
 * como en la app: no es el camino que va a hacer), y al final Lucía queda
 * elegida y viene al local.
 *
 * Las calles son ilustrativas (Av. Santa Fe, Honduras, Costa Rica, Thames,
 * Serrano, Juan B. Justo y la plaza Serrano), no un mapa exacto. Sin tiles
 * remotos: es un canvas. Con "reducir movimiento" se ve el final.
 */
const LOCAL_XY: [number, number] = [0.62, 0.42];

type Marca = { x: number; y: number; iniciales?: string };
const POSTULANTES: Marca[] = [
  { x: 0.3, y: 0.7, iniciales: "LM" },
  { x: 0.86, y: 0.2, iniciales: "DR" },
  { x: 0.4, y: 0.18, iniciales: "CP" },
];
const AVISADOS: Marca[] = [
  { x: 0.14, y: 0.36 }, { x: 0.78, y: 0.8 }, { x: 0.52, y: 0.88 }, { x: 0.92, y: 0.56 },
  { x: 0.22, y: 0.12 }, { x: 0.06, y: 0.78 }, { x: 0.7, y: 0.08 },
];

const LUCIA = CANDIDATES[0];

function dibujarCalles(canvas: HTMLCanvasElement) {
  const r = canvas.getBoundingClientRect();
  const d = Math.min(2, window.devicePixelRatio || 1);
  const W = r.width;
  const H = r.height;
  canvas.width = W * d;
  canvas.height = H * d;
  const cx = canvas.getContext("2d");
  if (!cx) return;
  cx.setTransform(d, 0, 0, d, 0, 0);
  cx.fillStyle = "#e8eff3";
  cx.fillRect(0, 0, W, H);
  cx.save();
  // Palermo no está a escuadra con la pantalla.
  cx.translate(W / 2, H / 2);
  cx.rotate(-0.14);
  cx.translate(-W / 2, -H / 2);
  const bw = Math.max(54, W / 9);
  const bh = bw * 0.78;
  const ext = W * 0.25;
  const linea = (x1: number, y1: number, x2: number, y2: number, ancho: number) => {
    cx.lineWidth = ancho;
    cx.beginPath();
    cx.moveTo(x1, y1);
    cx.lineTo(x2, y2);
    cx.stroke();
  };
  cx.strokeStyle = "#ffffff";
  for (let x = -ext; x < W + ext; x += bw) linea(x, -ext, x, H + ext, 7);
  for (let y = -ext; y < H + ext; y += bh) linea(-ext, y, W + ext, y, 7);

  const px = Math.round((W * 0.44) / bw) * bw;
  const py = Math.round((H * 0.42) / bh) * bh;
  cx.fillStyle = "#d7ebde";
  cx.fillRect(px - bw + 5, py + 5, bw - 10, bh - 10);

  const verticales: [number, string, number][] = [
    [Math.round((W * 0.1) / bw) * bw, "AV. SANTA FE", 15],
    [px, "HONDURAS", 9],
    [px + bw * 3, "COSTA RICA", 9],
  ];
  const horizontales: [number, string, number][] = [
    [py - bh * 2, "THAMES", 9],
    [py + bh, "SERRANO", 9],
    [py + bh * 4, "AV. JUAN B. JUSTO", 15],
  ];
  verticales.forEach(([x, , w]) => linea(x, -ext, x, H + ext, w));
  horizontales.forEach(([y, , w]) => linea(-ext, y, W + ext, y, w));
  cx.font = '500 10px "DM Mono", ui-monospace, monospace';
  cx.fillStyle = "#7d97a8";
  cx.textBaseline = "middle";
  horizontales.forEach(([y, n]) => cx.fillText(n, W * 0.16, y + 0.5));
  verticales.forEach(([x, n]) => {
    cx.save();
    cx.translate(x + 0.5, H * 0.8);
    cx.rotate(-Math.PI / 2);
    cx.fillText(n, 0, 0);
    cx.restore();
  });
  cx.fillStyle = "#5f8f74";
  cx.fillText("PLAZA SERRANO", px - bw + 10, py + bh / 2);
  cx.restore();
}

export default function MapaCamino() {
  const caja = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  // 0: nadie · 1: avisados · 2: se postularon · 3: Lucía va en camino.
  // El servidor trae el final, así se lee completo sin JavaScript.
  const [fase, setFase] = useState(3);
  const [eta, setEta] = useState("~4 min");
  const [tam, setTam] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const c = lienzo.current;
    const el = caja.current;
    if (!c || !el) return;
    const medir = () => {
      dibujarCalles(c);
      setTam({ w: el.clientWidth, h: el.clientHeight });
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  useEffect(() => {
    const el = caja.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setFase(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        timers.push(setTimeout(() => setFase(1), 150));
        timers.push(setTimeout(() => setFase(2), 1500));
        timers.push(setTimeout(() => setFase(3), 3600));
        timers.push(setTimeout(() => setEta("~1 min"), 6600));
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  // Llega al costado de Tu bar, sin tapar su etiqueta.
  const lucia = fase >= 3 ? { x: LOCAL_XY[0] - 0.11, y: LOCAL_XY[1] - 0.01 } : POSTULANTES[0];

  return (
    <section aria-labelledby="mapa-titulo" data-tone="light" className="landing-sec">
      <h2 id="mapa-titulo" className="landing-h2">
        A pocas cuadras de tu local hay alguien libre para hoy
      </h2>
      <figure className="landing-mapa">
        <div ref={caja} className="landing-mapa-calles">
          <canvas ref={lienzo} aria-hidden className="absolute inset-0 size-full" />
          <svg aria-hidden className="absolute inset-0 size-full" viewBox={`0 0 ${tam.w || 1} ${tam.h || 1}`}>
            {fase >= 2 &&
              POSTULANTES.map((p, k) =>
                fase >= 3 && k > 0 ? null : (
                  <line
                    key={k}
                    x1={p.x * tam.w}
                    y1={p.y * tam.h}
                    x2={LOCAL_XY[0] * tam.w}
                    y2={LOCAL_XY[1] * tam.h}
                    className={cn("landing-mapa-linea", fase >= 3 && "landing-mapa-linea-va")}
                  />
                )
              )}
          </svg>
          <div className="landing-mapa-local" style={{ left: `${LOCAL_XY[0] * 100}%`, top: `${LOCAL_XY[1] * 100}%` }}>
            <i />
            <span>{LOCAL}</span>
          </div>
          {AVISADOS.map((m, k) => (
            <span
              key={k}
              aria-hidden
              className={cn("landing-mapa-avisado", fase >= 1 && "landing-on", fase >= 3 && "landing-tenue")}
              style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
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
                  fase >= 2 && "landing-on",
                  fase >= 3 && k > 0 && "landing-tenue",
                  fase >= 3 && k === 0 && "landing-elegida"
                )}
                style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
              >
                {m.iniciales}
              </span>
            );
          })}
        </div>
        <figcaption className="landing-mapa-pie" aria-live="polite">
          <span className={cn("landing-mapa-persona-pie", fase >= 3 && "landing-on")}>LM</span>
          <span className="min-w-0">
            <b className="block text-base leading-tight text-ink">
              {fase >= 3 ? `${LUCIA.full_name.split(" ")[0]} va en camino` : fase >= 2 ? "3 se postularon" : "Avisando a 10 cerca tuyo"}
            </b>
            <small className="text-sm text-ink-mute">
              {fase >= 3 ? `A 600 m de ${LOCAL}` : fase >= 2 ? "Lucía, Diego y Camila" : "Mozo/a · hoy 21 a 2"}
            </small>
          </span>
          {fase >= 3 && <span className="landing-mapa-eta">{eta}</span>}
        </figcaption>
      </figure>
    </section>
  );
}
