// T2-09 · El hielo es la mitad del trago. Textos y tiempos en hielo.datos.ts; acá, los dibujos.
import React from "react";
import { C, F } from "../kit/base";
import { entre, P, PiezaGuion, Svg, type DatosGuion, type Dibujo } from "../kit/guion";
import { datos } from "./hielo.datos";

type Cubo = { x: number; y: number; s: number; r?: number };

// Un vaso visto de costado: el líquido hasta `nivel` (0 a 1) y los cubos adentro (coordenadas del vaso).
const Vaso: React.FC<{ id: string; x: number; y: number; w: number; h: number; liquido: string; nivel: number; cubos?: Cubo[]; picado?: number; caida?: number; children?: React.ReactNode }> = ({ id, x, y, w, h, liquido, nivel, cubos = [], picado = 0, caida = 1, children }) => {
  const ab = w * 0.86;
  const forma = `M0 0 L${w} 0 L${(w + ab) / 2} ${h} L${(w - ab) / 2} ${h} Z`;
  return (
    <g transform={`translate(${x - w / 2} ${y - h})`}>
      <defs><clipPath id={id}><path d={forma} /></clipPath></defs>
      <path d={forma} fill="#F4F9FC" />
      <g clipPath={`url(#${id})`}>
        <rect x={0} y={h * (1 - nivel)} width={w} height={h} fill={liquido} />
        {Array.from({ length: Math.round(picado) }, (_, i) => {
          const rx = Math.sin(i * 91.7) * 0.5 + 0.5, ry = Math.sin(i * 37.3) * 0.5 + 0.5;
          return <rect key={i} x={rx * (w - 30) + 4} y={h - 20 - ry * h * 0.9} width={18 + (i % 3) * 6} height={14 + (i % 4) * 5} rx={4} fill="#fff" opacity={0.85} transform={`rotate(${i * 37} ${rx * w} ${h - ry * h})`} />;
        })}
        {cubos.map((c, i) => {
          const r = c.r ?? 0;
          const dy = (1 - caida) * -h * 1.4 * (1 + i * 0.25);
          return (
            <g key={i} transform={`translate(${c.x} ${c.y + dy}) rotate(${r})`}>
              <rect x={-c.s / 2} y={-c.s / 2} width={c.s} height={c.s} rx={c.s * 0.14} fill="#fff" fillOpacity={0.78} stroke="#B9D7EA" strokeWidth={3} />
              <path d={`M${-c.s * 0.3} ${-c.s * 0.25} L${-c.s * 0.05} ${-c.s * 0.32}`} stroke="#fff" strokeWidth={5} strokeLinecap="round" />
            </g>
          );
        })}
        {children}
      </g>
      <path d={forma} fill="none" stroke={C.hondo} strokeWidth={6} strokeLinejoin="round" />
      <path d={`M${w * 0.12} ${h * 0.1} L${w * 0.16} ${h * 0.8}`} stroke="#fff" strokeWidth={8} strokeLinecap="round" opacity={0.7} />
    </g>
  );
};

const lleno = (w: number, h: number, s: number, n: number): Cubo[] =>
  Array.from({ length: n }, (_, i) => ({ x: s * 0.62 + (i % 3) * ((w - s * 1.24) / 2), y: h - s * 0.6 - Math.floor(i / 3) * s * 0.92, s, r: (i * 23) % 17 - 8 }));

const Rotulo: React.FC<{ x: number; y: number; texto: string; op?: number; tachado?: boolean }> = ({ x, y, texto, op = 1, tachado }) => (
  <g transform={`translate(${x} ${y})`} opacity={op}>
    <text textAnchor="middle" fontFamily={F.texto} fontWeight={800} fontSize={40} fill={tachado ? C.suave : C.hondo}>{texto}</text>
  </g>
);

// Vaso lleno de hielo contra vaso con tres cubos.
const DosVasos: Dibujo = ({ t }) => {
  const c1 = entre(t, 0, 16), c2 = entre(t, 6, 20);
  return (
    <Svg>
      <rect width={900} height={860} fill={P.fondo} />
      <rect x={0} y={700} width={900} height={160} fill={P.madera} />
      <Vaso id="v1" x={250} y={700} w={240} h={400} liquido="#F3E7CF" nivel={0.8} cubos={lleno(240, 400, 70, 12)} caida={c1} />
      <Vaso id="v2" x={640} y={700} w={240} h={400} liquido="#F3E7CF" nivel={0.8} cubos={[{ x: 80, y: 360, s: 70, r: 8 }, { x: 160, y: 365, s: 70, r: -6 }, { x: 120, y: 300, s: 70, r: 14 }]} caida={c2} />
      <Rotulo x={250} y={790} texto="Lleno" op={entre(t, 20, 30)} />
      <Rotulo x={640} y={790} texto="3 cubos" op={entre(t, 24, 34)} />
    </Svg>
  );
};

// Los tres cubos se derriten y el trago se agua; el vaso lleno sigue frío.
const Derrite: Dibujo = ({ t, dur }) => {
  const d = entre(t, 10, dur - 20);
  const s = 70 * (1 - d * 0.65);
  const term = (x: number, calor: number) => (
    <g transform={`translate(${x} 150)`}>
      <rect x={-16} y={-70} width={32} height={150} rx={16} fill="#fff" stroke={C.hondo} strokeWidth={4} />
      <rect x={-8} y={70 - 130 * calor} width={16} height={130 * calor} rx={8} fill={calor > 0.5 ? "#E7A08B" : C.celeste} />
      <circle cx={0} cy={86} r={22} fill={calor > 0.5 ? "#E7A08B" : C.celeste} stroke={C.hondo} strokeWidth={4} />
    </g>
  );
  return (
    <Svg>
      <rect width={900} height={860} fill={P.fondo} />
      <rect x={0} y={700} width={900} height={160} fill={P.madera} />
      <Vaso id="d1" x={250} y={700} w={240} h={400} liquido="#F3E7CF" nivel={0.8} cubos={lleno(240, 400, 70, 12)} />
      <Vaso id="d2" x={640} y={700} w={240} h={400} liquido={d > 0.5 ? "#F7F0E2" : "#F3E7CF"} nivel={0.8 + d * 0.06} cubos={[{ x: 80, y: 360, s, r: 8 }, { x: 160, y: 365, s, r: -6 }, { x: 120, y: 360 - s, s, r: 14 }]} />
      {term(400, 0.25)}
      {term(790, 0.25 + 0.6 * d)}
      <Rotulo x={250} y={790} texto="Frío y entero" op={entre(t, dur - 40, dur - 28)} />
      <Rotulo x={640} y={790} texto="Aguado" op={entre(t, dur - 50, dur - 38)} />
    </Svg>
  );
};

// Un cubo grande en vaso corto: whisky y Negroni.
const CuboGrande: Dibujo = ({ t }) => {
  const c = entre(t, 0, 18), c2 = entre(t, 10, 28);
  return (
    <Svg>
      <rect width={900} height={860} fill={P.fondo} />
      <rect x={0} y={680} width={900} height={180} fill={P.madera} />
      <Vaso id="g1" x={260} y={680} w={260} h={260} liquido="#D9A35B" nivel={0.62} cubos={[{ x: 130, y: 150, s: 150, r: 6 }]} caida={c} />
      <Vaso id="g2" x={640} y={680} w={260} h={260} liquido="#C8553D" nivel={0.62} cubos={[{ x: 130, y: 150, s: 150, r: -5 }]} caida={c2}>
        <path d="M150 60 a40 40 0 0 1 80 0 Z" fill="#F0A04B" transform="translate(-10 0)" />
      </Vaso>
      <Rotulo x={260} y={770} texto="Whisky" op={entre(t, 22, 32)} />
      <Rotulo x={640} y={770} texto="Negroni" op={entre(t, 28, 38)} />
      <g opacity={entre(t, 40, 52)} transform="translate(450 190)">
        <text textAnchor="middle" fontFamily={F.texto} fontWeight={700} fontSize={42} fill={C.suave}>Se derrite lento: el trago no se agua</text>
      </g>
    </Svg>
  );
};

// Vaso alto lleno de cubos comunes: gin tonic y fernet.
const CubosComunes: Dibujo = ({ t }) => {
  const c = entre(t, 0, 20), c2 = entre(t, 10, 30);
  return (
    <Svg>
      <rect width={900} height={860} fill={P.fondo} />
      <rect x={0} y={740} width={900} height={120} fill={P.madera} />
      <Vaso id="c1" x={260} y={740} w={210} h={520} liquido="#E8F2E6" nivel={0.86} cubos={lleno(210, 520, 62, 21)} caida={c}>
        <circle cx={150} cy={90} r={46} fill="#D7E99A" stroke="#A9C45A" strokeWidth={6} />
      </Vaso>
      <Vaso id="c2" x={640} y={740} w={210} h={520} liquido="#3B2A24" nivel={0.8} cubos={lleno(210, 520, 62, 21)} caida={c2}>
        <rect x={0} y={520 * 0.2 - 30} width={210} height={40} fill="#D9C4AE" />
      </Vaso>
      <Rotulo x={260} y={810} texto="Gin tonic" op={entre(t, 26, 36)} />
      <Rotulo x={640} y={810} texto="Fernet" op={entre(t, 32, 42)} />
    </Svg>
  );
};

// Hielo picado con menta: Mojito.
const Picado: Dibujo = ({ t }) => {
  const n = 70 * entre(t, 0, 40);
  const hojas = entre(t, 30, 50);
  return (
    <Svg>
      <rect width={900} height={860} fill={P.fondo} />
      <rect x={0} y={740} width={900} height={120} fill={P.madera} />
      <Vaso id="m1" x={450} y={740} w={300} h={540} liquido="#EEF6E4" nivel={0.85} picado={n}>
        {[0, 1, 2, 3, 4].map((i) => (
          <ellipse key={i} cx={60 + i * 45} cy={430 - (i % 2) * 120} rx={30} ry={16} fill="#5FA463" opacity={hojas} transform={`rotate(${i * 40 - 30} ${60 + i * 45} ${430 - (i % 2) * 120})`} />
        ))}
      </Vaso>
      <g opacity={hojas} transform="translate(450 190)">
        {[0, 1, 2].map((i) => <ellipse key={i} cx={-40 + i * 40} cy={(i % 2) * 14} rx={36} ry={18} fill="#5FA463" transform={`rotate(${i * 50 - 50} ${-40 + i * 40} 0)`} />)}
      </g>
      <Rotulo x={450} y={810} texto="Mojito" op={entre(t, 40, 52)} />
    </Svg>
  );
};

// El hielo de la coctelera se tira; al vaso, hielo nuevo.
const Colador: Dibujo = ({ t }) => {
  const sacude = Math.sin(t * 1.6) * 14 * (1 - entre(t, 18, 26));
  const vierte = entre(t, 26, 44);
  const tira = entre(t, 50, 70);
  const nuevo = entre(t, 62, 84);
  return (
    <Svg>
      <rect width={900} height={860} fill={P.fondo} />
      <rect x={0} y={740} width={900} height={120} fill={P.madera} />
      <g transform={`translate(${300 + vierte * 60} ${300 - vierte * 40}) rotate(${sacude + vierte * 115})`}>
        <path d="M-70 -150 L70 -150 L60 120 L-60 120 Z" fill="#D8E2EA" stroke={C.hondo} strokeWidth={6} strokeLinejoin="round" />
        <rect x={-80} y={-170} width={160} height={30} rx={10} fill="#C3D0DA" stroke={C.hondo} strokeWidth={6} />
        <path d="M-74 -175 h148" stroke={C.hondo} strokeWidth={4} strokeDasharray="8 8" />
      </g>
      {vierte > 0.6 && (
        <path d={`M430 360 Q 470 ${420 + vierte * 40} 520 ${560}`} stroke="#E7C9A0" strokeWidth={16 * (1 - tira)} fill="none" strokeLinecap="round" />
      )}
      <Vaso id="n1" x={560} y={740} w={220} h={300} liquido="#F2D9B0" nivel={0.75 * vierte} cubos={lleno(220, 300, 64, 9)} caida={nuevo} />
      <g transform="translate(160 740)" opacity={entre(t, 44, 54)}>
        <path d="M-80 0 L-95 -150 L95 -150 L80 0 Z" fill="#C9D6E0" stroke={C.hondo} strokeWidth={5} />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={-50 + i * 34} y={-150 - 160 + tira * 170 + i * 10} width={44} height={44} rx={8} fill="#fff" fillOpacity={0.6} stroke="#B9D7EA" strokeWidth={3} opacity={tira > 0 && tira < 0.98 ? 1 : 0} />
        ))}
        <text y={-170} textAnchor="middle" fontFamily={F.texto} fontWeight={800} fontSize={34} fill={C.suave} opacity={tira}>Usado</text>
      </g>
      <Rotulo x={560} y={810} texto="Hielo nuevo" op={entre(t, 80, 92)} />
    </Svg>
  );
};

export const dibujos: Record<string, Dibujo> = { dosVasos: DosVasos, derrite: Derrite, cuboGrande: CuboGrande, cubosComunes: CubosComunes, picado: Picado, colador: Colador };

export const Hielo: React.FC<{ d?: DatosGuion }> = ({ d = datos }) => <PiezaGuion d={d} dibujos={dibujos} />;
