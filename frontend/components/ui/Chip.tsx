"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Chip / pill seleccionable (filtros tipo categorías de Morfi). */
export default function Chip({
  children,
  active = false,
  onClick,
  icon,
  className,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.93 }}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors",
        active
          ? "bg-zinc-900 text-white shadow-md"
          : "bg-white text-zinc-600 ring-1 ring-zinc-200",
        className
      )}
    >
      {icon}
      {children}
    </motion.button>
  );
}
