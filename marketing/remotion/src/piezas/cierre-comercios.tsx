// 6 · Cierre para comercios (15 s). Los datos están en cierre-comercios.datos.ts.
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { BancoNubes, C, ChipVidrio, Cielo, F, Pop, Titular } from "../kit/base";
import { Pantalla, Telefono } from "../kit/telefono";
import { Cierre } from "../kit/cierre";
import { Titulos } from "../kit/datos";
import { Mezcla } from "../kit/sonido";
import { datos as datosPorDefecto, type Datos } from "./cierre-comercios.datos";


const Reloj: React.FC<{ hora: string; dia: string }> = ({ hora, dia }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 14, stiffness: 120 } });
  const o = interpolate(f, [54, 64], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const seg = String(Math.min(59, Math.floor(f / 1.0))).padStart(2, "0");
  if (o <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 560, textAlign: "center", opacity: o * Math.min(1, s * 1.5), transform: `scale(${0.8 + 0.2 * s})`, zIndex: 6 }}>
      <div style={{ fontFamily: F.texto, fontWeight: 800, fontSize: 290, letterSpacing: "-0.05em", color: C.tintaCielo, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{hora}</div>
      <div style={{ fontFamily: F.mono, fontWeight: 500, fontSize: 40, letterSpacing: "0.1em", color: C.hondo, marginTop: 8 }}>{dia} · :{seg}</div>
    </div>
  );
};

const Numero: React.FC<{ n: string; desde: number; hasta: number }> = ({ n, desde, hasta }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < desde || f > hasta + 8) return null;
  const s = spring({ frame: f - desde, fps, config: { damping: 12, stiffness: 170 } });
  const o = interpolate(f, [hasta, hasta + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  return (
    <div style={{ position: "absolute", left: 80, top: 236, width: 170, height: 170, borderRadius: 85, zIndex: 7,
      background: `linear-gradient(180deg, #2A6A94, ${C.hondo})`, color: "#fff", display: "grid", placeItems: "center",
      fontFamily: F.texto, fontWeight: 800, fontSize: 110, boxShadow: "0 18px 40px rgba(15,58,91,.35), inset 0 2px 0 rgba(255,255,255,.25)",
      transform: `scale(${s * (1 - o)}) rotate(${(1 - s) * -30}deg)` }}>{n}</div>
  );
};

export const CierreComercios: React.FC<{ d?: Datos }> = ({ d: datos = datosPorDefecto }) => {
  const T = datos.escenas;
  const PASOS = datos.pasos;
  return (
    <Cielo>
      <Reloj {...datos.reloj} />
      <Titulos lista={datos.titulos} />
      {PASOS.map((p, i) => {
        const d = T.pasos[i], h = (T.pasos[i + 1] ?? T.cierre) - 8;
        return (
          <React.Fragment key={i}>
            <Numero n={p.n} desde={d} hasta={h} />
            <Titular lineas={p.t} desde={d + 4} hasta={h} y={240} align="left" size={76} izq={290} />
          </React.Fragment>
        );
      })}
      {PASOS.map((p, i) => {
        const d = T.pasos[i];
        return (
          <Telefono key={i} entra={d - 4} hora={p.hora} sinBarra={false} claves={[
            { f: 0, x: 195, y: p.y, z: 0.98, ty: p.ty + 10, rot: i % 2 ? 2 : -2 },
            { f: d + 20, x: 195, y: p.y, z: 1.04, ty: p.ty, rot: 0 },
            { f: (T.pasos[i + 1] ?? T.cierre) - 10, x: 195, y: p.y, z: 0.96, tx: -700, ty: 1150, rot: -8 },
          ]}>
            <Pantalla n={p.cap} desde={0} modo="corte" />
          </Telefono>
        );
      })}
      <BancoNubes y={1660} />
      <Cierre desde={T.cierre} {...datos.cierre} cuenta={datos.cuenta} />
      <Mezcla s={datos.sonido} />
    </Cielo>
  );
};
