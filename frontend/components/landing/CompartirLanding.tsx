"use client";

import { shareLanding } from "@/lib/landing-share";

/** «Compartir» en el pie de la landing: un botón con aspecto de link, igual
 *  a los de al lado. Abre el menú de compartir del teléfono (o WhatsApp). */
export default function CompartirLanding() {
  return (
    <button type="button" onClick={shareLanding} aria-label="Compartir Oído" data-cta="pie-compartir">
      Compartir
    </button>
  );
}
