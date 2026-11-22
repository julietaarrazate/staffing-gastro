// Historias cortas en loop (el último cuadro se funde con el primero).
import React from "react";
import { AbsoluteFill, Freeze, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { BancoNubes, C, ChipVidrio, Cielo, Contador, F, Hoja, Pop, Titular, VeloSuperior } from "../kit/base";
import { Pantalla, Resalte, Secuencia, Telefono, Toque } from "../kit/telefono";
import { MudoContexto } from "../kit/sonido";
import { InstalarAndroid, InstalarIphone } from "./instalar";
import { Mezcla, type Sonido } from "../kit/sonido";
import { historias as H, type DatosHistoria } from "./historias.datos";



// Envoltura de loop: en los últimos `n` cuadros vuelve a aparecer el primero.
const Bucle: React.FC<{ children: React.ReactNode; n?: number }> = ({ children, n = 12 }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const o = interpolate(f, [durationInFrames - n, durationInFrames - 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      {children}
      {o > 0 && <AbsoluteFill style={{ opacity: o }}><Freeze frame={0}>{children}</Freeze></AbsoluteFill>}
    </AbsoluteFill>
  );
};

const Marca: React.FC<{ cuenta: string; noche?: boolean }> = ({ cuenta, noche }) => (
  <Pop desde={0} x={540} y={1500}><ChipVidrio noche={noche}>{cuenta} · oido.com.ar</ChipVidrio></Pop>
);

const H1: React.FC<{ d?: DatosHistoria }> = ({ d = H.comercios }) => (
  <Bucle>
    <Cielo>
      <Titular lineas={d.titulo} desde={0} y={235} size={104} acento={d.acento} />
      <Telefono hora="19:06" claves={[{ f: 0, x: 195, y: 400, z: 1.1, ty: 1180 }, { f: 58, x: 195, y: 430, z: 1.0, ty: 1180 }]}>
        <Pantalla n="c-recomendados" desde={0} hasta={62} modo="corte" />
        <Resalte desde={6} hasta={40} x={244} y={359} w={110} h={46} r={12} claro />
        <Toque f={52} x={195} y={448} grande />
        <Secuencia n="seq:c-oido" desde={58} hasta={108} />
        <Pantalla n="c-oido" desde={106} tr={4} />
      </Telefono>
      <VeloSuperior />
      <BancoNubes y={1640} />
      <Marca cuenta={d.cuenta} />
    </Cielo>
  </Bucle>
);

const H2: React.FC<{ d?: DatosHistoria }> = ({ d = H.trabajadores }) => (
  <Bucle>
    <Cielo>
      <Titular lineas={d.titulo} desde={0} y={235} size={104} acento={d.acento} />
      <Telefono hora="19:00" claves={[{ f: 0, x: 195, y: 360, z: 1.1, ty: 1120 }, { f: 40, x: 150, y: 330, z: 1.25, ty: 1100 }]}>
        <Pantalla n="t-mapa" desde={0} hasta={70} modo="corte" />
        <Toque f={44} x={90} y={263} grande />
        <Secuencia n="rec:t-mapa-toque" desde={46} hasta={84} />
        <Pantalla n="t-mapa-pin" desde={82} modo="corte" />
        <Resalte desde={100} hasta={180} x={286} y={458} w={90} h={30} r={10} />
      </Telefono>
      <VeloSuperior />
      <BancoNubes y={1640} />
      <Marca cuenta={d.cuenta} />
    </Cielo>
  </Bucle>
);

const H4: React.FC<{ d?: DatosHistoria }> = ({ d = H.match }) => {
  const coma = (n: number) => n.toFixed(1).replace(".", ",");
  const Card: React.FC<{ g: React.ReactNode; c: string }> = ({ g, c }) => (
    <Hoja style={{ padding: "22px 32px", minWidth: 280 }}>
      <div style={{ fontFamily: F.texto, fontWeight: 800, fontSize: 78, letterSpacing: "-0.03em", lineHeight: 1 }}>{g}</div>
      <div style={{ fontFamily: F.texto, fontWeight: 600, fontSize: 30, color: C.suave, marginTop: 6 }}>{c}</div>
    </Hoja>
  );
  return (
    <Bucle>
      <Cielo>
        <Titular lineas={d.titulo} desde={0} y={235} size={104} acento={d.acento} />
        <Telefono hora="19:06" claves={[{ f: 0, x: 195, y: 380, z: 0.8, tx: 740, ty: 1130 }]}>
          <Pantalla n="c-recomendados" desde={0} modo="corte" />
          <Resalte desde={20} hasta={170} x={23} y={359} w={331} h={46} r={12} />
        </Telefono>
        <VeloSuperior />
        <BancoNubes y={1640} />
        <Pop desde={20} x={40} y={660} ancla="left" rot={-5}><Card g={<><Contador desde={20} valor={4.9} fmt={coma} /> ★</>} c="de calificación" /></Pop>
        <Pop desde={44} x={40} y={880} ancla="left" rot={4}><Card g={<Contador desde={44} valor={38} />} c="turnos hechos" /></Pop>
        <Pop desde={68} x={40} y={1100} ancla="left" rot={-4}><Card g={<><Contador desde={68} valor={700} /> m</>} c="de tu local" /></Pop>
        <Pop desde={92} x={40} y={1300} ancla="left" rot={3}><Hoja style={{ padding: "20px 30px", fontFamily: F.texto, fontWeight: 700, fontSize: 38, whiteSpace: "nowrap" }}>✓ Identidad verificada</Hoja></Pop>
        <Marca cuenta={d.cuenta} />
      </Cielo>
    </Bucle>
  );
};

// Instalar: los pasos del video largo, recortados (del menú hasta que se abre).
const Tramos: React.FC<{ C: React.FC; tramos: [number, number][] }> = ({ C: Comp, tramos }) => {
  let acc = 0;
  return (
    <AbsoluteFill>
      {tramos.map(([a, b], i) => {
        const el = (
          <Sequence key={i} from={acc - a} durationInFrames={b} layout="none">
            <SoloDesde desde={a}><Comp /></SoloDesde>
          </Sequence>
        );
        acc += b - a;
        return el;
      })}
    </AbsoluteFill>
  );
};
const SoloDesde: React.FC<{ desde: number; children: React.ReactNode }> = ({ desde, children }) => {
  const f = useCurrentFrame();
  return f >= desde ? <AbsoluteFill>{children}</AbsoluteFill> : null;
};

const H3a: React.FC<{ d?: DatosHistoria }> = ({ d = H.instalarAndroid }) => <><Bucle><Tramos C={() => <Mudo><InstalarAndroid /></Mudo>} tramos={[[136, 362], [404, 478]]} /></Bucle><Mezcla s={d.sonido} /></>;
const H3b: React.FC<{ d?: DatosHistoria }> = ({ d = H.instalarIphone }) => <><Bucle><Tramos C={() => <Mudo><InstalarIphone /></Mudo>} tramos={[[136, 362], [404, 478]]} /></Bucle><Mezcla s={d.sonido} /></>;

// Las del video largo traen su propia mezcla adentro: en las historias se apaga y suena la de la historia.
const Mudo: React.FC<{ children: React.ReactNode }> = ({ children }) => <MudoContexto.Provider value={true}>{children}</MudoContexto.Provider>;

const conSonido = (C: React.FC<{ d?: DatosHistoria }>) => ({ d }: { d: DatosHistoria }) => <><C d={d} /><Mezcla s={d.sonido} /></>;

export const Historias: { id: string; c: React.FC<any>; dur: number; d: DatosHistoria }[] = [
  { id: H.comercios.id, c: conSonido(H1), dur: H.comercios.duracion, d: H.comercios },
  { id: H.trabajadores.id, c: conSonido(H2), dur: H.trabajadores.duracion, d: H.trabajadores },
  { id: H.match.id, c: conSonido(H4), dur: H.match.duracion, d: H.match },
  { id: H.instalarAndroid.id, c: H3a, dur: H.instalarAndroid.duracion, d: H.instalarAndroid },
  { id: H.instalarIphone.id, c: H3b, dur: H.instalarIphone.duracion, d: H.instalarIphone },
];
