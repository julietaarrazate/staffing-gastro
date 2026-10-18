
/**
 * Preguntas frecuentes de la landing. Una sola lista para la sección y para
 * los datos estructurados (`FAQPage` en app/page.tsx), así lo que lee Google
 * es lo mismo que lee la persona.
 *
 * "¿Cuánto cuesta?" salió el 2026-10-18: los precios están justo arriba, en
 * su sección. Sólo van respuestas que el producto ya cumple. Quedan afuera hasta tenerlas
 * validadas: quién es el empleador y si hace falta monotributo (asesoría
 * legal) y el medio de pago recomendado (auditoría de la landing,
 * 2026-10-12).
 */

export const PREGUNTA_INSTALAR = "¿Cómo la bajo al celular?";

export const PREGUNTAS: { pregunta: string; respuesta: string }[] = [
  {
    pregunta: "¿En qué zonas funciona?",
    respuesta: "Por ahora en la Ciudad de Buenos Aires.",
  },
  {
    pregunta: "¿Cómo le pago a quien trabaja?",
    respuesta: "Le pagás vos directo, como acuerden. Oído no cobra comisión ni pasa la plata por el medio.",
  },
  {
    pregunta: "¿Qué pasa si no viene?",
    respuesta: "Lo marcás como ausente y elegís a otra persona de las que se postularon, sin volver a publicar.",
  },
  {
    pregunta: "¿Cómo verifican a las personas?",
    respuesta:
      "Verificamos la identidad de cada trabajador y los datos fiscales de cada comercio.",
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
