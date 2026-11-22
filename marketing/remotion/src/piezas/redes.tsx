// Los tres primeros videos, portados de HTML + GSAP (redes/src.html) a Remotion con el mismo guion
// y los mismos tiempos. Las medidas siguen en cqw del original (1 cqw = 10,8 px a 1080 de ancho).
// Los datos (textos, tiempos, cuenta, paga, sonido) están en redes.datos.ts.
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, Cielo, F, Nube } from "../kit/base";
import { Mezcla } from "../kit/sonido";
import {
  paraComercios, paraTrabajadores, queResuelve,
  type Cap, type DatosParaComercios, type DatosParaTrabajadores, type DatosQueResuelve,
} from "./redes.datos";

const U = 10.8; // px por cqw
const cq = (n: number) => n * U;

// ── la línea de tiempo, como en GSAP ─────────────────────────────────
type Ease = (x: number) => number;
const E = {
  none: (x: number) => x,
  p1in: (x: number) => x * x,
  p2in: (x: number) => x * x * x,
  p2out: (x: number) => 1 - Math.pow(1 - x, 3),
  p3out: (x: number) => 1 - Math.pow(1 - x, 4),
  p2inOut: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  p1inOut: (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  back: (k: number) => (x: number) => 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2),
  steps: (n: number) => (x: number) => (x >= 1 ? 1 : Math.floor(x * n) / n),
};
/** progreso 0..1 de una animación que arranca en `t0` segundos y dura `d` */
const tw = (t: number, t0: number, d: number, e: Ease = E.p2out) => (t <= t0 ? 0 : t >= t0 + d ? 1 : e((t - t0) / d));
const mix = (a: number, b: number, p: number) => a + (b - a) * p;

const useT = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return f / fps;
};

// ── piezas visuales del original ────────────────────────────────────
const Chipv: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ display: "inline-flex", alignItems: "center", fontSize: cq(3.1), fontWeight: 600, whiteSpace: "nowrap", padding: `${cq(1.3)}px ${cq(2.8)}px`,
    borderRadius: 999, background: "rgba(255,255,255,.62)", color: C.tintaCielo,
    boxShadow: `inset 0 0 0 ${cq(0.25)}px rgba(255,255,255,.4), inset 0 ${cq(0.25)}px 0 rgba(255,255,255,.7)` }}>{children}</span>
);

const Turno: React.FC<{ puesto: string; chips: string[]; pago: string; noche?: boolean }> = ({ puesto, chips, pago, noche }) => (
  <div style={{ background: C.papel, color: C.tinta, borderRadius: cq(6), overflow: "hidden",
    boxShadow: noche ? `0 ${cq(3.5)}px ${cq(8)}px rgba(0,0,0,.45)` : `0 ${cq(3.5)}px ${cq(8)}px rgba(15,58,91,.2), 0 0 0 ${cq(0.25)}px rgba(15,58,91,.05)` }}>
    <div style={{ padding: `${cq(4.4)}px ${cq(5)}px ${cq(4.6)}px`, color: C.tintaCielo,
      background: `radial-gradient(120% 80% at 88% 0%, rgba(255,255,255,.22), transparent 60%), linear-gradient(180deg, ${C.cielo0}, ${C.cielo1} 55%, ${C.cielo2})` }}>
      <div style={{ fontWeight: 800, fontSize: cq(8), letterSpacing: "-0.03em", lineHeight: 1.05 }}>{puesto}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: cq(1.6), marginTop: cq(2.6) }}>{chips.map((c) => <Chipv key={c}>{c}</Chipv>)}</div>
    </div>
    <div style={{ padding: `${cq(3.6)}px ${cq(5)}px ${cq(4.4)}px` }}>
      <div style={{ fontSize: cq(3.2), fontWeight: 600, color: C.suave }}>Pago</div>
      <div style={{ fontSize: cq(11), fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1, marginTop: cq(0.8), fontVariantNumeric: "tabular-nums" }}>{pago}</div>
    </div>
  </div>
);

const Listo: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: cq(1.6), fontWeight: 700, fontSize: cq(4), color: "#166534", background: "#E7F5EC",
    padding: `${cq(2)}px ${cq(4)}px`, borderRadius: 999, boxShadow: `0 ${cq(2)}px ${cq(5)}px rgba(15,58,91,.18)`, whiteSpace: "nowrap" }}>
    <span style={{ width: cq(3), height: cq(3), borderRadius: "50%", background: "#166534", boxShadow: `inset 0 0 0 ${cq(0.7)}px #E7F5EC` }} />{children}
  </div>
);

const Boton: React.FC<{ children: React.ReactNode; s?: number }> = ({ children, s = 1 }) => (
  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap", transform: `scale(${s})`,
    background: `linear-gradient(180deg, ${C.ambarA}, ${C.ambarB})`, color: C.tinta, fontWeight: 700, fontSize: cq(4.4), padding: `${cq(3.2)}px ${cq(6)}px`,
    borderRadius: cq(4.6), boxShadow: `0 ${cq(2.5)}px ${cq(6)}px rgba(217,119,6,.3), inset 0 ${cq(0.25)}px 0 rgba(255,255,255,.45), inset 0 -${cq(0.5)}px 0 rgba(0,0,0,.08)` }}>{children}</span>
);

const Burbuja: React.FC<{ de: string; texto: string }> = ({ de, texto }) => (
  <div style={{ background: C.papel, color: C.tinta, borderRadius: `${cq(5)}px ${cq(5)}px ${cq(5)}px ${cq(1.4)}px`, padding: `${cq(3.4)}px ${cq(4.4)}px`,
    fontSize: cq(5), boxShadow: `0 ${cq(2)}px ${cq(6)}px rgba(15,58,91,.2)` }}>
    <small style={{ display: "block", fontSize: cq(3), fontWeight: 700, color: C.hondo, marginBottom: cq(1) }}>{de}</small>{texto}
  </div>
);

const Reloj: React.FC<{ dia: string; hora: string; top: number; noche?: boolean; o: number; y: number }> = ({ dia, hora, top, noche, o, y }) => (
  <div style={{ position: "absolute", left: 0, right: 0, top: cq(top), textAlign: "center", opacity: o, transform: `translateY(${cq(y)}px)` }}>
    <div style={{ fontSize: cq(4), fontWeight: 700, color: noche ? C.celeste : undefined }}>{dia}</div>
    <div style={{ fontSize: cq(19), fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05, fontVariantNumeric: "tabular-nums" }}>{hora}</div>
  </div>
);

// Los títulos: entran subiendo y se van hacia arriba (`caps` del original).
const Caps: React.FC<{ lista: Cap[]; noche?: boolean }> = ({ lista, noche }) => {
  const t = useT();
  return (
    <>
      {lista.map((c, i) => {
        const e = tw(t, c.desde, 0.45, E.p2out);
        const s = c.hasta === undefined ? 0 : tw(t, c.hasta - 0.3, 0.3, E.p1in);
        const o = e * (1 - s);
        if (o <= 0) return null;
        return (
          <div key={i} style={{ position: "absolute", left: cq(7), right: cq(7), top: cq(c.top ?? 134), textAlign: "center", zIndex: 9,
            opacity: o, transform: `translateY(${cq(mix(3, 0, e) - 2 * s)}px)` }}>
            <div style={{ fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.02, textWrap: "balance", fontSize: cq(8) } as React.CSSProperties}>{c.texto}</div>
            {c.bajada && <p style={{ fontSize: cq(4.4), marginTop: cq(2), fontWeight: 600, color: noche ? C.celeste : undefined }}>{c.bajada}</p>}
          </div>
        );
      })}
    </>
  );
};

// La cinta «¡Oído!» que cae como un sello (golpe) y el «oído» fileteado del final.
const golpe = (t: number, t0: number) => {
  const p = tw(t, t0, 0.42, E.back(2));
  return { opacity: Math.min(1, tw(t, t0, 0.42, E.none) * 3), transform: `scale(${mix(2.2, 1, p)}) rotate(${mix(-18, -6, p)}deg)` };
};
const Filete: React.FC<{ t0: number; d: number }> = ({ t0, d }) => {
  const t = useT();
  const p = tw(t, t0, d, E.back(1.6));
  if (t < t0) return null;
  return <Img src={staticFile("marca/oido-filete.svg")} style={{ position: "absolute", width: cq(88), left: cq(6), top: cq(40), zIndex: 7,
    opacity: Math.min(1, tw(t, t0, d, E.none) * 2), transform: `scale(${mix(0.7, 1, p)})` }} />;
};
const aparece = (t: number, t0: number) => {
  const p = tw(t, t0, 0.35, E.back(2.4));
  return { opacity: Math.min(1, tw(t, t0, 0.35, E.none) * 2), s: mix(0.8, 1, p) };
};
const hhmm = (x: number) => { const m = Math.round(x); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };
const aMin = (h: string) => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };

// Nubes del original: derivan todo el video; la de abajo sube al final para el cierre.
const NubesRedes: React.FC<{ dur: number; sube: number; tres?: boolean }> = ({ dur, sube, tres = true }) => {
  const t = useT();
  const x = (i: number) => cq(((i % 2 ? -1 : 1) * (6 + i * 3)) * (t / dur));
  const y3 = cq(-62 * tw(t, sube, 1.2, E.p3out));
  return (
    <>
      {tres && <div style={{ position: "absolute", left: cq(-14) + x(0), top: cq(8) }}><Nube k="a" x={0} y={0} w={cq(62)} prof={0} op={0.95} /></div>}
      <div style={{ position: "absolute", left: cq(100 - 48 + 12) + x(1), top: cq(44) }}><Nube k="b" x={0} y={0} w={cq(48)} prof={0} op={0.95} /></div>
      <div style={{ position: "absolute", left: cq(-20) + x(2), top: cq(150) + y3, zIndex: 6 }}><Nube k="c" x={0} y={0} w={cq(140)} prof={0} /></div>
    </>
  );
};

// ── 1 · Qué resuelve Oído (22 s) ────────────────────────────────────
export const QueResuelve: React.FC<{ d?: DatosQueResuelve }> = ({ d = queResuelve }) => {
  const t = useT();
  const reloj = hhmm(mix(aMin(d.reloj.desde), aMin(d.reloj.hasta), tw(t, 16, 1.4, E.p1inOut)));
  const sale = (i: number) => tw(t, 18.9 + i * 0.04, 0.5, E.p2in);
  const rel = tw(t, 0.2, 0.6);
  const bIn = tw(t, 3.1, 0.5, E.back(1.6)), bOut = tw(t, 5.7, 0.4, E.p2in);
  const impIn = tw(t, 6.1, 0.5, E.p3out), impOut = tw(t, 10, 0.5, E.p2in);
  const papel = tw(t, 6.7, 2.6, E.steps(14));
  const bocaY = tw(t, 10.4, 0.8, E.p2inOut) * 4;
  const sacude = t >= 13.45 && t < 13.63 ? [-1.2, 1, 0][Math.min(2, Math.floor((t - 13.45) / 0.06))] : 0;
  const cub = aparece(t, 17);
  return (
    <Cielo nubes={false}>
      <AbsoluteFill style={{ color: C.tintaCielo, fontFamily: F.texto }}>
        <NubesRedes dur={22} sube={19} />
        <Reloj dia={d.reloj.dia} hora={reloj} top={20} o={rel * (1 - sale(3))} y={mix(-6, 0, rel) + 10 * sale(3)} />
        {t >= 3.1 && bOut < 1 && (
          <div style={{ position: "absolute", left: cq(12), right: cq(16), top: cq(64), opacity: Math.min(1, bIn * 2) * (1 - bOut),
            transform: `translate(${cq(-30 * bOut)}px, ${cq(mix(-10, 0, bIn))}px) scale(${mix(0.9, 1, bIn)})` }}><Burbuja {...d.burbuja} /></div>
        )}
        {t >= 6.1 && impOut < 1 && (
          <div style={{ position: "absolute", left: cq(12), right: cq(12), top: cq(56), height: cq(9), borderRadius: cq(4.6), background: C.papel, zIndex: 3,
            boxShadow: `0 ${cq(2)}px ${cq(6)}px rgba(15,58,91,.22)`, opacity: Math.min(1, impIn * 2) * (1 - impOut), transform: `translateY(${cq(mix(-20, 0, impIn) - 24 * impOut)}px)` }}>
            <div style={{ position: "absolute", left: cq(9), right: cq(9), bottom: cq(2.6), height: cq(1.2), borderRadius: cq(1), background: "#EDF4F8" }} />
          </div>
        )}
        <div style={{ position: "absolute", left: cq(13), right: cq(13), top: cq(63), height: cq(72), overflow: t >= 9.6 ? "visible" : "hidden", zIndex: 2,
          opacity: 1 - sale(0), transform: `translate(${cq(sacude)}px, ${cq(bocaY + 10 * sale(0))}px)` }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, transform: `translateY(${mix(-115, 0, papel)}%)` }}><Turno {...d.turno} /></div>
        </div>
        {t >= 13.1 && <Img src={staticFile("marca/oido-filete-cinta.svg")} style={{ position: "absolute", width: cq(64), left: cq(18), top: cq(50), zIndex: 5,
          ...golpe(t, 13.1), opacity: golpe(t, 13.1).opacity * (1 - sale(1)), translate: `0 ${cq(10 * sale(1))}px` }} />}
        {t >= 17 && <div style={{ position: "absolute", left: "50%", top: cq(116), zIndex: 6, opacity: cub.opacity * (1 - sale(2)),
          transform: `translate(-50%, ${cq(10 * sale(2))}px) scale(${cub.s})` }}><Listo>{d.listo}</Listo></div>}
        <Filete t0={19.4} d={0.8} />
        <Caps lista={d.caps} />
      </AbsoluteFill>
      <Mezcla s={d.sonido} />
    </Cielo>
  );
};

// ── 2 · Para comercios (15 s) ──────────────────────────────────────
export const ParaComercios: React.FC<{ d?: DatosParaComercios }> = ({ d = paraComercios }) => {
  const t = useT();
  const reloj = hhmm(mix(aMin(d.reloj.desde), aMin(d.reloj.hasta), tw(t, 10, 0.8, E.p2out)));
  const sale = (i: number) => tw(t, 12.8 + i * 0.03, 0.45, E.p2in);
  const rel = tw(t, 0.1, 0.5);
  const bIn = tw(t, 0.7, 0.45, E.back(1.6)), bOut = tw(t, 2.8, 0.35, E.p2in);
  const cIn = tw(t, 3.1, 0.4), cOut = tw(t, 6.9, 0.3);
  const n = Math.round(d.pedido.frase.length * tw(t, 3.5, 1.9, E.none));
  const pedir = t >= 5.55 && t < 5.75 ? mix(1, 0.94, 1 - Math.abs((t - 5.65) / 0.1)) : 1;
  const papel = tw(t, 5.8, 1.3, E.steps(10));
  const tIn = tw(t, 8.1, 0.4, E.back(1.6));
  const conf = aparece(t, 10.6);
  return (
    <Cielo nubes={false}>
      <AbsoluteFill style={{ color: C.tintaCielo, fontFamily: F.texto }}>
        <NubesRedes dur={15} sube={12.9} tres={false} />
        <Reloj dia={d.reloj.dia} hora={reloj} top={16} o={rel * (1 - sale(4))} y={mix(-6, 0, rel) + 10 * sale(4)} />
        {t >= 0.7 && bOut < 1 && (
          <div style={{ position: "absolute", left: cq(12), right: cq(20), top: cq(62), opacity: Math.min(1, bIn * 2) * (1 - bOut),
            transform: `translate(${cq(-30 * bOut)}px, ${cq(mix(-10, 0, bIn))}px)` }}><Burbuja {...d.burbuja} /></div>
        )}
        {t >= 3.1 && cOut < 1 && (
          <div style={{ position: "absolute", left: cq(8), right: cq(8), top: cq(50), background: C.papel, borderRadius: cq(6), padding: cq(5), zIndex: 3,
            boxShadow: `0 ${cq(3)}px ${cq(8)}px rgba(15,58,91,.2)`, color: C.tinta, opacity: cIn * (1 - cOut), transform: `translateY(${cq(mix(8, 0, cIn) - 8 * cOut)}px)` }}>
            <div style={{ fontSize: cq(3.2), fontWeight: 600, color: C.suave }}>{d.pedido.rotulo}</div>
            <p style={{ fontSize: cq(5.2), fontWeight: 600, minHeight: cq(14), margin: `${cq(1.6)}px 0 0`, lineHeight: 1.35, background: "#EDF4F8", borderRadius: cq(3.6), padding: `${cq(3)}px ${cq(3.6)}px` }}>{d.pedido.frase.slice(0, n)}</p>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: cq(3) }}><Boton s={pedir}>{d.pedido.boton}</Boton></div>
          </div>
        )}
        <div style={{ position: "absolute", left: cq(12), right: cq(12), top: cq(80), height: cq(66), overflow: t >= 7.1 ? "visible" : "hidden", zIndex: 2,
          opacity: 1 - sale(0), transform: `translateY(${cq(10 * sale(0))}px)` }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, transform: `translateY(${mix(-115, 0, papel)}%)` }}><Turno {...d.turno} /></div>
        </div>
        {t >= 7.4 && <Img src={staticFile("marca/oido-filete-cinta.svg")} style={{ position: "absolute", width: cq(58), left: cq(21), top: cq(64), zIndex: 5,
          ...golpe(t, 7.4), opacity: golpe(t, 7.4).opacity * (1 - sale(1)), translate: `0 ${cq(10 * sale(1))}px` }} />}
        {t >= 8.1 && (
          <div style={{ position: "absolute", left: cq(10), right: cq(10), top: cq(46), background: C.papel, borderRadius: cq(5), padding: `${cq(3.6)}px ${cq(4.4)}px`,
            display: "flex", gap: cq(3), alignItems: "center", boxShadow: `0 ${cq(3)}px ${cq(8)}px rgba(15,58,91,.2)`, zIndex: 4, color: C.tinta,
            opacity: Math.min(1, tIn * 2) * (1 - sale(2)), transform: `translateY(${cq(mix(-6, 0, tIn) + 10 * sale(2))}px)` }}>
            <span style={{ width: cq(11), height: cq(11), borderRadius: "50%", background: "#EDF4F8", color: C.hondo, display: "grid", placeItems: "center", fontWeight: 800, fontSize: cq(5) }}>{d.persona.inicial}</span>
            <div><b style={{ fontSize: cq(4.6) }}>{d.persona.texto}</b>
              <div style={{ fontFamily: F.mono, fontSize: cq(2.4), letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.85, color: C.hondo, marginTop: cq(0.6) }}>{d.persona.nota}</div></div>
          </div>
        )}
        {t >= 10.6 && <div style={{ position: "absolute", left: "50%", top: cq(132), zIndex: 6, opacity: conf.opacity * (1 - sale(3)),
          transform: `translate(-50%, ${cq(10 * sale(3))}px) scale(${conf.s})` }}><Listo>{d.listo}</Listo></div>}
        <Filete t0={13.2} d={0.7} />
        <Caps lista={d.caps} />
      </AbsoluteFill>
      <Mezcla s={d.sonido} />
    </Cielo>
  );
};

// ── 3 · Para quien trabaja (15 s), de noche ─────────────────────────
export const ParaTrabajadores: React.FC<{ d?: DatosParaTrabajadores }> = ({ d = paraTrabajadores }) => {
  const t = useT();
  const sale = tw(t, 11.8, 0.35, E.p2out);
  const rel = tw(t, 0.2, 0.5);
  const item = (i: number) => tw(t, 3.1 + i * 0.35, 0.5, E.p3out);
  const otros = tw(t, 6.1, 0.4);
  const postular = tw(t, 6.4, 0.45, E.p2out) * (1 - tw(t, 8.6, 0.35, E.p2out));
  const prensa = t >= 7.9 && t < 8.14 ? mix(1, 0.92, 1 - Math.abs((t - 8.02) / 0.12)) : 1;
  const baja = tw(t, 8.6, 0.35, E.p2out) * 14;
  const conf = aparece(t, 9.9);
  const pIn = tw(t, 12.0, 0.5, E.back(2)), pOut = tw(t, 13.3, 0.3);
  const [a, ...resto] = d.turnos;
  return (
    <Cielo noche>
      <AbsoluteFill style={{ color: C.claro, fontFamily: F.texto }}>
        <Reloj noche dia={d.reloj.dia} hora={d.reloj.hora} top={16} o={rel * (1 - sale)} y={mix(-6, 0, rel)} />
        <div style={{ position: "absolute", left: cq(7), right: cq(7), top: cq(50), display: "grid", gap: cq(3), opacity: 1 - sale }}>
          <div style={{ background: C.papel, color: C.tinta, borderRadius: cq(6), padding: `${cq(4)}px ${cq(4.6)}px`, boxShadow: `0 ${cq(3.5)}px ${cq(8)}px rgba(0,0,0,.45)`,
            opacity: item(0), transform: `translate(${cq(30 * (1 - item(0)))}px, ${cq(baja)}px)` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: cq(2), alignItems: "baseline" }}><b style={{ fontSize: cq(5) }}>{a.puesto}</b><b style={{ fontSize: cq(5.4) }}>{a.pago}</b></div>
            <div style={{ fontSize: cq(3.2), color: C.suave, marginTop: cq(1), fontWeight: 500 }}>{a.detalle}</div>
            <div style={{ display: "flex", justifyContent: "flex-end", height: cq(16 * postular), overflow: "hidden" }}><span style={{ marginTop: cq(3) }}><Boton s={prensa}>{d.boton}</Boton></span></div>
          </div>
          {resto.map((r, i) => (
            <div key={i} style={{ background: "#1D2833", color: C.claro, borderRadius: cq(4.6), padding: `${cq(3.6)}px ${cq(4.4)}px`, display: "flex", justifyContent: "space-between",
              alignItems: "center", gap: cq(2), boxShadow: `0 ${cq(1.6)}px ${cq(4)}px rgba(0,0,0,.3)`,
              opacity: item(i + 1) * (1 - otros), transform: `translate(${cq(30 * (1 - item(i + 1)))}px, ${cq(6 * otros)}px)` }}>
              <div><b style={{ fontSize: cq(4.6) }}>{r.puesto}</b><small style={{ display: "block", fontSize: cq(3.1), color: C.claroSuave, marginTop: cq(0.6), fontWeight: 500 }}>{r.detalle}</small></div>
              <span style={{ fontSize: cq(5), fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{r.pago}</span>
            </div>
          ))}
        </div>
        {t >= 9.1 && <Img src={staticFile("marca/oido-filete-cinta.svg")} style={{ position: "absolute", width: cq(60), left: cq(20), top: cq(46), zIndex: 5,
          ...golpe(t, 9.1), opacity: golpe(t, 9.1).opacity * (1 - sale) }} />}
        {t >= 9.9 && <div style={{ position: "absolute", left: "50%", top: cq(98), zIndex: 6, opacity: conf.opacity * (1 - sale), transform: `translateX(-50%) scale(${conf.s})` }}><Listo>{d.listo}</Listo></div>}
        {t >= 12 && pOut < 1 && (
          <div style={{ position: "absolute", left: 0, right: 0, top: cq(56), textAlign: "center", zIndex: 6, opacity: Math.min(1, tw(t, 12, 0.5, E.none) * 2) * (1 - pOut),
            transform: `translateY(${cq(-8 * pOut)}px) scale(${mix(0.8, 1, pIn)})` }}>
            <div style={{ fontSize: cq(4), fontWeight: 600, color: C.claroSuave }}>{d.pagaGrande.rotulo}</div>
            <div style={{ fontSize: cq(22), fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.02, marginTop: cq(1), fontVariantNumeric: "tabular-nums" }}>{d.pagaGrande.monto}</div>
            <div style={{ fontFamily: F.mono, fontSize: cq(2.4), letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.85, color: C.claroSuave, marginTop: cq(1.4) }}>{d.pagaGrande.nota}</div>
          </div>
        )}
        <Filete t0={13.5} d={0.6} />
        <Caps noche lista={d.caps} />
      </AbsoluteFill>
      <Mezcla s={d.sonido} />
    </Cielo>
  );
};
