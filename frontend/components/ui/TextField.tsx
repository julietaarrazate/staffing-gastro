"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Input de texto del Design System, con label y touch target alto. */
export default function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  leftIcon,
  inputMode,
  min,
  max,
  className,
}: {
  label?: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  leftIcon?: ReactNode;
  inputMode?: "text" | "numeric" | "decimal" | "email" | "tel";
  min?: number;
  max?: number;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      {label && <span className="text-sm font-semibold text-zinc-700">{label}</span>}
      <span className="relative flex items-center">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3.5 text-zinc-400">{leftIcon}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          inputMode={inputMode}
          min={min}
          max={max}
          className={cn(
            "min-h-[48px] w-full rounded-2xl bg-surface px-4 text-[15px] text-zinc-900 outline-none ring-1 ring-zinc-200 transition focus:bg-white focus:ring-2 focus:ring-primary/40",
            Boolean(leftIcon) && "pl-11"
          )}
        />
      </span>
    </label>
  );
}
