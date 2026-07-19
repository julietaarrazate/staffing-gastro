"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Tarjeta base del Design System: fondo blanco, borde amplio (24px), sombra
 * suave y feedback táctil opcional cuando es interactiva.
 */
export default function Card({
  children,
  onClick,
  interactive = false,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  interactive?: boolean;
  className?: string;
}) {
  const clickable = interactive || Boolean(onClick);
  return (
    <motion.div
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      whileTap={clickable ? { scale: 0.985 } : undefined}
      className={cn(
        "rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)] ring-1 ring-zinc-100",
        // `role="button"` ya cubre la selección de texto vía el selector
        // `[role="button"]` de globals.css, pero se refuerza acá con
        // `.no-select` para tarjetas clickeables que envuelven texto que NO
        // es contenido de lectura genuino (ver "Ley de marca" / bug C0 #2).
        clickable && "no-select cursor-pointer",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
