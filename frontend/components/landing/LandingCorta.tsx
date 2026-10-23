import LandingHeader from "./LandingHeader";
import HeroRueda, { HERO_CTA_ID } from "./HeroRueda";
import Comanda from "./Comanda";
import MapaCamino from "./MapaCamino";
import Precios from "./Precios";
import ParaTrabajar from "./ParaTrabajar";
import Preguntas from "./Preguntas";
import Cierre from "./Cierre";
import LandingFooter from "./LandingFooter";

/**
 * La landing corta (2026-10-12). Reemplaza a la historia fijada al scroll
 * (2026-10-06): se entendía tarde qué hace Oído, el trabajador casi no tenía
 * lugar, las animaciones iban rápido y reemplazaban texto, y había títulos
 * que no decían nada. Diagnóstico y estructura: docs/historial/
 * 2026-10-12-landing-corta.md.
 *
 * Desde el 2026-10-18 ("cielo"): celeste y blanco con el ámbar de siempre,
 * cada sección como el inicio (un título y una sola cosa para mirar), sin
 * subtítulos ni textos grises que repitan. Inicio con rueda de fotos, la
 * comanda que se escribe en lenguaje natural, el mapa de "va en camino",
 * la ficha, precios, para trabajar, preguntas, cierre y "oído" grande.
 * Recorrido y decisiones: docs/historial/2026-10-18-landing-cielo.md.
 *
 * El contenido sale entero en el HTML del servidor; las animaciones (rueda,
 * palabra, comanda, mapa) arrancan en el navegador y se apagan con "reducir
 * movimiento". Nada se fija al scroll.
 */
export default function LandingCorta() {
  return (
    // `data-theme="light"`: la landing es siempre clara (la noche y el ámbar
    // son tramos, no un tema). globals.css redeclara los tokens claros para
    // este subárbol. `overflow-x-clip` y no `hidden`: `hidden` rompería el
    // encabezado `sticky`.
    <div data-landing data-theme="light" data-palette="celeste" className="overflow-x-clip bg-card text-ink">
      <LandingHeader heroCtaId={HERO_CTA_ID} />
      <HeroRueda />
      <Comanda />
      <MapaCamino />
      <Precios />
      <ParaTrabajar />
      <Preguntas />
      <Cierre />
      <LandingFooter />
    </div>
  );
}
