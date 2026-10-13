import LandingHeader from "./LandingHeader";
import Hero, { HERO_CTA_ID } from "./Hero";
import ComoFunciona from "./ComoFunciona";
import Confianza from "./Confianza";
import Precios from "./Precios";
import ParaTrabajar from "./ParaTrabajar";
import Preguntas from "./Preguntas";
import Cierre from "./Cierre";
import BarraCelular from "./BarraCelular";
import LandingFooter from "./LandingFooter";

/**
 * La landing corta (2026-10-12). Reemplaza a la historia fijada al scroll
 * (2026-10-06): se entendía tarde qué hace Oído, el trabajador casi no tenía
 * lugar, las animaciones iban rápido y reemplazaban texto, y había títulos
 * que no decían nada. Diagnóstico y estructura: docs/historial/
 * 2026-10-12-landing-corta.md.
 *
 * Una sola versión para todos: el contenido sale entero en el HTML del
 * servidor y la única animación es una entrada suave al aparecer (`Reveal`),
 * que no corre con "reducir movimiento". Nada se fija al scroll.
 */
export default function LandingCorta() {
  return (
    // `data-theme="light"`: la landing es siempre clara (la noche y el ámbar
    // son tramos, no un tema). globals.css redeclara los tokens claros para
    // este subárbol. `overflow-x-clip` y no `hidden`: `hidden` rompería el
    // encabezado `sticky`.
    <div data-landing data-theme="light" data-palette="celeste" className="overflow-x-clip bg-background text-ink">
      <LandingHeader heroCtaId={HERO_CTA_ID} />
      <Hero />
      <ComoFunciona />
      <Confianza />
      <Precios />
      <ParaTrabajar />
      <Preguntas />
      <Cierre />
      <LandingFooter />
      <BarraCelular heroCtaId={HERO_CTA_ID} />
    </div>
  );
}
