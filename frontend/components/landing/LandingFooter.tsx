import Link from "next/link";
import { useId } from "react";
import { Degrades, Letras, Sol } from "./Filete";

/**
 * El final, como el cierre de coofounder: arriba, sobre blanco, los links y
 * la firma; abajo, un domo de cielo que sube desde el borde de la página
 * (`.landing-firma`) con la palabra «oído» fileteada, grande y cortada por el
 * borde, y el Sol de Mayo saliendo detrás.
 *
 * 2026-10-30 (Julieta: "es abismal lo mal que se ve al lado de coofounder"):
 * el cielo era una franja lineal que arrancaba de golpe debajo de los links,
 * y el brillo del sol, más grande que el dibujo, quedaba recortado por el
 * borde del SVG en un rectángulo más claro. Ahora el degradado es un domo
 * radial (CSS) y el brillo se apaga antes del borde; la palabra va sin la
 * sombra beige y con menos relieve, que a este tamaño la volvían pesada.
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
        <svg aria-hidden viewBox="0 0 1000 340">
          <Degrades id={id} />
          <defs>
            <radialGradient id={`${id}-brillo`} cx=".5" cy=".5" r=".5">
              <stop offset="0" stopColor="#ffd77a" stopOpacity=".7" />
              <stop offset=".5" stopColor="#ffe9b0" stopOpacity=".3" />
              <stop offset="1" stopColor="#ffe9b0" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx={500} cy={175} r={170} fill={`url(#${id}-brillo)`} />
          <Sol cx={500} cy={175} r={88} id={id} />
          <Letras x={500} y={440} tam={380} texto="oído" id={`${id}-p`} anchor="middle" e={1.3} sombra={false} />
        </svg>
      </div>
    </footer>
  );
}
