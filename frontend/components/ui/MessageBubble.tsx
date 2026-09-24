import type { ReactNode } from "react";

/**
 * Burbuja de mensaje: una sola para el chat de un turno y para el ticket de
 * soporte (auditoría visual 2026-09-24, fase L). Antes eran dos diseños para
 * el mismo patrón: el chat con lo propio en ámbar sólido y el ticket con un
 * tinte translúcido, otro radio y otro padding.
 *
 * Lo propio va en un TINTE ámbar y no en ámbar sólido: el ámbar sólido es de
 * la acción ("Enviar"), y un hilo largo de burbujas llenas ponía decenas de
 * ámbares en pantalla (color-system.md, "un acento por contexto"). La
 * posición (derecha/izquierda) y la cola ya dicen de quién es cada una.
 */
export default function MessageBubble({
  mine,
  author,
  meta,
  children,
}: {
  mine: boolean;
  /** Rótulo arriba del texto ("Vos", "Soporte"). En el chat no hace falta:
   *  son dos personas y el encabezado ya dice quién es la otra. */
  author?: string;
  /** Hora, confirmación de lectura: va abajo a la derecha, en chico. */
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-body text-ink ${
          mine ? "rounded-br-md bg-primary/15" : "rounded-bl-md bg-card ring-1 ring-line"
        }`}
      >
        {author && <p className="mb-0.5 text-label font-semibold text-ink/50">{author}</p>}
        <div className="whitespace-pre-wrap break-words">{children}</div>
        {meta && (
          <p className="mt-1 flex items-center justify-end gap-1 text-label text-ink/45">{meta}</p>
        )}
      </div>
    </div>
  );
}
