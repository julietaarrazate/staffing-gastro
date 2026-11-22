// Los tres primeros videos («Qué resuelve Oído», «Para comercios», «Para trabajadores»), que estaban
// en HTML + GSAP (redes/src.html). Mismo guion; los tiempos van en segundos, como en el original.
// Cambios contra el original, por la verdad del producto: «bachero» no es un puesto de la app (va
// «mozo»), quien trabaja no «toma» el turno sino que se postula y confirma, y la paga se dice
// «desde $60.000».
import { PAGA } from "../kit/datos";
import type { Sonido } from "../kit/sonido";

export type Cap = { texto: string; desde: number; hasta?: number; top?: number; bajada?: string };

export const queResuelve = {
  id: "que-resuelve-oido",
  titulo: "Qué resuelve Oído",
  duracion: 22,
  cuenta: "@oidoapp",
  paga: PAGA,
  reloj: { dia: "Viernes", desde: "18:52", hasta: "19:00" },
  burbuja: { de: "Mati · mozo", texto: "Perdón, hoy no llego." },
  turno: { puesto: "Mozo/a", chips: ["Hoy", "20 a 04 h", "Palermo"], pago: "$65.000" },
  listo: "Cubierto en 8 min",
  caps: [
    { texto: "Viernes, 18:52.", desde: 0.5, hasta: 3 },
    { texto: "Se te cae un turno.", desde: 3.3, hasta: 6 },
    { texto: "Lo pedís como lo dirías.", desde: 6.3, hasta: 10 },
    { texto: "Lo ve quien trabaja cerca.", desde: 10.4, hasta: 13 },
    { texto: "Alguien lo confirma.", desde: 13.3, hasta: 16 },
    { texto: "Cubierto antes de las siete.", desde: 16.2, hasta: 19 },
    { texto: "Turnos de gastronomía, en el momento.", desde: 20.0, top: 104, bajada: "CABA · @oidoapp" },
  ] as Cap[],
  sonido: {
    murmullo: true,
    cues: [["vibracion", 93, -10], ["impresora", 201, -20], ["impresora", 222, -21], ["impresora", 243, -21], ["impresora", 264, -22],
      ["campanita", 399, 0], ["toque", 513, 0]],
  } as Sonido,
};

export const paraComercios = {
  id: "para-comercios",
  titulo: "Para comercios",
  duracion: 15,
  cuenta: "@oidoapp",
  paga: PAGA,
  reloj: { dia: "Sábado", desde: "19:00", hasta: "19:08" },
  burbuja: { de: "Mati · mozo", texto: "No llego a las 20, perdón." },
  pedido: { rotulo: "Pedilo como lo dirías", frase: "Un mozo hoy de 20 a 04 en Palermo", boton: "Pedir" },
  turno: { puesto: "Mozo/a", chips: ["Hoy", "20 a 04 h", "Palermo"], pago: "$65.000" },
  persona: { inicial: "J", texto: "Julián confirmó el turno", nota: "Nombre de ejemplo" },
  listo: "Llega 19:50",
  caps: [
    { texto: "Se te cayó el mozo de las 20.", desde: 0.4, hasta: 3 },
    { texto: "Lo publicás en un renglón.", desde: 3.3, hasta: 7, top: 139 },
    { texto: "¡Oído! Julián confirmó.", desde: 7.6, hasta: 10, top: 139 },
    { texto: "Y llega antes del servicio.", desde: 10.2, hasta: 12.9, top: 139 },
    { texto: "Publicá tu turno.", desde: 13.6, top: 104, bajada: "@oidoapp · Link en la bio" },
  ] as Cap[],
  sonido: {
    murmullo: true,
    cues: [["vibracion", 21, -10], ["tipeo", 105, -3, 1.9], ["toque", 168, 0], ["impresora", 174, -20], ["impresora", 192, -21],
      ["campanita", 228, 0], ["toque", 321, 0]],
  } as Sonido,
};

export const paraTrabajadores = {
  id: "para-trabajadores",
  titulo: "Para quien trabaja",
  duracion: 15,
  cuenta: "@turnosgastro",
  paga: PAGA,
  reloj: { dia: "Hoy", hora: "17:40" },
  turnos: [
    { puesto: "Mozo/a · Palermo", detalle: "Hoy 20 a 04 h · a 900 m", pago: "$65.000" },
    { puesto: "Runner · Colegiales", detalle: "Hoy 21 a 05 h · a 1,8 km", pago: "$65.000" },
    { puesto: "Cocinero/a · Villa Crespo", detalle: "Hoy 15 a 23 h · a 2,4 km", pago: "$62.000" },
  ],
  boton: "Postularme",
  listo: "Confirmado",
  pagaGrande: { rotulo: "Paga desde", monto: "$60.000", nota: "Turnos de la app" },
  caps: [
    { texto: "¿Te sumás esta noche?", desde: 0.5, hasta: 3 },
    { texto: "Ves los turnos cerca tuyo.", desde: 3.3, hasta: 6 },
    { texto: "Te postulás con un toque.", desde: 6.3, hasta: 9 },
    { texto: "Confirmado. Sabés dónde y a qué hora.", desde: 9.3, hasta: 12 },
    { texto: "Cobrás el turno que elegiste.", desde: 12.1, hasta: 13.5 },
    { texto: "Elegí tu próximo turno.", desde: 13.9, top: 104, bajada: "@turnosgastro · Link en la bio" },
  ] as Cap[],
  sonido: { murmullo: true, cues: [["toque", 237, 0], ["campanita", 279, 0]] } as Sonido,
};

export type DatosQueResuelve = typeof queResuelve;
export type DatosParaComercios = typeof paraComercios;
export type DatosParaTrabajadores = typeof paraTrabajadores;
