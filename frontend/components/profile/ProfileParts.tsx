"use client";

import Link from "next/link";
import { formatDecimal1, plural } from "@/lib/format";
import { formatRating, hasRating } from "@/lib/reputation";
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

/* ---- La dirección suave (ADR-0028): las usan el Perfil de quien trabaja y el
   del comercio, sus subpantallas y las fichas públicas (`FichaSuave`). ---- */

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

/** Un dato en su fila: el nombre a la izquierda, el valor a la derecha. Con
 * `largo` el valor es texto libre (un horario, una dirección, los idiomas):
 * ocupa lo que queda y pasa a otro renglón en vez de empujar el nombre. */
export function DatoSuave({
  nombre,
  valor,
  detalle,
  largo = false,
}: {
  nombre: string;
  valor: string;
  detalle?: string;
  largo?: boolean;
}) {
  return (
    // `flex-wrap`: con la letra grande (200 %) el valor baja a su renglón en
    // vez de pisar al nombre; con la de siempre las dos cosas caben y no se nota.
    <div className="flex min-h-[54px] flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5">
      <dt className={`${largo ? "shrink-0" : "min-w-0 flex-[1_1_6rem]"} text-fila font-semibold text-ink`}>
        {nombre}
        {detalle && <span className="block text-caption font-normal text-ink-soft">{detalle}</span>}
      </dt>
      <dd
        className={
          largo
            ? "ml-auto min-w-0 flex-[1_1_5rem] break-words text-right text-fila font-semibold text-ink"
            : "ml-auto shrink-0 text-base font-extrabold tabular-nums text-ink"
        }
      >
        {valor}
      </dd>
    </div>
  );
}

/**
 * La reputación en grande, que se ve igual en el perfil propio y en la ficha
 * pública: la nota como número enorme con sus estrellas y, al lado, cuántos
 * turnos y un dato más (puntualidad o pago a tiempo); sin nota, la cantidad de
 * turnos ocupa el lugar del número. Sin historia no dibuja el número sino
 * `vacio`. Nunca muestra ceros ni estrellas vacías.
 */
export function ReputacionGrande({
  rating,
  cantidad,
  singular,
  varios,
  detalle,
  conHistoria,
  vacio = null,
  mostrarCantidad = true,
}: {
  rating: number;
  /** Turnos hechos o publicados. */
  cantidad: number;
  singular: string;
  varios: string;
  /** «puntualidad 95%», «pago a tiempo 90%»: sólo si hay datos. */
  detalle?: string | null;
  conHistoria: boolean;
  vacio?: React.ReactNode;
  /** false: con nota pero sin turnos (sólo la ficha) no se escribe «0 turnos». */
  mostrarCantidad?: boolean;
}) {
  if (!conHistoria) return <>{vacio}</>;
  if (hasRating(rating)) {
    const linea = [mostrarCantidad ? plural(cantidad, singular, varios) : null, detalle]
      .filter(Boolean)
      .join(" · ");
    return (
      <div className="flex flex-wrap items-end gap-x-3.5 gap-y-1">
        <p className="perfil-numero">
          <span className="sr-only">Calificación: </span>
          {formatRating(rating)}
        </p>
        <div className="min-w-0 flex-[1_1_9rem] pb-1">
          <Estrellas valor={rating} size={17} />
          {linea && <p className="mt-1 text-sm text-ink-soft">{linea}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-end gap-x-3.5 gap-y-1">
      <p className="perfil-numero">{cantidad}</p>
      <div className="min-w-0 flex-[1_1_9rem] pb-1">
        <p className="text-fila font-semibold text-ink">{cantidad === 1 ? singular : varios}</p>
        {detalle && <p className="mt-0.5 text-sm text-ink-soft">{detalle}</p>}
      </div>
    </div>
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
  lectura = false,
  volver = VOLVER_AL_PERFIL,
  children,
}: {
  title: string;
  /** Una pantalla de lectura (un ticket de soporte): en la compu mide
   *  `--app-reading`, el ancho de lectura del sistema. */
  lectura?: boolean;
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
        ancha ? "md:max-w-2xl lg:max-w-5xl" : lectura ? "md:max-w-[var(--app-reading)]" : "md:max-w-xl"
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
