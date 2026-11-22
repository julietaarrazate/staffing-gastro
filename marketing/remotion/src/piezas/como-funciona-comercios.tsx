// 1 · Cómo funciona para comercios (29 s). Los datos están en como-funciona-comercios.datos.ts.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BancoNubes, C, ChipVidrio, Cielo, F, Hoja, Pop, Titular, VeloSuperior } from "../kit/base";
import { AvisoPush, Pantalla, Resalte, Secuencia, Telefono, Toque } from "../kit/telefono";
import { Cierre } from "../kit/cierre";
import { hora } from "../kit/util";
import { Chips, Titulos } from "../kit/datos";
import { Mezcla } from "../kit/sonido";
import { datos, type Datos } from "./como-funciona-comercios.datos";

export const ComoFuncionaComercios: React.FC<{ d?: Datos }> = ({ d = datos }) => {
  const f = useCurrentFrame();
  const T = d.escenas;
  const g = d.gancho;
  const tipeo = [1, 2, 3, 4, 5, 6, 7];
  return (
    <Cielo>
      {/* Gancho */}
      <Pop desde={1} hasta={44} x={540} y={330}><ChipVidrio mono style={{ fontSize: 44, padding: "18px 34px" }}>{g.dia}</ChipVidrio></Pop>
      <Pop desde={4} hasta={44} x={540} y={600} rot={-4}>
        <Hoja style={{ padding: "34px 46px", width: 820, transform: "rotate(-1.5deg)" }}>
          <div style={{ fontFamily: F.texto, fontWeight: 700, fontSize: 34, color: C.hondo }}>{g.de}</div>
          <div style={{ fontFamily: F.texto, fontWeight: 600, fontSize: 56, lineHeight: 1.2, marginTop: 6 }}>{g.mensaje}</div>
        </Hoja>
      </Pop>
      <Titular lineas={g.titulo} desde={10} hasta={40} y={830} size={124} />

      <Titulos lista={d.titulos} />

      <Telefono entra={T.entra} hora={hora(f, [[0, "19:00"], [T.donde, "19:01"], [T.aviso, "19:06"], [T.camino, "19:31"], [T.camino1, "19:38"], [T.camino2, "19:45"], [T.camino3, "19:51"], [T.llego, "19:53"]])}
        claves={[
          { f: 0, x: 195, y: 330, z: 1.0, ty: 1120 },
          { f: 66, x: 195, y: 300, z: 1.32, ty: 1050 },
          { f: 124, x: 230, y: 330, z: 1.12, ty: 1060 },
          { f: 144, x: 195, y: 420, z: 1.08, ty: 1100 },
          { f: 186, x: 195, y: 560, z: 0.98, ty: 1120 },
          { f: 214, x: 195, y: 420, z: 0.92, ty: 1190 },
          { f: 262, x: 195, y: 360, z: 1.0, ty: 1130 },
          { f: T.reco + 4, x: 195, y: 372, z: 1.5, ty: 1080 },
          { f: 404, x: 195, y: 420, z: 1.05, ty: 1080 },
          { f: T.oido, x: 195, y: 430, z: 0.93, ty: 1160 },
          { f: T.camino, x: 195, y: 520, z: 1.32, ty: 1080 },
          { f: T.llego, x: 195, y: 530, z: 1.3, ty: 1060 },
        ]}>
        <Pantalla n="c-publicar-0" desde={0} hasta={T.donde + 8} modo="corte" />
        {tipeo.map((i, k) => <Pantalla key={i} n={`c-publicar-tipeo-${i}`} desde={T.tipeo + k * 6} hasta={T.donde + 8} modo="corte" />)}
        <Toque f={T.toqueCampo} x={190} y={292} />
        <Toque f={T.completar} x={306} y={372} />
        <Pantalla n="c-publicar-donde-full" barra="c-publicar-donde-barra" desde={T.donde} hasta={T.publicado + 10} tr={5} modo="zoom" />
        <Resalte desde={160} hasta={184} x={30} y={548} w={330} h={52} r={14} />
        <Toque f={T.publicar} x={195} y={725} />
        <Pantalla n="c-publicado" desde={T.publicado} hasta={T.candidatos + 10} tr={4} />
        <AvisoPush desde={T.aviso} hasta={T.candidatos + 14} titulo={d.aviso.titulo} texto={d.aviso.texto} />
        <Pantalla n="c-candidatos" desde={T.candidatos} hasta={T.reco + 6} modo="empuja" tr={12} />
        <Toque f={T.tabReco} x={184} y={163} />
        <Pantalla n="c-recomendados" desde={T.reco} hasta={T.oido + 4} tr={4} />
        <Resalte desde={T.datos[0]} hasta={T.datos[0] + 18} x={23} y={359} w={110} h={46} r={12} />
        <Resalte desde={T.datos[1]} hasta={T.datos[1] + 18} x={133} y={359} w={110} h={46} r={12} />
        <Resalte desde={T.datos[2]} hasta={T.datos[2] + 26} x={244} y={359} w={110} h={46} r={12} claro />
        <Resalte desde={T.datos[3]} hasta={T.datos[3] + 24} x={110} y={297} w={190} h={28} r={14} claro />
        <Toque f={T.elegir} x={195} y={448} />
        <Secuencia n="seq:c-oido" desde={T.oido} hasta={T.oidoFin + 4} />
        <Pantalla n="c-oido" desde={T.oidoFin} hasta={T.camino + 12} tr={4} />
        <Pantalla n="c-camino-0-abajo" desde={T.camino} hasta={T.camino1 + 12} modo="empuja" tr={12} />
        <Pantalla n="c-camino-1-abajo" desde={T.camino1} hasta={T.camino2 + 12} tr={10} />
        <Pantalla n="c-camino-2-abajo" desde={T.camino2} hasta={T.camino3 + 12} tr={10} />
        <Pantalla n="c-camino-3-abajo" desde={T.camino3} hasta={T.llego + 12} tr={10} />
        <Pantalla n="c-llego-abajo" desde={T.llego} tr={5} modo="zoom" />
        <Resalte desde={T.llego + 8} hasta={T.cierre} x={20} y={578} w={136} h={28} r={10} />
        <Resalte desde={T.llego + 14} hasta={T.cierre} x={282} y={429} w={82} h={22} r={10} />
      </Telefono>

      <VeloSuperior />
      <BancoNubes y={1640} />
      <Chips lista={d.chips} />
      <Cierre desde={T.cierre} {...d.cierre} cuenta={d.cuenta} />
      <Mezcla s={d.sonido} />
    </Cielo>
  );
};
