"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import Button from "./Button";
import { LogoGlyph } from "@/components/Logo";
import { MOTION_UI } from "@/lib/motion";

/**
 * Estado vacío con ilustración (ícono grande), título, subtítulo y hasta dos
 * acciones. Nunca dejar una pantalla en blanco. Sin `icon`, cae al glifo de
 * marca (`LogoGlyph`) sobre superficie neutra — nunca gradiente decorativo
 * (Ley de marca, docs/planning/PULIDO_ROADMAP.md batch C1 #1).
 */
export default function EmptyState({
  icon,
  title,
  subtitle,
  primaryAction,
  secondaryAction,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : MOTION_UI}
      className="mx-auto mt-10 flex max-w-xs flex-col items-center px-6 text-center"
    >
      <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-surface text-primary-text">
        {icon ?? <LogoGlyph size={36} color="#f94e1b" />}
      </div>
      <h2 className="mt-5 text-lg font-bold text-ink">{title}</h2>
      {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-ink/50">{subtitle}</p>}
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
