import { ChevronDownIcon } from "@/components/icons";
import { PREGUNTAS } from "./preguntas";

/** Preguntas frecuentes con `<details>`: se abren sin JavaScript y el texto
 *  está en el HTML aunque estén cerradas. */
export default function Preguntas() {
  return (
    <section
      id="preguntas"
      aria-labelledby="preguntas-titulo"
      data-tone="light"
      className="scroll-mt-[var(--lht)] px-4 py-20 sm:px-6 lg:grid lg:grid-cols-12 lg:gap-12 lg:px-12 lg:py-28"
    >
      <h2
        id="preguntas-titulo"
        className="font-display text-poster font-semibold tracking-[-0.015em] text-ink [text-wrap:balance] lg:col-span-4"
      >
        Preguntas frecuentes
      </h2>
      <div className="mt-10 divide-y divide-line border-y border-line lg:col-span-8 lg:mt-0">
        {PREGUNTAS.map((p) => (
          <details key={p.pregunta} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-semibold text-ink [&::-webkit-details-marker]:hidden">
              {p.pregunta}
              <ChevronDownIcon
                size={20}
                aria-hidden
                className="shrink-0 text-ink-mute transition-transform duration-300 group-open:rotate-180"
              />
            </summary>
            <p className="max-w-[60ch] pb-5 text-body text-ink-soft lg:text-lg">{p.respuesta}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
