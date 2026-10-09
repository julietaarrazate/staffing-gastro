import Link from "next/link";

/**
 * Después del "¡Oído!", una bocanada de scroll libre sobre el mismo ámbar: el
 * último cuadro de la escena anterior es ámbar puro y esta banda arranca
 * igual, así que el `sticky` se suelta sin que se note. Es el punto de deseo
 * más alto de la página, y el botón va en noche: adentro del ámbar la
 * proporción se invierte (un botón ámbar sobre ámbar no existe).
 */
export default function BandaOido() {
  return (
    <section
      aria-label="La próxima"
      data-tone="amber"
      data-hide-cta=""
      className="bg-primary px-4 pb-24 pt-10 sm:px-6 lg:px-12 lg:pb-32"
    >
      <div>
        <h2 className="font-display text-poster font-semibold tracking-[-0.03em] text-ink [text-wrap:balance]">
          La próxima, pedilo así.
        </h2>
        <p className="mt-3 text-lg text-ink">Crear tu comercio es gratis.</p>
        <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Link
            href="/register?rol=comercio"
            data-cta="post-oido"
            className="inline-flex h-[52px] items-center justify-center rounded-[var(--radius-btn)] bg-night px-7 text-base font-semibold text-white transition duration-200 active:scale-[0.96] hover:brightness-150"
          >
            Necesito personal
          </Link>
          <Link
            href="/register?rol=trabajador"
            data-cta="post-oido-trabajo"
            className="inline-flex h-11 items-center text-base font-semibold text-ink underline decoration-ink/40 decoration-2 underline-offset-4"
          >
            ¿Trabajás en gastronomía? Quiero trabajar →
          </Link>
        </div>
      </div>
    </section>
  );
}
