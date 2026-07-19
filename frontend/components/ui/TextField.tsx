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
  minLength,
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
  minLength?: number;
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
          minLength={minLength}
          className={cn(
            "min-h-[48px] w-full rounded-[var(--radius-input)] bg-white px-4 text-[15px] text-ink outline-none ring-1 ring-line transition focus:ring-2 focus:ring-primary/40",
            Boolean(leftIcon) && "pl-11"
          )}
        />
      </span>
    </label>
  );
}
