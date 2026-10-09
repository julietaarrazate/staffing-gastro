import Link from "next/link";

/**
 * CORTE. Scroll libre entre dos escenas fijadas, como el "mientras tanto" de
 * una película: cambia el punto de vista (del celular de Lucía al local) y
 * suelta el `sticky` para que nunca haya más de dos pantallas y media fijadas
 * seguidas. Es también el lugar del trabajador: justo después de ver cómo le
 * llega un turno a Lucía.
 */
export default function Corte() {
  return (
    <section
      aria-label="Mientras tanto"
      data-tone="light"
      className="flex min-h-[51svh] flex-col justify-center px-4 py-16 sm:px-6 lg:min-h-[61svh] lg:px-12"
    >
      {/* Intertítulo: el único cartel de la página que no es producto. */}
      <p className="font-mono text-label font-medium uppercase tracking-[0.14em] text-ink-mute">20:51</p>
      <h2 className="mt-3 max-w-[14ch] font-display text-headline font-medium tracking-[-0.025em] text-ink [text-wrap:balance]">
        Mientras tanto, en tu bar.
      </h2>
      <p className="mt-4 max-w-[34ch] text-body text-ink-soft lg:text-lg">
        ¿Trabajás en gastronomía? Así te llegan los turnos.{" "}
        <Link
          href="/register?rol=trabajador"
          data-cta="corte"
          className="font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4 transition-colors duration-200 hover:decoration-secondary focus-visible:decoration-secondary"
        >
          Quiero trabajar →
        </Link>
      </p>
    </section>
  );
}
