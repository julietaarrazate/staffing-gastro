"use client";

import Link from "next/link";
import IconChip, { type IconChipTone } from "@/components/ui/IconChip";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

/**
 * Piezas compartidas por las tres pantallas del perfil (`/profile`,
 * `/profile/edit`, `/profile/settings`). Antes vivían adentro de
 * `app/profile/page.tsx`, que era la única pantalla; al separar la edición y
 * los ajustes (sobrecarga visual, 2026-09-30) las tres las necesitan.
 */

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 text-xs font-semibold font-mono uppercase tracking-wide text-ink/40">
      {children}
    </p>
  );
}

const ROW_CLASS =
  "flex w-full items-center gap-3 px-4 py-3.5 text-left transition first:rounded-t-[var(--radius-card)] last:rounded-b-[var(--radius-card)] hover:bg-surface active:bg-surface";

/**
 * Fila de menú tocable. Con `href` es un link (lleva a otra pantalla); con
 * `onClick` es un botón (hace algo acá, como cerrar sesión).
 */
export function Row({
  icon,
  tone,
  children,
  href,
  onClick,
}: {
  icon: React.ReactNode;
  tone: IconChipTone;
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <IconChip tone={tone}>{icon}</IconChip>
      <span className="flex-1 text-sm font-medium text-ink">{children}</span>
      {/* Affordance de fila tocable (sensación de app nativa): sin esto las
          filas parecían texto suelto y no se leía que llevaban a otro lado. */}
      <ChevronRightIcon size={17} className="shrink-0 text-ink/25" />
    </>
  );
  if (href) {
    return (
      <Link href={href} className={ROW_CLASS}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={ROW_CLASS}>
      {content}
    </button>
  );
}

export function RowGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-line rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-soft)] ring-1 ring-line">
      {children}
    </div>
  );
}

/** Encabezado de las subpantallas: volver al perfil + título. */
export function SubpageHeader({ title }: { title: string }) {
  return (
    <>
      <Link
        href="/profile"
        className="inline-flex items-center gap-1 text-sm font-semibold text-ink/50 hover:text-ink"
      >
        <ChevronLeftIcon size={16} /> Perfil
      </Link>
      <h1 className="mt-3 font-display text-h1 font-semibold tracking-tight text-ink">{title}</h1>
    </>
  );
}
