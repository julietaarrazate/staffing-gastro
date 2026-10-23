import Image from "next/image";
import Link from "next/link";
import { BARRIO, DISTANCIA_M, LOCAL } from "./fixtures";

/**
 * La sección de quien trabaja, con su ancla (`#trabajar`, el link del
 * encabezado). Desde el 2026-10-18 es el título, una oferta como la ve el
 * trabajador y un solo botón (Julieta: "mucho botón ámbar junto y cosas
 * encimadas"). Lo que antes iba en lista (pago directo, sin cobro al
 * trabajador) está en las preguntas frecuentes. La foto es de prueba (ver
 * HeroRueda.tsx).
 */
export default function ParaTrabajar() {
  return (
    <section
      id="trabajar"
      aria-labelledby="trabajar-titulo"
      data-tone="light"
      className="landing-sec landing-sec-dos scroll-mt-[var(--lht)]"
    >
      <h2 id="trabajar-titulo" className="landing-h2">
        Turnos cerca tuyo, cuando quieras
      </h2>
      <div className="landing-sec-cosa w-full max-w-[360px] text-left">
        <div aria-hidden className="landing-tarjeta overflow-hidden bg-card">
          <div className="relative h-32 sm:h-40">
            <Image src="/landing/mozo1.webp" alt="" fill sizes="360px" className="landing-foto object-cover" />
            <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 font-mono text-[11px] font-medium tracking-[0.04em] text-ink">A {DISTANCIA_M} m</span>
          </div>
          <div className="p-5">
            <p className="text-sm text-ink-mute">
              {LOCAL} · {BARRIO}
            </p>
            <p className="font-display text-xl font-bold tracking-[-0.02em] text-ink">Mozo/a</p>
            <p className="mt-1.5 flex items-baseline gap-1.5">
              <b className="font-display text-2xl tracking-[-0.03em] text-ink">$70.000</b>
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
    </section>
  );
}
