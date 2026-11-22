// 5 · Va en camino (14 s), de noche. Los datos están en va-en-camino.datos.ts.
import React from "react";
import { useCurrentFrame } from "remotion";
import { ChipVidrio, Cielo, Pop, Titular, VeloSuperior } from "../kit/base";
import { Pantalla, Resalte, Telefono } from "../kit/telefono";
import { Cierre } from "../kit/cierre";
import { hora } from "../kit/util";
import { Chips, Titulos } from "../kit/datos";
import { Mezcla } from "../kit/sonido";
import { datos, type Datos } from "./va-en-camino.datos";


export const VaEnCamino: React.FC<{ d?: Datos }> = ({ d = datos }) => {
  const f = useCurrentFrame();
  const T = d.escenas;
  const h = d.horas;
  return (
    <Cielo noche>
      <Titulos noche lista={d.titulos} />

      <Telefono noche hora={hora(f, [[0, "19:31"], [T.c1, "19:38"], [T.c2, "19:45"], [T.c3, "19:51"], [T.llego, "19:53"]])} claves={[
        { f: 0, x: 195, y: 512, z: 1.95, ty: 1020 },
        { f: 70, x: 195, y: 515, z: 1.82, ty: 1040 },
        { f: T.llego, x: 195, y: 520, z: 1.6, ty: 1080 },
      ]}>
        <Pantalla n="c-camino-0-noche-abajo" desde={0} hasta={T.c1 + 12} modo="corte" />
        <Pantalla n="c-camino-1-noche-abajo" desde={T.c1} hasta={T.c2 + 12} tr={10} />
        <Pantalla n="c-camino-2-noche-abajo" desde={T.c2} hasta={T.c3 + 12} tr={10} />
        <Pantalla n="c-camino-3-noche-abajo" desde={T.c3} hasta={T.llego + 8} tr={10} />
        <Resalte desde={24} hasta={T.llego - 4} x={296} y={580} w={70} h={30} r={12} claro />
        <Pantalla n="c-llego-noche-abajo" desde={T.llego} tr={5} modo="zoom" />
        <Resalte desde={T.llego + 8} hasta={T.cierre} x={20} y={578} w={136} h={28} r={10} claro />
        <Resalte desde={T.llego + 14} hasta={T.cierre} x={282} y={429} w={82} h={22} r={10} claro />
      </Telefono>

      <VeloSuperior noche />
      <Pop desde={6} hasta={T.cierre - 6} x={540} y={510}><ChipVidrio noche mono style={{ fontSize: 34 }}>{hora(f, [[0, h[0]], [T.c1, h[1]], [T.c2, h[2]], [T.c3, h[3]], [T.llego, h[4]]])}</ChipVidrio></Pop>
      <Chips noche lista={d.chips} />
      <Cierre noche desde={T.cierre} {...d.cierre} cuenta={d.cuenta} />
      <Mezcla s={d.sonido} />
    </Cielo>
  );
};
