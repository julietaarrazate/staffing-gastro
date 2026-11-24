"use client";

import { useEffect, useState } from "react";

interface Entrada {
  id: string;
  titulo: string;
}

/**
 * Índice lateral de los documentos largos (/terminos, /privacidad), sólo en
 * compu (`lg:`). Lee los `h2` del contenedor `#cuerpo-legal` en el navegador:
 * no duplica ni toca el texto legal. Resalta la sección que se está leyendo.
 */
export default function IndiceLegal() {
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [activa, setActiva] = useState<string | null>(null);

  useEffect(() => {
    const titulos = Array.from(document.querySelectorAll<HTMLElement>("#cuerpo-legal section > h2"));
    titulos.forEach((h, i) => {
      if (!h.id) h.id = `seccion-${i + 1}`;
    });
    setEntradas(titulos.map((h) => ({ id: h.id, titulo: h.textContent ?? "" })));

    const obs = new IntersectionObserver(
      (items) => {
        const visible = items.filter((i) => i.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiva(visible.target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" },
    );
    titulos.forEach((h) => obs.observe(h));
    return () => obs.disconnect();
  }, []);

  if (entradas.length === 0) return null;

  return (
    <nav aria-label="Índice del documento" className="hidden lg:block lg:pt-6">
      <div className="sticky top-20 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-2">
        <p className="mb-2 font-mono text-xs font-medium uppercase tracking-wide text-ink/50">En este documento</p>
        <ul className="space-y-0.5 border-l border-line">
          {entradas.map((e) => (
            <li key={e.id}>
              <a
                href={`#${e.id}`}
                onClick={() => setActiva(e.id)}
                aria-current={activa === e.id ? "true" : undefined}
                className={`-ml-px block border-l-2 py-1.5 pl-3 text-sm leading-snug transition-colors ${
                  activa === e.id
                    ? "border-primary-text font-semibold text-ink"
                    : "border-transparent text-ink/60 hover:text-ink"
                }`}
              >
                {e.titulo}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
