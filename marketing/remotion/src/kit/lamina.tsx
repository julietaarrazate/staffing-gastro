// Láminas: una hoja blanca sobre el cielo con un dibujo simple adentro (SVG, paleta de la marca).
// Las usan las piezas de contenido (tips y humor del rubro), donde no hay pantalla de la app.
// Cada dibujo recibe `t`: cuadros desde que entró su escena, para animarse por dentro.
import React from "react";
import { Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F, Hoja } from "./base";

export const rampa = (t: number, a: number, b: number, ease = Easing.bezier(0.22, 1, 0.36, 1)) =>
  interpolate(t, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

// La escena: aparece (sube con resorte, se enfoca) y se va hacia la izquierda cuando entra la siguiente.
export const Escena: React.FC<{ desde: number; hasta?: number; children: (t: number) => React.ReactNode; y?: number; alto?: number; sinHoja?: boolean }> = ({
  desde, hasta, children, y = 1040, alto = 860, sinHoja,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < desde - 1 || (hasta !== undefined && frame > hasta + 12)) return null;
  const t = frame - desde;
  const s = spring({ frame: t, fps, config: { damping: 17, stiffness: 120, mass: 0.9 } });
  const o = hasta === undefined ? 0 : interpolate(frame, [hasta, hasta + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const ancho = 900;
  return (
    <div style={{
      position: "absolute", left: 540 - ancho / 2, top: y - alto / 2, width: ancho, height: alto, zIndex: 4,
      opacity: Math.min(1, s * 1.5) * (1 - o),
      transform: `translate(${-o * 260}px, ${(1 - s) * 140}px) rotate(${(1 - s) * 3 - o * 4}deg) scale(${0.92 + 0.08 * s})`,
      filter: s < 0.97 ? `blur(${(1 - s) * 8}px)` : undefined,
    }}>
      {sinHoja ? children(t) : (
        <Hoja style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <svg viewBox="0 0 900 860" width={900} height={alto} preserveAspectRatio="xMidYMid meet" style={{ position: "absolute", inset: 0 }}>{children(t)}</svg>
        </Hoja>
      )}
    </div>
  );
};

// Número de paso en círculo azul hondo (como en el cierre para comercios).
export const NumeroPaso: React.FC<{ n: string; desde: number; hasta: number; x?: number; y?: number }> = ({ n, desde, hasta, x = 80, y = 236 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < desde || f > hasta + 8) return null;
  const s = spring({ frame: f - desde, fps, config: { damping: 12, stiffness: 170 } });
  const o = interpolate(f, [hasta, hasta + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 150, height: 150, borderRadius: 75, zIndex: 7,
      background: `linear-gradient(180deg, #2A6A94, ${C.hondo})`, color: "#fff", display: "grid", placeItems: "center",
      fontFamily: F.texto, fontWeight: 800, fontSize: 96, boxShadow: "0 18px 40px rgba(15,58,91,.35), inset 0 2px 0 rgba(255,255,255,.25)",
      transform: `scale(${s * (1 - o)}) rotate(${(1 - s) * -30}deg)` }}>{n}</div>
  );
};

// Sello «¡OÍDO!» que cae sobre algo.
export const Sello: React.FC<{ t: number; desde: number; x: number; y: number; texto?: string; rot?: number; size?: number; fondo?: boolean }> = ({ t, desde, x, y, texto = "¡OÍDO!", rot = -8, size = 64, fondo }) => {
  if (t < desde) return null;
  const p = rampa(t, desde, desde + 10, Easing.bezier(0.34, 1.56, 0.64, 1));
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${2 - p})`} opacity={Math.min(1, (t - desde) / 4)}>
      <rect x={-size * 2.3} y={-size * 0.78} width={size * 4.6} height={size * 1.56} rx={size * 0.3} fill={fondo ? "rgba(255,255,255,.94)" : "none"} stroke={C.hondo} strokeWidth={8} />
      <text x={0} y={size * 0.36} textAnchor="middle" fontFamily="Inter" fontWeight={900} fontSize={size} fill={C.hondo} letterSpacing="2">{texto}</text>
    </g>
  );
};

// Cierre de las cuentas de contenido (@turnosgastro): el «oído» fileteado chico, la frase y la cuenta.
export const CierreCuenta: React.FC<{ desde: number; lineas: string[]; cuenta: string; nombre: string; acento?: string; size?: number; fotos?: [string, string] }> = ({ desde, lineas, cuenta, nombre, acento, size = 92, fotos }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < desde) return null;
  const t = frame - desde;
  const lim = interpolate(t, [0, 12], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const s = spring({ frame: t - 10, fps, config: { damping: 12, stiffness: 120, mass: 0.9 } });
  const l = spring({ frame: t - 18, fps, config: { damping: 18, stiffness: 140 } });
  let k = 0;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 30 }}>
      <div style={{ position: "absolute", inset: 0, opacity: lim,
        background: `radial-gradient(120% 70% at 88% 0%, rgba(255,255,255,.24), transparent 60%), linear-gradient(180deg, ${C.cielo0}, ${C.cielo1} 52%, ${C.cielo2})` }} />
      {fotos && <FotosCierre t={t} fotos={fotos} y={860} w={360} />}
      <div style={{ position: "absolute", left: 90, right: 90, top: fotos ? 240 : 330, textAlign: "center", fontFamily: F.texto, fontWeight: 800, fontSize: size, lineHeight: 1.04,
        letterSpacing: "-0.025em", color: C.tintaCielo, opacity: lim }}>
        {lineas.map((ln, i) => (
          <div key={i} style={{ whiteSpace: "nowrap" }}>
            {ln.split(" ").map((w, j) => {
              const p = spring({ frame: t - 4 - (k++) * 2.2, fps, config: { damping: 16, stiffness: 160 } });
              const ac = acento && w.replace(/[.,!¡?¿«»]/g, "") === acento;
              return <span key={j} style={{ display: "inline-block", marginRight: "0.24em", opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 46}px)`, color: ac ? C.hondo : undefined }}>{w}</span>;
            })}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 540, top: fotos ? 1250 : 1010, width: fotos ? 420 : 620, zIndex: 5, transform: `translate(-50%,-50%) scale(${0.7 + 0.3 * s}) rotate(${(1 - s) * -6}deg)`, opacity: Math.min(1, s * 2) }}>
        <Img src={staticFile("marca/oido-filete.svg")} style={{ width: "100%", filter: "drop-shadow(0 22px 34px rgba(15,58,91,.26))" }} />
      </div>
      <div style={{ position: "absolute", left: 60, right: 60, top: fotos ? 1380 : 1250, textAlign: "center", opacity: Math.min(1, l * 1.4), transform: `translateY(${(1 - l) * 30}px)` }}>
        <div style={{ fontFamily: F.texto, fontWeight: 800, fontSize: 54, color: C.hondo, letterSpacing: "-0.01em" }}>{cuenta}</div>
        <div style={{ fontFamily: F.mono, fontWeight: 500, fontSize: 32, letterSpacing: "0.06em", color: C.tintaCielo, marginTop: 10 }}>{nombre}</div>
      </div>
    </div>
  );
};

// ── Dibujos ───────────────────────────────────────────────────────────
// Coordenadas en el viewBox de la hoja (900 × 860). Trazos en azul hondo, rellenos suaves.
export const T = { tinta: C.tintaCielo, hondo: C.hondo, celeste: C.celeste, chip: C.chip, papel: "#FFFFFF", gris: "#E7EDF1", suave: "#9AAAB8" };

/** Una persona vista desde arriba (cabeza y hombros). */
export const Persona: React.FC<{ x: number; y: number; r?: number; col?: string; rot?: number }> = ({ x, y, r = 22, col = T.celeste, rot = 0 }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`}>
    <ellipse cx={0} cy={0} rx={r * 1.5} ry={r * 0.85} fill={col} opacity={0.75} />
    <circle cx={0} cy={0} r={r * 0.72} fill={T.hondo} />
  </g>
);

/** Mesa redonda vista desde arriba con `n` personas alrededor. */
export const MesaArriba: React.FC<{ x: number; y: number; r: number; n: number; t?: number; plato?: boolean; mueve?: number }> = ({ x, y, r, n, t = 0, plato = true, mueve = 0 }) => (
  <g transform={`translate(${x} ${y})`}>
    {Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + 0.3;
      const w = mueve * Math.sin(t / 6 + i * 1.7);
      return <Persona key={i} x={Math.cos(a) * (r + 26) + w} y={Math.sin(a) * (r + 26)} r={19} rot={(a * 180) / Math.PI + 90} col={i % 3 === 0 ? "#C9DFEE" : T.celeste} />;
    })}
    <circle r={r} fill={T.papel} stroke={T.hondo} strokeWidth={5} />
    {plato && Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + 0.3;
      return <circle key={i} cx={Math.cos(a) * r * 0.62} cy={Math.sin(a) * r * 0.62} r={r * 0.2} fill={T.gris} stroke={T.suave} strokeWidth={2} />;
    })}
  </g>
);

/** Vaso (alto o corto), con hielo, líquido y nivel de agua. Base en (x, y). */
export const Vaso: React.FC<{
  x: number; y: number; alto?: boolean; ancho?: number; cubos?: { x: number; y: number; s: number; r?: number }[]; liquido?: string; nivel?: number; agua?: number; picado?: boolean; menta?: boolean; t?: number;
}> = ({ x, y, alto, ancho = alto ? 190 : 280, cubos = [], liquido = "#C98B4E", nivel = 0.7, agua = 0, picado, menta, t = 0 }) => {
  const h = alto ? 430 : 330;
  const w = ancho;
  const id = `v${Math.round(x)}${Math.round(y)}${alto ? "a" : "c"}`;
  const top = y - h;
  const ny = y - 18 - (h - 36) * nivel;
  return (
    <g>
      <defs>
        <clipPath id={id}><path d={`M ${x - w / 2 + 8} ${top + 6} L ${x + w / 2 - 8} ${top + 6} L ${x + w / 2 - 18} ${y - 18} L ${x - w / 2 + 18} ${y - 18} Z`} /></clipPath>
      </defs>
      <ellipse cx={x} cy={y + 6} rx={w * 0.55} ry={14} fill="rgba(15,58,91,.10)" />
      <g clipPath={`url(#${id})`}>
        <rect x={x - w} y={ny} width={w * 2} height={h} fill={liquido} opacity={0.55} />
        {agua > 0 && <rect x={x - w} y={ny - agua} width={w * 2} height={agua + 2} fill="#BFE1F6" opacity={0.85} />}
        {picado && Array.from({ length: 70 }, (_, i) => {
          const r1 = (Math.sin(i * 91.7) * 43758.5) % 1, r2 = (Math.sin(i * 17.3) * 12731.1) % 1;
          return <rect key={i} x={x - w / 2 + 14 + Math.abs(r1) * (w - 28)} y={top + 30 + Math.abs(r2) * (h - 60)} width={16 + (i % 3) * 6} height={14 + (i % 4) * 4} rx={4}
            fill="rgba(255,255,255,.85)" stroke="rgba(28,84,120,.35)" strokeWidth={2} transform={`rotate(${(i * 37) % 60 - 30} ${x} ${y - h / 2})`} />;
        })}
        {cubos.map((c, i) => (
          <rect key={i} x={x + c.x - c.s / 2} y={c.y - c.s / 2} width={c.s} height={c.s} rx={c.s * 0.16} transform={`rotate(${c.r ?? 0} ${x + c.x} ${c.y})`}
            fill="rgba(255,255,255,.78)" stroke="rgba(28,84,120,.45)" strokeWidth={3} />
        ))}
        {menta && [0, 1, 2, 3].map((i) => (
          <ellipse key={i} cx={x - 40 + i * 28} cy={top + 40 + (i % 2) * 18} rx={24} ry={12} fill="#5E9E6E" transform={`rotate(${-30 + i * 25} ${x - 40 + i * 28} ${top + 40})`} />
        ))}
      </g>
      <path d={`M ${x - w / 2} ${top} L ${x + w / 2} ${top} L ${x + w / 2 - 12} ${y} L ${x - w / 2 + 12} ${y} Z`} fill="rgba(191,225,246,.18)" stroke={T.hondo} strokeWidth={6} strokeLinejoin="round" />
      <line x1={x - w / 2 + 26} y1={top + 24} x2={x - w / 2 + 34} y2={y - 30} stroke="rgba(255,255,255,.8)" strokeWidth={8} strokeLinecap="round" />
    </g>
  );
};

/** Cubo de hielo suelto (para los que caen). */
export const Cubo: React.FC<{ x: number; y: number; s: number; r?: number; op?: number }> = ({ x, y, s, r = 0, op = 1 }) => (
  <rect x={x - s / 2} y={y - s / 2} width={s} height={s} rx={s * 0.16} transform={`rotate(${r} ${x} ${y})`} opacity={op}
    fill="rgba(255,255,255,.9)" stroke="rgba(28,84,120,.5)" strokeWidth={3} />
);

/** Cuchillo de cocina horizontal: punta a la derecha. (x, y) es el comienzo del mango. */
export const Cuchillo: React.FC<{ x: number; y: number; largo?: number; rot?: number }> = ({ x, y, largo = 460, rot = 0 }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`}>
    <rect x={0} y={-20} width={150} height={40} rx={14} fill={T.tinta} />
    {[38, 75, 112].map((cx) => <circle key={cx} cx={cx} cy={0} r={5} fill="#C9D6DF" />)}
    <path d={`M 150 -26 L ${largo - 30} -26 Q ${largo} -26 ${largo} 0 L ${largo - 40} 30 L 150 30 Z`} fill="#E9EFF3" stroke={T.hondo} strokeWidth={5} strokeLinejoin="round" />
    <line x1={170} y1={18} x2={largo - 50} y2={18} stroke="rgba(28,84,120,.25)" strokeWidth={4} />
  </g>
);

/** Tabla de picar. */
export const Tabla: React.FC<{ x: number; y: number; w?: number; h?: number }> = ({ x, y, w = 760, h = 520 }) => (
  <g>
    <rect x={x - w / 2} y={y - h / 2 + 12} width={w} height={h} rx={40} fill="rgba(15,58,91,.10)" />
    <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={40} fill="#EAD9BF" stroke="#C9AE86" strokeWidth={5} />
    {[0.25, 0.5, 0.75].map((k) => <path key={k} d={`M ${x - w / 2 + 40} ${y - h / 2 + h * k} q ${w / 4} -14 ${w / 2} 0 t ${w / 2 - 80} 0`} stroke="rgba(160,120,70,.25)" strokeWidth={3} fill="none" />)}
  </g>
);

/** Flecha curva con punta. */
export const Flecha: React.FC<{ d: string; p: number; col?: string; ancho?: number }> = ({ d, p, col = T.hondo, ancho = 12 }) => (
  <g>
    <path d={d} fill="none" stroke={col} strokeWidth={ancho} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} markerEnd={p > 0.95 ? "url(#punta)" : undefined} />
    <defs>
      <marker id="punta" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={col} />
      </marker>
    </defs>
  </g>
);

/** Plato visto desde arriba. */
export const Plato: React.FC<{ x: number; y: number; r?: number; comida?: string }> = ({ x, y, r = 70, comida = "#E4B878" }) => (
  <g>
    <circle cx={x} cy={y + 6} r={r} fill="rgba(15,58,91,.10)" />
    <circle cx={x} cy={y} r={r} fill={T.papel} stroke={T.hondo} strokeWidth={5} />
    <circle cx={x} cy={y} r={r * 0.68} fill="none" stroke={T.gris} strokeWidth={4} />
    {comida && <ellipse cx={x} cy={y} rx={r * 0.42} ry={r * 0.32} fill={comida} />}
  </g>
);

/** Copa vista desde arriba (círculo con brillo). */
export const CopaArriba: React.FC<{ x: number; y: number; r?: number; vino?: boolean }> = ({ x, y, r = 34, vino = true }) => (
  <g>
    <circle cx={x} cy={y + 4} r={r} fill="rgba(15,58,91,.10)" />
    <circle cx={x} cy={y} r={r} fill="rgba(191,225,246,.4)" stroke={T.hondo} strokeWidth={4} />
    {vino && <circle cx={x} cy={y} r={r * 0.62} fill="#9E3B4C" opacity={0.75} />}
    <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.16} fill="#fff" opacity={0.85} />
  </g>
);

/** Texto dentro de un dibujo. */
export const Rotulo: React.FC<{ x: number; y: number; children: React.ReactNode; size?: number; col?: string; peso?: number; mono?: boolean; anchor?: "start" | "middle" | "end"; op?: number }> = ({ x, y, children, size = 34, col = T.tinta, peso = 700, mono, anchor = "middle", op = 1 }) => (
  <text x={x} y={y} textAnchor={anchor} fontFamily={mono ? "DM Mono" : "Inter"} fontWeight={mono ? 500 : peso} fontSize={size} fill={col} opacity={op} letterSpacing={mono ? "0.06em" : "-0.01em"}>{children}</text>
);

// ── Fotos (las de la landing, 480 × 600: se muestran casi a su tamaño) ──
/** Tarjeta de foto con borde blanco y un zoom lento adentro. */
export const Foto: React.FC<{ f: string; t: number; w?: number; rot?: number; style?: React.CSSProperties }> = ({ f, t, w = 560, rot = 0, style }) => (
  <div style={{ width: w, height: w * 1.25, padding: 14, background: C.papel, borderRadius: 30, transform: `rotate(${rot}deg)`,
    boxShadow: "0 2px 4px rgba(15,58,91,.08), 0 26px 60px rgba(15,58,91,.26)", ...style }}>
    <div style={{ width: "100%", height: "100%", borderRadius: 20, overflow: "hidden" }}>
      <Img src={staticFile(`fotos/${f}.webp`)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.02 + t * 0.0009})` }} />
    </div>
  </div>
);

/** El par de fotos del cierre: un comercio y alguien trabajando, que entran girando. */
export const FotosCierre: React.FC<{ t: number; fotos: [string, string]; y: number; w?: number }> = ({ t, fotos, y, w = 380 }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {fotos.map((f, i) => {
        const s = spring({ frame: t - 6 - i * 5, fps, config: { damping: 14, stiffness: 130 } });
        const x = i === 0 ? 540 - w * 0.52 : 540 + w * 0.52;
        const rot = i === 0 ? -6 : 5;
        return (
          <div key={f} style={{ position: "absolute", left: x - w / 2 - 14, top: y - (w * 1.25) / 2 - 14 + (i ? 30 : -10), zIndex: 2 + i,
            opacity: Math.min(1, s * 1.6), transform: `translateY(${(1 - s) * 120}px) scale(${0.8 + 0.2 * s})` }}>
            <Foto f={f} t={t} w={w} rot={rot * s} />
          </div>
        );
      })}
    </>
  );
};
