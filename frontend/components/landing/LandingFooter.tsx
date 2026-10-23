import Link from "next/link";
import { useId } from "react";
import { Degrades, Letras, Sol } from "./Filete";

/**
 * El final (2026-10-23), como el cierre de coofounder: arriba los links y la
 * firma; abajo, al borde de la página, la palabra «oído» grande y fileteada
 * con el Sol de Mayo saliendo detrás, que le da el color al cielo. La palabra
 * queda apenas cortada por el borde. Links: Términos y condiciones y
 * Privacidad, cada uno por su lado.
 */
export default function LandingFooter() {
  const id = `pie-${useId().replace(/:/g, "")}`;
  return (
    <footer className="landing-pie">
      <div className="landing-pie-fila">
        <nav aria-label="Pie" className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-sm lg:justify-start">
          <Link href="/terminos">Términos y condiciones</Link>
          <Link href="/privacidad">Privacidad</Link>
        </nav>
        <p className="text-xs">© 2026 Julieta Arrazate — Oído. Hecho en Argentina.</p>
      </div>
      <div className="landing-firma">
        <svg aria-hidden viewBox="0 0 1000 400">
          <Degrades id={id} />
          <defs>
            <radialGradient id={`${id}-brillo`} cx=".5" cy=".55" r=".5">
              <stop offset="0" stopColor="#ffd77a" stopOpacity=".75" />
              <stop offset=".45" stopColor="#ffe9b0" stopOpacity=".35" />
              <stop offset="1" stopColor="#ffe9b0" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx={500} cy={190} r={330} fill={`url(#${id}-brillo)`} />
          <Sol cx={500} cy={190} r={95} id={id} />
          <Letras x={500} y={425} tam={360} texto="oído" id={`${id}-p`} anchor="middle" e={2} />
        </svg>
      </div>
    </footer>
  );
}
