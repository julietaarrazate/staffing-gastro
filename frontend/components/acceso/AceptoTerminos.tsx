"use client";

import Link from "next/link";

/**
 * La casilla del consentimiento legal («Acepto los Términos y Condiciones y la
 * Política de Privacidad»), la misma en `/register` y en el paso del rol de
 * «Continuar con Google». El texto y los dos links no cambian: si cambia el
 * texto de `/terminos` o `/privacidad` hay que subir la versión legal
 * (`LEGAL_TERMS_VERSION`, `lib/legal.ts`).
 *
 * La casilla es la nativa (`<input type="checkbox">`, con su teclado y su
 * etiqueta) vestida de casilla suave de la dirección suave (`.casilla-nativa`,
 * ADR-0028): redonda, con el tilde en azul hondo al marcarse.
 */
export default function AceptoTerminos({
  checked,
  onChange,
  className = "",
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  className?: string;
}) {
  return (
    <label className={`flex items-start gap-3 py-1 text-sm text-ink/70 ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="casilla-nativa mt-0.5"
      />
      <span>
        Acepto los{" "}
        <Link
          href="/terminos"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary-text hover:underline"
        >
          Términos y Condiciones
        </Link>{" "}
        y la{" "}
        <Link
          href="/privacidad"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary-text hover:underline"
        >
          Política de Privacidad
        </Link>
      </span>
    </label>
  );
}
