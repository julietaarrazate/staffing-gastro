// 3a y 3b · Instalá Oído (Android con Chrome, iPhone con Safari). Pasos y textos
// de frontend/components/landing/InstalarPasos.tsx; pensado para que lo siga cualquiera:
// número grande, el dedo que toca y una pausa en cada paso.
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { BancoNubes, C, Cielo, F, VeloSuperior } from "../kit/base";
import { Chips, Titulos } from "../kit/datos";
import { Mezcla } from "../kit/sonido";
import { datosAndroid, datosIphone, type DatosInstalar, type DatosPaso } from "./instalar.datos";
import { CAP, Resalte, Telefono, Toque } from "../kit/telefono";
import { Cierre } from "../kit/cierre";
import {
  AppAbre, ChromeDialogo, ChromeMenu, ChromeSitio, Ico, Inicio, iconoNuevo, SafariAgregar, SafariCompartir, SafariSitio,
  SAFARI_AGREGAR_INICIO, SAFARI_BOTON_AGREGAR, SAFARI_COMPARTIR,
} from "../kit/navegador";

const Icono: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ display: "inline-grid", placeItems: "center", width: 74, height: 74, borderRadius: 18, background: "#fff", margin: "0 8px", verticalAlign: "-14px", boxShadow: "0 6px 16px rgba(15,58,91,.16)" }}>{children}</span>
);

// Un paso: número grande y la instrucción tal cual la dice la app.
const Paso: React.FC<{ n: number; total: number; desde: number; hasta: number; children: React.ReactNode }> = ({ n, total, desde, hasta, children }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < desde || f > hasta + 6) return null;
  const s = spring({ frame: f - desde, fps, config: { damping: 13, stiffness: 160 } });
  const t = spring({ frame: f - desde - 5, fps, config: { damping: 18, stiffness: 140 } });
  const o = interpolate(f, [hasta, hasta + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  return (
    <div style={{ position: "absolute", left: 70, right: 70, top: 214, zIndex: 7, opacity: 1 - o, transform: `translateY(${-o * 30}px)` }}>
      <div style={{ display: "flex", gap: 30, alignItems: "flex-start" }}>
        <div style={{ flex: "none", width: 150, height: 150, borderRadius: 75, background: `linear-gradient(180deg, #2A6A94, ${C.hondo})`, color: "#fff", display: "grid", placeItems: "center",
          fontFamily: F.texto, fontWeight: 800, fontSize: 96, boxShadow: "0 16px 36px rgba(15,58,91,.35), inset 0 2px 0 rgba(255,255,255,.25)", transform: `scale(${s}) rotate(${(1 - s) * -25}deg)` }}>{n}</div>
        <div style={{ paddingTop: 6, opacity: Math.min(1, t * 1.4), transform: `translateY(${(1 - t) * 30}px)` }}>
          <div style={{ fontFamily: F.mono, fontWeight: 500, fontSize: 28, letterSpacing: "0.1em", color: C.hondo, textTransform: "uppercase" }}>Paso {n} de {total}</div>
          <div style={{ fontFamily: F.texto, fontWeight: 800, fontSize: 66, lineHeight: 1.1, letterSpacing: "-0.02em", color: C.tintaCielo, marginTop: 6 }}>{children}</div>
        </div>
      </div>
    </div>
  );
};

// Los trozos de una instrucción: texto, un ícono del teléfono o una palabra subrayada.
const Instruccion: React.FC<{ p: DatosPaso }> = ({ p }) => (
  <span style={p.size ? { fontSize: p.size } : undefined}>
    {p.trozos.map((t, i) => typeof t === "string" ? <React.Fragment key={i}>{t}</React.Fragment>
      : "icono" in t ? <Icono key={i}>{t.icono === "tresPuntos" ? Ico.tresPuntos(C.hondo, 40) : t.icono === "compartir" ? Ico.compartir(C.hondo, 42) : Ico.agregar(C.hondo, 42)}</Icono>
      : <u key={i} style={{ textDecorationThickness: 4, textUnderlineOffset: 8 }}>{t.subrayado}</u>)}
  </span>
);

const Pasos: React.FC<{ d: DatosInstalar; P: { s1: number; s2: number; s3: number; s4: number; s5: number; listo: number } }> = ({ d, P }) => {
  const ini = [P.s1, P.s2, P.s3, P.s4, P.s5, P.listo];
  const todos = [...d.pasos, d.pasoFinal];
  return <>{todos.map((p, i) => <Paso key={i} n={i + 1} total={todos.length} desde={ini[i]} hasta={ini[i + 1] - 5}><Instruccion p={p} /></Paso>)}</>;
};

export const InstalarAndroid: React.FC<{ d?: DatosInstalar }> = ({ d = datosAndroid }) => {
  const P = { s1: 48, s2: 140, menu: 172, s3: 222, toqueIns: 268, dialogo: 276, s4: 310, toqueOk: 352, inicio: 366, icono: 380, s5: 410, abrir: 448, abre: 452, listo: 480, cierre: 530 };
  const ic = iconoNuevo(false);
  return (
    <Cielo>
      <Titulos lista={d.titulos} />
      <Pasos d={d} P={P} />

      <Telefono barraTinta="oscuro" barraColor="#fff" hora="19:05" entra={0} claves={[
        { f: 0, x: 195, y: 422, z: 1.0, ty: 1250 },
        { f: P.s1 + 6, x: 195, y: 60, z: 1.5, ty: 760 },
        { f: P.s2 + 4, x: 300, y: 60, z: 1.45, ty: 760 },
        { f: P.menu + 6, x: 270, y: 300, z: 1.08, ty: 1000 },
        { f: P.s3 + 30, x: 260, y: 470, z: 1.22, ty: 1000 },
        { f: P.dialogo + 4, x: 195, y: 400, z: 1.18, ty: 1060 },
        { f: P.inicio, x: 195, y: 422, z: 1.0, ty: 1250 },
        { f: P.s5 + 4, x: 130, y: 500, z: 1.35, ty: 1050 },
        { f: P.abre + 6, x: 195, y: 422, z: 1.0, ty: 1250 },
      ]}>
        {/* el sitio en Chrome */}
        <ChromeSitio />
        <Resalte desde={P.s1 + 14} hasta={P.s2 - 10} x={50} y={4} w={264} h={44} r={22} />
        <Toque f={P.s2 + 36} x={370} y={28} grande />
        <ChromeMenu desde={P.s2 + 40} hasta={P.dialogo} resalta={P.s3 + 22} />
        <Toque f={P.toqueIns} x={240} y={541} grande />
        <ChromeDialogo desde={P.dialogo} hasta={P.inicio} />
        <Toque f={P.toqueOk} x={295} y={470} grande />
        {/* la pantalla de inicio con el ícono nuevo */}
        <InicioDesde desde={P.inicio}><Inicio aparece={P.icono} toque={P.abrir} /></InicioDesde>
        <Toque f={P.abrir} x={ic.x} y={ic.y} grande />
        <AppAbre desde={P.abre} />
      </Telefono>

      <VeloSuperior alto={480} />
      <BancoNubes y={1700} />
      <Chips lista={d.chips} />
      <Cierre desde={P.cierre} {...d.cierre} cuenta={d.cuenta} />
      <Mezcla s={d.sonido} />
    </Cielo>
  );
};

export const InstalarIphone: React.FC<{ d?: DatosInstalar }> = ({ d = datosIphone as unknown as DatosInstalar }) => {
  const P = { s1: 48, s2: 140, toqueComp: 176, hoja: 182, s3: 222, scroll: 236, resalta: 262, toqueIni: 276, agregarHoja: 284, s4: 312, toqueAg: 352, inicio: 366, icono: 380, s5: 410, abrir: 448, abre: 452, listo: 480, cierre: 530 };
  const ic = iconoNuevo(true);
  return (
    <Cielo>
      <Titulos lista={d.titulos} />
      <Pasos d={d} P={P} />

      <Telefono barraTinta="oscuro" barraColor={CAP["l-landing-safari"].top} hora="19:05" entra={0} claves={[
        { f: 0, x: 195, y: 422, z: 1.0, ty: 1180 },
        { f: P.s1 + 6, x: 195, y: 760, z: 1.35, ty: 1380 },
        { f: P.s2 + 4, x: 195, y: 790, z: 1.4, ty: 1380 },
        { f: P.hoja + 4, x: 195, y: 520, z: 1.1, ty: 1100 },
        { f: P.agregarHoja, x: 230, y: 110, z: 1.3, ty: 820 },
        { f: P.s4 + 4, x: 290, y: 120, z: 1.4, ty: 800 },
        { f: P.inicio, x: 195, y: 422, z: 1.0, ty: 1250 },
        { f: P.s5 + 4, x: 130, y: 460, z: 1.35, ty: 1050 },
        { f: P.abre + 6, x: 195, y: 422, z: 1.0, ty: 1250 },
      ]}>
        <SafariSitio />
        <Resalte desde={P.s1 + 14} hasta={P.s2 - 10} x={12} y={728} w={366} h={46} r={14} />
        <Toque f={P.toqueComp} x={SAFARI_COMPARTIR.x} y={SAFARI_COMPARTIR.y} grande />
        <SafariCompartir desde={P.hoja} hasta={P.agregarHoja + 4} scroll={[P.scroll, P.scroll + 22]} resalta={P.resalta} />
        <Toque f={P.toqueIni} x={SAFARI_AGREGAR_INICIO.x} y={SAFARI_AGREGAR_INICIO.y} grande />
        <SafariAgregar desde={P.agregarHoja} hasta={P.inicio} />
        <Toque f={P.toqueAg} x={SAFARI_BOTON_AGREGAR.x} y={SAFARI_BOTON_AGREGAR.y} grande />
        <InicioDesde desde={P.inicio}><Inicio ios aparece={P.icono} toque={P.abrir} /></InicioDesde>
        <Toque f={P.abrir} x={ic.x} y={ic.y} grande />
        <AppAbre desde={P.abre} ios />
      </Telefono>

      <VeloSuperior alto={480} />
      <BancoNubes y={1700} />
      <Chips lista={d.chips} />
      <Cierre desde={P.cierre} {...d.cierre} cuenta={d.cuenta} />
      <Mezcla s={d.sonido} />
    </Cielo>
  );
};

const InicioDesde: React.FC<{ desde: number; children: React.ReactNode }> = ({ desde, children }) => {
  const f = useCurrentFrame();
  if (f < desde) return null;
  const p = interpolate(f, [desde, desde + 12], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return <div style={{ position: "absolute", inset: 0, zIndex: 33, opacity: p, transform: `scale(${1.08 - 0.08 * p})` }}>{children}</div>;
};
