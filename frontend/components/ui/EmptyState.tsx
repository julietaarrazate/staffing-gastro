"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import Button from "./Button";

/**
 * Estado vacío con ilustración (ícono grande), título, subtítulo y hasta dos
 * acciones. Nunca dejar una pantalla en blanco.
 */
export default function EmptyState({
  icon,
  title,
  subtitle,
  primaryAction,
  secondaryAction,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto mt-10 flex max-w-xs flex-col items-center px-6 text-center"
    >
      <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-gradient-to-br from-orange-100 to-amber-100 text-primary">
        {icon}
      </div>
      <h2 className="mt-5 text-lg font-bold text-zinc-900">{title}</h2>
      {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{subtitle}</p>}
      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex w-full flex-col gap-2.5">
          {primaryAction && (
            <Button fullWidth onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button fullWidth variant="surface" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}
