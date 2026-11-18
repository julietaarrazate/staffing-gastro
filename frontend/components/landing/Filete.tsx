import { useId, type ReactNode } from "react";
import { ADORNOS_CAJA, ADORNOS_SVG } from "./filete-adornos";

/**
 * El «oído» fileteado: letra gorda e inclinada (Shrikhand desde el
 * 2026-11-17, como la letra fantasía de los carteles fileteados; antes
 * Sancreek) en crema, con filete interior de luz, borde y relieve azul hondo
 * y canto dorado. Los mismos dibujos en vector, con la letra convertida a
 * trazos, están en docs/design-system/marca/.
 *
 * En el tamaño grande, los adornos (desde el 2026-11-18, con cuerpo: hasta
 * ahí eran líneas doradas de 1 a 2 px que en el celular no se veían): cuatro
 * volutas celestes con relieve y alas de hojas, filete dorado por dentro, una
 * flor roja arriba y una rosa abajo. El dibujo no se escribe acá: lo genera
 * `scripts/build-filete.mjs` en `filete-adornos.ts` (nivel «medio»; el
 * «cargado», con cinta y más flores, es sólo para la miniatura al compartir).
 * El rojo y el rosa viven sólo adentro del filete, igual que el crema.
 *
 * Tres tamaños: `firma` (con adornos: pantalla de inicio y final de la
 * landing, LandingFooter.tsx), `marca` (sólo la palabra) y `cinta` («¡Oído!»
 * en la comanda). El `Sol` quedó sin uso en la landing desde el 2026-11-18.
 * Los colores son del cartel, no tokens: se ve igual en cualquier tema.
 */
const RAYO = "#9a6410";
const HONDO = "#14456a";
const HONDO_CLARO = "#1c5478";
const CANTO = "#c98a1a";
const FUENTE = "var(--font-shrikhand), Georgia, serif";

const r1 = (n: number) => Math.round(n * 10) / 10;

/** El sol, a la manera del Sol de Mayo: rayos rectos y ondulados alternados y disco con relieve. */
export function Sol({
  cx,
  cy,
  r,
  id,
  rayos = 32,
  claseRayos,
}: {
  cx: number;
  cy: number;
  r: number;
  id: string;
  rayos?: number;
  /** Clase para el grupo de los rayos solos (el disco y su relieve no giran). */
  claseRayos?: string;
}) {
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
      <g className={claseRayos}>{piezas}</g>
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
    <svg aria-hidden viewBox={ADORNOS_CAJA} className={className}>
      {/* Dibujo estático generado por scripts/build-filete.mjs (no hay datos
          de nadie acá adentro); el id distingue degradés y filtros por copia. */}
      <g dangerouslySetInnerHTML={{ __html: ADORNOS_SVG.replace(/__ID__/g, id) }} />
      <Letras x={410} y={253} tam={175} texto={palabra} id={id} anchor="middle" />
    </svg>
  );
}
