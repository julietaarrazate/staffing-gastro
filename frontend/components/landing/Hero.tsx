import Link from "next/link";
import RelojDelTurno from "./RelojDelTurno";
import { ToastLine } from "./replicas";

export const HERO_CTA_ID = "hero-ctas";

/**
 * Primera pantalla: el problema y la promesa en el título, y los dos caminos
 * (el del comercio como botón, el del trabajador como link explícito). Sin
 * eyebrow ni bajada: Julieta (2026-10-12) los sacó por repetir lo mismo; qué
 * hace Oído lo cuentan los tres pasos de abajo. Al lado, el problema y
 * la solución en una imagen quieta: Martín avisa a las 20:46 que no llega y a
 * las 20:54 el turno está cubierto. Auditoría de la landing, 2026-10-12.
 */
export default function Hero() {
  return (
    <section
      aria-labelledby="hero-titulo"
      data-tone="light"
      className="lg:grid lg:min-h-[calc(100svh-var(--lht))] lg:grid-cols-12"
    >
      <div className="px-4 pb-10 pt-8 sm:px-6 lg:col-span-7 lg:flex lg:flex-col lg:justify-center lg:px-12 lg:py-16">
        <h1
          id="hero-titulo"
          className="font-display text-[clamp(2.5rem,10vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.015em] text-ink [text-wrap:balance]"
        >
          <span className="font-medium text-ink-soft">¿Faltó alguien de tu equipo?</span>{" "}
          <span className="block">Cubrí el turno en minutos</span>
        </h1>
        <div id={HERO_CTA_ID} className="mt-9 flex flex-col items-start gap-4">
          <Link
            href="/register?rol=comercio"
            data-cta="hero"
            className="inline-flex h-14 w-full items-center justify-center rounded-[var(--radius-btn)] bg-primary px-8 text-lg font-semibold text-night shadow-[var(--shadow-primary)] transition duration-200 active:scale-[0.96] hover:brightness-[1.04] sm:w-auto"
          >
            Publicar un turno gratis
          </Link>
          <p className="font-mono text-caption font-medium uppercase tracking-[0.12em] text-ink-mute">
            Gratis para empezar · Sin comisión por turno
          </p>
          <Link
            href="/register?rol=trabajador"
            data-cta="hero-trabajo"
            className="mt-2 inline-flex min-h-11 items-center text-body-strong font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4 transition-colors duration-200 hover:decoration-secondary-text"
          >
            ¿Trabajás en gastronomía? Encontrá turnos cerca tuyo →
          </Link>
        </div>
      </div>

      <div
        data-tone="night"
        aria-label="Ejemplo: un viernes a las 20:46 Martín, el mozo, avisa que no llega. A las 20:54 Lucía confirmó y el turno está cubierto."
        role="img"
        className="flex flex-col items-start gap-5 bg-night px-4 py-10 sm:px-6 lg:col-span-5 lg:justify-center lg:px-10"
      >
        <div aria-hidden className="flex w-full max-w-[340px] flex-col items-start gap-5 lg:mx-auto">
          <p className="font-mono text-caption uppercase tracking-[0.12em] text-manteca">Viernes · 20:46</p>
          <div className="landing-bubble w-full rounded-[22px_22px_22px_6px] bg-[var(--burbuja)] px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
            <p className="font-mono text-caption uppercase tracking-[0.12em] text-[var(--burbuja-tinta)]">Martín · mozo</p>
            <p className="mt-1.5 text-2xl leading-tight text-white">Perdón, hoy no llego.</p>
            <p className="mt-1 text-right font-mono text-metadata tracking-[0.05em] text-[var(--burbuja-tenue)]">20:46</p>
          </div>
          <RelojDelTurno at="sinCubrir" className="landing-hero-later ring-1 ring-white/12" style={{ ["--d" as string]: "0.9s" }} />
          <span style={{ ["--d" as string]: "1.5s" }} className="landing-hero-line ml-5 h-8 w-px border-l-2 border-dotted border-white/30" />
          <RelojDelTurno at="cubierto" className="landing-hero-later" style={{ ["--d" as string]: "2.1s" }} />
          <ToastLine className="landing-hero-later" style={{ ["--d" as string]: "2.6s" }}>Lucía confirmó tu turno de las 21</ToastLine>
        </div>
      </div>
    </section>
  );
}
