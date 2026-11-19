import Link from "next/link";

/** El último empujón, igual que el inicio: el título y los dos caminos.
 *  Desde el 2026-10-23 es corto y se apoya en el cielo del final. El título
 *  va en brocha, como el del inicio (2026-11-18). */
export default function Cierre() {
  return (
    <section id="cierre" aria-labelledby="cierre-titulo" data-tone="light" className="landing-sec landing-cierre">
      <h2 id="cierre-titulo" className="landing-cartel landing-cartel-cierre">
        ¿Te falta alguien hoy?
      </h2>
      <div className="landing-par mt-8">
        <Link href="/register?rol=comercio" data-cta="cierre" className="landing-btn landing-btn-primario">
          Necesito personal <span aria-hidden className="landing-btn-flecha">→</span>
        </Link>
        <Link href="/register?rol=trabajador" data-cta="cierre-trabajo" className="landing-btn landing-btn-borde">
          Quiero trabajar <span aria-hidden className="landing-btn-flecha">→</span>
        </Link>
      </div>
    </section>
  );
}
