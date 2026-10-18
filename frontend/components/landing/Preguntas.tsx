import { ChevronDownIcon } from "@/components/icons";
import InstalarPasos from "./InstalarPasos";
import { PREGUNTA_INSTALAR, PREGUNTAS } from "./preguntas";

/** Preguntas frecuentes con `<details>`: se abren sin JavaScript y el texto
 *  está en el HTML aunque estén cerradas. Desde el 2026-10-18, centradas en
 *  el celular y con el título al costado en pantallas anchas, como Confianza
 *  y Para trabajar. */
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
      <div className="landing-sec-cosa w-full max-w-[760px] divide-y divide-line border-y border-line text-left">
        {PREGUNTAS.map((p) => (
          <details key={p.pregunta} id={p.pregunta === PREGUNTA_INSTALAR ? "instalar" : undefined} className="group scroll-mt-[var(--lht)]">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-5 font-display text-[clamp(1.125rem,1.8vw,1.375rem)] font-semibold tracking-[-0.02em] text-ink [&::-webkit-details-marker]:hidden">
              {p.pregunta}
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-ink transition duration-300 group-open:rotate-180 group-open:bg-primary"
              >
                <ChevronDownIcon size={18} />
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
