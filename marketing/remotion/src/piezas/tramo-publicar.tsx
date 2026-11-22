// El tramo de pantallas reales que comparten las piezas de @oidoapp del 1 y el 4/12: publicar el turno,
// llegan postulantes (con quién tiene la identidad verificada) y, si se pide, elegir y «¡Oído!».
// Coordenadas de toques y resaltados: las mismas capturas que «Cómo funciona para comercios» (node capturar/medir.js).
import React from "react";
import { useCurrentFrame } from "remotion";
import { AvisoPush, Pantalla, Resalte, Secuencia, Telefono, Toque, type Clave } from "../kit/telefono";
import { hora } from "../kit/util";

/** Cuadros (absolutos) de cada paso. `candidatos`, `elegir` y `oido` son opcionales: sin ellos, el tramo termina en publicado. */
export type TramoPublicar = {
  entra: number; toqueCampo: number; tipeo: number; completar: number; donde: number; publicar: number; publicado: number;
  aviso: number; candidatos?: number; verificada?: [number, number]; elegir?: number; oido?: number; fin: number;
  aviso_texto: { titulo: string; texto: string };
};

export const TelefonoPublicar: React.FC<{ T: TramoPublicar; claves: Clave[] }> = ({ T, claves }) => {
  const f = useCurrentFrame();
  if (f < T.entra - 1 || f > T.fin + 12) return null;
  const tipeo = [1, 2, 3, 4, 5, 6, 7];
  const finPublicado = T.candidatos ?? T.fin + 12;
  return (
    <Telefono entra={T.entra} claves={claves}
      hora={hora(f, [[0, "19:00"], [T.donde, "19:01"], [T.aviso, "19:06"], ...(T.oido ? [[T.oido, "19:08"] as [number, string]] : [])])}>
      <Pantalla n="c-publicar-0" desde={T.entra} hasta={T.donde + 8} modo="corte" />
      {tipeo.map((i, k) => <Pantalla key={i} n={`c-publicar-tipeo-${i}`} desde={T.tipeo + k * 6} hasta={T.donde + 8} modo="corte" />)}
      <Toque f={T.toqueCampo} x={190} y={292} />
      <Toque f={T.completar} x={306} y={372} />
      <Pantalla n="c-publicar-donde-full" barra="c-publicar-donde-barra" desde={T.donde} hasta={T.publicado + 10} tr={5} modo="zoom" />
      <Toque f={T.publicar} x={195} y={725} />
      <Pantalla n="c-publicado" desde={T.publicado} hasta={finPublicado + 10} tr={4} />
      <AvisoPush desde={T.aviso} hasta={(T.candidatos ?? T.fin) + 14} titulo={T.aviso_texto.titulo} texto={T.aviso_texto.texto} />
      {T.candidatos !== undefined && <Pantalla n="c-candidatos" desde={T.candidatos} hasta={(T.oido ?? T.fin + 12) + 4} modo="empuja" tr={12} />}
      {T.verificada && <Resalte desde={T.verificada[0]} hasta={T.verificada[1]} x={112} y={298} w={162} h={26} r={12} claro />}
      {T.elegir !== undefined && <Toque f={T.elegir} x={195} y={448} />}
      {T.oido !== undefined && <Secuencia n="seq:c-oido" desde={T.oido} hasta={T.oido + 52} />}
      {T.oido !== undefined && <Pantalla n="c-oido" desde={T.oido + 48} hasta={T.fin + 12} tr={4} />}
    </Telefono>
  );
};
