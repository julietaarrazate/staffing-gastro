// T3-05 · Una cebolla en 20 segundos. Textos y tiempos en cebolla.datos.ts; acá, los dibujos.
// La cebolla se ve de costado, con la raíz a la derecha: los cortes nunca la tocan.
import React from "react";
import { C, F } from "../kit/base";
import { entre, P, PiezaGuion, Svg, type DatosGuion, type Dibujo } from "../kit/guion";
import { datos } from "./cebolla.datos";

const CEB = { piel: "#D9A066", pielOsc: "#B97A42", carne: "#F7F0E6", capa: "#E8D9C6", raiz: "#9C7A55" };
const CX = 430, BASE = 640, R = 250; // la media cebolla: centro, base sobre la tabla, radio
const RAIZ = CX + R; // la raíz, a la derecha

const Tabla: React.FC = () => (
  <>
    <rect width={900} height={860} fill={P.fondo} />
    <rect x={40} y={BASE} width={820} height={70} rx={20} fill={P.madera} />
    <rect x={40} y={BASE + 50} width={820} height={20} rx={10} fill={P.maderaOsc} />
  </>
);

const Cuchillo: React.FC<{ x: number; y: number; rot?: number; largo?: number; op?: number }> = ({ x, y, rot = 0, largo = 380, op = 1 }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`} opacity={op}>
    <path d={`M0 0 L${largo} 0 Q${largo - 30} 56 ${largo * 0.2} 60 L0 60 Z`} fill="#E3EAF0" stroke={C.hondo} strokeWidth={5} strokeLinejoin="round" />
    <path d={`M${largo * 0.15} 50 L${largo - 40} 46`} stroke="#fff" strokeWidth={5} strokeLinecap="round" />
    <rect x={-170} y={-2} width={170} height={58} rx={22} fill={C.noche1} />
    {[-130, -70].map((cx) => <circle key={cx} cx={cx} cy={27} r={7} fill="#7A8794" />)}
  </g>
);

// La media cebolla, apoyada sobre la parte plana; `pelada` saca la piel.
const Media: React.FC<{ pelada?: number; dx?: number; children?: React.ReactNode }> = ({ pelada = 1, dx = 0, children }) => (
  <g transform={`translate(${dx} 0)`}>
    <defs><clipPath id="domo"><path d={`M${CX - R} ${BASE} A${R} ${R} 0 0 1 ${CX + R} ${BASE} Z`} /></clipPath></defs>
    <path d={`M${CX - R - 12} ${BASE} A${R + 12} ${R + 12} 0 0 1 ${CX + R + 12} ${BASE} Z`} fill={CEB.piel} opacity={1 - pelada} />
    <path d={`M${CX - R} ${BASE} A${R} ${R} 0 0 1 ${CX + R} ${BASE} Z`} fill={CEB.carne} />
    {[200, 150, 100, 55].map((r) => <path key={r} d={`M${CX - r} ${BASE} A${r} ${r} 0 0 1 ${CX + r} ${BASE}`} fill="none" stroke={CEB.capa} strokeWidth={6} />)}
    <g clipPath="url(#domo)">{children}</g>
    <path d={`M${CX - R} ${BASE} A${R} ${R} 0 0 1 ${CX + R} ${BASE}`} fill="none" stroke={CEB.capa} strokeWidth={8} />
    <g transform={`translate(${RAIZ} ${BASE - 20})`}>
      {[-24, -8, 8, 24].map((a, i) => <path key={i} d={`M0 0 q30 ${a} 56 ${a * 1.4}`} stroke={CEB.raiz} strokeWidth={6} fill="none" strokeLinecap="round" />)}
      <rect x={-16} y={-34} width={30} height={52} rx={10} fill={CEB.raiz} />
    </g>
  </g>
);

const alto = (x: number) => Math.sqrt(Math.max(0, R * R - (x - CX) ** 2));
const VERT = Array.from({ length: 8 }, (_, i) => CX - R + 50 + i * 52); // hasta 4 dedos antes de la raíz

const Entera: Dibujo = ({ t }) => {
  const s = entre(t, 0, 14);
  return (
    <Svg>
      <Tabla />
      <g transform={`translate(330 ${BASE - 190 - (1 - s) * 50})`} opacity={s}>
        <circle r={190} fill={CEB.piel} />
        <path d="M-120 -120 Q0 -40 120 -120" stroke={CEB.pielOsc} strokeWidth={6} fill="none" opacity={0.5} />
        <path d="M-150 40 Q0 120 150 40" stroke={CEB.pielOsc} strokeWidth={6} fill="none" opacity={0.5} />
        <path d="M-20 -186 Q0 -250 30 -270" stroke={CEB.pielOsc} strokeWidth={14} fill="none" strokeLinecap="round" />
      </g>
      <Cuchillo x={560} y={BASE - 70} rot={0} largo={260} op={entre(t, 10, 22)} />
    </Svg>
  );
};

const Mitad: Dibujo = ({ t }) => {
  const linea = entre(t, 6, 26);
  const abre = entre(t, 30, 46);
  const ring = entre(t, 44, 56);
  const cy = BASE - 220;
  return (
    <Svg>
      <Tabla />
      {/* La cebolla parada, raíz abajo: se corta de la punta a la raíz. */}
      <g transform={`translate(450 ${cy})`}>
        <g transform={`translate(${-abre * 120} 0) rotate(${-abre * 8})`}>
          <path d="M0 -200 A200 200 0 0 0 0 200 Z" fill={abre > 0 ? CEB.carne : CEB.piel} stroke={CEB.piel} strokeWidth={14} />
          {abre > 0 && [150, 100, 55].map((r) => <path key={r} d={`M0 ${-r} A${r} ${r} 0 0 0 0 ${r}`} fill="none" stroke={CEB.capa} strokeWidth={6} />)}
        </g>
        <g transform={`translate(${abre * 120} 0) rotate(${abre * 8})`}>
          <path d="M0 -200 A200 200 0 0 1 0 200 Z" fill={abre > 0 ? CEB.carne : CEB.piel} stroke={CEB.piel} strokeWidth={14} />
          {abre > 0 && [150, 100, 55].map((r) => <path key={r} d={`M0 ${-r} A${r} ${r} 0 0 1 0 ${r}`} fill="none" stroke={CEB.capa} strokeWidth={6} />)}
        </g>
        <path d="M0 -250 L0 210" stroke={C.hondo} strokeWidth={8} strokeDasharray="22 16" pathLength={1} opacity={1 - abre} style={{ strokeDasharray: `${linea} 1` }} />
        <g transform="translate(0 210)">
          {[-20, -6, 6, 20].map((a, i) => <path key={i} d={`M0 0 q${a} 30 ${a * 1.4} 50`} stroke={CEB.raiz} strokeWidth={6} fill="none" strokeLinecap="round" />)}
        </g>
        {ring > 0 && (
          <g opacity={ring} transform="translate(0 225)">
            <circle r={70} fill="none" stroke={C.hondo} strokeWidth={8} />
            <text x={100} y={14} fontFamily={F.texto} fontWeight={800} fontSize={44} fill={C.hondo}>raíz</text>
          </g>
        )}
      </g>
    </Svg>
  );
};

const Plana: Dibujo = ({ t }) => {
  const baja = entre(t, 0, 20);
  const pelada = entre(t, 30, 60);
  return (
    <Svg>
      <Tabla />
      <g transform={`translate(0 ${(1 - baja) * -120})`}><Media pelada={pelada} /></g>
      {pelada > 0.02 && pelada < 0.98 && (
        <path d={`M${CX - R - 40 - pelada * 80} ${BASE - 30 + pelada * 20} q40 -120 140 -200`} stroke={CEB.piel} strokeWidth={22} fill="none" strokeLinecap="round" opacity={1 - pelada} />
      )}
      <g opacity={entre(t, 70, 84)}>
        <path d={`M${CX - R} ${BASE + 100} H${CX + R}`} stroke={C.hondo} strokeWidth={6} />
        <text x={CX} y={BASE + 160} textAnchor="middle" fontFamily={F.texto} fontWeight={800} fontSize={40} fill={C.hondo}>parte plana abajo</text>
      </g>
    </Svg>
  );
};

const Verticales: Dibujo = ({ t }) => {
  const n = VERT.length;
  const k = entre(t, 8, 90) * n;
  const actual = Math.min(n - 1, Math.floor(k));
  const cx = VERT[actual];
  return (
    <Svg>
      <Tabla />
      <Media>
        {VERT.map((x, i) => {
          const p = Math.max(0, Math.min(1, k - i));
          const top = BASE - alto(x) - 10;
          return p > 0 ? <line key={i} x1={x} y1={top} x2={x} y2={top + (BASE - top) * p} stroke={C.hondo} strokeWidth={5} /> : null;
        })}
      </Media>
      <Cuchillo x={cx - 8} y={BASE - alto(cx) - 120 + (k % 1) * 90} rot={90} largo={200} op={k < n ? 1 : 1 - entre(t, 92, 100)} />
      <g opacity={entre(t, 40, 52)}>
        <path d={`M${RAIZ - 40} ${BASE - 150} q30 -60 90 -70`} stroke={C.hondo} strokeWidth={5} fill="none" />
        <text x={RAIZ + 60} y={BASE - 225} textAnchor="middle" fontFamily={F.texto} fontWeight={800} fontSize={36} fill={C.hondo}>sin tocarla</text>
      </g>
    </Svg>
  );
};

const Horizontales: Dibujo = ({ t }) => {
  const h1 = entre(t, 10, 40), h2 = entre(t, 50, 80);
  const y1 = BASE - 70, y2 = BASE - 150;
  const fin = RAIZ - 60;
  const x0 = CX - R - 10;
  const kx = h2 > 0 ? x0 + (fin - x0) * h2 : x0 + (fin - x0) * h1;
  const ky = h2 > 0 ? y2 : y1;
  return (
    <Svg>
      <Tabla />
      <Media>
        {VERT.map((x, i) => <line key={i} x1={x} y1={BASE - alto(x) - 10} x2={x} y2={BASE} stroke={C.hondo} strokeWidth={5} opacity={0.5} />)}
        <line x1={x0} y1={y1} x2={x0 + (fin - x0) * h1} y2={y1} stroke={C.hondo} strokeWidth={6} />
        <line x1={x0} y1={y2} x2={x0 + (fin - x0) * h2} y2={y2} stroke={C.hondo} strokeWidth={6} />
      </Media>
      <Cuchillo x={kx - 220} y={ky - 30} rot={0} largo={220} op={1 - entre(t, 90, 100)} />
    </Svg>
  );
};

const Costado: Dibujo = ({ t }) => {
  const n = 7;
  const k = entre(t, 6, 96) * n;
  const xs = Array.from({ length: n }, (_, i) => CX - R + 40 + i * 58);
  const cubos = Array.from({ length: Math.floor(k) * 6 }, (_, i) => ({ x: 120 + (i % 9) * 26 + Math.sin(i) * 6, y: BASE - 22 - Math.floor(i / 9) * 22, r: (i * 37) % 30 }));
  const corte = xs[Math.min(n - 1, Math.floor(k))];
  return (
    <Svg>
      <Tabla />
      <g transform="translate(140 0)">
        <Media>
          {VERT.map((x, i) => <line key={i} x1={x} y1={BASE - alto(x) - 10} x2={x} y2={BASE} stroke={C.hondo} strokeWidth={4} opacity={0.4} />)}
          {[BASE - 70, BASE - 150].map((y) => <line key={y} x1={CX - R} y1={y} x2={RAIZ - 60} y2={y} stroke={C.hondo} strokeWidth={4} opacity={0.4} />)}
          <rect x={CX - R - 10} y={BASE - R - 10} width={Math.max(0, corte - (CX - R) + 10)} height={R + 20} fill={P.fondo} />
        </Media>
        <Cuchillo x={corte - 8} y={BASE - 330 + (k % 1) * 120} rot={90} largo={260} op={k < n ? 1 : 0} />
      </g>
      {cubos.map((c, i) => <rect key={i} x={c.x} y={c.y} width={20} height={20} rx={4} fill={CEB.carne} stroke={CEB.capa} strokeWidth={3} transform={`rotate(${c.r} ${c.x + 10} ${c.y + 10})`} />)}
      <text x={240} y={BASE + 150} textAnchor="middle" fontFamily={F.texto} fontWeight={800} fontSize={40} fill={C.hondo} opacity={entre(t, 70, 84)}>pareja</text>
    </Svg>
  );
};

const Frio: Dibujo = ({ t }) => {
  const brillo = entre(t, 20, 40);
  return (
    <Svg>
      <rect width={900} height={860} fill={P.fondo} />
      <g transform="translate(230 300)" opacity={entre(t, 0, 14)}>
        <Cuchillo x={0} y={0} largo={300} />
        <path d={`M${40 + brillo * 220} 10 l20 30`} stroke="#fff" strokeWidth={10} strokeLinecap="round" opacity={brillo < 1 ? 1 : 0} />
        {[0, 1, 2].map((i) => <path key={i} d={`M${270 + i * 20} ${-30 - i * 16} l12 -22`} stroke={C.hondo} strokeWidth={5} strokeLinecap="round" opacity={entre(t, 36 + i * 4, 44 + i * 4)} />)}
      </g>
      <g transform="translate(570 400)" opacity={entre(t, 10, 26)}>
        <rect x={0} y={0} width={220} height={380} rx={26} fill="#fff" stroke={C.hondo} strokeWidth={6} />
        <line x1={0} y1={130} x2={220} y2={130} stroke={C.hondo} strokeWidth={6} />
        <rect x={180} y={40} width={12} height={60} rx={6} fill={C.hondo} />
        <rect x={180} y={170} width={12} height={90} rx={6} fill={C.hondo} />
        <g transform="translate(90 260)">
          {[0, 60, 120].map((a) => <line key={a} x1={0} y1={-40} x2={0} y2={40} stroke={C.celeste} strokeWidth={9} strokeLinecap="round" transform={`rotate(${a})`} />)}
        </g>
      </g>
    </Svg>
  );
};

export const dibujos: Record<string, Dibujo> = { entera: Entera, mitad: Mitad, plana: Plana, verticales: Verticales, horizontales: Horizontales, costado: Costado, frio: Frio };

export const Cebolla: React.FC<{ d?: DatosGuion }> = ({ d = datos }) => <PiezaGuion d={d} dibujos={dibujos} />;
