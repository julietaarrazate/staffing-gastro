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
      whileTap={clickable ? { scale: 0.985 } : undefined}
      className={cn(
        "rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)] ring-1 ring-zinc-100",
        clickable && "cursor-pointer",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
