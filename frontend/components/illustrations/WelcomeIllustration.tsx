/**
 * "El gesto previo a empezar" — un delantal atándose (ART_DIRECTION.md
 * §10.4, cuarta pieza construida del set). Mismo criterio que las
 * anteriores: primer trazo propio, monocromo, sin relleno, reemplazable
 * por la mano entrenada del §16.
 */
export default function WelcomeIllustration({
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
      {/* peto del delantal */}
      <path
        d="M34 20h28l-4 22H38l-4-22Z"
        stroke={color}
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* cuerpo del delantal, se ensancha hacia abajo */}
      <path
        d="M36 42h24l6 34c0 1.5-1.3 2.5-2.7 2.1-8.7-2.4-21.9-2.4-30.6 0-1.4.4-2.7-.6-2.7-2.1l6-34Z"
        stroke={color}
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* tira que se ata: sale del peto, cruza y baja como si alguien la
          estuviera anudando en este instante */}
      <path
        d="M34 24C22 26 16 30 14 38"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M62 24c9 3 13 8 12 15-1 5-6 7-11 4"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
