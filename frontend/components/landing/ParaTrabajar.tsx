import Image from "next/image";
import Link from "next/link";
import { BARRIO, DISTANCIA_M, LOCAL } from "./fixtures";

/**
 * La sección de quien trabaja, con su ancla (`#trabajar`, el link del
 * encabezado). Desde el 2026-10-18 es el título, una oferta como la ve el
 * trabajador y un solo botón (Julieta: "mucho botón ámbar junto y cosas
 * encimadas"). Lo que antes iba en lista (pago directo, sin cobro al
 * trabajador) está en las preguntas frecuentes. La foto es de prueba (ver
 * HeroRueda.tsx). Desde el 2026-11-18 la oferta va apoyada y apenas torcida,
 * con el relieve del filete. El puesto va en Inter: en brocha la barra de
 * «Mozo/a» se leía como una letra, y la brocha es sólo para el inicio, el
 * cierre y la carta.
 */
export default function ParaTrabajar() {
  return (
    <section id="trabajar" aria-labelledby="trabajar-titulo" data-tone="night" className="landing-noche scroll-mt-[var(--lht)]">
      {/* La noche azul de la app, en un panel (2026-11-13): marca que acá se
          le habla a quien trabaja, y es cuando se trabaja. */}
      <div className="landing-sec landing-sec-dos">
        <h2 id="trabajar-titulo" className="landing-h2">
          Turnos cerca tuyo, cuando quieras
        </h2>
        <div className="landing-sec-cosa w-full max-w-[360px] text-left">
          <div aria-hidden className="landing-tarjeta overflow-hidden bg-card">
            <div className="relative h-32 sm:h-40">
              <Image src="/landing/mozo1.webp" alt="" fill sizes="360px" className="landing-foto object-cover" />
              <span className="absolute left-3 top-3 rounded-[var(--radius-chip)] bg-white px-2 py-1 text-label font-semibold uppercase tracking-[0.06em] text-ink">A {DISTANCIA_M} m</span>
            </div>
            <div className="p-5">
              <p className="text-sm text-ink-mute">
                {LOCAL} · {BARRIO}
              </p>
              <p className="mt-0.5 text-xl font-bold tracking-[-0.02em] text-ink">Mozo/a</p>
              <p className="mt-1.5 flex items-baseline gap-1.5">
                <b className="text-2xl font-bold tracking-[-0.02em] tabular-nums text-ink">$70.000</b>
                <span className="text-sm text-ink-soft">$14.000 por hora</span>
              </p>
              <p className="mt-1 text-sm text-ink-soft">Hoy · 21:00 – 02:00</p>
            </div>
          </div>
        </div>
        <div className="landing-sec-accion">
          <Link href="/register?rol=trabajador" data-cta="trabajar" className="landing-btn landing-btn-primario">
            Crear mi perfil gratis <span aria-hidden className="landing-btn-flecha">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
