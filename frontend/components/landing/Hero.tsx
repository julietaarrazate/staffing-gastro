import Link from "next/link";
import HeroNoche from "./HeroNoche";

export const HERO_CTA_ID = "hero-ctas";

/**
 * Primera pantalla: el problema y la promesa en el título, y los dos caminos
 * (el del comercio como botón, el del trabajador como link explícito). Sin
 * eyebrow ni bajada: Julieta (2026-10-12) los sacó por repetir lo mismo; qué
 * hace Oído lo cuentan los tres pasos de abajo. Al lado, el problema y
 * la solución animados (HeroNoche): Martín avisa a las 20:46 que no llega y a
 * las 20:54 el turno está cubierto.
 */
export default function Hero() {
  return (
    <section
      aria-labelledby="hero-titulo"
      data-tone="light"
      className="lg:grid lg:min-h-[calc(100svh-var(--lht))] lg:grid-cols-12"
    >
      {/* El brillo ámbar de arriba, el mismo de la pantalla de crear cuenta
          (`--wash`, globals.css). */}
      <div
        style={{ background: "var(--wash) no-repeat, var(--background)" }}
        className="px-4 pb-10 pt-8 sm:px-6 lg:col-span-7 lg:flex lg:flex-col lg:justify-center lg:px-12 lg:py-16"
      >
        <h1
          id="hero-titulo"
          className="font-display text-[clamp(2.5rem,10vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.015em] text-ink [text-wrap:balance]"
        >
          <span className="font-medium text-ink-soft">¿Faltó alguien de tu equipo?</span>{" "}
          <span className="block">Cubrí el turno en minutos</span>
        </h1>
        <div id={HERO_CTA_ID} className="mt-9 flex w-full gap-3 sm:w-auto">
          <Link
            href="/register?rol=comercio"
            data-cta="hero"
            className="inline-flex h-14 flex-1 items-center justify-center whitespace-nowrap rounded-[var(--radius-btn)] bg-primary px-5 text-lg font-semibold text-night shadow-[var(--shadow-primary)] transition duration-200 active:scale-[0.96] hover:brightness-[1.04] sm:flex-none sm:px-8"
          >
            Necesito personal
          </Link>
          <Link
            href="/register?rol=trabajador"
            data-cta="hero-trabajo"
            className="inline-flex h-14 flex-1 items-center justify-center whitespace-nowrap rounded-[var(--radius-btn)] px-5 text-lg font-semibold text-ink ring-[1.5px] ring-ink/70 ring-inset transition-colors duration-200 hover:bg-surface active:scale-[0.96] sm:flex-none sm:px-8"
          >
            Quiero trabajar
          </Link>
        </div>
      </div>

      <div
        data-tone="night"
        aria-label="Ejemplo: un viernes a las 20:46 Martín, el mozo, avisa que no llega. A las 20:54 Lucía confirmó y el turno está cubierto."
        role="img"
        // En el celular ocupa la pantalla entera (menos el encabezado) para que
        // la escena se vea completa, de principio a fin.
        className="flex min-h-[calc(100svh-var(--lh))] flex-col items-start justify-center gap-5 bg-night px-4 py-10 sm:px-6 lg:min-h-0 lg:col-span-5 lg:px-10"
      >
        <HeroNoche />
      </div>
    </section>
  );
}
