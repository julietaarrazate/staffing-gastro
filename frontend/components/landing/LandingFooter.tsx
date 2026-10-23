import Link from "next/link";
import Filete from "./Filete";

/** El final: "oído" grande y fileteado sobre el cielo y, debajo, en el mismo celeste,
 *  los links y la firma (2026-10-18). Desde el 2026-10-23 sólo Ingresar y lo
 *  legal: lo demás ya está arriba. */
export default function LandingFooter() {
  return (
    <footer className="landing-pie">
      <div className="landing-firma">
        <Filete palabra="oído" tam="firma" />
      </div>
      <div className="landing-pie-fila">
        <nav aria-label="Pie" className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-sm lg:justify-start">
          <Link href="/login">Ingresar</Link>
          <Link href="/terminos">Términos</Link>
          <Link href="/privacidad">Privacidad</Link>
        </nav>
        <p className="text-xs">© 2026 Julieta Arrazate — Oído. Hecho en Argentina.</p>
      </div>
    </footer>
  );
}
