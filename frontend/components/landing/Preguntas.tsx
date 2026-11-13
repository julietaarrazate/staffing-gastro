import InstalarPasos from "./InstalarPasos";
import { PREGUNTA_INSTALAR, PREGUNTAS } from "./preguntas";

/** Preguntas frecuentes con `<details>`: se abren sin JavaScript y el texto
 *  está en el HTML aunque estén cerradas. Centradas como el resto de la
 *  landing (2026-10-23). */
export default function Preguntas() {
  return (
    <section
      id="preguntas"
      aria-labelledby="preguntas-titulo"
      data-tone="light"
      className="landing-sec landing-sec-dos landing-sec-arriba scroll-mt-[var(--lht)]"
    >
      <h2 id="preguntas-titulo" className="landing-h2">
        Preguntas frecuentes
      </h2>
      <div className="landing-sec-cosa w-full max-w-[640px] divide-y divide-line border-y border-line text-left">
        {PREGUNTAS.map((p) => (
          <details key={p.pregunta} id={p.pregunta === PREGUNTA_INSTALAR ? "instalar" : undefined} className="group scroll-mt-[var(--lht)]">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-[clamp(1.125rem,1.8vw,1.375rem)] font-medium tracking-[-0.02em] text-ink [&::-webkit-details-marker]:hidden">
              {p.pregunta}
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink ring-1 ring-line transition duration-300 group-open:rotate-45 group-open:bg-ink group-open:text-card group-open:ring-ink motion-reduce:transition-none"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </summary>
            <p className="max-w-[60ch] pb-5 text-body text-ink-soft lg:text-lg">{p.respuesta}</p>
            {/* La de instalar suma los pasos de cada celular (y el botón en
                Android). El texto de arriba es el que va en los datos
                estructurados. */}
            {p.pregunta === PREGUNTA_INSTALAR && <InstalarPasos />}
          </details>
        ))}
      </div>
    </section>
  );
}
