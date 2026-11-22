// El teléfono con las pantallas reales adentro, una cámara que se mueve con
// resortes (zoom a detalles), toques simulados, resaltados y lupas.
import React from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import capJson from "../cap.json";
import { C, F, inOut } from "./base";

export const CAP: Record<string, any> = capJson as any;
export const cap = (n: string) => {
  const c = CAP[n];
  if (!c) throw new Error("falta la captura " + n);
  return c;
};

export const K = 1.6; // px de video por px CSS, con zoom 1
export const SW = 390 * K; // ancho de pantalla
export const BAR = 34; // barra de estado (CSS)
export const SH = (BAR + 844) * K;
export const BISEL = 16;
export const PW = SW + BISEL * 2;
export const PH = SH + BISEL * 2;

// Cámara: cuadros clave con el punto de la pantalla (CSS) que va a (tx, ty) del video, y el zoom.
export type Clave = { f: number; x?: number; y?: number; z?: number; tx?: number; ty?: number; rot?: number; dur?: number };
const DEF = { x: 195, y: 440, z: 0.9, tx: 540, ty: 1180, rot: 0 };

export function camara(claves: Clave[], frame: number, fps: number) {
  let cur = { ...DEF, ...claves[0] } as Required<Clave>;
  for (let i = 1; i < claves.length; i++) {
    const k = claves[i];
    if (frame < k.f) break;
    const nxt = { ...cur, ...k } as Required<Clave>;
    const p = spring({ frame: frame - k.f, fps, config: { damping: 30, stiffness: 90, mass: 1 }, durationInFrames: k.dur });
    const mix = (a: number, b: number) => a + (b - a) * p;
    cur = { f: k.f, x: mix(cur.x, nxt.x), y: mix(cur.y, nxt.y), z: mix(cur.z, nxt.z), tx: mix(cur.tx, nxt.tx), ty: mix(cur.ty, nxt.ty), rot: mix(cur.rot, nxt.rot), dur: 0 };
  }
  return cur;
}

// Posición en el video de un punto de la pantalla, con la cámara (para poner cosas al lado del teléfono).
export function aVideo(c: ReturnType<typeof camara>, x: number, y: number) {
  return { x: c.tx + (x - c.x) * K * c.z, y: c.ty + (y - c.y) * K * c.z };
}

export const Telefono: React.FC<{
  claves: Clave[]; children: React.ReactNode; noche?: boolean; hora?: string; barraColor?: string; barraTinta?: "claro" | "oscuro"; entra?: number; sinBarra?: boolean;
}> = ({ claves, children, noche, hora = "19:00", barraColor, barraTinta, entra, sinBarra }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = camara(claves, frame, fps);
  const c1 = camara(claves, frame - 1, fps);
  // Entrada desde abajo.
  let dy = 0, op = 1;
  if (entra !== undefined) {
    const s = spring({ frame: frame - entra, fps, config: { damping: 20, stiffness: 110, mass: 1 } });
    dy = (1 - s) * 1500; op = frame < entra ? 0 : 1;
  }
  // Desenfoque de movimiento sutil según la velocidad de la cámara.
  const vx = (c.tx - c.x * K * c.z) - (c1.tx - c1.x * K * c1.z);
  const vy = (c.ty - c.y * K * c.z) - (c1.ty - c1.y * K * c1.z) + (entra !== undefined ? 0 : 0);
  const vz = Math.abs(c.z - c1.z) * 400;
  const bx = Math.min(5, Math.abs(vx) * 0.06 + vz * 0.02), by = Math.min(5, Math.abs(vy) * 0.06 + vz * 0.02);
  const id = `mb${Math.round(bx * 10)}_${Math.round(by * 10)}`;
  const usaBlur = bx > 0.35 || by > 0.35;
  const tinta = barraTinta || (noche ? "claro" : "oscuro");
  // Origen: el teléfono se dibuja con su esquina en 0,0; el punto (x,y) de la pantalla va a (tx,ty).
  const px = BISEL + c.x * K, py = BISEL + (BAR + c.y) * K;
  return (
    <>
      {usaBlur && (
        <svg width="0" height="0" style={{ position: "absolute" }}>
          <filter id={id}><feGaussianBlur stdDeviation={`${bx} ${by}`} /></filter>
        </svg>
      )}
      <div style={{
        position: "absolute", left: 0, top: 0, width: PW, height: PH, opacity: op,
        transformOrigin: `${px}px ${py}px`,
        transform: `translate(${c.tx - px}px, ${c.ty - py + dy}px) scale(${c.z}) rotate(${c.rot}deg)`,
        filter: usaBlur ? `url(#${id})` : undefined, zIndex: 2,
      }}>
        {/* Cuerpo del teléfono, genérico: sin marcas. */}
        <div style={{ position: "absolute", inset: 0, borderRadius: 86, background: "linear-gradient(145deg, #2A3038, #0D1116 40%, #1B2027)",
          boxShadow: noche ? "0 50px 120px rgba(0,0,0,.55), 0 14px 30px rgba(0,0,0,.4), inset 0 0 0 2px rgba(255,255,255,.08)" : "0 60px 130px rgba(15,58,91,.38), 0 18px 36px rgba(15,58,91,.22), inset 0 0 0 2px rgba(255,255,255,.10)" }} />
        <div style={{ position: "absolute", right: -5, top: 330, width: 6, height: 150, borderRadius: 4, background: "#1A1F26" }} />
        <div style={{ position: "absolute", left: -5, top: 280, width: 6, height: 90, borderRadius: 4, background: "#1A1F26" }} />
        <div style={{ position: "absolute", left: BISEL, top: BISEL, width: SW, height: SH, borderRadius: 70, overflow: "hidden", background: noche ? "#0D131A" : "#F8FBFC" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 390, height: BAR + 844, transform: `scale(${K})`, transformOrigin: "0 0" }}>
            {children}
            {!sinBarra && <BarraEstado hora={hora} tinta={tinta} fondo={barraColor} />}
          </div>
          {/* cámara frontal */}
          <div style={{ position: "absolute", left: SW / 2 - 13, top: 14, width: 26, height: 26, borderRadius: 13, background: "#05070A", boxShadow: "inset 0 0 0 3px #11161C", zIndex: 50 }} />
        </div>
      </div>
    </>
  );
};

export const BarraEstado: React.FC<{ hora: string; tinta: "claro" | "oscuro"; fondo?: string }> = ({ hora, tinta, fondo }) => {
  const col = tinta === "claro" ? "#F5F7FA" : "#0B0F14";
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 390, height: BAR, background: fondo || "transparent", zIndex: 40, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 26px 0 30px", fontFamily: F.texto, fontWeight: 650, fontSize: 15, color: col }}>
      <span style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{hora}</span>
      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <svg width="18" height="11" viewBox="0 0 18 11">{[0, 1, 2, 3].map((i) => <rect key={i} x={i * 4.6} y={8 - i * 2.6} width="3.2" height={3 + i * 2.6} rx="0.8" fill={col} />)}</svg>
        <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.2 5.6 8.6a3.4 3.4 0 0 1 4.8 0Z M3.4 6.4a6.6 6.6 0 0 1 9.2 0l-1.4 1.5a4.6 4.6 0 0 0-6.4 0Z M1 4a10 10 0 0 1 14 0l-1.4 1.5a8 8 0 0 0-11.2 0Z" fill={col} /></svg>
        <svg width="26" height="12" viewBox="0 0 26 12"><rect x="0.6" y="0.6" width="22" height="10.8" rx="3" fill="none" stroke={col} strokeOpacity=".5" /><rect x="2.2" y="2.2" width="16" height="7.6" rx="1.6" fill={col} /><rect x="23.6" y="4" width="1.8" height="4" rx="0.8" fill={col} fillOpacity=".5" /></svg>
      </span>
    </div>
  );
};

const rango = (frame: number, a: number, b: number, ease = inOut) => interpolate(frame, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

// Una pantalla real. `scroll`: cuadros clave [cuadro, y CSS]; `barra`: la barra de la app, fija encima.
export const Pantalla: React.FC<{
  n: string; desde?: number; hasta?: number; tr?: number; modo?: "fundido" | "empuja" | "sube" | "corte" | "zoom"; scroll?: [number, number][]; barra?: string; top?: number;
}> = ({ n, desde = 0, hasta, tr = 8, modo = "fundido", scroll, barra, top = BAR }) => {
  const frame = useCurrentFrame();
  if (frame < desde - 1 || (hasta !== undefined && frame >= hasta)) return null;
  const c = cap(n);
  const p = modo === "corte" ? 1 : rango(frame, desde, desde + tr, modo === "fundido" ? Easing.linear : Easing.bezier(0.2, 0.9, 0.25, 1));
  let sy = 0;
  if (scroll && scroll.length) {
    sy = scroll[0][1];
    for (let i = 1; i < scroll.length; i++) {
      const [f0, y0] = scroll[i - 1]; const [f1, y1] = scroll[i];
      if (frame >= f0) sy = y0 + (y1 - y0) * rango(frame, f0, f1);
    }
  }
  const h = (c.h / c.w) * 390;
  const st: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: 390, height: BAR + 844, overflow: "hidden" };
  if (modo === "fundido" || modo === "corte") st.opacity = p;
  if (modo === "empuja") st.transform = `translateX(${(1 - p) * 390}px)`;
  if (modo === "sube") st.transform = `translateY(${(1 - p) * 880}px)`;
  if (modo === "zoom") { st.opacity = p; st.transform = `scale(${1.06 - 0.06 * p})`; }
  return (
    <div style={st}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 390, height: BAR, background: c.top }} />
      <Img src={staticFile(c.f)} style={{ position: "absolute", left: 0, top: top - sy, width: 390, height: h }} />
      {barra && <Img src={staticFile(cap(barra).f)} style={{ position: "absolute", left: 0, top: BAR, width: 390, height: 844 }} />}
    </div>
  );
};

// Secuencia de cuadros reales (grabación del mapa, la animación de ¡Oído!) a su tiempo.
export const Secuencia: React.FC<{ n: string; desde: number; hasta?: number; vel?: number; tr?: number }> = ({ n, desde, hasta, vel = 1, tr = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < desde || (hasta !== undefined && frame >= hasta)) return null;
  const cs = CAP[n].cuadros as { f: string; t: number }[];
  const t = ((frame - desde) / fps) * vel;
  let i = 0;
  while (i < cs.length - 1 && cs[i + 1].t <= t) i++;
  const op = tr ? Math.min(1, (frame - desde) / tr) : 1;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 390, height: BAR + 844, overflow: "hidden", opacity: op }}>
      <Img src={staticFile(cs[i].f)} style={{ position: "absolute", left: 0, top: BAR, width: 390, height: 844 }} />
    </div>
  );
};

// El dedo que toca: aparece, aprieta (onda) y se va. Coordenadas CSS de la página.
export const Toque: React.FC<{ f: number; x: number; y: number; grande?: boolean }> = ({ f, x, y, grande }) => {
  const frame = useCurrentFrame();
  const t = frame - f;
  if (t < -12 || t > 22) return null;
  const llega = interpolate(t, [-12, -2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const aprieta = interpolate(t, [-2, 1, 6], [1, 0.82, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const se = interpolate(t, [10, 22], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const onda = interpolate(t, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const d = grande ? 54 : 42;
  return (
    <div style={{ position: "absolute", left: x, top: y + BAR, zIndex: 45, pointerEvents: "none" }}>
      {t >= 0 && <div style={{ position: "absolute", left: -d * 1.6 * onda, top: -d * 1.6 * onda, width: d * 3.2 * onda, height: d * 3.2 * onda, borderRadius: "50%",
        border: `${grande ? 4 : 3}px solid rgba(255,255,255,${0.9 * (1 - onda)})`, boxShadow: `0 0 0 ${grande ? 3 : 2}px rgba(28,84,120,${0.45 * (1 - onda)})` }} />}
      <div style={{ position: "absolute", left: -d / 2, top: -d / 2, width: d, height: d, borderRadius: "50%", opacity: llega * se,
        transform: `scale(${(1.35 - 0.35 * llega) * aprieta})`, background: "radial-gradient(circle at 40% 35%, rgba(255,255,255,.95), rgba(235,242,247,.88))",
        boxShadow: "0 6px 18px rgba(15,58,91,.35), inset 0 0 0 2px rgba(28,84,120,.35)" }} />
    </div>
  );
};

// Resaltado: un contorno en azul hondo que late alrededor de algo de la pantalla.
export const Resalte: React.FC<{ desde: number; hasta: number; x: number; y: number; w: number; h: number; r?: number; claro?: boolean }> = ({ desde, hasta, x, y, w, h, r = 18, claro }) => {
  const frame = useCurrentFrame();
  if (frame < desde || frame > hasta + 8) return null;
  const a = interpolate(frame, [desde, desde + 8, hasta, hasta + 8], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const s = 1 + 0.04 * Math.sin((frame - desde) / 5);
  const col = claro ? "255,255,255" : "28,84,120";
  return (
    <div style={{ position: "absolute", left: x - 5, top: y + BAR - 5, width: w + 10, height: h + 10, borderRadius: r + 5, zIndex: 44, opacity: a,
      transform: `scale(${s})`, boxShadow: `0 0 0 3px rgba(${col},.95), 0 0 0 10px rgba(${col},.18), 0 0 30px rgba(${col},.35)` }} />
  );
};

// Aviso del sistema que baja desde arriba (dibujado, sin marcas de terceros).
export const AvisoPush: React.FC<{ desde: number; hasta: number; titulo: string; texto: string; noche?: boolean }> = ({ desde, hasta, titulo, texto, noche }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < desde || frame > hasta + 14) return null;
  const s = spring({ frame: frame - desde, fps, config: { damping: 16, stiffness: 170 } });
  const o = interpolate(frame, [hasta, hasta + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  return (
    <div style={{ position: "absolute", left: 10, right: 10, top: BAR + 4, zIndex: 46, transform: `translateY(${(1 - s) * -130 - o * 130}px)`, opacity: 1 - o * 0.5,
      background: noche ? "rgba(30,38,48,.92)" : "rgba(255,255,255,.92)", backdropFilter: "blur(14px)", borderRadius: 22, padding: "12px 14px",
      boxShadow: "0 10px 30px rgba(15,58,91,.25)", display: "flex", gap: 11, alignItems: "flex-start", fontFamily: F.texto, color: noche ? C.claro : C.tinta }}>
      <Img src={staticFile("marca/isotipo-pinche-chico.svg")} style={{ width: 38, height: 38, borderRadius: 10, flex: "none" }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.6, display: "flex", justifyContent: "space-between" }}><span>Oído</span><span>ahora</span></div>
        <div style={{ fontSize: 15, fontWeight: 700, marginTop: 1 }}>{titulo}</div>
        <div style={{ fontSize: 14, lineHeight: 1.3, opacity: 0.85 }}>{texto}</div>
      </div>
    </div>
  );
};

// Lupa: un recorte agrandado de la pantalla, flotando al lado del teléfono.
export const Lupa: React.FC<{ n: string; desde: number; hasta: number; rect: [number, number, number, number]; x: number; y: number; ancho: number; scrollY?: number; rot?: number }> = ({ n, desde, hasta, rect, x, y, ancho, scrollY = 0, rot = -2 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < desde || frame > hasta + 10) return null;
  const s = spring({ frame: frame - desde, fps, config: { damping: 14, stiffness: 150 } });
  const o = interpolate(frame, [hasta, hasta + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const c = cap(n);
  const [rx, ry, rw, rh] = rect;
  const esc = ancho / rw;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: ancho, height: rh * esc, borderRadius: 34, overflow: "hidden", zIndex: 8,
      transform: `translate(-50%,-50%) scale(${0.55 + 0.45 * s}) rotate(${rot * s}deg)`, opacity: Math.min(1, s * 1.5) * (1 - o),
      boxShadow: "0 30px 70px rgba(15,58,91,.32), 0 8px 18px rgba(15,58,91,.18), 0 0 0 4px rgba(255,255,255,.95)" }}>
      <Img src={staticFile(c.f)} style={{ position: "absolute", left: -rx * esc, top: -(ry + scrollY) * esc, width: 390 * esc, height: (c.h / c.w) * 390 * esc }} />
    </div>
  );
};
