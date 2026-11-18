import Link from "next/link";
import { useId } from "react";
import { Degrades, Letras } from "./Filete";

/**
 * El final: la palabra «oído» fileteada, grande y cortada por el borde, cierra
 * el panel de cielo que empieza en «¿Te falta alguien hoy?»
 * (`.landing-cierre` arriba, `.landing-firma` abajo); debajo, los caminos de
 * la página y el © en un panel azul hondo.
 *
 * 2026-11-18 (el híbrido, docs/design-system/direccion-relieve.md): se fue
 * el Sol de Mayo que salía detrás de la palabra, con su brillo y sus rayos
 * girando, y el pie pasó de blanco a azul hondo. La palabra sigue sin la
 * sombra beige y con menos relieve, que a este tamaño la volvían pesada
 * (2026-10-30). El `Sol` sigue en `Filete.tsx` para las otras piezas de la
 * marca.
 */
export default function LandingFooter() {
  const id = `pie-${useId().replace(/:/g, "")}`;
  return (
    <footer className="landing-pie">
      <div className="landing-firma">
        <svg aria-hidden viewBox="0 130 1000 210">
          <Degrades id={id} />
          <Letras x={500} y={440} tam={380} texto="oído" id={`${id}-p`} anchor="middle" e={1.3} sombra={false} />
        </svg>
      </div>
      <div className="landing-pie-fila">
        {/* Los caminos de la página además de los legales (2026-10-30):
            ayudan a moverse y a que Google entienda las secciones. */}
        <nav aria-label="Pie" className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-sm lg:justify-start">
          <Link href="/#precios">Precios</Link>
          <Link href="/#trabajar">Para trabajar</Link>
          <Link href="/#preguntas">Preguntas frecuentes</Link>
          <Link href="/login">Ingresar</Link>
          <Link href="/terminos">Términos y condiciones</Link>
          <Link href="/privacidad">Privacidad</Link>
        </nav>
        <p className="text-xs">© 2026 Julieta Arrazate — Oído. Hecho en Argentina.</p>
      </div>
    </footer>
  );
}
