"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Floating Action Button: acción principal flotante, anclada abajo a la
 * derecha por encima de la bottom nav. Puede mostrar sólo ícono o ícono+label
 * (pill extendido). Naranja de marca, al alcance del pulgar.
 */
export default function FAB({
  icon,
  label,
  href,
  onClick,
  className,
  "aria-label": ariaLabel,
}: {
  icon: ReactNode;
  label?: string;
  href?: string;
  onClick?: () => void;
  className?: string;
  "aria-label"?: string;
}) {
  const content = (
    <motion.span
      whileTap={{ scale: 0.92 }}
      className={cn(
        "fixed bottom-24 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-5 font-bold text-ink shadow-[0_12px_28px_rgba(249,115,22,0.4)]",
        label ? "h-14" : "h-14 w-14 justify-center px-0",
        className
      )}
    >
      {icon}
      {label && <span className="text-[15px]">{label}</span>}
    </motion.span>
  );

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel ?? label}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel ?? label}>
      {content}
    </button>
  );
}
