"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatearPesos, leerPesos } from "@/lib/pesos";

/**
 * Campo de monto en pesos enteros (pago del turno y de cada puesto del
 * evento). Es de texto con teclado numérico: un `type="number"` descartaba la
 * coma y «15000,50» se publicaba como $1.500.050. Las reglas de lectura están
 * en `lib/pesos.ts`.
 *
 * `value` y `onChange` usan el monto canónico («15001», o «» si lo escrito no
 * es un monto). Mientras se escribe se muestra lo tecleado tal cual; al salir
 * del campo, formateado («15.001»). Si lo escrito no se puede leer, queda a la
 * vista marcado como inválido y el formulario no deja seguir.
 */
export default function PesosInput({
  value,
  onChange,
  placeholder,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (canonico: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  // null: se muestra `value` formateado. Un string: lo que la persona está
  // escribiendo (o lo que dejó y no se pudo leer).
  const [texto, setTexto] = useState<string | null>(null);
  const invalido = texto !== null && leerPesos(texto) === null;

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={texto ?? formatearPesos(value)}
      onChange={(e) => {
        setTexto(e.target.value);
        onChange(leerPesos(e.target.value) ?? "");
      }}
      onBlur={() => {
        if (texto !== null && leerPesos(texto) !== null) setTexto(null);
      }}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-invalid={invalido || undefined}
      className={cn(className, invalido && "text-danger-text!")}
    />
  );
}
