// T1-04 · El orden de servicio que nadie te explicó. Textos y tiempos en orden.datos.ts; acá, los dibujos.
// La mesa se ve desde arriba. El cliente de abajo mira hacia la mesa: su derecha es la derecha de la pantalla.
import React from "react";
import { C, F } from "../kit/base";
import { entre, Flecha, P, PersonaArriba, Plato, PiezaGuion, RelojTexto, Svg, type DatosGuion, type Dibujo } from "../kit/guion";
import { datos } from "./orden.datos";

const COMIDA = ["#E8B48A", "#9CC59B", "#E7A08B", "#D8C59E"];

// La mesa de 4, con su gente (dos arriba, dos abajo).
const MESA = { x: 210, y: 250, w: 480, h: 360 };
const LUGARES = [
  { x: 330, y: 170, rot: 180, plato: [330, 320] }, { x: 570, y: 170, rot: 180, plato: [570, 320] },
  { x: 330, y: 690, rot: 0, plato: [330, 540] }, { x: 570, y: 690, rot: 0, plato: [570, 540] },
];
const Mesa: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <>
    <rect width={900} height={860} fill={P.fondo} />
    {LUGARES.map((l, i) => <PersonaArriba key={i} x={l.x} y={l.y} r={46} c={P.gente[i]} rot={l.rot} />)}
    <rect x={MESA.x} y={MESA.y} width={MESA.w} height={MESA.h} rx={26} fill={P.madera} stroke={P.maderaOsc} strokeWidth={5} />
    {children}
  </>
);

const Mesa4: Dibujo = ({ t }) => {
  const s = entre(t, 6, 22);
  const duda = entre(t, 26, 38);
  return (
    <Svg>
      <Mesa />
      <g transform={`translate(${860 - s * 70} 430)`}>
        {[0, 1].map((m) => (
          <g key={m} transform={`translate(0 ${m ? 100 : -100})`}>
            <Plato x={-40} y={0} r={52} comida={COMIDA[m * 2]} />
            <Plato x={10} y={-30} r={52} comida={COMIDA[m * 2 + 1]} />
          </g>
        ))}
      </g>
      <g opacity={duda} transform={`translate(450 430) scale(${0.7 + 0.3 * duda})`}>
        <circle r={70} fill="#fff" stroke={C.hondo} strokeWidth={6} />
        <text y={34} textAnchor="middle" fontFamily={F.texto} fontWeight={800} fontSize={100} fill={C.hondo}>?</text>
      </g>
    </Svg>
  );
};

// De cerca: un cliente, su lugar y desde dónde entra cada cosa.
const Lugar: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <>
    <rect width={900} height={860} fill={P.fondo} />
    <rect x={60} y={100} width={780} height={540} rx={30} fill={P.madera} stroke={P.maderaOsc} strokeWidth={5} />
    <PersonaArriba x={450} y={740} r={90} c={P.gente[2]} />
    <g fontFamily={F.texto} fontWeight={800} fontSize={34} fill={C.suave}>
      <text x={150} y={820} textAnchor="middle">izquierda</text>
      <text x={750} y={820} textAnchor="middle">derecha</text>
    </g>
    {children}
  </>
);

const PlatoDerecha: Dibujo = ({ t }) => {
  const f = entre(t, 10, 40);
  const llega = entre(t, 34, 52);
  return (
    <Svg>
      <Lugar>
        <Flecha d="M860 700 C 820 560, 720 500, 560 500" p={f} ancho={12} punta={[560, 500, 180]} />
        <Plato x={450 + (1 - llega) * 330} y={500 + (1 - llega) * 140} r={110} comida={COMIDA[0]} op={Math.min(1, llega * 3)} />
      </Lugar>
    </Svg>
  );
};

const Bebida: Dibujo = ({ t }) => {
  const f = entre(t, 6, 30);
  const llega = entre(t, 24, 40);
  return (
    <Svg>
      <Lugar>
        <Plato x={450} y={500} r={110} comida={COMIDA[0]} />
        <Flecha d="M860 620 C 820 420, 760 320, 650 300" p={f} ancho={12} punta={[650, 300, 190]} />
        <g transform={`translate(${620 + (1 - llega) * 220} ${300 + (1 - llega) * 200})`} opacity={Math.min(1, llega * 3)}>
          <circle r={56} fill="#fff" stroke={C.hondo} strokeWidth={5} />
          <circle r={40} fill="#E9C4C8" />
        </g>
      </Lugar>
    </Svg>
  );
};

const Pan: Dibujo = ({ t }) => {
  const llega = entre(t, 8, 26);
  return (
    <Svg>
      <Lugar>
        <Plato x={450} y={500} r={110} comida={COMIDA[0]} />
        <g transform="translate(620 300)"><circle r={56} fill="#fff" stroke={C.hondo} strokeWidth={5} /><circle r={40} fill="#E9C4C8" /></g>
        <g transform={`translate(${250 - (1 - llega) * 200} 290)`} opacity={Math.min(1, llega * 3)}>
          <circle r={70} fill="#fff" stroke={P.suave} strokeWidth={4} />
          <ellipse cx={-8} cy={0} rx={40} ry={28} fill="#E3B77E" />
          <rect x={22} y={-16} width={30} height={22} rx={5} fill="#F6E7A8" stroke="#E3CF7E" strokeWidth={3} />
        </g>
        <Flecha d="M40 620 C 80 440, 140 360, 190 320" p={entre(t, 0, 20)} ancho={12} punta={[190, 320, -40]} />
      </Lugar>
    </Svg>
  );
};

// El orden: primero los invitados, al final el que paga.
const Orden: Dibujo = ({ t }) => {
  const orden = [1, 0, 3, 2]; // índices de LUGARES; el último (2) paga
  return (
    <Svg>
      <Mesa>
        {orden.map((idx, k) => {
          const a = 10 + k * 25;
          const l = LUGARES[idx];
          const p = entre(t, a, a + 10);
          const paga = k === 3;
          return (
            <g key={idx}>
              <Plato x={l.plato[0]} y={l.plato[1]} r={64} comida={COMIDA[k]} op={p} />
              <g transform={`translate(${l.x + (l.x < 450 ? -110 : 110)} ${l.y}) scale(${0.6 + 0.4 * p})`} opacity={p}>
                <circle r={44} fill={paga ? C.hondo : "#fff"} stroke={C.hondo} strokeWidth={5} />
                <text y={18} textAnchor="middle" fontFamily={F.texto} fontWeight={800} fontSize={52} fill={paga ? "#fff" : C.hondo}>{k + 1}</text>
              </g>
              {paga && (
                <g opacity={entre(t, a + 8, a + 18)} transform={`translate(${l.x - 110} ${l.y + 85})`}>
                  <rect x={-70} y={-30} width={140} height={56} rx={28} fill="#fff" stroke={C.hondo} strokeWidth={4} />
                  <text y={10} textAnchor="middle" fontFamily={F.texto} fontWeight={800} fontSize={32} fill={C.hondo}>paga</text>
                </g>
              )}
            </g>
          );
        })}
      </Mesa>
    </Svg>
  );
};

// Tres terminaron; el de la punta sigue. Cuando termina, se retira todo.
const Retira: Dibujo = ({ t, dur }) => {
  const reloj = Math.round(entre(t, 20, dur - 40) * 40);
  const sale = entre(t, dur - 30, dur - 12);
  return (
    <Svg>
      <Mesa>
        {LUGARES.map((l, i) => {
          const termino = i !== 1 || reloj >= 40;
          const x = l.plato[0] + sale * (l.x < 450 ? -40 : 40) * 0 + sale * 500, y = l.plato[1];
          return (
            <g key={i} opacity={1 - sale}>
              <Plato x={x} y={y} r={64} comida={termino ? undefined : COMIDA[1]} />
              {termino && i !== 1 && <path d={`M${x - 20} ${y} l14 14 l26 -30`} stroke={C.hondo} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
              <path d={`M${x + 30} ${y - 40} l40 -40 M${x + 44} ${y - 30} l40 -40`} stroke={C.suave} strokeWidth={6} strokeLinecap="round" />
            </g>
          );
        })}
      </Mesa>
      <RelojTexto x={680} y={90} texto={`+${reloj} min`} size={48} op={entre(t, 14, 24)} />
    </Svg>
  );
};

export const dibujos: Record<string, Dibujo> = { mesa4: Mesa4, plato: PlatoDerecha, bebida: Bebida, pan: Pan, orden: Orden, retira: Retira };

export const OrdenServicio: React.FC<{ d?: DatosGuion }> = ({ d = datos }) => <PiezaGuion d={d} dibujos={dibujos} />;
