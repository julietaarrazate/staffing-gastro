// 4 · Match, reputación y distancia (15 s). Los datos están en match.datos.ts.
import React from "react";
import { BancoNubes, C, Cielo, Contador, F, Hoja, Pop, Titular, VeloSuperior } from "../kit/base";
import { Pantalla, Resalte, Telefono, Toque } from "../kit/telefono";
import { Cierre } from "../kit/cierre";
import { Titulos } from "../kit/datos";
import { Mezcla } from "../kit/sonido";
import { datos, type Datos } from "./match.datos";


const Dato: React.FC<{ grande: React.ReactNode; chico: string; icono?: React.ReactNode }> = ({ grande, chico, icono }) => (
  <Hoja style={{ padding: "26px 36px", minWidth: 300 }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, fontFamily: F.texto, fontWeight: 800, fontSize: 84, letterSpacing: "-0.03em", color: C.tinta, lineHeight: 1 }}>
      {grande}{icono}
    </div>
    <div style={{ fontFamily: F.texto, fontWeight: 600, fontSize: 32, color: C.suave, marginTop: 8 }}>{chico}</div>
  </Hoja>
);

const Estrella = () => <svg width="54" height="54" viewBox="0 0 24 24"><path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3l-5.8 3.1 1.2-6.5L2.6 9.4l6.5-.8z" fill={C.hondo} /></svg>;
const Tilde = () => <svg width="50" height="50" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill={C.hondo} /><path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;

export const Match: React.FC<{ d?: Datos }> = ({ d = datos }) => {
  const T = d.escenas;
  const k = d.tarjetas;
  const coma = (n: number) => n.toFixed(1).replace(".", ",");
  return (
    <Cielo>
      <Titulos lista={d.titulos} />

      <Telefono hora="19:06" claves={[
        { f: 0, x: 195, y: 330, z: 1.32, ty: 1060 },
        { f: 60, x: 195, y: 380, z: 0.8, tx: 740, ty: 1130 },
        { f: 186, x: 195, y: 380, z: 1.0, tx: 540, ty: 1150 },
        { f: T.ficha, x: 195, y: 330, z: 1.12, ty: 1080 },
        { f: T.resenas - 6, x: 195, y: 520, z: 1.1, ty: 1100 },
      ]}>
        <Pantalla n="c-recomendados" desde={0} hasta={T.ficha + 12} modo="corte" />
        <Resalte desde={T.datos[0]} hasta={T.datos[0] + 22} x={23} y={359} w={110} h={46} r={12} />
        <Resalte desde={T.datos[1]} hasta={T.datos[1] + 22} x={133} y={359} w={110} h={46} r={12} />
        <Resalte desde={T.datos[2]} hasta={T.datos[2] + 22} x={244} y={359} w={110} h={46} r={12} />
        <Resalte desde={T.datos[3]} hasta={T.datos[3] + 26} x={110} y={297} w={190} h={28} r={14} claro />
        <Toque f={T.nombre} x={215} y={258} />
        <Pantalla n="c-ficha-full" barra="c-ficha-barra" desde={T.ficha} modo="empuja" tr={12} scroll={[[T.resenas - 6, 0], [T.resenas + 20, 300]]} />
        <Resalte desde={T.puntual} hasta={T.resenas - 8} x={126} y={316} w={244} h={22} r={10} />
        <Resalte desde={T.resenas + 22} hasta={T.cierre} x={20} y={542} w={350} h={96} r={22} />
      </Telefono>

      <VeloSuperior />
      <BancoNubes y={1660} />
      <Pop desde={T.datos[0]} hasta={186} x={40} y={660} ancla="left" rot={-5}>
        <Dato grande={<Contador desde={T.datos[0]} valor={k.nota.valor} fmt={coma} />} icono={<Estrella />} chico={k.nota.chico} />
      </Pop>
      <Pop desde={T.datos[1]} hasta={186} x={40} y={880} ancla="left" rot={4}>
        <Dato grande={<Contador desde={T.datos[1]} valor={k.turnos.valor} />} chico={k.turnos.chico} />
      </Pop>
      <Pop desde={T.datos[2]} hasta={186} x={40} y={1100} ancla="left" rot={-4}>
        <Dato grande={<><Contador desde={T.datos[2]} valor={k.distancia.valor} />&nbsp;{k.distancia.unidad}</>} chico={k.distancia.chico} />
      </Pop>
      <Pop desde={T.datos[3]} hasta={186} x={40} y={1300} ancla="left" rot={3}>
        <Hoja style={{ padding: "22px 34px", display: "flex", gap: 16, alignItems: "center", fontFamily: F.texto, fontWeight: 700, fontSize: 40, whiteSpace: "nowrap" }}><Tilde />{k.identidad}</Hoja>
      </Pop>
      <Pop desde={T.puntual} hasta={T.resenas} x={1040 - 320} y={1330} ancla="left" rot={4}>
        <Dato grande={<><Contador desde={T.puntual} valor={k.puntual.valor} />%</>} chico={k.puntual.chico} />
      </Pop>
      <Cierre desde={T.cierre} {...d.cierre} cuenta={d.cuenta} />
      <Mezcla s={d.sonido} />
    </Cielo>
  );
};
