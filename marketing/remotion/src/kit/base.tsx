// Base visual de los videos de Oído: el cielo de la app, las nubes, la letra y
// las piezas chicas (títulos, chips, contadores). Valores de docs/design-system.
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing, continueRender, delayRender } from "remotion";

export const C = {
  cielo0: "#5BA8E0", cielo1: "#84C0EC", cielo2: "#BFE1F6", tintaCielo: "#0F3A5B",
  noche0: "#0B1A28", noche1: "#0F2233", noche2: "#12283B", claro: "#EEF3F6", claroSuave: "#A9B6C2",
  hondo: "#1C5478", celeste: "#9AC9E7", papel: "#FFFFFF", tinta: "#111111", suave: "#4B5563",
  ambarA: "#F6A92A", ambarB: "#E58E0F", ambar: "#D97706", chip: "#DEECF0",
};
export const F = { texto: "Inter, system-ui, sans-serif", mono: "'DM Mono', ui-monospace, monospace" };

// Fuentes locales (Inter variable, DM Mono): el render espera a que carguen.
let cargadas = false;
export const useFuentes = () => {
  if (cargadas || typeof document === "undefined") return;
  cargadas = true;
  const h = delayRender("fuentes");
  const f = [
    new FontFace("Inter", `url(${staticFile("fonts/inter.woff2")}) format("woff2")`, { weight: "100 900" }),
    new FontFace("DM Mono", `url(${staticFile("fonts/dmmono-400.woff2")}) format("woff2")`, { weight: "400" }),
    new FontFace("DM Mono", `url(${staticFile("fonts/dmmono-500.woff2")}) format("woff2")`, { weight: "500" }),
  ];
  Promise.all(f.map((x) => x.load().then((y) => (document as any).fonts.add(y)))).then(() => continueRender(h));
};

export const suave = Easing.bezier(0.22, 1, 0.36, 1);
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);

export const resorte = (frame: number, fps: number, desde: number, cfg: Partial<{ damping: number; stiffness: number; mass: number }> = {}) =>
  spring({ frame: frame - desde, fps, config: { damping: 18, stiffness: 140, mass: 0.9, ...cfg } });

export const pesos = (n: number) => "$" + Math.round(n).toLocaleString("es-AR").replace(/,/g, ".");

// El cielo con luz arriba a la derecha; de noche, estrellas y sin nubes.
export const Cielo: React.FC<{ noche?: boolean; children?: React.ReactNode; nubes?: boolean }> = ({ noche, children, nubes = true }) => {
  useFuentes();
  return (
    <AbsoluteFill style={{
      background: noche
        ? `radial-gradient(110% 60% at 85% 0%, rgba(154,201,231,.10), transparent 60%), linear-gradient(180deg, ${C.noche0}, ${C.noche1} 50%, ${C.noche2})`
        : `radial-gradient(120% 70% at 88% 0%, rgba(255,255,255,.24), transparent 60%), linear-gradient(180deg, ${C.cielo0}, ${C.cielo1} 52%, ${C.cielo2})`,
      fontFamily: F.texto, overflow: "hidden",
    }}>
      {noche ? <Estrellas /> : nubes ? <NubesFondo /> : null}
      {children}
    </AbsoluteFill>
  );
};

const NUBES = { a: { f: "marca/nube-a.webp", r: 840 / 500 }, b: { f: "marca/nube-b.webp", r: 680 / 480 }, c: { f: "marca/nube-c.webp", r: 1160 / 420 } };

// El cielo de arriba otra vez, encima del teléfono y con borde que se funde: deja limpio el lugar de los títulos.
export const VeloSuperior: React.FC<{ noche?: boolean; alto?: number; op?: number }> = ({ noche, alto = 440, op = 1 }) => (
  <AbsoluteFill style={{ zIndex: 3, pointerEvents: "none", opacity: op,
    WebkitMaskImage: `linear-gradient(180deg, #000 ${alto}px, transparent ${alto + 70}px)`, maskImage: `linear-gradient(180deg, #000 ${alto}px, transparent ${alto + 70}px)`,
    background: noche
      ? `radial-gradient(110% 60% at 85% 0%, rgba(154,201,231,.10), transparent 60%), linear-gradient(180deg, ${C.noche0}, ${C.noche1} 50%, ${C.noche2})`
      : `radial-gradient(120% 70% at 88% 0%, rgba(255,255,255,.24), transparent 60%), linear-gradient(180deg, ${C.cielo0}, ${C.cielo1} 52%, ${C.cielo2})` }}>
    {noche ? <Estrellas /> : <NubesFondo />}
  </AbsoluteFill>
);

// Una nube que deriva; `prof` (0 lejos, 1 cerca) da el parallax: velocidad, tamaño y nitidez.
export const Nube: React.FC<{ k: "a" | "b" | "c"; x: number; y: number; w: number; prof: number; op?: number; flip?: boolean }> = ({ k, x, y, w, prof, op = 1, flip }) => {
  const frame = useCurrentFrame();
  const dx = frame * (0.25 + prof * 0.9);
  const dy = Math.sin((frame + x) / 90) * 4 * prof;
  const n = NUBES[k];
  return (
    <Img src={staticFile(n.f)} style={{
      position: "absolute", left: x + dx, top: y + dy, width: w, height: w / n.r, opacity: op,
      filter: prof < 0.4 ? `blur(${(0.4 - prof) * 6}px)` : undefined, transform: flip ? "scaleX(-1)" : undefined,
    }} />
  );
};

export const NubesFondo: React.FC = () => (
  <>
    <Nube k="c" x={-420} y={120} w={760} prof={0.1} op={0.5} />
    <Nube k="a" x={640} y={60} w={520} prof={0.25} op={0.75} />
    <Nube k="b" x={-220} y={760} w={420} prof={0.2} op={0.45} flip />
    <Nube k="a" x={820} y={980} w={380} prof={0.3} op={0.5} />
  </>
);

// El banco de nubes de abajo, delante del teléfono: profundidad y tapa la zona de los botones de la red.
export const BancoNubes: React.FC<{ y?: number; op?: number }> = ({ y = 1600, op = 1 }) => (
  <AbsoluteFill style={{ pointerEvents: "none", opacity: op }}>
    <div style={{ position: "absolute", left: 0, right: 0, top: y + 150, bottom: 0, background: `linear-gradient(180deg, rgba(255,255,255,0), rgba(246,250,253,.95) 40%, #F8FBFC)` }} />
    <Nube k="c" x={-380} y={y - 40} w={1000} prof={0.75} />
    <Nube k="a" x={420} y={y - 10} w={760} prof={0.9} />
    <Nube k="b" x={-140} y={y + 110} w={640} prof={1} />
    <Nube k="c" x={300} y={y + 160} w={1100} prof={1.1} />
  </AbsoluteFill>
);

export const Estrellas: React.FC = () => {
  const frame = useCurrentFrame();
  const est = React.useMemo(() => Array.from({ length: 70 }, (_, i) => {
    const r = (n: number) => { const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return x - Math.floor(x); };
    return { x: r(1) * 1080, y: r(2) * 1300, s: 1.2 + r(3) * 2.4, f: r(4) * 6.28, v: 0.03 + r(5) * 0.05 };
  }), []);
  return (
    <AbsoluteFill>
      {est.map((e, i) => (
        <div key={i} style={{ position: "absolute", left: e.x - frame * 0.08, top: e.y, width: e.s, height: e.s, borderRadius: 9, background: "#EEF3F6",
          opacity: 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(frame * e.v + e.f)), boxShadow: "0 0 6px rgba(154,201,231,.8)" }} />
      ))}
    </AbsoluteFill>
  );
};

// Título que entra palabra por palabra (sube, aparece, se enfoca) y sale hacia arriba.
export const Titular: React.FC<{
  lineas: string[]; desde: number; hasta?: number; y?: number; size?: number; noche?: boolean; color?: string; align?: "center" | "left"; acento?: string; peso?: number; izq?: number;
}> = ({ lineas, desde, hasta, y = 300, size = 88, noche, color, align = "center", acento, peso = 800, izq = 80 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < desde - 1 || (hasta !== undefined && frame > hasta + 12)) return null;
  const salida = hasta === undefined ? 0 : interpolate(frame, [hasta, hasta + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  let k = 0;
  return (
    <div style={{
      position: "absolute", left: izq, right: 80, top: y, textAlign: align, zIndex: 6, color: color || (noche ? C.claro : C.tintaCielo),
      fontFamily: F.texto, fontWeight: peso, fontSize: size, lineHeight: 1.04, letterSpacing: "-0.025em",
      opacity: 1 - salida, transform: `translateY(${-salida * 40}px)`, filter: salida ? `blur(${salida * 8}px)` : undefined,
    }}>
      {lineas.map((l, i) => (
        <div key={i} style={{ whiteSpace: "nowrap" }}>
          {l.split(" ").map((w, j) => {
            const s = resorte(frame, fps, desde + (k++) * 2.2, { damping: 16, stiffness: 160 });
            const esAcento = acento && w.replace(/[.,!¡?¿]/g, "") === acento;
            return (
              <span key={j} style={{ display: "inline-block", marginRight: "0.24em", opacity: Math.min(1, s * 1.4), transform: `translateY(${(1 - s) * 46}px)`,
                filter: s < 0.98 ? `blur(${(1 - s) * 10}px)` : undefined, color: esAcento ? (noche ? C.celeste : C.hondo) : undefined }}>{w}</span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// Chip de vidrio (como los de la app sobre el cielo).
export const ChipVidrio: React.FC<{ children: React.ReactNode; noche?: boolean; style?: React.CSSProperties; mono?: boolean }> = ({ children, noche, style, mono }) => (
  <div style={{
    display: "inline-flex", alignItems: "center", gap: 12, padding: "14px 26px", borderRadius: 999, whiteSpace: "nowrap",
    background: noche ? "rgba(255,255,255,.10)" : "rgba(255,255,255,.62)", color: noche ? C.claro : C.tintaCielo,
    boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,.45), inset 0 2px 0 rgba(255,255,255,.7), 0 8px 24px rgba(15,58,91,.12)",
    fontFamily: mono ? F.mono : F.texto, fontWeight: mono ? 500 : 700, fontSize: mono ? 30 : 34, letterSpacing: mono ? "0.08em" : "-0.01em",
    textTransform: mono ? "uppercase" : undefined, backdropFilter: "blur(8px)", ...style,
  }}>{children}</div>
);

// Aparece con resorte (escala y opacidad) y se va.
export const Pop: React.FC<{ desde: number; hasta?: number; x: number; y: number; children: React.ReactNode; ancla?: "center" | "left"; rot?: number; z?: number }> = ({ desde, hasta, x, y, children, ancla = "center", rot = 0, z = 5 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < desde) return null;
  const s = resorte(frame, fps, desde, { damping: 13, stiffness: 190 });
  const out = hasta === undefined ? 0 : interpolate(frame, [hasta, hasta + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (out >= 1) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, zIndex: z, transform: `translate(${ancla === "center" ? "-50%" : "0"}, -50%) scale(${(0.6 + 0.4 * s) * (1 - out * 0.15)}) rotate(${rot * (1 - s)}deg)`,
      opacity: Math.min(1, s * 1.6) * (1 - out), transformOrigin: ancla === "center" ? "50% 50%" : "0 50%" }}>
      {children}
    </div>
  );
};

// Número que cuenta hasta su valor (con formato argentino).
export const Contador: React.FC<{ desde: number; valor: number; dur?: number; fmt?: (n: number) => string }> = ({ desde, valor, dur = 20, fmt = (n) => String(Math.round(n)) }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [desde, desde + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(valor * t)}</span>;
};

// Tarjeta blanca (la hoja) con sombra difusa.
export const Hoja: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; noche?: boolean }> = ({ children, style, noche }) => (
  <div style={{ background: noche ? "#151D26" : C.papel, borderRadius: 36, color: noche ? C.claro : C.tinta,
    boxShadow: noche ? "0 2px 4px rgba(0,0,0,.3), 0 24px 60px rgba(0,0,0,.35)" : "0 2px 4px rgba(15,58,91,.06), 0 24px 60px rgba(15,58,91,.18)", ...style }}>{children}</div>
);

// Botón principal: el único ámbar.
export const BotonAmbar: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "30px 56px", borderRadius: 30,
    background: `linear-gradient(180deg, ${C.ambarA}, ${C.ambarB})`, color: C.tinta, fontWeight: 800, fontSize: 46, letterSpacing: "-0.01em",
    boxShadow: "0 14px 34px rgba(217,119,6,.38), inset 0 2px 0 rgba(255,255,255,.35)", ...style }}>{children}</div>
);
