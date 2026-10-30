import { useId, type ReactNode } from "react";

/**
 * El «oído» fileteado (2026-10-23): letra de cartel antiguo (Sancreek, con
 * espolones, como los alfabetos "lettres fantaisie" y los carteles de
 * fileteado) en crema, con filete interior de luz, borde y relieve azul hondo
 * y canto dorado. En el tamaño grande, adornos finos dorados: arco con doble
 * filete y flor de tres hojas arriba, filete cortado con eses y rombo abajo,
 * rulos y perlitas.
 *
 * Tres tamaños: `firma` (con adornos: pantalla de inicio), `marca` (sólo la
 * palabra: encabezado) y `cinta` («¡Oído!» en la comanda). El final de la
 * landing usa `Sol` y `Letras` sueltos (LandingFooter.tsx): el Sol de Mayo
 * saliendo detrás de la palabra. Los colores son del cartel, no tokens: se
 * ve igual en cualquier tema.
 */
const ORO = "#b8801f";
const ORO_CLARO = "#e2b04a";
const RAYO = "#9a6410";
const HONDO = "#14456a";
const HONDO_CLARO = "#1c5478";
const CANTO = "#c98a1a";
const FUENTE = "var(--font-sancreek), Georgia, serif";

const r1 = (n: number) => Math.round(n * 10) / 10;

/** El sol, a la manera del Sol de Mayo: rayos rectos y ondulados alternados y disco con relieve. */
export function Sol({ cx, cy, r, id, rayos = 32 }: { cx: number; cy: number; r: number; id: string; rayos?: number }) {
  const piezas: ReactNode[] = [];
  const R1 = r * 1.08;
  const R2 = r * 1.72;
  const R3 = r * 1.52;
  for (let k = 0; k < rayos; k++) {
    const a = (k * 2 * Math.PI) / rayos - Math.PI / 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    if (k % 2 === 0) {
      const w = rayos >= 32 ? 0.075 : 0.13;
      const d = `M${r1(cx + R1 * Math.cos(a - w))} ${r1(cy + R1 * Math.sin(a - w))}L${r1(cx + R2 * ca)} ${r1(cy + R2 * sa)}L${r1(cx + R1 * Math.cos(a + w))} ${r1(cy + R1 * Math.sin(a + w))}Z`;
      piezas.push(<path key={k} d={d} fill={`url(#${id}-rayo)`} stroke={RAYO} strokeWidth={1.6} strokeLinejoin="round" />);
    } else {
      const pts: string[] = [];
      for (let j = 0; j <= 14; j++) {
        const t = j / 14;
        const rr = R1 + (R3 - R1) * t;
        const off = Math.sin(t * Math.PI * 2.2) * r * 0.07 * (1 - t * 0.5);
        pts.push(`${r1(cx + rr * ca - off * sa)} ${r1(cy + rr * sa + off * ca)}`);
      }
      const p = pts.join(" ");
      piezas.push(
        <g key={k} fill="none" strokeLinecap="round">
          <polyline points={p} stroke={RAYO} strokeWidth={r1(r * 0.11)} />
          <polyline points={p} stroke="#f1c75a" strokeWidth={r1(r * 0.06)} />
        </g>
      );
    }
  }
  const relieve = Array.from({ length: 10 }, (_, i) => 10 - i);
  return (
    <g>
      {piezas}
      {relieve.map((k) => (
        <circle key={k} cx={cx + k} cy={cy + k} r={r} fill={k > 5 ? HONDO : HONDO_CLARO} />
      ))}
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-disco)`} stroke={RAYO} strokeWidth={4} />
      <circle cx={cx} cy={cy} r={r - 8} fill="none" stroke="#fff6cf" strokeWidth={2.5} />
    </g>
  );
}

/** La letra: sombra, relieve azul, canto dorado, borde, cara crema y filete interior de luz. */
export function Letras({ x, y, tam, texto, id, anchor = "start", e = 1, sombra = true }: { x: number; y: number; tam: number; texto: string; id: string; anchor?: "start" | "middle"; e?: number; sombra?: boolean }) {
  const t = `${id}-texto`;
  const pasos = Array.from({ length: 14 }, (_, i) => 14 - i);
  return (
    <g>
      <defs>
        <text id={t} x={x} y={y} textAnchor={anchor} fontSize={tam} letterSpacing={6 * e} style={{ fontFamily: FUENTE }}>
          {texto}
        </text>
        <linearGradient id={`${id}-cara`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff9dc" />
          <stop offset="1" stopColor="#f2dc9a" />
        </linearGradient>
        <clipPath id={`${id}-recorte`}>
          <use href={`#${t}`} />
        </clipPath>
      </defs>
      {sombra && <use href={`#${t}`} x={20 * e} y={20 * e} fill={CANTO} opacity={0.5} />}
      {pasos.map((k) => {
        const c = k > 6 ? HONDO : HONDO_CLARO;
        return <use key={k} href={`#${t}`} x={k * e} y={k * e} fill={c} stroke={c} strokeWidth={2 * e} />;
      })}
      <use href={`#${t}`} x={2.2 * e} y={2.2 * e} fill={CANTO} />
      <use href={`#${t}`} fill={`url(#${id}-cara)`} stroke={HONDO} strokeWidth={5 * e} paintOrder="stroke" />
      <g clipPath={`url(#${id}-recorte)`}>
        <use href={`#${t}`} fill="none" stroke="#ffffff" strokeWidth={16 * e} />
        <use href={`#${t}`} fill="none" stroke={`url(#${id}-cara)`} strokeWidth={10 * e} />
      </g>
    </g>
  );
}

function Hoja({ x, y, rot, s = 1 }: { x: number; y: number; rot: number; s?: number }) {
  const tr = `translate(${x} ${y}) rotate(${rot}) scale(${s})`;
  return (
    <g transform={tr}>
      <path d="M0 0c7-9 7-19 0-27c-7 8-7 18 0 27z" fill={ORO_CLARO} stroke={ORO} strokeWidth={1.4} />
      <path d="M0-4v-18" stroke="#fff6cf" strokeWidth={1.2} strokeLinecap="round" />
    </g>
  );
}

function Rulo({ x, y, lado }: { x: number; y: number; lado: 1 | -1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${lado} 1)`}>
      <path d="M0 0c22 0 36-10 36-24 0-12-10-18-18-14-7 4-6 13 1 14" fill="none" stroke={ORO} strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={19} cy={-24} r={2.6} fill={ORO} />
      <Hoja x={10} y={-3} rot={-70} s={0.7} />
    </g>
  );
}

/** Los adornos finos de la firma, como los de los carteles de "Argentina". */
function Adornos({ x0, yt, yb, hw }: { x0: number; yt: number; yb: number; hw: number }) {
  return (
    <g>
      <g fill="none" stroke={ORO} strokeLinecap="round">
        <path d={`M${x0 - hw} ${yt + 26}Q${x0} ${yt - 26} ${x0 + hw} ${yt + 26}`} strokeWidth={2.4} />
        <path d={`M${x0 - hw + 30} ${yt + 30}Q${x0} ${yt - 14} ${x0 + hw - 30} ${yt + 30}`} strokeWidth={1.1} />
        <path d={`M${x0 - hw} ${yb}H${x0 - 58}M${x0 + 58} ${yb}H${x0 + hw}`} strokeWidth={2.4} />
        <path d={`M${x0 - hw + 40} ${yb + 8}H${x0 - 70}M${x0 + 70} ${yb + 8}H${x0 + hw - 40}`} strokeWidth={1.1} />
        {[1, -1].map((e) => (
          <path key={e} transform={`translate(${x0} ${yb}) scale(${e} 1)`} d="M12 0c10 0 18 8 28 8s16-10 10-16c-5-5-12 0-8 5" strokeWidth={2} />
        ))}
        <path d={`M${x0 - hw} ${yt + 26}c-14 2-24-8-18-17 4-6 12-3 10 3`} strokeWidth={2.2} />
        <path d={`M${x0 + hw} ${yt + 26}c14 2 24-8 18-17-4-6-12-3-10 3`} strokeWidth={2.2} />
      </g>
      <path d={`M${x0} ${yb - 9}l8 9-8 9-8-9z`} fill={ORO_CLARO} stroke={ORO} strokeWidth={1.4} />
      <Hoja x={x0} y={yt - 2} rot={0} s={1.1} />
      <Hoja x={x0} y={yt - 2} rot={-48} s={0.8} />
      <Hoja x={x0} y={yt - 2} rot={48} s={0.8} />
      <circle cx={x0} cy={yt + 2} r={3.2} fill={ORO} />
      <Rulo x={x0 + hw} y={yb} lado={1} />
      <Rulo x={x0 - hw} y={yb} lado={-1} />
      {[-1, 1].map((e) => (
        <g key={e} fill={ORO}>
          <circle cx={x0 + e * hw * 0.62} cy={yt + 4} r={2.4} />
          <circle cx={x0 + e * hw * 0.69} cy={yt + 12} r={1.6} />
        </g>
      ))}
    </g>
  );
}

export function Degrades({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={`${id}-disco`} cx=".4" cy=".35" r=".75">
        <stop offset="0" stopColor="#fff3b0" />
        <stop offset=".6" stopColor="#f1c75a" />
        <stop offset="1" stopColor="#d9962a" />
      </radialGradient>
      <linearGradient id={`${id}-rayo`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fbe08a" />
        <stop offset="1" stopColor="#d9962a" />
      </linearGradient>
    </defs>
  );
}

export default function Filete({ palabra, tam, className }: { palabra: string; tam: "marca" | "cinta" | "firma"; className?: string }) {
  const id = `filete-${useId().replace(/:/g, "")}`;

  if (tam === "cinta") {
    return (
      <svg aria-hidden viewBox="0 0 640 250" className={className}>
        <Letras x={320} y={180} tam={170} texto={palabra} id={id} anchor="middle" />
      </svg>
    );
  }

  if (tam === "marca") {
    return (
      <svg aria-hidden viewBox="145 55 365 175" className={className}>
        <Letras x={320} y={200} tam={175} texto={palabra} id={id} anchor="middle" />
      </svg>
    );
  }

  return (
    <svg aria-hidden viewBox="70 20 680 345" className={className}>
      <Adornos x0={410} yt={58} yb={330} hw={300} />
      <Letras x={410} y={253} tam={175} texto={palabra} id={id} anchor="middle" />
    </svg>
  );
}
