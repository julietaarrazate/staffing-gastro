"use client";

// QR del alta de la verificación en dos pasos (ADR-0023). Se arma en el
// navegador con `uqr` (sin dependencias, ~27 KB, sólo en esta pantalla): el
// secreto nunca sale a un servicio de terceros para dibujar el QR.

import { useMemo } from "react";
import { encode } from "uqr";

/**
 * Módulos negros sobre blanco también en el tema oscuro, a propósito: varias
 * apps autenticadoras no leen un QR invertido. Es una imagen para la cámara,
 * no una superficie de la interfaz, por eso los colores van fijos acá y no
 * con los tokens del tema.
 */
const QR_DARK = "#111111";
const QR_LIGHT = "#ffffff";

export default function TotpQr({ value, size = 200 }: { value: string; size?: number }) {
  const { path, modules } = useMemo(() => {
    const qr = encode(value, { ecc: "M", border: 2 });
    let d = "";
    qr.data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      })
    );
    return { path: d, modules: qr.size };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label="Código QR para cargar Oído en tu app autenticadora"
      viewBox={`0 0 ${modules} ${modules}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="rounded-xl ring-1 ring-line"
    >
      <rect width={modules} height={modules} fill={QR_LIGHT} />
      <path d={path} fill={QR_DARK} />
    </svg>
  );
}
