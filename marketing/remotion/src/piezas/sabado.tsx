// T6-05 · Cosas que solo entiende quien laburó un sábado. Los textos y tiempos están en sabado.datos.ts;
// acá, los dibujos de cada escena.
import React from "react";
import { C, F } from "../kit/base";
import { entre, P, PersonaArriba, PersonaFrente, Plato, PiezaGuion, RelojTexto, Svg, type DatosGuion, type Dibujo } from "../kit/guion";
import { datos } from "./sabado.datos";

const rnd = (i: number, n: number) => { const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return x - Math.floor(x); };

// Salón explotado visto desde arriba: mesas llenas y dos mozos que no paran.
const Salon: Dibujo = ({ t }) => {
  const mesas = [0, 1, 2].flatMap((f) => [0, 1, 2].map((c) => ({ x: 170 + c * 280 + (f % 2) * 40, y: 160 + f * 270 })));
  const z = 1.08 - 0.08 * entre(t, 0, 60);
  return (
    <Svg>
      <rect width={900} height={860} fill={P.fondo} />
      <g transform={`translate(450 430) scale(${z}) translate(-450 -430)`}>
        {Array.from({ length: 10 }, (_, i) => <line key={i} x1={0} y1={i * 90} x2={900} y2={i * 90} stroke="#E2ECF4" strokeWidth={2} />)}
        {mesas.map((m, i) => {
          const s = entre(t, i * 1.2, i * 1.2 + 8);
          return (
            <g key={i} opacity={s}>
              {[0, 1, 2, 3].map((k) => {
                const a = (k * Math.PI) / 2 + 0.4;
                return <PersonaArriba key={k} x={m.x + Math.cos(a) * 86} y={m.y + Math.sin(a) * 86} r={24} c={P.gente[(i + k) % 6]} rot={(a * 180) / Math.PI + 90} />;
              })}
              <circle cx={m.x} cy={m.y} r={62} fill="#fff" stroke={P.suave} strokeWidth={3} />
              {[0, 1, 2, 3].map((k) => <circle key={k} cx={m.x + Math.cos((k * Math.PI) / 2 + 0.4) * 36} cy={m.y + Math.sin((k * Math.PI) / 2 + 0.4) * 36} r={14} fill={P.mesa} />)}
            </g>
          );
        })}
        {[0, 1].map((k) => {
          const u = (t / 40 + k * 0.5) % 1;
          const x = k ? 900 - u * 900 : u * 900;
          const y = k ? 300 : 570;
          return (
            <g key={k}>
              <PersonaArriba x={x} y={y + Math.sin(u * 20) * 6} r={28} c={C.tinta} rot={k ? -90 : 90} />
              <circle cx={x + (k ? -30 : 30)} cy={y - 22} r={20} fill="#fff" stroke={P.suave} strokeWidth={3} />
            </g>
          );
        })}
      </g>
    </Svg>
  );
};

// La carta, sobre la mesa. Y el anillo que la señala.
const Carta: Dibujo = ({ t }) => {
  const s = entre(t, 0, 14);
  const ring = entre(t, 30, 44);
  const late = 1 + 0.05 * Math.sin(t / 4);
  return (
    <Svg>
      <rect width={900} height={860} fill={P.fondo} />
      <circle cx={450} cy={470} r={360} fill={P.madera} />
      <circle cx={450} cy={470} r={360} fill="none" stroke={P.maderaOsc} strokeWidth={6} />
      <Plato x={250} y={330} r={70} />
      <g transform="translate(670 330)"><circle r={38} fill="#fff" stroke={P.suave} strokeWidth={3} /><circle r={26} fill="#DCEBF5" /></g>
      <g transform={`translate(470 ${560 - (1 - s) * 40}) rotate(-8)`} opacity={s}>
        <rect x={-150} y={-190} width={300} height={380} rx={18} fill="#fff" stroke={C.hondo} strokeWidth={5} />
        <text x={0} y={-110} textAnchor="middle" fontFamily={F.texto} fontWeight={800} fontSize={58} fill={C.hondo} letterSpacing="0.06em">CARTA</text>
        {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={-110} y={-60 + i * 42} width={150 + (i % 3) * 20} height={12} rx={6} fill={P.suave} />)}
        {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={80} y={-60 + i * 42} width={30} height={12} rx={6} fill={P.suave} />)}
      </g>
      {ring > 0 && (
        <g transform={`translate(470 560) scale(${late})`} opacity={ring}>
          <ellipse rx={235} ry={260} fill="none" stroke={C.hondo} strokeWidth={9} strokeDasharray="28 18" transform="rotate(-8)" />
        </g>
      )}
    </Svg>
  );
};

// 21:30: se abre la puerta y no paran de entrar. Ocho nomás.
const Puerta: Dibujo = ({ t }) => {
  const abre = entre(t, 6, 20);
  const n = Math.min(8, Math.max(0, Math.floor((t - 16) / 7) + 1));
  return (
    <Svg>
      <rect width={900} height={860} fill={P.fondo} />
      <rect x={0} y={720} width={900} height={140} fill={P.mesa} />
      <RelojTexto x={720} y={110} texto="21:30" size={56} />
      <rect x={70} y={170} width={260} height={560} rx={10} fill={C.noche1} />
      <g transform={`translate(70 170) skewY(${abre * 8}) scale(${1 - abre * 0.82} 1)`}>
        <rect width={260} height={560} rx={10} fill={C.hondo} />
        <circle cx={226} cy={300} r={12} fill={P.suave} />
      </g>
      {Array.from({ length: 8 }, (_, i) => {
        const llega = entre(t, 16 + i * 7, 28 + i * 7);
        const x = 220 + i * 84 + (1 - llega) * -60;
        return llega > 0 ? <PersonaFrente key={i} x={x} y={730 - (i % 2) * 12} h={250 - (i % 3) * 18} c={P.gente[i % 6]} op={llega} /> : null;
      })}
      <g transform="translate(120 110)">
        <circle r={62} fill="#fff" stroke={C.hondo} strokeWidth={5} />
        <text y={24} textAnchor="middle" fontFamily={F.texto} fontWeight={800} fontSize={68} fill={C.hondo}>{n}</text>
      </g>
    </Svg>
  );
};

// El pase lleno de platos, la campana… y nadie.
const Pase: Dibujo = ({ t }) => {
  const golpe = Math.max(0, 1 - Math.abs(t - 22) / 8);
  const globo = entre(t, 22, 30);
  const platos = Array.from({ length: 12 }, (_, i) => ({ x: 130 + (i % 6) * 128, y: 520 + Math.floor(i / 6) * 120 }));
  return (
    <Svg>
      <rect width={900} height={860} fill={P.fondo} />
      <rect x={0} y={0} width={900} height={400} fill="#DDE9F2" />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={60 + i * 210} y={70} width={150} height={10} rx={5} fill={P.suave} />)}
      <rect x={40} y={440} width={820} height={300} rx={24} fill="#fff" stroke={P.suave} strokeWidth={4} />
      {platos.map((p, i) => <Plato key={i} x={p.x} y={p.y} r={52} comida={["#E8B48A", "#9CC59B", "#E7A08B", "#D8C59E"][i % 4]} s={entre(t, i * 1.5, i * 1.5 + 8)} />)}
      <g transform={`translate(760 400) rotate(${Math.sin(t * 1.4) * 14 * golpe})`}>
        <path d="M-60 0 A60 60 0 0 1 60 0 Z" fill={C.hondo} />
        <rect x={-74} y={0} width={148} height={14} rx={7} fill={C.hondo} />
        <circle cx={0} cy={-66} r={10} fill={C.hondo} />
      </g>
      {globo > 0 && (
        <g transform={`translate(420 230) scale(${0.6 + 0.4 * globo})`} opacity={globo}>
          <rect x={-200} y={-80} width={400} height={150} rx={40} fill="#fff" stroke={C.hondo} strokeWidth={5} />
          <path d="M120 70 L170 120 L80 70 Z" fill="#fff" stroke={C.hondo} strokeWidth={5} strokeLinejoin="round" />
          <rect x={80} y={62} width={44} height={14} fill="#fff" />
          <text y={22} textAnchor="middle" fontFamily={F.texto} fontWeight={800} fontSize={74} fill={C.hondo}>¡Oído!</text>
        </g>
      )}
      <text x={450} y={820} textAnchor="middle" fontFamily={F.mono} fontWeight={500} fontSize={34} fill={C.suave} opacity={entre(t, 40, 52)} letterSpacing="0.08em">… (silencio)</text>
    </Svg>
  );
};

// Media medialuna, fría, a las 2.
const Medialuna: Dibujo = ({ t }) => {
  const s = entre(t, 4, 18);
  return (
    <Svg>
      <rect width={900} height={860} fill={P.fondo} />
      <RelojTexto x={450} y={150} texto="02:00" size={76} op={entre(t, 0, 10)} />
      <g transform="translate(450 520)">
        <ellipse cx={0} cy={30} rx={250} ry={90} fill="#DCE7EF" />
        <ellipse cx={0} cy={0} rx={250} ry={90} fill="#fff" stroke={P.suave} strokeWidth={4} />
        <ellipse cx={0} cy={0} rx={170} ry={58} fill="none" stroke={P.suave} strokeWidth={3} />
        <g transform={`translate(-20 ${-10 - (1 - s) * 60}) rotate(-6)`} opacity={s}>
          <path d="M-130 10 C-110 -70 30 -80 60 -30 L60 30 C20 40 -80 50 -130 10 Z" fill="#E3B77E" />
          {[-90, -50, -10, 30].map((x, i) => <path key={i} d={`M${x} ${-48 + i * 4} q14 30 4 60`} stroke="#C8924F" strokeWidth={6} fill="none" strokeLinecap="round" />)}
          <path d="M60 -30 L60 30" stroke="#F3DDBB" strokeWidth={12} strokeLinecap="round" />
        </g>
      </g>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${640 + i * 46} ${400 - i * 30})`} opacity={entre(t, 24 + i * 5, 34 + i * 5)}>
          {[0, 60, 120].map((a) => <line key={a} x1={0} y1={-18} x2={0} y2={18} stroke={C.celeste} strokeWidth={5} strokeLinecap="round" transform={`rotate(${a})`} />)}
        </g>
      ))}
    </Svg>
  );
};

// El ticket de la mesa de 12, que no termina más.
const Ticket: Dibujo = ({ t, dur }) => {
  const largo = 160 + entre(t, 6, dur - 10) * 1500;
  const sube = Math.max(0, largo - 680);
  const items = ["Milanesa napo", "Agua sin gas", "Fernet", "Ravioles", "Flan c/ dulce", "Cortado", "Papas fritas", "Coca", "Ensalada", "Vino copa", "Bife", "Helado", "Agua con gas", "Provoleta", "Café", "Tiramisú", "Limonada", "Sorrentinos", "Birra", "Medialuna", "Postre", "Cortado"];
  return (
    <Svg>
      <rect width={900} height={860} fill={P.fondo} />
      <rect x={250} y={0} width={400} height={40} rx={12} fill={C.noche1} />
      <g transform={`translate(0 ${-sube})`}>
        <path d={`M280 30 H620 V${30 + largo} l-20 16 l-20 -16 l-20 16 l-20 -16 l-20 16 l-20 -16 l-20 16 l-20 -16 l-20 16 l-20 -16 l-20 16 l-20 -16 l-20 16 l-20 -16 l-20 16 l-20 -16 l-20 16 l-20 -16 Z`} fill="#fff" stroke={P.suave} strokeWidth={3} />
        <text x={450} y={100} textAnchor="middle" fontFamily={F.mono} fontWeight={500} fontSize={34} fill={C.tinta}>MESA 12</text>
        {items.map((it, i) => (
          <g key={i} opacity={30 + 150 + i * 62 < largo ? 1 : 0}>
            <text x={310} y={170 + i * 62} fontFamily={F.mono} fontSize={28} fill={C.suave}>1 {it}</text>
            <text x={590} y={170 + i * 62} textAnchor="end" fontFamily={F.mono} fontSize={28} fill={C.suave}>$…</text>
          </g>
        ))}
      </g>
      <g opacity={entre(t, dur - 28, dur - 18)} transform="translate(450 760)">
        <rect x={-260} y={-50} width={520} height={92} rx={46} fill={C.hondo} />
        <text y={14} textAnchor="middle" fontFamily={F.texto} fontWeight={800} fontSize={40} fill="#fff">12 cuentas separadas</text>
      </g>
    </Svg>
  );
};

// El delantal colgado, esperando el domingo.
const Delantal: Dibujo = ({ t }) => {
  const balanceo = Math.sin(t / 14) * 3 * (1 - entre(t, 40, 100));
  return (
    <Svg>
      <rect width={900} height={860} fill={P.fondo} />
      <rect x={0} y={0} width={900} height={860} fill="url(#pared)" />
      <defs><pattern id="pared" width={60} height={60} patternUnits="userSpaceOnUse"><rect width={60} height={60} fill={P.fondo} /><rect width={58} height={28} fill="#E7F0F6" /></pattern></defs>
      <rect x={410} y={110} width={80} height={24} rx={10} fill={C.noche1} />
      <path d="M450 134 q0 40 -20 46" stroke={C.noche1} strokeWidth={10} fill="none" strokeLinecap="round" />
      <g transform={`translate(450 170) rotate(${balanceo})`}>
        <path d="M-60 0 Q0 -30 60 0" stroke={C.hondo} strokeWidth={8} fill="none" />
        <path d="M-90 20 H90 L110 300 Q120 520 0 540 Q-120 520 -110 300 Z" fill={C.hondo} />
        <path d="M-110 300 H110" stroke="#fff" strokeOpacity=".35" strokeWidth={6} />
        <rect x={-70} y={360} width={140} height={90} rx={12} fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth={5} />
        <path d="M-110 300 C-180 310 -200 330 -230 380" stroke={C.hondo} strokeWidth={10} fill="none" strokeLinecap="round" />
        <path d="M110 300 C180 310 200 340 210 400" stroke={C.hondo} strokeWidth={10} fill="none" strokeLinecap="round" />
      </g>
      <g transform="translate(720 160)" opacity={entre(t, 10, 22)}>
        <rect x={-80} y={-60} width={160} height={150} rx={18} fill="#fff" stroke={P.suave} strokeWidth={4} />
        <rect x={-80} y={-60} width={160} height={44} rx={18} fill={C.hondo} />
        <rect x={-80} y={-30} width={160} height={14} fill={C.hondo} />
        <text y={58} textAnchor="middle" fontFamily={F.texto} fontWeight={800} fontSize={52} fill={C.hondo}>DOM</text>
      </g>
    </Svg>
  );
};

export const dibujos: Record<string, Dibujo> = { salon: Salon, carta: Carta, puerta: Puerta, pase: Pase, medialuna: Medialuna, ticket: Ticket, delantal: Delantal };

export const Sabado: React.FC<{ d?: DatosGuion }> = ({ d = datos }) => <PiezaGuion d={d} dibujos={dibujos} />;
