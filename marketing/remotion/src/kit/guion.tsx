// Piezas que salen de un guion (pestaña Guiones del documento de crecimiento): cada escena tiene
// su texto arriba (zona segura de títulos) y una lámina blanca con un dibujo animado en el medio.
// Los textos y los tiempos van en los datos de cada pieza; los dibujos, en el archivo de la pieza.
import React from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { BancoNubes, BotonAmbar, C, ChipVidrio, Cielo, F, Hoja, Nube, Titular } from "./base";
import { Mezcla, type Sonido } from "./sonido";
import type { Cuenta } from "./datos";

export const seg = (s: number) => Math.round(s * 30);

/** Una escena: de `desde` a `hasta` (segundos), el texto en pantalla y qué dibujo va en la lámina. */
export type Escena = {
  desde: number; hasta: number;
  lineas: string[]; size?: number; acento?: string;
  /** texto chico debajo de la lámina (aclaraciones entre paréntesis del guion) */
  nota?: string;
  /** segundos después del arranque de la escena en que aparece la nota (por defecto 0,6) */
  notaEn?: number;
  dibujo: string;
};

/** El cierre: el logo de la cuenta y el llamado del guion. */
export type CierreGuion = {
  desde: number;
  lineas: string[]; size?: number;
  logo: "pinche" | "filete";
  boton?: string; bajada?: string;
};

/** Un dibujo recibe el cuadro local (0 al empezar la escena) y su duración en cuadros. */
export type Dibujo = React.FC<{ t: number; dur: number }>;

export const LAMINA = { x: 90, y: 560, w: 900, h: 860 };

const ease = Easing.bezier(0.22, 1, 0.36, 1);
/** 0→1 entre los cuadros a y b (locales), con resorte suave. */
export const entre = (t: number, a: number, b: number, e = ease) =>
  interpolate(t, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });

// La lámina: entra subiendo, sale hacia la izquierda. El dibujo va en un SVG de 900 × 860.
export const Lamina: React.FC<{ desde: number; hasta: number; children: React.ReactNode; sinHoja?: boolean }> = ({ desde, hasta, children, sinHoja }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < desde - 1 || frame > hasta + 10) return null;
  const s = spring({ frame: frame - desde, fps, config: { damping: 20, stiffness: 150, mass: 0.9 } });
  const o = interpolate(frame, [hasta, hasta + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const { x, y, w, h } = LAMINA;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, zIndex: 4,
      transform: `translate(${-o * 120}px, ${(1 - s) * 140}px) scale(${0.94 + 0.06 * s}) rotate(${(1 - s) * 1.5}deg)`,
      opacity: Math.min(1, s * 1.8) * (1 - o) }}>
      {sinHoja ? children : <Hoja style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>{children}</Hoja>}
    </div>
  );
};

export const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox="0 0 900 860" width="100%" height="100%" style={{ display: "block" }}>{children}</svg>
);

// Las escenas de una pieza: el texto (palabra por palabra) y la lámina con su dibujo.
export const Escenas: React.FC<{ lista: Escena[]; dibujos: Record<string, Dibujo> }> = ({ lista, dibujos }) => {
  const frame = useCurrentFrame();
  return (
    <>
      {lista.map((e, i) => {
        const a = seg(e.desde), b = seg(e.hasta) - 8;
        const D = dibujos[e.dibujo];
        if (!D) throw new Error("falta el dibujo " + e.dibujo);
        const n = e.lineas.length;
        const size = e.size ?? (n >= 3 ? 66 : 76);
        const y = 400 - (n * size * 1.04) / 2 + 10;
        return (
          <React.Fragment key={i}>
            <Titular lineas={e.lineas} desde={a} hasta={b} y={Math.max(200, y)} size={size} acento={e.acento} />
            <Lamina desde={a} hasta={b}>{frame >= a - 1 && frame <= b + 10 ? <D t={frame - a} dur={b - a} /> : null}</Lamina>
            {e.nota && <Nota desde={a + seg(e.notaEn ?? 0.6)} hasta={b} texto={e.nota} />}
          </React.Fragment>
        );
      })}
    </>
  );
};

const Nota: React.FC<{ desde: number; hasta: number; texto: string }> = ({ desde, hasta, texto }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < desde || frame > hasta + 10) return null;
  const s = spring({ frame: frame - desde, fps, config: { damping: 14, stiffness: 170 } });
  const o = interpolate(frame, [hasta, hasta + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: LAMINA.y + LAMINA.h - 40, display: "flex", justifyContent: "center", zIndex: 7,
      opacity: Math.min(1, s * 1.5) * (1 - o), transform: `translateY(${(1 - s) * 30}px) scale(${0.85 + 0.15 * s})` }}>
      <ChipVidrio style={{ fontSize: 40, padding: "18px 34px", background: "rgba(255,255,255,.88)", whiteSpace: "normal", maxWidth: 820, textAlign: "center", justifyContent: "center", borderRadius: 40, lineHeight: 1.2 }}>{texto}</ChipVidrio>
    </div>
  );
};

// El cierre de las piezas de guion: el logo de la cuenta (el pinche en @turnosgastro, el «oído»
// fileteado en @oidoapp), el llamado y, si hay, el botón ámbar.
export const CierreDeGuion: React.FC<{ c: CierreGuion; cuenta: string }> = ({ c, cuenta }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const d = seg(c.desde);
  if (frame < d) return null;
  const t = frame - d;
  const lim = interpolate(t, [0, 12], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const s = spring({ frame: t - 6, fps, config: { damping: 12, stiffness: 120, mass: 0.9 } });
  const b = spring({ frame: t - 16, fps, config: { damping: 14, stiffness: 160 } });
  const l = spring({ frame: t - 22, fps, config: { damping: 18, stiffness: 140 } });
  const respira = 1 + 0.012 * Math.sin(t / 9);
  const size = c.size ?? 74;
  const pinche = c.logo === "pinche";
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 30 }}>
      <div style={{ position: "absolute", inset: 0, opacity: lim,
        background: `radial-gradient(120% 70% at 88% 0%, rgba(255,255,255,.24), transparent 60%), linear-gradient(180deg, ${C.cielo0}, ${C.cielo1} 52%, ${C.cielo2})` }}>
        <Nube k="a" x={620} y={170} w={520} prof={0.3} op={0.8} />
        <Nube k="c" x={-380} y={330} w={720} prof={0.15} op={0.55} />
      </div>
      <Titular lineas={c.lineas} desde={d + 2} y={250} size={size} />
      <div style={{ position: "absolute", left: 540, top: pinche ? 800 : 760, width: pinche ? 400 : 820,
        transform: `translate(-50%,-50%) scale(${(0.7 + 0.3 * s) * respira}) rotate(${(1 - s) * -6}deg)`, opacity: Math.min(1, s * 2) }}>
        <Img src={staticFile(pinche ? "marca/isotipo-pinche.svg" : "marca/oido-filete.svg")}
          style={{ width: "100%", borderRadius: pinche ? 92 : 0, filter: "drop-shadow(0 26px 40px rgba(15,58,91,.28))" }} />
      </div>
      {c.boton && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 1060, display: "flex", justifyContent: "center", transform: `translateY(${(1 - b) * 60}px) scale(${0.85 + 0.15 * b})`, opacity: Math.min(1, b * 1.6) }}>
          <BotonAmbar>{c.boton}</BotonAmbar>
        </div>
      )}
      {c.bajada && (
        <div style={{ position: "absolute", left: 60, right: 60, top: c.boton ? 1235 : 1060, textAlign: "center", fontFamily: F.mono, fontWeight: 500, fontSize: 40, letterSpacing: "0.04em", color: C.tintaCielo, opacity: Math.min(1, l * 1.5), transform: `translateY(${(1 - l) * 30}px)` }}>{c.bajada}</div>
      )}
      <div style={{ position: "absolute", left: 60, right: 60, top: c.boton ? 1300 : pinche ? 1060 : 1150, textAlign: "center", fontFamily: F.texto, fontWeight: 800, fontSize: pinche ? 56 : 42, letterSpacing: "-0.01em", color: C.hondo, opacity: Math.min(1, l * 1.3), transform: `translateY(${(1 - l) * 30}px)` }}>{cuenta}</div>
      <BancoNubes y={1560} op={lim} />
    </div>
  );
};

/** Los datos de una pieza de guion (src/piezas/<pieza>.datos.ts). */
export type DatosGuion = {
  id: string; codigo: string; titulo: string; fecha: string;
  /** en segundos */
  duracion: number;
  cuenta: Cuenta;
  escenas: Escena[];
  cierre: CierreGuion;
  sonido: Sonido;
};

/** Una pieza entera hecha sólo de escenas con lámina (las de @turnosgastro). */
export const PiezaGuion: React.FC<{ d: DatosGuion; dibujos: Record<string, Dibujo> }> = ({ d, dibujos }) => (
  <Cielo>
    <Escenas lista={d.escenas} dibujos={dibujos} />
    <BancoNubes y={1660} />
    <CierreDeGuion c={d.cierre} cuenta={d.cuenta} />
    <Mezcla s={d.sonido} />
  </Cielo>
);

// ——— Piezas chicas de dibujo, en la paleta de la marca (azul hondo, celeste, papel; un solo ámbar). ———

export const P = {
  linea: C.hondo, suave: "#C9DCEA", fondo: "#EEF5FA", mesa: "#E3EEF6", madera: "#E9D9C3", maderaOsc: "#CDB495",
  piel: "#F1D3BC", gente: ["#1C5478", "#5BA8E0", "#9AC9E7", "#2F6E96", "#84C0EC", "#3E7FA8"],
};

/** Persona vista desde arriba (cabeza y hombros). */
export const PersonaArriba: React.FC<{ x: number; y: number; r?: number; c?: string; rot?: number; op?: number }> = ({ x, y, r = 26, c = P.gente[0], rot = 0, op = 1 }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`} opacity={op}>
    <ellipse cx={0} cy={r * 0.5} rx={r * 1.35} ry={r * 0.75} fill={c} opacity={0.9} />
    <circle cx={0} cy={0} r={r * 0.72} fill={P.piel} stroke={c} strokeWidth={3} />
  </g>
);

/** Persona de frente, en silueta simple. */
export const PersonaFrente: React.FC<{ x: number; y: number; h?: number; c?: string; op?: number }> = ({ x, y, h = 220, c = P.gente[0], op = 1 }) => {
  const k = h / 220;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`} opacity={op}>
      <circle cx={0} cy={-170} r={34} fill={P.piel} />
      <path d="M-62 0 C-62 -90 -48 -122 0 -122 C48 -122 62 -90 62 0 Z" fill={c} />
    </g>
  );
};

/** Plato visto desde arriba. */
export const Plato: React.FC<{ x: number; y: number; r?: number; comida?: string; op?: number; s?: number }> = ({ x, y, r = 46, comida, op = 1, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={op}>
    <circle r={r} fill="#fff" stroke={P.suave} strokeWidth={3} />
    <circle r={r * 0.68} fill="none" stroke={P.suave} strokeWidth={2} />
    {comida && <circle r={r * 0.42} fill={comida} />}
  </g>
);

/** Flecha curva dibujándose (p de 0 a 1). */
export const Flecha: React.FC<{ d: string; p: number; color?: string; ancho?: number; punta?: [number, number, number] }> = ({ d, p, color = C.hondo, ancho = 10, punta }) => (
  <g>
    <path d={d} fill="none" stroke={color} strokeWidth={ancho} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} />
    {punta && p > 0.95 && (
      <g transform={`translate(${punta[0]} ${punta[1]}) rotate(${punta[2]})`}>
        <path d="M0 0 L-30 -18 L-30 18 Z" fill={color} />
      </g>
    )}
  </g>
);

/** Reloj de pared (o de cocina) con la hora en texto. */
export const RelojTexto: React.FC<{ x: number; y: number; texto: string; size?: number; op?: number }> = ({ x, y, texto, size = 64, op = 1 }) => {
  const w = Math.max(size * 3.4, texto.length * size * 0.62 + size * 0.8);
  return (
  <g transform={`translate(${x} ${y})`} opacity={op}>
    <rect x={-w / 2} y={-size * 0.85} width={w} height={size * 1.5} rx={size * 0.35} fill={C.noche1} />
    <text x={0} y={size * 0.28} textAnchor="middle" fontFamily={F.mono} fontWeight={500} fontSize={size} fill="#EEF3F6" letterSpacing="0.04em">{texto}</text>
  </g>
  );
};

/** Globo de chat (sin marcas). */
export const Globo: React.FC<{ x: number; y: number; w: number; texto: string; de?: string; propio?: boolean; s?: number; size?: number; audio?: boolean }> = ({ x, y, w, texto, de, propio, s = 1, size = 34, audio }) => {
  const h = (de ? 46 : 0) + size * 1.35 + 44;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={Math.min(1, s * 1.4)}>
      <rect x={0} y={0} width={w} height={h} rx={30} fill={propio ? "#D7EAF6" : "#fff"} stroke={P.suave} strokeWidth={2} />
      {de && <text x={30} y={46} fontFamily={F.texto} fontWeight={700} fontSize={26} fill={C.hondo}>{de}</text>}
      {audio ? (
        <g transform={`translate(30 ${(de ? 46 : 0) + 22})`}>
          <circle cx={22} cy={size * 0.66} r={22} fill={C.hondo} />
          <path d={`M15 ${size * 0.66 - 12} L33 ${size * 0.66} L15 ${size * 0.66 + 12} Z`} fill="#fff" />
          {Array.from({ length: 22 }, (_, i) => {
            const hh = 8 + Math.abs(Math.sin(i * 1.7)) * 30;
            return <rect key={i} x={62 + i * 12} y={size * 0.66 - hh / 2} width={6} height={hh} rx={3} fill={C.hondo} opacity={0.55} />;
          })}
        </g>
      ) : (
        <text x={30} y={(de ? 46 : 0) + size * 1.2 + 14} fontFamily={F.texto} fontWeight={600} fontSize={size} fill={C.tinta}>{texto}</text>
      )}
    </g>
  );
};
