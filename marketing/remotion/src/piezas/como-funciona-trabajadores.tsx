// 2 · Cómo funciona para quien trabaja (29 s). Los datos están en como-funciona-trabajadores.datos.ts.
import React from "react";
import { useCurrentFrame } from "remotion";
import { BancoNubes, ChipVidrio, Cielo, Pop, Titular, VeloSuperior } from "../kit/base";
import { AvisoPush, Pantalla, Resalte, Secuencia, Telefono, Toque } from "../kit/telefono";
import { Cierre } from "../kit/cierre";
import { hora } from "../kit/util";
import { Chips, Titulos } from "../kit/datos";
import { Mezcla } from "../kit/sonido";
import { datos, type Datos } from "./como-funciona-trabajadores.datos";

export const ComoFuncionaTrabajadores: React.FC<{ d?: Datos }> = ({ d = datos }) => {
  const f = useCurrentFrame();
  const T = d.escenas;
  return (
    <Cielo>
      <Titulos lista={d.titulos} />

      <Telefono entra={0} hora={hora(f, [[0, "19:00"], [T.aviso, "19:07"], [T.confirmado, "19:08"], [T.antes, "19:28"], [T.terminado, "04:10"]])}
        claves={[
          { f: 0, x: 195, y: 380, z: 0.98, ty: 1160 },
          { f: T.buscar + 6, x: 195, y: 410, z: 1.05, ty: 1110 },
          { f: 150, x: 260, y: 140, z: 1.25, ty: 896 },
          { f: T.mapa, x: 195, y: 330, z: 1.0, ty: 1060 },
          { f: T.pin, x: 170, y: 330, z: 1.1, ty: 1060 },
          { f: T.listaV, x: 230, y: 440, z: 1.2, ty: 1080 },
          { f: T.postulado, x: 195, y: 260, z: 1.05, ty: 1040 },
          { f: T.elegida, x: 195, y: 420, z: 0.98, ty: 1140 },
          { f: 500, x: 220, y: 520, z: 1.15, ty: 1080 },
          { f: T.confirmado, x: 195, y: 430, z: 0.98, ty: 1140 },
          { f: 600, x: 195, y: 560, z: 1.12, ty: 1080 },
          { f: T.terminado, x: 150, y: 560, z: 1.5, ty: 1060 },
        ]}>
        <Pantalla n="t-inicio" desde={0} modo="corte" />
        <Pantalla n="t-buscar-full" barra="t-buscar-barra" desde={T.buscar} hasta={T.mapa + 8} modo="empuja" tr={12} scroll={[[T.buscar + 50, 0], [T.buscar + 78, 230], [T.buscar + 98, 230], [T.buscar + 118, 0]]} />
        <Resalte desde={T.buscar + 16} hasta={T.buscar + 44} x={284} y={386} w={84} h={28} r={10} />
        <Resalte desde={T.buscar + 22} hasta={T.buscar + 44} x={256} y={410} w={56} h={22} r={8} />
        <Toque f={T.mapaToque} x={338} y={42} />
        <Pantalla n="t-mapa" desde={T.mapa} hasta={T.listaV + 8} tr={4} />
        <Toque f={T.pin} x={90} y={263} />
        <Secuencia n="rec:t-mapa-toque" desde={T.pin + 2} hasta={T.pinFin + 2} />
        <Pantalla n="t-mapa-pin" desde={T.pinFin} hasta={T.listaV + 8} modo="corte" />
        <Secuencia n="rec:t-mapa-hoja" desde={T.pinFin + 2} hasta={T.listaV + 6} vel={1.35} />
        <Toque f={T.lista} x={283} y={42} />
        <Pantalla n="t-buscar" desde={T.listaV} hasta={T.postulado + 8} tr={4} />
        <Toque f={T.postular} x={299} y={495} />
        <Pantalla n="t-postulado" desde={T.postulado} hasta={T.elegida + 12} tr={5} />
        <Resalte desde={T.postulado + 6} hasta={T.postulado + 50} x={12} y={8} w={366} h={40} r={20} />
        <AvisoPush desde={T.aviso} hasta={T.elegida + 30} titulo={d.aviso.titulo} texto={d.aviso.texto} />
        <Pantalla n="t-elegida-full" barra="t-elegida-barra" desde={T.elegida} hasta={T.confirmado + 8} modo="empuja" tr={12} scroll={[[480, 0], [506, 160]]} />
        <Resalte desde={T.elegida + 16} hasta={T.elegida + 60} x={31} y={375} w={84} h={28} r={14} />
        <Toque f={T.confirmar} x={254} y={597} />
        <Pantalla n="t-confirmado" desde={T.confirmado} hasta={T.antes + 10} tr={6} />
        <Pantalla n="t-antes-full" barra="t-antes-barra" desde={T.antes} hasta={T.enCamino + 8} modo="empuja" tr={12} scroll={[[588, 0], [622, 360]]} />
        <Toque f={T.voy} x={195} y={629} />
        <Pantalla n="t-en-camino" desde={T.enCamino} hasta={T.terminado + 10} tr={6} />
        <Pantalla n="t-terminado" desde={T.terminado} modo="empuja" tr={12} />
        {T.estrellas.map((e, i) => <Pantalla key={i} n={`t-califica-${i + 1}`} desde={e} modo="corte" />)}
        {T.estrellas.map((e, i) => <Toque key={i} f={e - 1} x={48 + 24 * i} y={590} />)}
        <Pantalla n="t-califica-texto" desde={758} modo="corte" />
        <Toque f={T.enviar} x={116} y={742} />
        <Pantalla n="t-calificado" desde={T.calificado} tr={5} />
      </Telefono>

      <VeloSuperior />
      <BancoNubes y={1640} />
      <Chips lista={d.chips} />
      <Cierre desde={T.cierre} {...d.cierre} cuenta={d.cuenta} />
      <Mezcla s={d.sonido} />
    </Cielo>
  );
};
