"use client";

import { useId } from "react";

/**
 * Marca Oído: "la cloche" (campana de servicio), símbolo universal del
 * salón gastronómico premium. Geometría fija (spec de marca): pomo, domo y
 * plato en blanco. El mismo degradé naranja que --color-primary /
 * --color-primary-strong en globals.css (antes el SVG usaba el naranja
 * default de Tailwind, que no coincidía con el token real de la app).
 *
 * `LogoGlyph` es sólo el trazo (pomo + domo + plato), sin tile de fondo —
 * lo reusa SplashScreen sobre su propia tarjeta blanca. `LogoMark` agrega el
 * tile naranja (uso estándar: Navbar, favicon/app icons). `Logo` agrega el
 * wordmark y es el default export que ya consumen Navbar, login/register/
 * recuperar/restablecer y la landing.
 */
export function LogoGlyph({ size = 28, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="12" cy="5.5" r="1.5" fill={color} />
      <path
        d="M4.4 16.1 A 7.6 7.6 0 0 1 19.6 16.1"
        stroke={color}
        strokeWidth="2.1"
        strokeLinecap="round"
        fill="none"
      />
      <rect x="3" y="17.3" width="18" height="2.1" rx="1.05" fill={color} />
    </svg>
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  const gradientId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Oído"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff6b00" />
          <stop offset="1" stopColor="#e85f00" />
        </linearGradient>
      </defs>
      {/* Tile: cuadrado redondeado, rx ~22% del lado */}
      <rect width="24" height="24" rx="5.3" fill={`url(#${gradientId})`} />
      {/* Pomo */}
      <circle cx="12" cy="5.5" r="1.5" fill="#fff" />
      {/* Domo */}
      <path
        d="M4.4 16.1 A 7.6 7.6 0 0 1 19.6 16.1"
        stroke="#fff"
        strokeWidth="2.1"
        strokeLinecap="round"
        fill="none"
      />
      {/* Plato base */}
      <rect x="3" y="17.3" width="18" height="2.1" rx="1.05" fill="#fff" />
    </svg>
  );
}

export default function Logo({
  size = 28,
  withWordmark = true,
}: {
  size?: number;
  withWordmark?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      {withWordmark && (
        <span className="text-xl font-extrabold tracking-tight text-ink">
          staff<span className="text-primary-text">ya</span>
        </span>
      )}
    </span>
  );
}
