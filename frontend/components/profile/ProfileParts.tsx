"use client";

import Link from "next/link";
import { formatDecimal1 } from "@/lib/format";
import IconChip, { type IconChipTone } from "@/components/ui/IconChip";
import { ChevronLeftIcon, ChevronRightIcon, StarIcon } from "@/components/icons";

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

/* ---- La dirección suave (ADR-0028): hoy sólo las usa el Perfil de quien
   trabaja (`components/worker/PerfilTrabajador.tsx`). ---- */

/** Un grupo de filas sobre una tecla blanca con sombra difusa (`.perfil-filas`
 * en `globals.css`). Con `as="dl"` agrupa datos; si no, accesos. */
export function FilasSuaves({
  children,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  as?: "div" | "dl";
}) {
  return <Tag className="perfil-filas">{children}</Tag>;
}

const FILA_SUAVE_CLASS =
  "flex min-h-[54px] w-full items-center justify-between gap-3 py-2.5 pl-4 pr-3.5 text-left text-fila font-semibold text-ink";

/** Una fila tocable, sin ícono de color: el texto y la flecha. Con `href` es
 * un link; con `onClick`, un botón. */
export function FilaSuave({
  children,
  href,
  onClick,
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="min-w-0">{children}</span>
      <ChevronRightIcon size={18} className="shrink-0 text-ink-mute" aria-hidden />
    </>
  );
  if (href) {
    return (
      <Link href={href} className={FILA_SUAVE_CLASS}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={FILA_SUAVE_CLASS}>
      {content}
    </button>
  );
}

/** Las cinco estrellas de una nota, en el azul de los links: el ámbar de
 * `StarRating` sumaba un segundo ámbar a la pantalla. Sólo se leen: la nota
 * va en `aria-label`. */
export function Estrellas({ valor, size = 16 }: { valor: number; size?: number }) {
  const llenas = Math.round(valor);
  return (
    <span
      role="img"
      // La nota tal cual, no las estrellas llenas: 4,5 se dibuja con cinco.
      aria-label={`${formatDecimal1(valor).replace(",0", "")} de 5 estrellas`}
      className="flex items-center gap-0.5 text-primary-text"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} size={size} filled={n <= llenas} className={n <= llenas ? "" : "opacity-30"} />
      ))}
    </span>
  );
}

/**
 * La cáscara de una subpantalla del perfil (`/profile/edit`,
 * `/profile/settings`) con la dirección suave (2026-11-20): el cielo corto y
 * liso con la vuelta al perfil en un botón de vidrio y el título en letra
 * normal, y debajo la hoja con el contenido. Reemplaza a `SubpageHeader` en
 * esas dos pantallas.
 */
const VOLVER_AL_PERFIL = { href: "/profile", label: "Volver al perfil" };

export function SubpaginaSuave({
  title,
  bajada,
  ancha = false,
  volver = VOLVER_AL_PERFIL,
  children,
}: {
  title: string;
  /** A dónde lleva la vuelta del cielo; por defecto, al perfil. */
  volver?: { href: string; label: string };
  /** Una línea debajo del título, sobre el cielo. */
  bajada?: string;
  /** Para una pantalla con grilla (Mi plan): en la compu ocupa el ancho de la app. */
  ancha?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`estilo-suave mx-auto flex min-h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] max-w-md flex-col md:min-h-[calc(100dvh-var(--chrome-top))] md:px-4 md:pt-4 ${
        ancha ? "md:max-w-2xl lg:max-w-5xl" : "md:max-w-xl"
      }`}
    >
      <div className="app-cielo cielo-limpio px-4 pb-12 pt-4 md:rounded-t-[28px] md:px-6 md:pt-5">
        <Link href={volver.href} aria-label={volver.label} className="boton-vidrio h-11 w-11">
          <ChevronLeftIcon size={18} />
        </Link>
        <h1 className="titulo-pantalla mt-4 break-words">{title}</h1>
        {bajada && <p className="mt-1 break-words text-sm font-medium">{bajada}</p>}
      </div>
      <div className="hoja -mt-7 flex-1 px-4 pb-8 pt-6 md:px-6">{children}</div>
    </div>
  );
}
