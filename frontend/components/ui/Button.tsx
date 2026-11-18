"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "dark" | "secondary" | "danger" | "surface" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  // Ámbar de marca con texto OSCURO: ink sobre #d97706 da 6.61 (AA holgado); el
  // blanco sobre ámbar da 2.86 y no llega ni al mínimo de texto grande.
  // Desactivado va gris azulado (`surface` + tinta apagada), no ámbar al 50%:
  // sobre el lienzo oscuro el ámbar transparente se leía marrón (2026-10-19).
  // Con el relieve del filete desde el 2026-11-18 (`.boton-relieve`, ADR-0027):
  // borde azul hondo y sombra dura, en lugar del resplandor ámbar. Julieta lo
  // vio plano al lado de «Publicar turno», que ya tenía relieve, y el plano
  // era el que desentonaba. El desactivado (sin borde ni relieve, con un
  // filete) lo resuelve `.boton-relieve:disabled`.
  primary:
    "boton-relieve bg-primary text-night hover:brightness-[1.04] disabled:bg-surface disabled:text-ink-mute disabled:opacity-100",
  // "dark" / énfasis neutro de marca (#111).
  dark: "bg-night text-white hover:brightness-150",
  secondary:
    "bg-success text-white shadow-[var(--shadow-success)] hover:brightness-[1.04]",
  danger: "bg-danger text-white shadow-[var(--shadow-danger)] hover:brightness-[1.04]",
  // Desactivados como el de `primary`: sin opacidad (a opacity-50 la tinta sobre
  // la tarjeta blanca quedaba tenue en claro), fondo `surface` y tinta apagada.
  surface:
    "bg-card text-ink ring-1 ring-line hover:bg-surface disabled:bg-surface disabled:text-ink-mute disabled:opacity-100",
  ghost: "bg-transparent text-ink/80 hover:bg-surface disabled:text-ink-mute disabled:opacity-100",
};

// Touch targets >= 44px (accesibilidad móvil).
const SIZES: Record<Size, string> = {
  sm: "min-h-[40px] px-4 text-sm gap-1.5",
  md: "min-h-[48px] px-5 text-body gap-2",
  lg: "min-h-[56px] px-6 text-base gap-2.5",
};

export default function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  className,
  "aria-label": ariaLabel,
}: {
  children?: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      aria-label={ariaLabel}
      // El principal se aprieta como su relieve: se corre lo que mide la
      // sombra (que el CSS lleva a cero). Los demás se achican apenas.
      whileTap={variant === "primary" ? { x: 3, y: 3 } : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-btn)] font-semibold transition-[filter,background-color] outline-none disabled:opacity-50 disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className
      )}
    >
      {loading ? (
        <>
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {/* F3 (auditoría de producto/UI 2026-08-09): sin esto, el botón
              pierde su nombre accesible mientras carga (el spinner no tiene
              texto) — un lector de pantalla no anuncia nada al re-enfocarlo
              durante el submit. */}
          <span className="sr-only">Cargando…</span>
        </>
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </motion.button>
  );
}
