"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { EyeIcon, EyeOffIcon } from "@/components/icons";

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
  maxLength,
  error,
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
  maxLength?: number;
  /** Mensaje de error del campo: conecta `aria-describedby`/`aria-invalid`
   *  con el `<input>` y se anuncia a lectores de pantalla (`role="alert"`).
   *  Hallazgo F4 de la auditoría de producto/UI 2026-08-09 — antes ningún
   *  campo del repo tenía esto, los errores de formulario eran un `<p>`
   *  suelto sin asociación programática con ningún input específico. */
  error?: string;
  className?: string;
}) {
  // Ver la contraseña que se está escribiendo. Sin esto, en un teclado de
  // celular es facilísimo equivocarse y no hay forma de darse cuenta: se
  // escribe a ciegas y el error recién aparece al enviar el formulario.
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && reveal ? "text" : type;
  const errorId = useId();

  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      {label && <span className="text-sm font-semibold text-ink/70">{label}</span>}
      <span className="relative flex items-center">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3.5 text-ink/40">{leftIcon}</span>
        )}
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          inputMode={inputMode}
          min={min}
          max={max}
          minLength={minLength}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "min-h-[48px] w-full rounded-[var(--radius-input)] bg-surface px-4 text-[15px] text-ink outline-none ring-1 ring-line transition focus:ring-2 focus:ring-primary/40",
            Boolean(leftIcon) && "pl-11",
            isPassword && "pr-12",
            error && "ring-2 ring-danger"
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={reveal}
            className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-full text-ink/40 transition active:scale-90"
          >
            {reveal ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
          </button>
        )}
      </span>
      {error && (
        <span id={errorId} role="alert" className="text-sm text-danger-text">
          {error}
        </span>
      )}
    </label>
  );
}
