"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * Control segmentado estilo iOS: una pista con una pastilla blanca que se
 * desliza al segmento activo (motion layout). Reemplaza los chip-tabs.
 */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex gap-1 rounded-[var(--radius-input)] bg-surface p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="relative flex-1 rounded-[14px] px-3 py-2 text-sm font-semibold"
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                className="absolute inset-0 rounded-[14px] bg-white shadow-[var(--shadow-soft)]"
              />
            )}
            <span className={cn("relative z-10 transition-colors", active ? "text-ink" : "text-ink/45")}>
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
