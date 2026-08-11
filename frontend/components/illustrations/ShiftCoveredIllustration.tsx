/**
 * "El pase" — dos manos en el pase de una bandeja (ART_DIRECTION.md §10.4,
 * quinta y última pieza construida del set). El trabajador confirmó el
 * turno: se completa. Regla de dignidad (§10.3): se ilustra el gesto del
 * oficio, nunca la persona completa. Mismo criterio de las anteriores.
 */
export default function ShiftCoveredIllustration({
  size = 56,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
    >
      {/* bandeja, vista de perfil */}
      <ellipse cx="48" cy="52" rx="26" ry="7" stroke={color} strokeWidth="2.2" />
      <path
        d="M22 52c0 2.5 1.5 4.2 4 5M74 52c0 2.5-1.5 4.2-4 5"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* mano izquierda, entregando */}
      <path
        d="M16 62c2-4 6-8 10-9l4-1"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 66c1-2 2-3 3-3M17 69c1-2 2-4 3-5M22 71c1-2 1.5-4 2-5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* mano derecha, recibiendo */}
      <path
        d="M80 62c-2-4-6-8-10-9l-4-1"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M83 66c-1-2-2-3-3-3M79 69c-1-2-2-4-3-5M74 71c-1-2-1.5-4-2-5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
