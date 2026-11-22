// C2-07 · El costo que no ves (@oidoapp). Datos en costo-encargado.datos.ts. Cuatro láminas (el problema y la
// cuenta para hacer) y después la app real: publicar el turno en un minuto y llega el primer postulante.
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { BancoNubes, C, ChipVidrio, Cielo, F, Pop, VeloSuperior } from "../kit/base";
import { Titulos } from "../kit/datos";
import { CierreDeGuion, entre, Escenas, Globo, P, PersonaFrente, RelojTexto, Svg, type Dibujo } from "../kit/guion";
import { Mezcla } from "../kit/sonido";
import { TelefonoPublicar } from "./tramo-publicar";
import { datos, type Datos } from "./costo-encargado.datos";

// El encargado en la barra, con el celular; el salón vacío.
const Encargado: Dibujo = ({ t }) => {
  const luz = 0.6 + 0.4 * Math.sin(t / 3);
  return (
    <Svg>
      <rect width={900} height={860} fill={P.fondo} />
      <RelojTexto x={720} y={100} texto="16:40" size={50} />
      {[150, 330].map((x, i) => (
        <g key={i} transform={`translate(${x} 330)`} opacity={0.7}>
          <rect x={-70} y={0} width={140} height={14} rx={7} fill={P.maderaOsc} />
          <rect x={-6} y={14} width={12} height={90} fill={P.maderaOsc} />
          {[-1, 1].map((s) => <path key={s} d={`M${s * 50} 0 l0 -60 l${s * 24} 0 l0 60`} stroke={P.suave} strokeWidth={8} fill="none" transform={`rotate(180 ${s * 62} -30)`} />)}
        </g>
      ))}
      <PersonaFrente x={600} y={560} h={300} c={C.hondo} />
      <g transform="translate(560 430) rotate(-10)">
        <rect x={-34} y={-58} width={68} height={116} rx={12} fill={C.noche1} />
        <rect x={-26} y={-48} width={52} height={92} rx={6} fill={C.celeste} opacity={luz} />
      </g>
      <rect x={60} y={560} width={780} height={60} rx={14} fill={P.madera} />
      <rect x={100} y={620} width={700} height={240} fill={P.maderaOsc} />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={140 + i * 170} y={660} width={120} height={160} rx={12} fill={P.madera} opacity={0.6} />)}
    </Svg>
  );
};

// Mensajes y audios que se apilan.
const MENSAJES: { texto: string; propio?: boolean; audio?: boolean }[] = [
  { texto: "¿Conocés a alguien para hoy?", propio: true }, { texto: "", audio: true }, { texto: "Hoy no puedo, perdón" },
  { texto: "¿Y tu hermano?", propio: true }, { texto: "", audio: true }, { texto: "Me fijo y te aviso" }, { texto: "¿Alguien de la otra vez?", propio: true },
];
const Audios: Dibujo = ({ t, dur }) => {
  const n = Math.min(MENSAJES.length, Math.floor(entre(t, 2, dur - 20) * MENSAJES.length) + 1);
  const sube = Math.max(0, n - 5) * 140 * 1;
  return (
    <Svg>
      <rect width={900} height={860} fill="#F4F8FB" />
      <g transform={`translate(0 ${-sube})`}>
        {MENSAJES.slice(0, n).map((m, i) => (
          <Globo key={i} x={m.propio ? 300 : 60} y={60 + i * 150} w={540} texto={m.texto} propio={m.propio} audio={m.audio} size={34} s={entre(t, i * ((dur - 20) / MENSAJES.length) + 2, i * ((dur - 20) / MENSAJES.length) + 10)} />
        ))}
      </g>
    </Svg>
  );
};

// La cuenta, con los espacios en blanco para que la haga cada uno.
const Fila: React.FC<{ y: number; pre?: string; rotulo: string; p: number; fuerte?: boolean; t: number }> = ({ y, pre = "", rotulo, p, fuerte, t }) => (
  <g transform={`translate(0 ${y + (1 - p) * 30})`} opacity={p}>
    <rect x={110} y={-60} width={300} height={110} rx={24} fill={fuerte ? C.hondo : "#fff"} stroke={C.hondo} strokeWidth={5} />
    <text x={150} y={18} fontFamily={F.texto} fontWeight={800} fontSize={58} fill={fuerte ? "#fff" : C.hondo}>{pre}</text>
    <rect x={pre ? 200 : 150} y={22} width={pre ? 170 : 220} height={8} rx={4} fill={fuerte ? "#fff" : C.hondo} opacity={0.35 + 0.65 * (Math.floor(t / 15) % 2)} />
    <text x={440} y={14} fontFamily={F.texto} fontWeight={700} fontSize={38} fill={C.tinta}>{rotulo}</text>
  </g>
);
const Cuenta: Dibujo = ({ t }) => (
  <Svg>
    <rect width={900} height={860} fill={P.fondo} />
    <Fila y={180} rotulo="horas por semana" p={entre(t, 4, 18)} t={t} />
    <text x={260} y={330} textAnchor="middle" fontFamily={F.texto} fontWeight={800} fontSize={70} fill={C.hondo} opacity={entre(t, 24, 32)}>×</text>
    <Fila y={450} pre="$" rotulo="lo que vale tu hora" p={entre(t, 30, 44)} t={t} />
    <text x={260} y={600} textAnchor="middle" fontFamily={F.texto} fontWeight={800} fontSize={70} fill={C.hondo} opacity={entre(t, 54, 62)}>=</text>
    <Fila y={720} pre="$" rotulo="por semana, buscando" p={entre(t, 60, 76)} fuerte t={t} />
  </Svg>
);

// Donde no estás mientras buscás.
const LUGAR = [
  { rotulo: "el salón", icono: (<g><circle cx={0} cy={0} r={46} fill="#fff" stroke={C.hondo} strokeWidth={5} /><circle cx={0} cy={0} r={18} fill={P.suave} /></g>) },
  { rotulo: "la caja", icono: (<g><rect x={-56} y={-30} width={112} height={70} rx={10} fill="#fff" stroke={C.hondo} strokeWidth={5} /><rect x={-40} y={-62} width={80} height={32} rx={6} fill={C.hondo} /><rect x={-30} y={-6} width={60} height={10} rx={5} fill={P.suave} /></g>) },
  { rotulo: "tu equipo", icono: (<g>{[-44, 0, 44].map((x, i) => <g key={i}><circle cx={x} cy={-24} r={18} fill={P.piel} /><path d={`M${x - 26} 30 q0 -36 26 -36 q26 0 26 36 Z`} fill={P.gente[i]} /></g>)}</g>) },
];
const SinVos: Dibujo = ({ t }) => (
  <Svg>
    <rect width={900} height={860} fill={P.fondo} />
    {LUGAR.map((l, i) => {
      const p = entre(t, i * 14, i * 14 + 12);
      const y = 150 + i * 240;
      return (
        <g key={i} transform={`translate(0 ${y + (1 - p) * 30})`} opacity={p}>
          <rect x={80} y={-90} width={740} height={190} rx={30} fill="#fff" stroke={P.suave} strokeWidth={3} />
          <g transform="translate(210 5)">{l.icono}</g>
          <text x={330} y={20} fontFamily={F.texto} fontWeight={800} fontSize={52} fill={C.hondo}>{l.rotulo}</text>
          <g transform="translate(720 5)" opacity={entre(t, i * 14 + 10, i * 14 + 20)}>
            <circle r={64} fill="none" stroke={C.suave} strokeWidth={5} strokeDasharray="12 10" />
            <text y={9} textAnchor="middle" fontFamily={F.texto} fontWeight={800} fontSize={26} fill={C.suave}>sin vos</text>
          </g>
        </g>
      );
    })}
  </Svg>
);

const Minuto: React.FC<{ desde: number; hasta: number }> = ({ desde, hasta }) => {
  const f = useCurrentFrame();
  const s = Math.round(interpolate(f, [desde, hasta], [0, 58], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <Pop desde={desde} hasta={hasta + 40} x={540} y={1480} z={8}>
      <ChipVidrio mono style={{ fontSize: 44, padding: "18px 34px", background: "rgba(255,255,255,.9)" }}>⏱ 00:{String(s).padStart(2, "0")}</ChipVidrio>
    </Pop>
  );
};

export const CostoEncargado: React.FC<{ d?: Datos }> = ({ d = datos }) => {
  const f = useCurrentFrame();
  const T = d.tramo;
  const P0 = T.entra;
  return (
    <Cielo>
      <Escenas lista={d.escenas} dibujos={{ encargado: Encargado, audios: Audios, cuenta: Cuenta, sinVos: SinVos }} />
      <TelefonoPublicar T={T} claves={[
        { f: 0, x: 195, y: 330, z: 1.0, ty: 1120 },
        { f: P0 + 26, y: 300, z: 1.28, ty: 1050 },
        { f: P0 + 84, y: 420, z: 1.0, ty: 1100 },
        { f: P0 + 108, y: 560, z: 0.98, ty: 1120 },
        { f: P0 + 140, y: 400, z: 1.0, ty: 1120 },
      ]} />
      {f >= P0 && <VeloSuperior />}
      <Titulos lista={d.titulos} />
      <BancoNubes y={1660} />
      <Minuto desde={d.minuto.desde} hasta={d.minuto.hasta} />
      <CierreDeGuion c={d.cierre} cuenta={d.cuenta} />
      <Mezcla s={d.sonido} />
    </Cielo>
  );
};
