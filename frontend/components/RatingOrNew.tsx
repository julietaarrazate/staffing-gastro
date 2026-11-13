"use client";

import StarRating from "@/components/StarRating";
import { hasRating, formatRating, NEW_LABEL } from "@/lib/reputation";

/**
 * Reputación de una persona o comercio en una línea: estrellas + nota, o
 * «Nuevo en Oído» si todavía no tiene reseñas (nunca «0,0» ni estrellas
 * vacías). La regla vive en `lib/reputation.ts` (`hasRating`).
 */
export default function RatingOrNew({
  rating,
  size = 18,
  numberClassName = "text-sm font-semibold text-ink/75",
}: {
  rating: number;
  size?: number;
  numberClassName?: string;
}) {
  if (!hasRating(rating)) {
    return <span className={`whitespace-nowrap ${numberClassName}`}>{NEW_LABEL}</span>;
  }
  return (
    <>
      <StarRating value={Math.round(rating)} size={size} />
      <span className={numberClassName}>{formatRating(rating)}</span>
    </>
  );
}
