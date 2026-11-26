import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import IndiceLegal from "@/components/legal/IndiceLegal";
import { LEGAL_LAST_UPDATED } from "@/lib/legal";

/**
 * La cáscara de `/terminos` y `/privacidad` con el diseño de la app (dirección
 * suave, ADR-0028): el cielo corto con la vuelta y el título, y el texto en
 * la hoja; en la compu, con el índice lateral fijo.
 *
 * Hasta el 2026-11-26 las dos páginas tenían el aspecto de antes (fondo
 * papel, una tarjeta y el título con la letra de la landing). Se llegaba a
 * ellas desde la landing; ahora el cartel «Actualizamos los Términos» manda
 * ahí desde adentro de la app y el salto de estilo se notaba (Julieta). El
 * texto no cambia.
 */
export default function PaginaLegal({
  titulo,
  otra,
  children,
}: {
  titulo: string;
  /** El link del pie a la otra página legal. */
  otra: { href: string; pregunta: string; nombre: string };
  children: ReactNode;
}) {
  // 66,5 rem en la compu: el índice (13) + el aire (2,5) + el texto a su ancho
  // de lectura (46 rem = 736 px) + los márgenes de la hoja y del marco (5).
  return (
    <div className="estilo-suave mx-auto flex min-h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] max-w-md flex-col md:min-h-[calc(100dvh-var(--chrome-top))] md:max-w-[var(--app-reading)] md:px-4 md:pt-4 lg:max-w-[66.5rem]">
      <div className="app-cielo cielo-limpio px-4 pb-12 pt-4 md:rounded-t-[28px] md:px-6 md:pt-5">
        <Link href="/" aria-label="Volver al inicio" className="boton-vidrio h-11 w-11">
          <ChevronLeftIcon size={18} />
        </Link>
        <h1 className="titulo-pantalla mt-4 break-words">{titulo}</h1>
        <p className="mt-1 text-sm font-medium">{LEGAL_LAST_UPDATED}</p>
      </div>
      <div className="hoja -mt-7 flex-1 px-4 pb-8 pt-6 md:px-6">
        <div className="lg:grid lg:grid-cols-[13rem_minmax(0,46rem)] lg:gap-10">
          <IndiceLegal />
          <div id="cuerpo-legal" className="lg:col-start-2">
            {children}
            <p className="mt-10 text-sm text-ink-soft">
              {otra.pregunta}{" "}
              <Link href={otra.href} className="font-semibold text-primary-text underline underline-offset-2">
                {otra.nombre}
              </Link>
              ?
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
