import { formatArs } from "@/lib/format";
import { RESPALDO } from "./planes";

/**
 * Preguntas frecuentes de la landing. Una sola lista para la sección y para
 * los datos estructurados (`FAQPage` en app/page.tsx), así lo que lee Google
 * es lo mismo que lee la persona.
 *
 * Sólo van respuestas que el producto ya cumple. Quedan afuera hasta tenerlas
 * validadas: quién es el empleador y si hace falta monotributo (asesoría
 * legal) y el medio de pago recomendado (auditoría de la landing,
 * 2026-10-12).
 */
const gratis = RESPALDO.find((p) => p.code === "gratis");
const desde = Math.min(...RESPALDO.filter((p) => Number(p.price_ars) > 0).map((p) => Number(p.price_ars)));

export const PREGUNTA_INSTALAR = "¿Cómo la bajo al celular?";

export const PREGUNTAS: { pregunta: string; respuesta: string }[] = [
  {
    pregunta: "¿En qué zonas funciona?",
    respuesta: "Por ahora en la Ciudad de Buenos Aires. Estamos en beta.",
  },
  {
    pregunta: "¿Cuánto cuesta?",
    respuesta: `Publicar es gratis hasta ${gratis?.max_turnos_mes ?? 3} turnos por mes. Después hay planes desde ${formatArs(desde)} por mes. No cobramos comisión por turno.`,
  },
  {
    pregunta: "¿Cómo le pago a quien trabaja?",
    respuesta: "Directo vos, como acuerden. Oído no cobra comisión ni pasa la plata por el medio.",
  },
  {
    pregunta: "¿Qué pasa si no viene?",
    respuesta: "Lo marcás como ausente y elegís a otra persona de las que se postularon, sin volver a publicar.",
  },
  {
    pregunta: "¿Cómo verifican a las personas?",
    respuesta:
      "Verificamos el DNI y la selfie de cada trabajador, y la constancia de AFIP de cada comercio.",
  },
  {
    pregunta: "Si trabajo, ¿me cobran algo?",
    respuesta: "No. Para trabajar no se paga nada, y el local te paga directo.",
  },
  {
    pregunta: PREGUNTA_INSTALAR,
    respuesta:
      "Desde esta misma página, gratis y sin pasar por ninguna tienda. En Android tocá Instalar; en iPhone, Compartir y después Agregar a inicio. Queda como cualquier app y te llegan los avisos al instante.",
  },
];
