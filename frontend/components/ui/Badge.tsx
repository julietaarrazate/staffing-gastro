import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "primary" | "secondary" | "danger" | "neutral" | "trust";

const TONES: Record<Tone, string> = {
  // Tokens de tinte (rediseño 2026-09), no `bg-orange-50`/`bg-green-50`/
  // `bg-red-50` de Tailwind directo — mismos valores exactos, cero cambio
  // visual, pero ahora pasan por el sistema (ver ShiftCard.tsx, mismo
  // criterio). `info` (azul crudo, fuera de la paleta de ADR-0011) se sacó:
  // no tenía ningún uso real en la app.
  primary: "bg-primary-tint text-primary-text",
  secondary: "bg-success-tint text-success-text",
  danger: "bg-danger-tint text-danger-text",
  neutral: "bg-surface text-ink/70",
  // Identidad/confianza verificada — nunca estado ni reputación (ADR-0010
  // §5, ADR-0011). No reusar para nada que no sea una verificación de
  // identidad real. Color: CELESTE (cielo), no petróleo — es el rol de
  // "confianza/verificación" de la identidad visual nueva (mockups 03/09) y
  // coincide con lo que la landing ya asumía ("el celeste es el token de
  // confianza, el mismo de su insignia de perfil verificado"). El tinte
  // celeste es claro y su texto oscuro no se voltea, así que se lee igual en
  // modo claro y oscuro (pastilla celeste clara sobre tarjeta oscura).
  trust: "bg-cielo-tint text-cielo-text",
};

/** Badge / etiqueta de estado, pequeña y redonda. */
export default function Badge({
  children,
  tone = "neutral",
  icon,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold",
        TONES[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}
