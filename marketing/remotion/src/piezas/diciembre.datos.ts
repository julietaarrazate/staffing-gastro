// Las seis piezas del 1 al 4 de diciembre (pestaña Guiones de «Oído · Estrategia de crecimiento en redes»).
// Textos y tiempos del guion; cuadros a 30 fps. Tono: «me río para no llorar», el villano es la situación.
// Cambio contra el guion: «Mandaselo» va con tilde («Mandáselo»).
import type { Cuenta, DatosTitulo } from "../kit/datos";
import type { Sonido } from "../kit/sonido";

export type DatosLaminas = {
  id: string;
  titulo: string;
  duracion: number;
  cuenta: Cuenta;
  titulos: DatosTitulo[];
  /** cuadro en que arranca cada escena (la última termina en `cierre`) */
  escenas: number[];
  cierre: number;
  /** cierre de @turnosgastro: la frase y el nombre de la cuenta */
  cierreCuenta?: { lineas: string[]; acento?: string; size?: number };
  /** cierre de @oidoapp: el llamado */
  cierreApp?: { boton: string; bajada?: string; linea2?: string };
  /** el cierre lleva dos fotos de la landing: un comercio y alguien trabajando (frontend/public/landing/) */
  fotosCierre?: [string, string];
  sonido: Sonido;
};

export const NOMBRE_TURNOS = "Turnos Gastro CABA · Oído";

// 1/12 · @turnosgastro · T6-05 Cosas que solo entiende quien laburó un sábado (25 s)
export const sabado: DatosLaminas & { textos: Record<string, string> } = {
  id: "t6-05-sabado",
  fotosCierre: ["cocina1", "mozo3"],
  titulo: "Cosas que solo entiende quien laburó un sábado",
  duracion: 750,
  cuenta: "@turnosgastro",
  escenas: [0, 60, 150, 240, 330, 420, 540],
  cierre: 660,
  titulos: [
    { lineas: ["Cosas que solo", "entiende quien", "laburó un sábado"], desde: 4, hasta: 50, size: 84, acento: "sábado" },
    { lineas: ["«¿Me traés", "la carta?»"], desde: 64, hasta: 140, size: 96 },
    { lineas: ["21:30, sin reserva:", "«Somos poquitos,", "ocho nomás»"], desde: 154, hasta: 230, size: 80, acento: "ocho" },
    { lineas: ["Cocina canta «¡Oído!»", "y nadie oyó nada"], desde: 244, hasta: 320, size: 74 },
    { lineas: ["Tu cena: media", "medialuna fría a las", "2 de la mañana"], desde: 334, hasta: 410, size: 76 },
    { lineas: ["Mesa de 12:", "«¿Nos cobrás", "separado?»"], desde: 424, hasta: 530, size: 88 },
    { lineas: ["Y el domingo", "volvés igual."], desde: 544, hasta: 596, size: 92 },
    { lineas: ["Porque te encanta.", "(Un poco.)"], desde: 602, hasta: 650, size: 84, acento: "encanta." },
  ],
  textos: { carta: "la carta está en la mesa", hora: "02:00" },
  cierreCuenta: { lineas: ["Etiquetá a quien", "se banca todos", "los sábados"], acento: "sábados" },
  sonido: {
    murmullo: true, murmulloDb: 4, musicaDesde: 60,
    cues: [["impresora", 8, -22], ["impresora", 30, -23], ["toque", 160, -14], ["toque", 172, -14], ["toque", 184, -14], ["toque", 196, -14],
      ["campanita", 252, -3], ["impresora", 430, -20], ["impresora", 452, -21], ["impresora", 474, -21], ["toque", 668, -10]],
  },
};

// 1/12 · @oidoapp · Qué es Oído, en 30 segundos
export const queEs: DatosLaminas & { mensaje: { de: string; texto: string }; chat: string[]; pantallas: Record<string, number> } = {
  id: "que-es-oido-30s",
  fotosCierre: ["bar3", "barista1"],
  titulo: "Qué es Oído, en 30 segundos",
  duracion: 900,
  cuenta: "@oidoapp",
  escenas: [0, 60, 180, 360, 540],
  cierre: 720,
  titulos: [
    { lineas: ["Viernes, 19 h.", "Se te cayó un mozo."], desde: 4, hasta: 52, size: 80 },
    { lineas: ["Antes: 40 mensajes", "de WhatsApp"], desde: 64, hasta: 170, size: 80, acento: "40" },
    { lineas: ["Con Oído: publicás", "el turno desde", "el celular"], desde: 184, hasta: 350, size: 72 },
    { lineas: ["Se postula gente", "del rubro."], desde: 364, hasta: 436, size: 80 },
    { lineas: ["Ves quién tiene", "la identidad", "verificada."], desde: 444, hasta: 530, size: 76, acento: "verificada." },
    { lineas: ["Elegís y listo.", "¡Oído!"], desde: 546, hasta: 710, size: 96, acento: "Oído" },
  ],
  mensaje: { de: "Mati · mozo", texto: "Perdón, hoy no llego." },
  chat: ["¿Alguien libre hoy a las 20?", "¿Conocés a alguien?", "Hoy no puedo, perdón", "¿Hasta qué hora es?", "Te paso un contacto", "Le pregunto a mi primo", "¿Cuánto pagan?", "Visto", "¿Sigue en pie?", "Ya conseguí, perdón"],
  pantallas: { entra: 176, toqueCampo: 200, tipeo: 206, completar: 262, donde: 268, publicar: 330, publicado: 336, candidatos: 360, verificada: 450, elegir: 552, oido: 558, oidoFin: 606 },
  cierreApp: { boton: "Comentá CUBRIR", bajada: "Abre el 12/12 en CABA", linea2: "Y te aviso cuando abra." },
  sonido: {
    murmullo: true, musicaDesde: 180,
    cues: [["impresora", 6, -24], ["impresora", 28, -25], ["vibracion", 18, -10],
      ["toque", 72, -18], ["toque", 84, -19], ["toque", 94, -18], ["toque", 103, -19], ["toque", 111, -18], ["toque", 118, -19], ["toque", 125, -18], ["toque", 131, -19], ["toque", 137, -19], ["toque", 143, -20],
      ["toque", 200, -4], ["tipeo", 206, -6, 1.5], ["toque", 262, -4], ["toque", 330, -4], ["vibracion", 362, -12], ["toque", 552, -4], ["campanita", 575, -2], ["campanita", 728, -4]],
  },
};

// 2/12 · @turnosgastro · T2-09 El hielo es la mitad del trago (29 s)
export const hielo: DatosLaminas = {
  id: "t2-09-hielo",
  fotosCierre: ["bar3", "mozo2"],
  titulo: "El hielo es la mitad del trago",
  duracion: 870,
  cuenta: "@turnosgastro",
  escenas: [0, 60, 210, 360, 510, 660],
  cierre: 780,
  titulos: [
    { lineas: ["«Sin mucho hielo,", "que me cobrás agua».", "La física: no."], desde: 2, hasta: 52, size: 72, acento: "no." },
    { lineas: ["Poco hielo se derrite", "rápido y agua el trago."], desde: 64, hasta: 132, size: 66 },
    { lineas: ["Vaso lleno:", "frío y entero."], desde: 138, hasta: 200, size: 92, acento: "entero." },
    { lineas: ["Cubo grande:", "whisky, Negroni"], desde: 214, hasta: 350, size: 92 },
    { lineas: ["Cubos comunes:", "gin tonic, fernet"], desde: 364, hasta: 500, size: 88 },
    { lineas: ["Hielo picado:", "Mojito"], desde: 514, hasta: 650, size: 96 },
    { lineas: ["El de la coctelera", "se tira. Servís", "con hielo nuevo."], desde: 664, hasta: 770, size: 80, acento: "nuevo." },
  ],
  cierreCuenta: { lineas: ["Mandáselo a quien", "te pide", "«poquito hielo»"], acento: "hielo" },
  sonido: {
    murmullo: true, murmulloDb: -3, musicaDesde: 60,
    cues: [["hielo", 6, -3], ["hielo", 222, -8, 0.9], ["hielo", 372, -6], ["hielo", 522, -6], ["coctelera", 662, -5], ["hielo", 726, -8, 1.2], ["toque", 788, -10]],
  },
};

// 3/12 · @turnosgastro · T3-05 Una cebolla en 20 segundos (28 s)
export const cebolla: DatosLaminas = {
  id: "t3-05-cebolla",
  fotosCierre: ["cocina1", "cocinera"],
  titulo: "Una cebolla en 20 segundos",
  duracion: 840,
  cuenta: "@turnosgastro",
  escenas: [0, 60, 150, 270, 390, 510, 630],
  cierre: 750,
  titulos: [
    { lineas: ["Si llorás picando", "cebolla, no es la", "cebolla: es el cuchillo"], desde: 2, hasta: 52, size: 70, acento: "cuchillo" },
    { lineas: ["1. Al medio, de la raíz", "a la punta.", "La raíz no se toca."], desde: 64, hasta: 142, size: 70 },
    { lineas: ["2. Pelá y apoyá", "la parte plana"], desde: 154, hasta: 262, size: 84 },
    { lineas: ["3. Cortes verticales", "sin llegar a la raíz"], desde: 274, hasta: 382, size: 76 },
    { lineas: ["4. Uno o dos cortes", "horizontales"], desde: 394, hasta: 502, size: 80 },
    { lineas: ["5. De costado:", "sale pareja"], desde: 514, hasta: 622, size: 92, acento: "pareja" },
    { lineas: ["Cuchillo afilado y", "cebolla fría. Para", "llorar ya está el", "cierre del domingo."], desde: 634, hasta: 742, size: 70, acento: "domingo." },
  ],
  cierreCuenta: { lineas: ["Guardalo para tu", "próximo turno", "en cocina"], acento: "cocina" },
  sonido: {
    murmullo: true, murmulloDb: -5, musicaDesde: 60,
    cues: [["cuchillo", 84, -5, 0.6], ["cuchillo", 290, -4, 3.0], ["cuchillo", 420, -6, 1.2], ["cuchillo", 530, -4, 3.2], ["toque", 758, -10]],
  },
};

// 4/12 · @turnosgastro · T1-04 El orden de servicio que nadie te explicó (28 s)
export const servicio: DatosLaminas = {
  id: "t1-04-orden-de-servicio",
  fotosCierre: ["cocina1", "mozo3"],
  titulo: "El orden de servicio que nadie te explicó",
  duracion: 840,
  cuenta: "@turnosgastro",
  escenas: [0, 60, 210, 330, 450, 600],
  cierre: 720,
  titulos: [
    { lineas: ["Mesa de 4, cuatro", "platos, dos manos.", "¿Por qué lado entro?"], desde: 2, hasta: 52, size: 72 },
    { lineas: ["Plato: por la", "derecha del cliente"], desde: 64, hasta: 200, size: 80, acento: "derecha" },
    { lineas: ["Bebida: por la derecha,", "copa a la derecha", "del plato"], desde: 214, hasta: 320, size: 68 },
    { lineas: ["Pan y manteca:", "a la izquierda"], desde: 334, hasta: 440, size: 88, acento: "izquierda" },
    { lineas: ["Primero los invitados;", "el que paga, al final", "(que espere, total paga)"], desde: 454, hasta: 590, size: 64 },
    { lineas: ["Se retira cuando", "terminaron todos. Sí,", "aunque el de la punta", "tarde 40 minutos."], desde: 604, hasta: 710, size: 66, acento: "todos." },
  ],
  cierreCuenta: { lineas: ["Cada casa tiene", "su manual.", "Esto es lo más", "usado. Guardalo."], acento: "Guardalo", size: 84 },
  sonido: {
    murmullo: true, musicaDesde: 60,
    cues: [["copa", 120, -6], ["copa", 240, -3], ["copa", 372, -8], ["toque", 470, -10], ["toque", 490, -10], ["toque", 510, -10], ["toque", 534, -8], ["copa", 690, -8], ["campanita", 726, -3]],
  },
};

// 4/12 · @oidoapp · C2-07 El costo que no ves: el encargado buscando gente (30 s)
export const encargado: DatosLaminas & { chat: string[]; pantallas: Record<string, number> } = {
  id: "c2-07-costo-encargado",
  fotosCierre: ["bar3", "barista2"],
  titulo: "El costo que no ves: el encargado buscando gente",
  duracion: 900,
  cuenta: "@oidoapp",
  escenas: [0, 60, 210, 390, 540],
  cierre: 720,
  titulos: [
    { lineas: ["¿Cuántas horas por", "semana pasás", "buscando quien cubra?"], desde: 2, hasta: 52, size: 70, acento: "horas" },
    { lineas: ["Mensajes, audios,", "«¿conocés a alguien?»"], desde: 64, hasta: 200, size: 72 },
    { lineas: ["Hacé la cuenta: horas", "por semana × lo que", "vale tu hora"], desde: 214, hasta: 380, size: 70, acento: "cuenta:" },
    { lineas: ["Esas horas no estás", "en el salón, ni en la", "caja, ni con tu equipo"], desde: 394, hasta: 530, size: 68 },
    { lineas: ["Con Oído publicás", "el turno en 1 minuto", "y te postulan"], desde: 544, hasta: 710, size: 72, acento: "minuto" },
  ],
  chat: ["¿Conocés a alguien?", "audio", "¿Alguien para el sábado?", "audio", "Pregunto y te digo", "¿Me pasás el número?", "audio", "Mañana te confirmo"],
  pantallas: { entra: 536, toqueCampo: 556, tipeo: 562, completar: 606, donde: 612, publicar: 660, publicado: 666 },
  cierreApp: { boton: "Comentá CUBRIR", bajada: "Abre el 12/12", linea2: "Te mando el acceso para publicar tu primer turno." },
  sonido: {
    murmullo: true, murmulloDb: -4, musicaDesde: 210,
    cues: [["vibracion", 70, -16], ["toque", 82, -18], ["toque", 100, -18], ["vibracion", 118, -17], ["toque", 136, -18], ["toque", 152, -18], ["vibracion", 168, -17], ["toque", 184, -19],
      ["campanita", 542, -4], ["toque", 556, -4], ["tipeo", 562, -6, 1.3], ["toque", 606, -4], ["toque", 660, -4], ["campanita", 728, -4]],
  },
};
