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
 * es un monto). Con el foco se ve sin separadores y tal cual se teclea; al
 * salir del campo, formateado («15.001»). Si lo escrito no se puede leer, queda a la
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
      onFocus={() => {
        // Al editar se ve sin puntos («15001»): borrar una cifra en el medio
        // de «1.500» no deja un «1.50» que no se puede leer.
        if (texto === null && value !== "") setTexto(value);
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
