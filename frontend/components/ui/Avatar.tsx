"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { cldThumb } from "@/lib/cloudinary";

const SIZES = { sm: 32, md: 44, lg: 64, xl: 96 } as const;

/**
 * Avatar con fallback robusto: si no hay foto (o la imagen falla al cargar),
 * muestra la inicial sobre un gradiente, sin texto desbordado.
 */
export default function Avatar({
  src,
  name,
  size = "md",
  square = false,
  className,
}: {
  src?: string | null;
  name: string;
  size?: keyof typeof SIZES;
  square?: boolean;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const px = SIZES[size];
  const radius = square ? "rounded-2xl" : "rounded-full";
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      style={{ width: px, height: px, fontSize: px * 0.4 }}
      className={cn(
        // Inicial en tinta, como el botón principal. Medido en el centro del
        // degradé, donde cae la letra: con el ámbar de v5.0 la tinta da 4,74
        // y el blanco 3,99 (no llega); con el naranja #e64c1e de la paleta
        // celeste, 4,45 contra 4,09 (la inicial es letra grande: pide 3:1).
        "flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-primary to-primary-strong font-bold text-night ring-1 ring-black/5",
        radius,
        className
      )}
    >
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cldThumb(src, px)}
          alt={name}
          width={px}
          height={px}
          onError={() => setBroken(true)}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
