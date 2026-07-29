"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "dark" | "secondary" | "danger" | "surface" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  // Texto ink sobre el naranja de marca: 6.61 de contraste (AA), contra 2.86
  // del blanco, que no llegaba ni al minimo de texto grande. La decision de
  // que el boton siga siendo NARANJA (y no ink) sale de ART_DIRECTION §6.2:
  // "el naranja marca la accion principal". Ver docs/COLOR_SYSTEM.md §2.3.
  primary:
    "bg-primary text-ink shadow-[0_8px_20px_rgba(255,107,0,0.28)] hover:brightness-[1.04]",
  // "dark" / énfasis neutro de marca (#111).
  dark: "bg-ink text-white hover:brightness-150",
  secondary:
    "bg-secondary text-white shadow-[0_8px_20px_rgba(34,197,94,0.25)] hover:brightness-[1.04]",
  danger: "bg-danger text-white shadow-[0_8px_20px_rgba(239,68,68,0.22)] hover:brightness-[1.04]",
  surface: "bg-white text-ink ring-1 ring-line hover:bg-surface",
  ghost: "bg-transparent text-ink/80 hover:bg-surface",
};

// Touch targets >= 44px (accesibilidad móvil).
const SIZES: Record<Size, string> = {
  sm: "min-h-[40px] px-4 text-sm gap-1.5",
  md: "min-h-[48px] px-5 text-[15px] gap-2",
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
      aria-label={ariaLabel}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-btn)] font-semibold transition-[filter,background-color] outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className
      )}
    >
      {loading ? (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
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
