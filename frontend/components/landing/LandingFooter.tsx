import Link from "next/link";
import Filete from "./Filete";
import BancoDeNubes from "./Nubes";

/**
 * El final. Cierra el panel de cielo que empieza en «¿Te falta alguien hoy?»
 * (`.landing-cierre` arriba, `.landing-firma` abajo): la palabra «oído»
 * fileteada, **entera** y con sus adornos finos (la misma `firma` de la
 * pantalla de bienvenida), apoyada sobre un banco de nubes como el del
 * inicio; y sobre las nubes, una sola línea con lo legal y el ©.
 *
 * 2026-11-18, segunda vuelta (Julieta: "queda raro ese oído cortado y abajo
 * una tarjeta llena de cosas, quizás con términos y privacidad es
 * suficiente"). Antes la palabra iba gigante y cortada por el borde, y
 * debajo había un panel aparte con seis links (azul hondo en la primera
 * vuelta del híbrido, blanco antes). Los otros caminos (Precios, Para
 * trabajar, Preguntas, Ingresar) ya están en el encabezado y en la página.
 * El Sol de Mayo se fue en la primera vuelta; sigue en `Filete.tsx`.
 */
export default function LandingFooter() {
  return (
    <footer className="landing-firma">
      <BancoDeNubes id="landing-final" className="landing-firma-nubes" />
      <Filete palabra="oído" tam="firma" className="landing-firma-palabra" />
      <div className="landing-pie-fila">
        <nav aria-label="Pie" className="flex flex-wrap justify-center gap-x-5 gap-y-1">
          <Link href="/terminos">Términos y condiciones</Link>
          <Link href="/privacidad">Privacidad</Link>
        </nav>
        {/* La marca, el rubro y la ciudad: lo que un buscador usa para ubicar
            la página (Julieta, 2026-11-18). El nombre de la titular está en
            Términos y Privacidad (`lib/legal.ts`), no acá. */}
        {/* En el celular no entra en un renglón: se parte en el punto, que
            ahí se esconde, y no en medio de la frase. */}
        <p className="flex flex-col items-center gap-x-1.5 min-[400px]:flex-row">
          <span>© 2026 Oído</span>
          <span aria-hidden className="hidden min-[400px]:inline">
            ·
          </span>
          <span>Personal gastronómico en Buenos Aires</span>
        </p>
      </div>
    </footer>
  );
}
