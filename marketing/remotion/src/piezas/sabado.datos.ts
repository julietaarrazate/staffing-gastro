// T6-05 · Cosas que solo entiende quien laburó un sábado (@turnosgastro, 1/12, 25 s).
// Guion aprobado en la pestaña Guiones del documento de crecimiento. Identificación pura: se comparte y se etiqueta.
import type { DatosGuion } from "../kit/guion";

export const datos: DatosGuion = {
  id: "t6-05-sabado",
  codigo: "T6-05",
  titulo: "Cosas que solo entiende quien laburó un sábado",
  fecha: "1/12",
  duracion: 25,
  cuenta: "@turnosgastro",
  escenas: [
    { desde: 0, hasta: 2.2, lineas: ["Cosas que solo entiende", "quien laburó un sábado"], size: 68, acento: "sábado", dibujo: "salon" },
    { desde: 2.2, hasta: 5, lineas: ["«¿Me traés la carta?»"], nota: "(la carta está en la mesa)", notaEn: 1, dibujo: "carta" },
    { desde: 5, hasta: 8, lineas: ["21:30, sin reserva:", "«Somos poquitos,", "ocho nomás»"], dibujo: "puerta" },
    { desde: 8, hasta: 11, lineas: ["Cocina canta «¡Oído!»", "y nadie oyó nada"], size: 70, dibujo: "pase" },
    { desde: 11, hasta: 14, lineas: ["Tu cena: media", "medialuna fría a las", "2 de la mañana"], dibujo: "medialuna" },
    { desde: 14, hasta: 18, lineas: ["Mesa de 12:", "«¿Nos cobrás", "separado?»"], dibujo: "ticket" },
    { desde: 18, hasta: 22, lineas: ["Y el domingo", "volvés igual.", "Porque te encanta."], nota: "(Un poco.)", notaEn: 2.2, dibujo: "delantal" },
  ],
  cierre: { desde: 22, lineas: ["Etiquetá a quien se banca", "todos los sábados"], size: 66, logo: "pinche" },
  sonido: {
    murmullo: true, murmulloDb: 4, musicaDesde: 60,
    cues: [["impresora", 12, -24], ["impresora", 30, -26], ["campanita", 262, -4], ["campanita", 292, -9]],
  },
};
