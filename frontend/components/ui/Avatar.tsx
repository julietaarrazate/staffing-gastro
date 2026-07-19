"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

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
        "flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-[#ff6b00] to-[#e85f00] font-bold text-white ring-1 ring-black/5",
        radius,
        className
      )}
    >
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
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
