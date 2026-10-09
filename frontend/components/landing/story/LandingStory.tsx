"use client";

import { useEffect } from "react";
import LandingHeader from "./LandingHeader";
import { ActoNoche, ActoNocheStatic, HERO_CTA_ID } from "./ActoNoche";
import Silencio from "./Silencio";
import { ActoPedido, ActoPedidoStatic } from "./ActoPedido";
import { ActoOido, ActoOidoStatic } from "./ActoOido";
import Corte from "./Corte";
import BandaOido from "./BandaOido";
import { ActoLlegada, ActoLlegadaStatic } from "./ActoLlegada";
import Confianza from "./Confianza";
import Resultado from "./Resultado";
import Carta from "./Carta";
import LandingFooter from "./LandingFooter";
import { setReloj } from "./relojStore";
import { StoryContext } from "./Stage";
import { useEnhanced } from "./useStage";

/**
 * La landing como la historia de UN turno: el de mozo de 21 a 2 de un viernes
 * en Palermo, desde que se cae (20:46) hasta que queda cubierto. Guion,
 * decisiones y qué se sacó de la landing anterior: docs/historial/
 * 2026-10-06-landing-historia-de-un-turno.md.
 *
 * Dos versiones con el mismo contenido: la estática (cuadros apilados) sale en
 * el HTML del servidor y es la que ven los buscadores, quien no tiene
 * JavaScript y quien pidió reducir el movimiento; la animada se arma después
 * de montar (`useEnhanced`).
 */
export default function LandingStory() {
  const enhanced = useEnhanced();

  useEffect(() => () => setReloj(null), []);

  return (
    <StoryContext.Provider value={{ enhanced }}>
      {/* `data-theme="light"`: la landing es siempre clara (la noche, el ámbar
          y el celeste son tramos de la historia, no un tema). globals.css
          redeclara los tokens claros para este subárbol. `data-palette`
          prende la paleta celeste en previsualización (Julieta, 2026-10-09);
          cuando se apruebe pasa a `:root` y este atributo se va.
          `overflow-x-clip` y no `hidden`: `hidden` rompería los escenarios
          `sticky`. */}
      <div
        data-landing
        data-theme="light"
        data-palette="celeste"
        className="overflow-x-clip bg-background text-ink"
      >
        <LandingHeader heroCtaId={HERO_CTA_ID} reloj={enhanced} />
        {enhanced ? <ActoNoche /> : <ActoNocheStatic />}
        <Silencio />
        {enhanced ? <ActoPedido /> : <ActoPedidoStatic />}
        <Corte />
        {enhanced ? <ActoOido /> : <ActoOidoStatic />}
        <BandaOido />
        {enhanced ? <ActoLlegada /> : <ActoLlegadaStatic />}
        <Confianza />
        <Resultado />
        <Carta />
        <LandingFooter />
      </div>
    </StoryContext.Provider>
  );
}
