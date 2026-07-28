"use client";

import { StarIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * Rating compacto de sólo lectura: estrella llena + valor numérico.
 * Para el picker interactivo de reseñas seguir usando StarRating.
 */
export default function Rating({
  value,
  count,
  size = 14,
  className,
}: {
  value: number;
  count?: number;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-semibold text-ink/70", className)}>
      <StarIcon size={size} filled className="text-amber-400" />
      {value.toFixed(1)}
      {count != null && <span className="font-normal text-ink/40">({count})</span>}
    </span>
  );
}
