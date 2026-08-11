/**
 * "Mesa preparada sin ocupar" — el lugar servido, esperando que se publique
 * el primer turno (ART_DIRECTION.md §10.4, segunda pieza del set). Mismo
 * criterio que `EmptyFeedIllustration`: primer trazo propio como
 * placeholder de calidad, reemplazable por la mano entrenada del §16.
 */
export default function EmptyPanelIllustration({
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
      <circle cx="48" cy="48" r="21" stroke={color} strokeWidth="2.2" />
      <circle cx="48" cy="48" r="13.5" stroke={color} strokeWidth="1.6" opacity="0.4" />
      <path
        d="M23 29v13.5M27.5 29v13.5M23 42.5c0 4.2 2.2 6 2.2 10.5v18M27.5 42.5c0 4.2-2.2 6-2.2 10.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M74 29c3.5 4.5 3.5 10 0 14.5-2.2 2.3-3.3 3.4-3.3 5.7V71"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
