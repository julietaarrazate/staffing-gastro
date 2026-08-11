/**
 * "El hueco esperando" — comanda vacía en el clip de cocina, sin nada
 * anotado todavía (ART_DIRECTION.md §10.4, primera pieza del set de
 * ilustración). Primer trazo propio (código, no diseñador): sigue las
 * reglas del §10.2 —trazo único, sin relleno, monocromo, leve
 * irregularidad— como placeholder de calidad hasta que exista la mano
 * entrenada que pide el roadmap (§16). Reemplazable sin tocar quien la usa.
 */
export default function EmptyFeedIllustration({
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
      <path d="M48 8v12" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M39 19c0-3.5 4-6 9-6s9 2.5 9 6-2.5 4.5-2.5 8"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M29 26h38v42c-2.2 1.8-4.3-1.8-6.3.2s-4 2.8-6 .8-5 2.8-7 .2-4.8 2.8-6.8.6-4 1.2-4-1.6V26Z"
        stroke={color}
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M37 37h22M37 45h22M37 53h14" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.35" />
    </svg>
  );
}
