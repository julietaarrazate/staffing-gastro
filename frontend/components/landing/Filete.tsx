import { useId } from "react";

/**
 * Filete porteño (2026-10-18): una palabra con letras crema y doradas, relieve
 * ámbar y borde hondo, entre volutas, hojas celestes, florcitas y perlitas,
 * a la manera del cartel "Pase y vea". Va en la cinta "¡Oído!" de la comanda
 * y en el "oído" grande del final; el resto de la landing queda liso.
 *
 * Los colores son del cartel, no tokens: el filete es una ilustración y se ve
 * igual en cualquier tema.
 */
const AMBAR = "#d97706";
const RELIEVE = "#8a3f05";
const HONDO = "#1c5478";
const BORDE = "#14456a";

/** Un costado del adorno, en un lienzo de 1000 × 420 (el otro es su espejo). */
function Costado() {
  return (
    <g>
      <path d="M168 352C70 352 44 262 98 220c42-32 86-2 66 30-14 22-46 14-38-6" fill="none" stroke={AMBAR} strokeWidth="12" strokeLinecap="round" />
      <path d="M160 320C104 320 86 270 116 244" fill="none" stroke="#9ac9e7" strokeWidth="6" strokeLinecap="round" />
      <path d="M98 220c-24-44-4-92 46-104-10 44-22 78-46 104z" fill="#c4e3ed" stroke={HONDO} strokeWidth="3" />
      <path d="M168 352c22-32 64-38 98-20-32 22-64 28-98 20z" fill="#c4e3ed" stroke={HONDO} strokeWidth="3" />
      <path d="M144 116c10-30 36-44 66-40" fill="none" stroke={AMBAR} strokeWidth="7" strokeLinecap="round" />
      <g transform="translate(66 132)">
        <g fill="#e8f4f8" stroke={HONDO} strokeWidth="2.5">
          <circle cy="-17" r="15" />
          <circle cx="16" cy="-5" r="15" />
          <circle cx="10" cy="14" r="15" />
          <circle cx="-10" cy="14" r="15" />
          <circle cx="-16" cy="-5" r="15" />
        </g>
        <circle r="9" fill={AMBAR} />
      </g>
      <g fill={AMBAR}>
        <circle cx="230" cy="60" r="7" />
        <circle cx="40" cy="300" r="8" />
        <circle cx="250" cy="380" r="6" />
      </g>
      <g fill="#fff">
        <circle cx="228" cy="58" r="2.2" />
        <circle cx="38" cy="298" r="2.6" />
        <circle cx="248" cy="378" r="2" />
      </g>
    </g>
  );
}

type Medidas = {
  ancho: number;
  alto: number;
  /** Base de la palabra y su cuerpo. */
  y: number;
  cuerpo: number;
  /** Escala y corrimiento de los costados (dibujados en 1000 × 420). */
  escala: number;
  dx: number;
  dy: number;
  relieve: number;
  borde: number;
};

const MEDIDAS: Record<"cinta" | "firma", Medidas> = {
  cinta: { ancho: 340, alto: 124, y: 86, cuerpo: 66, escala: 0.27, dx: -4, dy: 6, relieve: 5, borde: 2.4 },
  firma: { ancho: 1000, alto: 420, y: 330, cuerpo: 300, escala: 1, dx: 0, dy: 0, relieve: 12, borde: 5 },
};

export default function Filete({ palabra, tam, className }: { palabra: string; tam: "cinta" | "firma"; className?: string }) {
  const id = useId().replace(/:/g, "");
  const m = MEDIDAS[tam];
  const texto = `filete-texto-${id}`;
  const cara = `filete-cara-${id}`;
  const pasos = Array.from({ length: 10 }, (_, k) => (m.relieve * (10 - k)) / 10);
  return (
    <svg aria-hidden viewBox={`0 0 ${m.ancho} ${m.alto}`} className={className}>
      <defs>
        <text
          id={texto}
          x={m.ancho / 2}
          y={m.y}
          textAnchor="middle"
          fontWeight="700"
          fontSize={m.cuerpo}
          letterSpacing={tam === "firma" ? -6 : -1}
          style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
        >
          {palabra}
        </text>
        <linearGradient id={cara} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff9dc" />
          <stop offset=".55" stopColor="#f6df8c" />
          <stop offset="1" stopColor="#e9b84a" />
        </linearGradient>
      </defs>
      <g transform={`translate(${m.dx} ${m.dy}) scale(${m.escala})`}>
        <Costado />
      </g>
      <g transform={`translate(${m.ancho - m.dx} ${m.dy}) scale(${-m.escala} ${m.escala})`}>
        <Costado />
      </g>
      {pasos.map((d) => (
        <use key={d} href={`#${texto}`} x={d} y={d} fill={RELIEVE} />
      ))}
      <use href={`#${texto}`} fill={`url(#${cara})`} stroke={BORDE} strokeWidth={m.borde} paintOrder="stroke" />
      <use href={`#${texto}`} fill="none" stroke="#fff" strokeWidth={m.borde / 3} opacity={0.7} transform="translate(-1 -1)" />
    </svg>
  );
}
