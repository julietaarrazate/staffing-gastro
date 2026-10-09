"use client";

import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { motion, type MotionValue } from "motion/react";
import { cn } from "@/lib/cn";
import { LogoGlyph, LogoMark } from "@/components/Logo";
import { CheckCircleIcon, StarIcon } from "@/components/icons";
import { Spinner } from "@/components/ui";
import { PEDIDO, PEDIDO_PARTES } from "./fixtures";

/* Réplicas de piezas del producto que la historia necesita "en vivo" (un
 * botón que se aprieta, un mapa que se dibuja) y que los componentes reales no
 * pueden mostrar sin backend, MapLibre o sesión. Copian las clases de los
 * originales; cada una dice de cuál sale. Lo que sí se puede mostrar tal cual
 * (OpportunityCard, CandidateCard, ShiftCard) va real, dentro de un `inert`. */

/** Partes de la frase del pedido, en orden, con su posición en el texto. */
const PARTES = (() => {
  let from = 0;
  return PEDIDO_PARTES.map((p) => {
    const start = PEDIDO.indexOf(p.texto, from);
    from = start + p.texto.length;
    return { ...p, start, end: start + p.texto.length };
  });
})();

/**
 * El cuadro "Describilo y lo completamos" de /shifts/new (app/shifts/new/
 * page.tsx). `chars` es cuánto de la frase está escrito (lo maneja el scroll);
 * `marked` subraya en manteca las tres partes que se convierten en campos.
 */
export const DescribeBox = forwardRef<
  HTMLDivElement,
  {
    chars: number;
    marked: boolean;
    loading: boolean;
    pressed: boolean;
    caret: boolean;
    onComplete?: () => void;
    style?: CSSProperties;
    className?: string;
  }
>(function DescribeBox({ chars, marked, loading, pressed, caret, onComplete, style, className }, ref) {
  const shown = PEDIDO.slice(0, chars);
  const segments: ReactNode[] = [];
  let cursor = 0;
  PARTES.forEach((p, i) => {
    if (p.start >= shown.length) return;
    if (p.start > cursor) segments.push(shown.slice(cursor, p.start));
    const end = Math.min(p.end, shown.length);
    segments.push(
      <span
        key={i}
        data-parte={i}
        className={cn(
          "rounded-[4px] transition-[background-color,box-shadow] duration-400",
          marked && "bg-manteca shadow-[0_0_0_2px_var(--color-manteca)]"
        )}
      >
        {shown.slice(p.start, end)}
      </span>
    );
    cursor = end;
  });
  if (cursor < shown.length) segments.push(shown.slice(cursor));

  return (
    <div ref={ref} style={style} className={cn("rounded-3xl bg-surface p-4 ring-1 ring-line", className)}>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink/70">
        <LogoGlyph size={14} color="var(--color-primary)" /> Describilo y lo completamos
      </p>
      <div className="mt-2 min-h-[4.25rem] rounded-2xl bg-card px-3.5 py-2.5 text-sm leading-relaxed text-ink ring-1 ring-line">
        {chars === 0 && !caret ? (
          <span className="text-ink-mute">Ej: necesito un mozo el sábado a la noche, se paga 45000</span>
        ) : (
          <>
            {segments}
            {caret && (
              <span
                aria-hidden
                className="ml-px inline-block h-[1.1em] w-[2px] translate-y-[0.2em] bg-primary story-caret"
              />
            )}
          </>
        )}
      </div>
      <div className="mt-2 flex min-h-[40px] items-center justify-between gap-2">
        {loading ? (
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-ink/60">
            <Spinner size={14} className="[animation-duration:1.333s]!" /> Leyendo tu pedido…
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onComplete}
          className={cn(
            "inline-flex min-h-[40px] items-center rounded-[var(--radius-btn)] bg-primary px-4 text-sm font-semibold text-night shadow-[var(--shadow-primary)] transition-transform duration-200",
            pressed ? "scale-[0.96]" : "scale-100"
          )}
        >
          Completar
        </button>
      </div>
    </div>
  );
});

/** El marcador de turno del mapa en su estado activo (components/map/
 *  ShiftMarker.tsx): pastilla ámbar con el pago adentro, punto del rubro y
 *  el pico hacia el punto exacto. */
export function PricePin({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div style={style} className={className}>
      <div className="relative flex w-max items-center gap-1.5 rounded-full border-2 border-white bg-primary px-2.5 py-1.5 text-xs font-bold tabular-nums text-night shadow-[var(--shadow-primary)]">
        <span className="absolute -bottom-[6px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-primary" />
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-night" />
        <span className="relative">$70.000</span>
      </div>
    </div>
  );
}

/**
 * Pin de trabajador. `avisado` es una variante propia de la historia (círculo
 * blanco con la inicial): marca a quién le llegó el aviso sin decir nada más.
 * `candidato` es el WorkerMarker real (components/map/WorkerMarker.tsx):
 * gradiente ámbar, borde blanco y el rating en un badge noche.
 */
export function WorkerPin({
  inicial,
  variant,
  rating,
}: {
  inicial: string;
  variant: "avisado" | "candidato";
  rating?: number;
}) {
  if (variant === "avisado") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-card text-xs font-bold text-ink shadow-[0_4px_10px_rgba(17,17,20,0.18)] ring-1 ring-line">
        {inicial}
      </span>
    );
  }
  return (
    <span className="relative flex h-[38px] w-[38px] items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-primary to-primary-strong shadow-[0_4px_10px_rgba(17,17,20,0.22)]">
      <span className="text-sm font-bold text-night">{inicial}</span>
      {rating != null && (
        <span className="absolute -bottom-1.5 -right-2 flex items-center gap-0.5 rounded-full border border-white bg-night px-1 py-px text-metadata font-bold leading-tight text-white shadow-sm">
          <StarIcon size={9} filled className="text-rating" />
          {rating.toLocaleString("es-AR", { minimumFractionDigits: 1 })}
        </span>
      )}
    </span>
  );
}

/**
 * Calles de la historia: una grilla en diagonal, como la de Palermo, sin
 * nombres (no tiene que leerse como una dirección real). Se revela en un
 * círculo que crece desde el local (`reveal`, 0→1), un solo recorte en vez de
 * animar cada calle.
 */
export function StreetGrid({
  reveal,
  className,
  tone = "map",
}: {
  reveal?: MotionValue<string>;
  className?: string;
  /** `map`: calles blancas sobre fondo de mapa. `faint`: casi transparente,
   *  para el mapa chico de "va en camino". */
  tone?: "map" | "faint";
}) {
  const lines: { d: string; avenue: boolean }[] = [];
  for (let k = -4; k <= 4; k++) {
    const c = 50 + k * 15;
    lines.push({ d: `M${c} -60 L${c} 160`, avenue: k === 0 || k === 3 });
    lines.push({ d: `M-60 ${c} L160 ${c}`, avenue: k === -1 });
  }
  const stroke = tone === "map" ? "#ffffff" : "rgba(17,17,17,0.12)";
  return (
    <motion.div className={cn("absolute inset-0", className)} style={reveal ? { clipPath: reveal } : undefined}>
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
        <g transform="rotate(-34 50 50)">
          {lines.map((l, i) => (
            <path
              key={i}
              d={l.d}
              stroke={stroke}
              strokeWidth={l.avenue ? 6 : 3}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              fill="none"
            />
          ))}
        </g>
      </svg>
    </motion.div>
  );
}

/** Recorte plano de un celular: chasis noche, sin inclinación ni reflejos. Lo
 *  que importa es la pantalla, no el aparato. */
export function PhoneFrame({
  children,
  hora,
  className,
  style,
}: {
  children: ReactNode;
  hora: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn(
        "rounded-[2.6rem] bg-night p-[7px] shadow-[0_30px_60px_-24px_rgba(25,20,16,0.5)]",
        className
      )}
    >
      <div className="relative h-[540px] w-[260px] overflow-hidden rounded-[2.2rem] bg-background">
        <div className="relative flex h-9 items-center justify-between px-7 text-metadata font-semibold tabular-nums text-ink">
          <span>{hora}</span>
          <span aria-hidden className="absolute left-1/2 top-2 h-5 w-[4.5rem] -translate-x-1/2 rounded-full bg-night" />
          <span aria-hidden className="flex items-center gap-1">
            <span className="h-2 w-3 rounded-[2px] bg-ink/80" />
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Una notificación push como la muestra el sistema. Título y texto son los
 *  del backend (cada uso dice de qué servicio salen). */
export function PushNotice({
  title,
  body,
  when = "ahora",
  className,
  style,
}: {
  title: string;
  body: string;
  when?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn("rounded-[1.25rem] bg-card p-3 shadow-[var(--shadow-float)] ring-1 ring-black/5", className)}
    >
      <div className="flex items-center gap-2">
        <LogoMark size={20} />
        <span className="font-mono text-label font-medium uppercase tracking-[0.14em] text-ink-mute">Oído</span>
        <span className="ml-auto text-metadata text-ink-mute">{when}</span>
      </div>
      <p className="mt-1.5 text-body-strong font-semibold text-ink">{title}</p>
      <p className="text-caption text-ink-soft">{body}</p>
    </div>
  );
}

/** El toast de la app (components/ui/Toast.tsx), en línea. */
export function ToastLine({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-toast px-4 py-3 text-sm font-semibold text-toast-ink shadow-[var(--shadow-float)]",
        className
      )}
    >
      <CheckCircleIcon size={18} className="shrink-0 text-success" />
      <span>{children}</span>
    </div>
  );
}
