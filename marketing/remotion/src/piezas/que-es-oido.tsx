// Qué es Oído, en 30 segundos (@oidoapp). Datos en que-es-oido.datos.ts. Dos láminas (el problema)
// y después la app real: publicar, postulantes con la identidad verificada a la vista, elegir y «¡Oído!».
import React from "react";
import { useCurrentFrame } from "remotion";
import { BancoNubes, C, Cielo, F, VeloSuperior } from "../kit/base";
import { Titulos } from "../kit/datos";
import { CierreDeGuion, entre, Escenas, Globo, P, PersonaArriba, Svg, type Dibujo } from "../kit/guion";
import { Mezcla } from "../kit/sonido";
import { TelefonoPublicar } from "./tramo-publicar";
import { datos, type Datos } from "./que-es-oido.datos";

// Salón lleno y el mensaje que nadie quiere leer.
export const SalonCel: Dibujo = ({ t }) => {
  const g = entre(t, 14, 26);
  return (
    <Svg>
      <rect width={900} height={860} fill={P.fondo} />
      {[0, 1].flatMap((f) => [0, 1, 2].map((c) => ({ x: 170 + c * 280, y: 200 + f * 300 }))).map((m, i) => (
        <g key={i} opacity={entre(t, i, i + 8)}>
          {[0, 1, 2, 3].map((k) => {
            const a = (k * Math.PI) / 2 + 0.4;
            return <PersonaArriba key={k} x={m.x + Math.cos(a) * 80} y={m.y + Math.sin(a) * 80} r={22} c={P.gente[(i + k) % 6]} rot={(a * 180) / Math.PI + 90} />;
          })}
          <circle cx={m.x} cy={m.y} r={56} fill="#fff" stroke={P.suave} strokeWidth={3} />
        </g>
      ))}
      <rect x={0} y={0} width={900} height={860} fill="#0F3A5B" opacity={0.25 * g} />
      <g transform={`translate(450 ${700 - g * 40})`} opacity={g}>
        <Globo x={-330} y={-80} w={660} de="Mati · mozo" texto="No llego, perdón." size={52} />
      </g>
    </Svg>
  );
};

// Antes: el chat que no para de bajar, hasta 40 mensajes.
const PEDIDOS = ["¿Alguien para hoy a la noche?", "¿Conocés a alguien?", "Necesito un mozo YA", "¿Te sumás hoy?", "Pago bien, es por hoy", "¿Estás libre a las 20?", "Hola!! ¿hoy podés?", "Audio de 2 min", "¿Le pasás a tu primo?", "Urgente: mozo 20 h"];
export const Chat40: Dibujo = ({ t, dur }) => {
  const n = Math.min(40, Math.floor(entre(t, 4, dur - 14) * 40) + 1);
  const baja = entre(t, 4, dur - 14) * 39 * 130;
  return (
    <Svg>
      <rect width={900} height={860} fill="#F4F8FB" />
      <g transform={`translate(0 ${760 - baja})`}>
        {Array.from({ length: n }, (_, i) => (
          <Globo key={i} x={i % 2 ? 300 : 60} y={i * 130 - 60} w={540} texto={PEDIDOS[i % PEDIDOS.length]} propio={i % 2 === 0} size={34} audio={i % 7 === 6} />
        ))}
      </g>
      <g transform="translate(760 90)">
        <circle r={66} fill={C.hondo} />
        <text y={22} textAnchor="middle" fontFamily={F.texto} fontWeight={800} fontSize={64} fill="#fff">{n}</text>
      </g>
    </Svg>
  );
};

export const QueEsOido: React.FC<{ d?: Datos }> = ({ d = datos }) => {
  const f = useCurrentFrame();
  const T = d.tramo;
  const P0 = T.entra;
  return (
    <Cielo>
      <Escenas lista={d.escenas} dibujos={{ salonCel: SalonCel, chat40: Chat40 }} />
      <TelefonoPublicar T={T} claves={[
        { f: 0, x: 195, y: 330, z: 1.0, ty: 1120 },
        { f: P0 + 20, y: 300, z: 1.28, ty: 1050 },
        { f: P0 + 80, y: 420, z: 1.0, ty: 1100 },
        { f: P0 + 110, y: 560, z: 0.98, ty: 1120 },
        { f: P0 + 150, y: 400, z: 1.0, ty: 1120 },
        { f: (T.candidatos ?? 0) + 4, y: 330, z: 1.0, ty: 1120 },
        { f: (T.verificada?.[0] ?? 0) - 6, x: 195, y: 310, z: 1.55, ty: 1050 },
        { f: (T.verificada?.[1] ?? 0) - 10, y: 400, z: 1.05, ty: 1110 },
        { f: (T.oido ?? 0) - 2, y: 430, z: 0.95, ty: 1160 },
      ]} />
      {f >= P0 && <VeloSuperior />}
      <Titulos lista={d.titulos} />
      <BancoNubes y={1660} />
      <CierreDeGuion c={d.cierre} cuenta={d.cuenta} />
      <Mezcla s={d.sonido} />
    </Cielo>
  );
};
