// C2-07 · El costo que no ves: el encargado buscando gente (@oidoapp, 4/12, 30 s).
// «Publicás el turno en 1 minuto»: confirmado por Julieta el 22/11.
import type { Escena, CierreGuion } from "../kit/guion";
import type { DatosTitulo } from "../kit/datos";
import type { Sonido } from "../kit/sonido";
import type { TramoPublicar } from "./tramo-publicar";

const seg = (s: number) => Math.round(s * 30);

export const datos = {
  id: "c2-07-costo-encargado",
  codigo: "C2-07",
  titulo: "El costo que no ves: el encargado buscando gente",
  fecha: "4/12",
  duracion: 30,
  cuenta: "@oidoapp" as const,
  escenas: [
    { desde: 0, hasta: 2.4, lineas: ["¿Cuántas horas por semana", "pasás buscando", "quien cubra?"], size: 62, dibujo: "encargado" },
    { desde: 2.4, hasta: 7, lineas: ["Mensajes, audios,", "«¿conocés a alguien?»"], size: 70, dibujo: "audios" },
    { desde: 7, hasta: 13, lineas: ["Hacé la cuenta:"], size: 84, dibujo: "cuenta" },
    { desde: 13, hasta: 18, lineas: ["Esas horas no estás", "en el salón, ni en la caja,", "ni con tu equipo"], size: 60, dibujo: "sinVos" },
  ] as Escena[],
  titulos: [
    { lineas: ["Con Oído publicás el turno", "en 1 minuto y te postulan"], desde: seg(18), hasta: seg(24) - 8, size: 62, acento: "minuto" },
  ] as DatosTitulo[],
  /** el cronómetro del minuto, en cuadros */
  minuto: { desde: seg(18) + 20, hasta: seg(18) + 146 },
  tramo: {
    entra: seg(18) - 6, toqueCampo: seg(18) + 16, tipeo: seg(18) + 22, completar: seg(18) + 70, donde: seg(18) + 76, publicar: seg(18) + 126, publicado: seg(18) + 132,
    aviso: seg(18) + 150, fin: seg(24),
    aviso_texto: { titulo: "3 postulantes para Mozo/a", texto: "Sofía Ramírez se postuló a tu turno de Mozo/a. Entrá para ver a todos los postulantes y elegir." },
  } as TramoPublicar,
  cierre: { desde: 24, lineas: ["Abre el 12/12."], size: 84, logo: "filete", boton: "Comentá CUBRIR" } as CierreGuion,
  sonido: {
    murmullo: true, murmulloDb: -5, musicaDesde: seg(7),
    cues: [
      ["vibracion", 6, -14], ["toque", 80, -18], ["vibracion", 110, -16], ["toque", 140, -18], ["vibracion", 170, -16], ["toque", 195, -18],
      ["toque", seg(18) + 16, -4], ["tipeo", seg(18) + 22, -6, 1.5], ["toque", seg(18) + 70, -4], ["toque", seg(18) + 126, -4],
      ["campanita", seg(18) + 134, -3], ["vibracion", seg(18) + 150, -12], ["campanita", seg(24) + 6, -5],
    ],
  } as Sonido,
};

export type Datos = typeof datos;
