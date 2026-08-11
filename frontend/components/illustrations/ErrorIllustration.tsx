/**
 * "Lámpara de salón parpadeando" — estados de fallo/sin conexión
 * (ART_DIRECTION.md §10.4, cuarta pieza del set). Mismo criterio que las
 * otras dos: primer trazo propio como placeholder de calidad, reemplazable
 * por la mano entrenada del §16.
 */
export default function ErrorIllustration({
  size = 64,
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
      <path d="M48 8v10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M30 22h36l-6 26c-1.4 6-6.2 10-12 10s-10.6-4-12-10L30 22Z"
        stroke={color}
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M26 22h44" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M42 62 46 74 41 74 47 88"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}
