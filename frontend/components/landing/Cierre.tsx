import Link from "next/link";

/** El último empujón, en noche, pegado al pie. */
export default function Cierre() {
  return (
    <section
      id="cierre"
      aria-labelledby="cierre-titulo"
      data-tone="night"
      className="bg-night px-4 pb-6 pt-20 text-white sm:px-6 lg:px-12 lg:pt-28"
    >
      <h2
        id="cierre-titulo"
        className="max-w-[18ch] font-display text-poster font-semibold tracking-[-0.015em] text-white [text-wrap:balance]"
      >
        La próxima vez que falte alguien, cubrilo con Oído
      </h2>
      <div className="mt-9 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <Link
          href="/register?rol=comercio"
          data-cta="cierre"
          className="inline-flex h-14 w-full items-center justify-center rounded-[var(--radius-btn)] bg-primary px-8 text-lg font-semibold text-night shadow-[var(--shadow-primary)] transition duration-200 active:scale-[0.96] hover:brightness-[1.04] sm:w-auto"
        >
          Publicar mi primer turno gratis
        </Link>
        <Link
          href="/register?rol=trabajador"
          data-cta="cierre-trabajo"
          className="inline-flex min-h-11 items-center text-body-strong font-semibold text-manteca underline decoration-manteca/50 decoration-2 underline-offset-4 hover:text-white"
        >
          Quiero trabajar →
        </Link>
      </div>
    </section>
  );
}
