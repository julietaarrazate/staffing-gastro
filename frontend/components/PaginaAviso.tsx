import Link from "next/link";
import type { ReactNode } from "react";
import { LogoGlyph } from "@/components/Logo";

export type SalidaDeAviso = { label: string; href: string };

const SALIDA_PRINCIPAL =
  "flex min-h-[56px] w-full items-center justify-center rounded-[var(--radius-btn)] bg-primary px-6 text-base font-bold text-night shadow-[var(--shadow-primary)] transition active:scale-[0.98]";
const SALIDA_SECUNDARIA =
  "flex min-h-[48px] w-full items-center justify-center rounded-[var(--radius-btn)] bg-card px-6 text-sm font-semibold text-ink ring-1 ring-line transition active:scale-[0.98]";

/**
 * Pantalla entera para cuando no hay nada que mostrar en esa dirección: la
 * página no existe (`app/not-found.tsx`) o el turno ya no está disponible
 * (`TurnoNoDisponible`). Dice qué pasó en una línea, lo explica en otra y
 * siempre deja una salida.
 *
 * Las salidas son links de verdad (no botones con `router.push`): se pueden
 * abrir en otra pestaña y, en la página que ya viene armada del servidor (una
 * dirección que no existe), andan aunque todavía no haya cargado el
 * JavaScript.
 *
 * Marca: el isotipo sobre la superficie celeste, con la tinta de `on-brand`,
 * y un solo ámbar, el de la salida principal.
 */
export default function PaginaAviso({
  titulo,
  texto,
  principal,
  secundaria,
  children,
}: {
  titulo: string;
  texto: string;
  principal?: SalidaDeAviso;
  secundaria?: SalidaDeAviso;
  /** En lugar de las salidas, mientras todavía no se sabe cuáles van. */
  children?: ReactNode;
}) {
  return (
    <div className="app-container-reading flex min-h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] flex-col items-center justify-center px-6 py-10 text-center">
      <span
        aria-hidden="true"
        className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-secondary"
      >
        <LogoGlyph size={40} color="var(--color-on-brand-label)" />
      </span>
      <h1 className="mt-6 font-display text-h1 font-medium text-ink">{titulo}</h1>
      <p className="mt-2 max-w-sm text-body leading-relaxed text-ink/60">{texto}</p>
      <div className="mt-7 flex w-full max-w-xs flex-col gap-2.5">
        {children}
        {principal && (
          <Link href={principal.href} className={SALIDA_PRINCIPAL}>
            {principal.label}
          </Link>
        )}
        {secundaria && (
          <Link href={secundaria.href} className={SALIDA_SECUNDARIA}>
            {secundaria.label}
          </Link>
        )}
      </div>
    </div>
  );
}
