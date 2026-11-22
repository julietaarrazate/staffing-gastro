// Las seis piezas del 1 al 4 de diciembre. Los textos, tiempos y sonido están en diciembre.datos.ts;
// acá van los dibujos de cada escena (láminas) y, en las de @oidoapp, las pantallas reales de la app.
import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { BancoNubes, C, Cielo, Contador, F, Hoja, Pop } from "../kit/base";
import { Titulos } from "../kit/datos";
import { Cierre } from "../kit/cierre";
import { Mezcla } from "../kit/sonido";
import { Pantalla, Resalte, Secuencia, Telefono, Toque } from "../kit/telefono";
import {
  CierreCuenta, CopaArriba, Cubo, Cuchillo, Escena, Flecha, MesaArriba, Persona, Plato, Rotulo, Sello, T, Tabla, Vaso, rampa,
} from "../kit/lamina";
import { cebolla, encargado, hielo, NOMBRE_TURNOS, queEs, sabado, servicio, type DatosLaminas } from "./diciembre.datos";

type Dibujo = (t: number) => React.ReactNode;

// El armado común: cielo, títulos, una lámina por escena, nubes abajo y el cierre.
const Piezas: React.FC<{ d: DatosLaminas; dibujos: (Dibujo | null)[]; extra?: React.ReactNode; y?: number[]; alto?: number[] }> = ({ d, dibujos, extra, y = [], alto = [] }) => (
  <Cielo>
    <Titulos lista={d.titulos} />
    {dibujos.map((dib, i) => dib && (
      <Escena key={i} desde={d.escenas[i]} hasta={(d.escenas[i + 1] ?? d.cierre) - 10} y={y[i] ?? 1050} alto={alto[i] ?? 860}>{dib}</Escena>
    ))}
    {extra}
    <BancoNubes y={1640} />
    {d.cierreCuenta && <CierreCuenta desde={d.cierre} lineas={d.cierreCuenta.lineas} acento={d.cierreCuenta.acento} size={d.cierreCuenta.size} cuenta={d.cuenta} nombre={NOMBRE_TURNOS} />}
    {d.cierreApp && <Cierre desde={d.cierre} {...d.cierreApp} cuenta={d.cuenta} />}
    <Mezcla s={d.sonido} />
  </Cielo>
);

// ── Piezas sueltas ───────────────────────────────────────────────────

const Salon: React.FC<{ t: number; mueve?: number; mozo?: boolean }> = ({ t, mueve = 3, mozo = true }) => {
  const mx = interpolate((t % 90) / 90, [0, 1], [-60, 960]);
  return (
    <g>
      <rect x={0} y={0} width={900} height={860} fill="#F4F8FA" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <line key={i} x1={0} y1={i * 120} x2={900} y2={i * 120} stroke="#EAF0F4" strokeWidth={3} />)}
      <MesaArriba x={200} y={200} r={70} n={4} t={t} mueve={mueve} />
      <MesaArriba x={470} y={170} r={58} n={3} t={t + 9} mueve={mueve} />
      <MesaArriba x={740} y={230} r={70} n={5} t={t + 4} mueve={mueve} />
      <MesaArriba x={190} y={560} r={84} n={7} t={t + 13} mueve={mueve} />
      <MesaArriba x={480} y={470} r={56} n={2} t={t + 2} mueve={mueve} />
      <MesaArriba x={730} y={620} r={88} n={8} t={t + 7} mueve={mueve} />
      <MesaArriba x={470} y={760} r={56} n={4} t={t + 5} mueve={mueve} />
      {mozo && <Persona x={mx} y={360 + Math.sin(t / 5) * 6} r={24} col={T.hondo} rot={90} />}
    </g>
  );
};

const Burbuja: React.FC<{ de: string; texto: string; desde: number; hasta: number }> = ({ de, texto, desde, hasta }) => (
  <Pop desde={desde} hasta={hasta} x={540} y={1180} z={8}>
    <div style={{ background: C.papel, borderRadius: "40px 40px 40px 12px", padding: "28px 38px", width: 620, fontFamily: F.texto, color: C.tinta,
      boxShadow: "0 24px 60px rgba(15,58,91,.28)" }}>
      <div style={{ fontSize: 30, fontWeight: 700, color: C.hondo, marginBottom: 6 }}>{de}</div>
      <div style={{ fontSize: 48, fontWeight: 600, letterSpacing: "-0.01em" }}>{texto}</div>
    </div>
  </Pop>
);

// Un chat genérico (sin marcas) que no para de bajar, con un contador de mensajes.
const Chat: React.FC<{ t: number; lineas: string[]; total: number; titulo: string }> = ({ t, lineas, total, titulo }) => {
  const n = Math.min(total, Math.floor(t / 2.4) + 1);
  const alto = 112;
  const sy = Math.max(0, n * alto - 560);
  return (
    <Hoja style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#F3F7FA" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 120, background: C.papel, zIndex: 2, display: "flex", alignItems: "center", gap: 22, padding: "0 40px",
        boxShadow: "0 2px 0 rgba(15,58,91,.06)", fontFamily: F.texto }}>
        <div style={{ width: 64, height: 64, borderRadius: 32, background: C.celeste }} />
        <div style={{ fontWeight: 700, fontSize: 36, color: C.tinta, flex: 1 }}>{titulo}</div>
        <div style={{ minWidth: 92, height: 64, borderRadius: 32, background: C.hondo, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 36, padding: "0 18px" }}>
          <Contador desde={0} valor={total} dur={Math.round(total * 2.4)} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 140 - sy, fontFamily: F.texto }}>
        {Array.from({ length: n }, (_, i) => {
          const txt = lineas[i % lineas.length];
          const der = i % 3 === 1;
          const entra = interpolate(t - i * 2.4, [0, 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ height: alto, display: "flex", justifyContent: der ? "flex-end" : "flex-start", padding: "0 34px", opacity: entra, transform: `translateY(${(1 - entra) * 20}px)` }}>
              <div style={{ alignSelf: "center", maxWidth: 620, padding: "18px 26px", borderRadius: 28, fontSize: 34, fontWeight: 500, color: C.tinta,
                background: der ? "#D7EAF6" : C.papel, boxShadow: "0 2px 6px rgba(15,58,91,.08)", display: "flex", alignItems: "center", gap: 14 }}>
                {txt === "audio" ? (
                  <>
                    <span style={{ width: 0, height: 0, borderLeft: `22px solid ${C.hondo}`, borderTop: "13px solid transparent", borderBottom: "13px solid transparent" }} />
                    <svg width="300" height="40" viewBox="0 0 300 40">{Array.from({ length: 30 }, (_, k) => {
                      const h = 8 + Math.abs(Math.sin(k * 1.7 + i)) * 28;
                      return <rect key={k} x={k * 10} y={20 - h / 2} width={5} height={h} rx={2.5} fill={C.hondo} opacity={0.7} />;
                    })}</svg>
                    <span style={{ fontSize: 26, color: C.suave }}>0:{String(12 + ((i * 17) % 40)).padStart(2, "0")}</span>
                  </>
                ) : txt}
              </div>
            </div>
          );
        })}
      </div>
    </Hoja>
  );
};

// La pantalla de publicar un turno (escrito como pedido, completado, publicado). Reusa las capturas.
const Publicar: React.FC<{ p: Record<string, number> }> = ({ p }) => {
  const tipeo = [1, 2, 3, 4, 5, 6, 7];
  return (
    <>
      <Pantalla n="c-publicar-0" desde={0} hasta={p.donde + 8} modo="corte" />
      {tipeo.map((i, k) => <Pantalla key={i} n={`c-publicar-tipeo-${i}`} desde={p.tipeo + k * 6} hasta={p.donde + 8} modo="corte" />)}
      <Toque f={p.toqueCampo} x={190} y={292} />
      <Toque f={p.completar} x={306} y={372} />
      <Pantalla n="c-publicar-donde-full" barra="c-publicar-donde-barra" desde={p.donde} hasta={p.publicado + 10} tr={5} modo="zoom" />
      <Toque f={p.publicar} x={195} y={725} />
      <Pantalla n="c-publicado" desde={p.publicado} tr={4} />
    </>
  );
};

// ── 1/12 · @turnosgastro · Sábado ─────────────────────────────────────
const dSabado: Dibujo[] = [
  (t) => <Salon t={t} mueve={5} />,
  (t) => {
    const pulso = t > 22 ? 0.5 + 0.5 * Math.sin((t - 22) / 4) : 0;
    return (
      <g>
        <rect width={900} height={860} fill="#F4F8FA" />
        <circle cx={450} cy={400} r={330} fill={T.papel} stroke={T.hondo} strokeWidth={6} />
        <Plato x={250} y={300} r={80} comida="" />
        <CopaArriba x={360} y={190} vino={false} />
        <g transform="rotate(-8 520 430)">
          <rect x={420} y={300} width={220} height={290} rx={14} fill="#FFFDF7" stroke={T.hondo} strokeWidth={5} />
          <Rotulo x={530} y={360} size={36} col={T.hondo} peso={900}>CARTA</Rotulo>
          {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={450} y1={400 + i * 34} x2={610 - (i % 2) * 40} y2={400 + i * 34} stroke={T.suave} strokeWidth={6} strokeLinecap="round" />)}
          <circle cx={530} cy={445} r={190 + pulso * 16} fill="none" stroke={T.hondo} strokeWidth={6} opacity={t > 22 ? 0.25 + 0.5 * pulso : 0} />
        </g>
        <Rotulo x={450} y={810} size={34} mono col={T.hondo} op={rampa(t, 26, 36)}>{sabado.textos.carta.toUpperCase()}</Rotulo>
      </g>
    );
  },
  (t) => {
    const n = Math.min(8, Math.floor(Math.max(0, t - 6) / 6) + (t >= 6 ? 1 : 0));
    return (
      <g>
        <rect width={900} height={860} fill="#F4F8FA" />
        <rect x={40} y={60} width={250} height={86} rx={43} fill={C.chip} />
        <Rotulo x={165} y={118} size={44} mono col={T.tinta}>21:30</Rotulo>
        <rect x={300} y={170} width={300} height={560} rx={10} fill="#DCEAF2" stroke={T.hondo} strokeWidth={6} />
        <path d="M 300 170 L 210 210 L 210 770 L 300 730 Z" fill="#C3D9E7" stroke={T.hondo} strokeWidth={6} strokeLinejoin="round" />
        <rect x={0} y={730} width={900} height={130} fill="#EAF0F4" />
        {Array.from({ length: n }, (_, i) => {
          const llega = rampa(t, 6 + i * 6, 20 + i * 6);
          const x = interpolate(llega, [0, 1], [1000, 120 + i * 94]);
          const salta = Math.abs(Math.sin((t + i * 5) / 3)) * 8 * (1 - llega);
          return (
            <g key={i} transform={`translate(${x} ${-salta})`}>
              <rect x={-36} y={530} width={72} height={200} rx={34} fill={i % 2 ? T.celeste : "#C9DFEE"} stroke={T.hondo} strokeWidth={4} />
              <circle cx={0} cy={490} r={34} fill={T.hondo} />
            </g>
          );
        })}
        <g transform={`translate(780 120) scale(${n > 0 ? 1 + 0.15 * Math.max(0, 1 - ((t - 6) % 6) / 6) : 0})`}>
          <circle r={62} fill={T.hondo} />
          <Rotulo x={0} y={22} size={62} col="#fff" peso={900}>{n}</Rotulo>
        </g>
      </g>
    );
  },
  (t) => (
    <g>
      <rect width={900} height={860} fill="#F4F8FA" />
      {[0, 1, 2].map((i) => <path key={i} d={`M ${150 + i * 300} 70 L ${110 + i * 300} 150 L ${190 + i * 300} 150 Z`} fill="#FCE7B0" opacity={0.7} />)}
      {[0, 1, 2].map((i) => <rect key={i} x={120 + i * 300} y={40} width={60} height={34} rx={8} fill={T.tinta} />)}
      <rect x={30} y={330} width={840} height={26} rx={8} fill={T.hondo} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i} transform={`translate(${105 + i * 138} 318)`}>
          <ellipse cx={0} cy={0} rx={60} ry={14} fill={T.papel} stroke={T.hondo} strokeWidth={4} />
          <path d="M -36 -4 Q 0 -60 36 -4 Z" fill={["#E4B878", "#C9DFEE", "#D9A35B", "#B8D4A0", "#E4B878", "#D99A7A"][i]} />
          {[0, 1].map((k) => <path key={k} d={`M ${-10 + k * 20} -60 q 8 -14 0 -28 q -8 -14 0 -28`} fill="none" stroke={T.suave} strokeWidth={4} opacity={0.5 + 0.5 * Math.sin(t / 5 + i + k)} />)}
        </g>
      ))}
      <Sello t={t} desde={10} x={450} y={560} size={78} />
      {[0, 1, 2].map((i) => {
        const p = ((t - 22 - i * 8) % 36) / 36;
        return t > 22 + i * 8 && <circle key={i} cx={450} cy={560} r={230 + p * 220} fill="none" stroke={T.hondo} strokeWidth={4} opacity={(1 - p) * 0.35} />;
      })}
      <Rotulo x={450} y={800} size={34} mono col={T.suave} op={rampa(t, 34, 46)}>(SILENCIO DE RADIO)</Rotulo>
    </g>
  ),
  (t) => (
    <g>
      <rect width={900} height={860} fill="#F4F8FA" />
      <rect x={560} y={60} width={290} height={100} rx={50} fill={T.hondo} />
      <circle cx={615} cy={110} r={22} fill="#F4F8FA" /><circle cx={627} cy={100} r={20} fill={T.hondo} />
      <Rotulo x={730} y={128} size={50} mono col="#fff">{sabado.textos.hora}</Rotulo>
      <circle cx={450} cy={490} r={250} fill="rgba(15,58,91,.08)" />
      <circle cx={450} cy={480} r={250} fill={T.papel} stroke={T.hondo} strokeWidth={6} />
      <circle cx={450} cy={480} r={180} fill="none" stroke={T.gris} strokeWidth={5} />
      <defs><clipPath id="mitad"><path d="M 150 200 L 470 200 L 445 330 L 480 420 L 440 500 L 475 600 L 450 760 L 150 760 Z" /></clipPath></defs>
      <g transform={`rotate(${-6 + Math.sin(t / 20) * 2} 450 480)`} clipPath="url(#mitad)">
        <path d="M 230 560 C 220 330, 680 330, 670 560 C 640 470, 560 430, 450 430 C 340 430, 260 470, 230 560 Z" fill="#E2B06A" stroke="#B9843F" strokeWidth={7} strokeLinejoin="round" />
        {[[300, 470, 270, 540], [350, 410, 340, 452], [410, 380, 405, 432], [470, 376, 470, 430]].map(([a, b, c2, d2], i) => (
          <path key={i} d={`M ${a} ${b} Q ${(a + c2) / 2 - 18} ${(b + d2) / 2} ${c2} ${d2}`} fill="none" stroke="#B9843F" strokeWidth={6} strokeLinecap="round" />
        ))}
        <path d="M 260 470 C 300 410, 380 380, 450 378" fill="none" stroke="#F3CF8E" strokeWidth={8} strokeLinecap="round" opacity={0.8} />
      </g>
      {[0, 1, 2].map((i) => <circle key={i} cx={560 + i * 40} cy={640 - ((t + i * 20) % 60)} r={6} fill={T.celeste} opacity={0.6} />)}
      <Rotulo x={450} y={800} size={34} mono col={T.hondo} op={rampa(t, 20, 30)}>FRÍA. OBVIO.</Rotulo>
    </g>
  ),
  (t) => {
    const largo = 240 + t * 13;
    const items = ["Milanesa napo", "Ravioles", "Provoleta", "Coca x3", "Agua s/gas", "Flan c/dulce", "Fernet x4", "Papas", "Ensalada", "Bife", "Malbec", "Café x6"];
    return (
      <g>
        <rect width={900} height={860} fill="#F4F8FA" />
        <g transform={`translate(0 ${-Math.max(0, largo - 760)})`}>
          <rect x={150} y={40} width={600} height={largo} fill="#FFFEFA" stroke={T.hondo} strokeWidth={4} />
          <Rotulo x={450} y={110} size={44} mono col={T.tinta}>MESA 12</Rotulo>
          <line x1={190} y1={140} x2={710} y2={140} stroke={T.suave} strokeWidth={3} strokeDasharray="8 8" />
          {Array.from({ length: Math.floor((largo - 140) / 66) }, (_, i) => (
            <g key={i}>
              <Rotulo x={190} y={200 + i * 66} size={36} mono anchor="start" col={T.tinta}>{items[i % items.length]}</Rotulo>
              <Rotulo x={710} y={200 + i * 66} size={36} mono anchor="end" col={T.tinta}>${(4200 + ((i * 3170) % 9000)).toLocaleString("es-AR")}</Rotulo>
            </g>
          ))}
        </g>
        <Sello t={t} desde={72} x={450} y={640} texto="÷ 12" size={86} rot={8} />
      </g>
    );
  },
  (t) => (
    <g>
      <rect width={900} height={860} fill="#F4F8FA" />
      <rect x={0} y={0} width={900} height={70} fill="#E6EEF3" />
      <circle cx={450} cy={110} r={18} fill={T.tinta} />
      <path d="M 450 110 q -4 36 18 40" fill="none" stroke={T.tinta} strokeWidth={8} strokeLinecap="round" />
      <g transform={`rotate(${Math.sin(t / 14) * 4} 450 120)`}>
        <path d="M 380 290 Q 450 120 520 290" fill="none" stroke={T.hondo} strokeWidth={12} />
        <path d="M 360 280 L 540 280 L 560 420 Q 600 470 600 520 L 620 760 Q 450 800 280 760 L 300 520 Q 300 470 340 420 Z" fill={T.celeste} stroke={T.hondo} strokeWidth={7} strokeLinejoin="round" />
        <rect x={360} y={540} width={180} height={110} rx={14} fill="#B5D8EE" stroke={T.hondo} strokeWidth={5} />
        <line x1={450} y1={540} x2={450} y2={650} stroke={T.hondo} strokeWidth={4} />
        <path d="M 300 470 q -60 40 -40 190" fill="none" stroke={T.hondo} strokeWidth={10} strokeLinecap="round" />
        <path d="M 600 470 q 60 40 40 190" fill="none" stroke={T.hondo} strokeWidth={10} strokeLinecap="round" />
        <circle cx={410} cy={720} r={16} fill="#B9C8D3" opacity={0.7} />
      </g>
    </g>
  ),
];

// ── 2/12 · @turnosgastro · Hielo ──────────────────────────────────────
const cubosLlenos = (y: number, n = 9, s = 70) =>
  Array.from({ length: n }, (_, i) => ({ x: ((i % 3) - 1) * 72 + (Math.floor(i / 3) % 2) * 10, y: y - 56 - Math.floor(i / 3) * 80, s, r: (i * 23) % 30 - 15 }));

const dHielo: Dibujo[] = [
  (t) => (
    <g>
      <rect width={900} height={860} fill="#F4F8FA" />
      <Vaso x={250} y={640} cubos={cubosLlenos(640, 9, 84).map((c, i) => ({ ...c, y: c.y - Math.max(0, 1 - rampa(t, i * 2, 12 + i * 2, Easing.in(Easing.quad))) * 500 }))} liquido="#8C5A3C" nivel={0.75} />
      <Vaso x={650} y={640} cubos={[{ x: -50, y: 560, s: 80, r: 12 }, { x: 40, y: 566, s: 76, r: -8 }, { x: -6, y: 500, s: 74, r: 20 }]} liquido="#8C5A3C" nivel={0.75} />
      <Rotulo x={250} y={730} size={34} mono col={T.hondo}>LLENO</Rotulo>
      <Rotulo x={650} y={730} size={34} mono col={T.hondo}>3 CUBOS</Rotulo>
    </g>
  ),
  (t) => {
    const m = rampa(t, 4, 70, Easing.inOut(Easing.quad));
    const s = 80 - m * 44;
    const ok = rampa(t, 78, 92);
    return (
      <g>
        <rect width={900} height={860} fill="#F4F8FA" />
        <g opacity={1 - ok * 0.45}>
          <Vaso x={650} y={640} cubos={[{ x: -50, y: 580 - m * 10, s, r: 12 }, { x: 40, y: 584 - m * 10, s: s * 0.95, r: -8 }, { x: -6, y: 520 + m * 40, s: s * 0.9, r: 20 }]} liquido="#8C5A3C" nivel={0.75} agua={m * 90} />
          <Rotulo x={650} y={730} size={34} mono col={T.hondo} op={rampa(t, 40, 50)}>AGUADO</Rotulo>
        </g>
        <g transform={`translate(250 450) scale(${1 + ok * 0.08}) translate(-250 -450)`}>
          <Vaso x={250} y={640} cubos={cubosLlenos(640, 9, 84)} liquido="#8C5A3C" nivel={0.75} />
          <circle cx={250} cy={470} r={240} fill="none" stroke={T.hondo} strokeWidth={6} opacity={ok * 0.6} />
        </g>
        <Rotulo x={250} y={780} size={34} mono col={T.hondo} op={ok}>FRÍO Y ENTERO</Rotulo>
      </g>
    );
  },
  (t) => (
    <g>
      <rect width={900} height={860} fill="#F4F8FA" />
      <Vaso x={260} y={620} cubos={[{ x: 0, y: 520 - (1 - rampa(t, 4, 18, Easing.in(Easing.quad))) * 400, s: 160, r: 4 }]} liquido="#B5652B" nivel={0.6} />
      <Vaso x={640} y={620} cubos={[{ x: 0, y: 520 - (1 - rampa(t, 12, 26, Easing.in(Easing.quad))) * 400, s: 160, r: -6 }]} liquido="#B93A32" nivel={0.62} />
      <path d="M 600 400 q 40 -30 90 -6" fill="none" stroke="#E08A2E" strokeWidth={16} strokeLinecap="round" opacity={rampa(t, 30, 40)} />
      <Rotulo x={260} y={720} size={38} mono col={T.hondo}>WHISKY</Rotulo>
      <Rotulo x={640} y={720} size={38} mono col={T.hondo}>NEGRONI</Rotulo>
    </g>
  ),
  (t) => {
    const cubos = (base: number, k: number) => Array.from({ length: 6 }, (_, i) => ({ x: (i % 2 ? 26 : -26), y: base - 50 - i * 60 - (1 - rampa(t, k + i * 2, k + 12 + i * 2, Easing.in(Easing.quad))) * 500, s: 66, r: (i * 29) % 26 - 13 }));
    return (
      <g>
        <rect width={900} height={860} fill="#F4F8FA" />
        <Vaso x={270} y={720} alto cubos={cubos(720, 2)} liquido="#DCEFF5" nivel={0.86} />
        <circle cx={330} cy={300} r={40} fill="#C7E39A" stroke="#7FA94E" strokeWidth={5} opacity={rampa(t, 24, 30)} />
        <Vaso x={630} y={720} alto cubos={cubos(720, 8)} liquido="#3B2A22" nivel={0.8} />
        <rect x={548} y={292} width={164} height={44} fill="#E3D3BC" opacity={rampa(t, 26, 36) * 0.95} />
        <Rotulo x={270} y={800} size={34} mono col={T.hondo}>GIN TONIC</Rotulo>
        <Rotulo x={630} y={800} size={34} mono col={T.hondo}>FERNET</Rotulo>
      </g>
    );
  },
  (t) => (
    <g>
      <rect width={900} height={860} fill="#F4F8FA" />
      <g transform={`translate(0 ${(1 - rampa(t, 0, 16)) * 30})`}>
        <line x1={490} y1={420} x2={580} y2={170} stroke="#7FA94E" strokeWidth={16} strokeLinecap="round" />
        <Vaso x={450} y={720} alto ancho={220} picado menta liquido="#CFE8B8" nivel={0.88} />
      </g>
      <Rotulo x={450} y={800} size={38} mono col={T.hondo}>MOJITO</Rotulo>
    </g>
  ),
  (t) => {
    const cae = rampa(t, 10, 40, Easing.in(Easing.quad));
    const nuevo = rampa(t, 46, 70);
    return (
      <g>
        <rect width={900} height={860} fill="#F4F8FA" />
        <g transform={`rotate(${-15 - cae * 50} 300 300)`}>
          <path d="M 200 120 L 400 120 L 372 470 L 228 470 Z" fill="#DCE3E8" stroke={T.hondo} strokeWidth={6} strokeLinejoin="round" />
          <path d="M 200 120 L 400 120" stroke={T.hondo} strokeWidth={14} strokeLinecap="round" />
          <line x1={232} y1={150} x2={252} y2={440} stroke="#FFFFFF" strokeWidth={12} strokeLinecap="round" opacity={0.8} />
          <Rotulo x={300} y={330} size={28} mono col={T.hondo}>COCTELERA</Rotulo>
        </g>
        {[0, 1, 2, 3, 4].map((i) => <Cubo key={i} x={330 + i * 22 + cae * 30} y={150 + cae * (500 + i * 30)} s={50} r={i * 30 + t * 4} op={1 - rampa(t, 36, 44)} />)}
        <path d="M 260 760 L 300 640 L 470 640 L 510 760 Z" fill="#E6EEF3" stroke={T.suave} strokeWidth={5} />
        <Rotulo x={385} y={720} size={30} mono col={T.suave}>SE TIRA</Rotulo>
        <g opacity={nuevo} transform={`translate(0 ${(1 - nuevo) * 40})`}>
          <Vaso x={690} y={700} cubos={cubosLlenos(700, 6, 62)} liquido="#E9A23B" nivel={0.6} />
          <Rotulo x={690} y={790} size={30} mono col={T.hondo}>HIELO NUEVO</Rotulo>
        </g>
      </g>
    );
  },
];

// ── 3/12 · @turnosgastro · Cebolla ────────────────────────────────────
const Raiz: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g>{[-24, -10, 6, 20].map((d, i) => <path key={i} d={`M ${x} ${y + d / 3} q -30 ${d} -50 ${d * 1.6}`} fill="none" stroke="#9C7A55" strokeWidth={5} strokeLinecap="round" />)}</g>
);
// Media cebolla vista desde arriba, apoyada sobre la parte plana: raíz a la izquierda.
const MediaArriba: React.FC<{ cortesV?: number; cortesX?: number; cx?: number; cy?: number }> = ({ cortesV = 0, cortesX = 0, cx = 450, cy = 400 }) => (
  <g>
    <ellipse cx={cx} cy={cy + 10} rx={270} ry={160} fill="rgba(15,58,91,.12)" />
    <ellipse cx={cx} cy={cy} rx={270} ry={160} fill="#F6EEDC" stroke="#D6BE8E" strokeWidth={6} />
    {[0.35, 0.65].map((k) => <ellipse key={k} cx={cx + 30} cy={cy} rx={270 * k} ry={160 * k} fill="none" stroke="#E5D3AE" strokeWidth={4} />)}
    <Raiz x={cx - 270} y={cy} />
    <defs><clipPath id={`el${cx}`}><ellipse cx={cx} cy={cy} rx={268} ry={158} /></clipPath></defs>
    <g clipPath={`url(#el${cx})`}>
    {Array.from({ length: 7 }, (_, i) => {
      const dy = (i - 3) * 40;
      const p = Math.max(0, Math.min(1, cortesV - i));
      const x0 = cx + 250, x1 = cx - 200;
      return p > 0 && <line key={i} x1={x0} y1={cy + dy} x2={x0 + (x1 - x0) * p} y2={cy + dy} stroke={T.hondo} strokeWidth={4} />;
    })}
    {Array.from({ length: 7 }, (_, i) => {
      const x = cx + 220 - i * 62;
      const p = Math.max(0, Math.min(1, cortesX - i));
      return p > 0 && <line key={i} x1={x} y1={cy - 160} x2={x} y2={cy - 160 + 320 * p} stroke={T.hondo} strokeWidth={4} />;
    })}
    </g>
  </g>
);
// Media cebolla de costado (domo), apoyada en la tabla.
const MediaCostado: React.FC<{ pelada?: number; cortesH?: number }> = ({ pelada = 1, cortesH = 0 }) => (
  <g>
    <path d="M 190 560 Q 190 250 450 250 Q 710 250 710 560 Z" fill="#C98C4E" opacity={1 - pelada} transform={`translate(${pelada * 60} ${-pelada * 60}) rotate(${pelada * 12} 450 560)`} />
    <path d="M 210 560 Q 210 270 450 270 Q 690 270 690 560 Z" fill="#F6EEDC" stroke="#D6BE8E" strokeWidth={6} />
    {[0.33, 0.66].map((k) => <path key={k} d={`M ${210 + 240 * k} 560 Q ${210 + 240 * k} ${270 + 290 * k} 450 ${270 + 290 * k} Q ${690 - 240 * k} ${270 + 290 * k} ${690 - 240 * k} 560`} fill="none" stroke="#E5D3AE" strokeWidth={4} />)}
    <Raiz x={210} y={540} />
    {[0, 1].map((i) => {
      const p = Math.max(0, Math.min(1, cortesH - i));
      const y = 470 - i * 90;
      return p > 0 && <line key={i} x1={680} y1={y} x2={680 - 420 * p} y2={y} stroke={T.hondo} strokeWidth={5} />;
    })}
  </g>
);

const dCebolla: Dibujo[] = [
  (t) => (
    <g>
      <Tabla x={450} y={430} w={820} h={720} />
      <g transform={`translate(0 ${(1 - rampa(t, 0, 14)) * -60})`}>
        <circle cx={420} cy={360} r={170} fill="#C98C4E" stroke="#A46B35" strokeWidth={6} />
        {[0.8, 0.6].map((k) => <circle key={k} cx={420} cy={360} r={170 * k} fill="none" stroke="#B57A42" strokeWidth={4} opacity={0.6} />)}
        <Raiz x={250} y={360} />
        <path d="M 590 360 q 30 -6 50 -30" fill="none" stroke="#A46B35" strokeWidth={8} strokeLinecap="round" />
      </g>
      <g transform={`translate(${(1 - rampa(t, 6, 22)) * 500} 0)`}><Cuchillo x={150} y={660} largo={560} /></g>
    </g>
  ),
  (t) => {
    const c = rampa(t, 8, 30, Easing.inOut(Easing.quad));
    const sep = rampa(t, 36, 52);
    return (
      <g>
        <Tabla x={450} y={430} w={820} h={720} />
        <g transform={`translate(0 ${-sep * 50})`}><path d="M 250 360 A 170 170 0 0 1 590 360 Z" fill="#F6EEDC" stroke="#C98C4E" strokeWidth={10} /><Raiz x={250} y={350} /></g>
        <g transform={`translate(0 ${sep * 50})`}><path d="M 250 360 A 170 170 0 0 0 590 360 Z" fill="#F6EEDC" stroke="#C98C4E" strokeWidth={10} /><Raiz x={250} y={370} /></g>
        <line x1={250} y1={360} x2={250 + 340 * c} y2={360} stroke={T.hondo} strokeWidth={6} opacity={1 - sep} />
        <circle cx={226} cy={360} r={52} fill="none" stroke={T.hondo} strokeWidth={5} strokeDasharray="10 8" opacity={rampa(t, 50, 60)} />
        <Rotulo x={226} y={250} size={32} mono col={T.hondo} op={rampa(t, 50, 60)}>RAÍZ</Rotulo>
        <Rotulo x={620} y={250} size={32} mono col={T.hondo} op={rampa(t, 50, 60)}>PUNTA</Rotulo>
      </g>
    );
  },
  (t) => (
    <g>
      <Tabla x={450} y={430} w={820} h={720} />
      <MediaCostado pelada={rampa(t, 10, 40)} />
      <path d="M 200 610 L 700 610" stroke={T.hondo} strokeWidth={6} strokeDasharray="14 10" opacity={rampa(t, 50, 60)} />
      <Rotulo x={450} y={680} size={34} mono col={T.hondo} op={rampa(t, 54, 64)}>PARTE PLANA ABAJO</Rotulo>
    </g>
  ),
  (t) => {
    const v = interpolate(t, [10, 90], [0, 7], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <g>
        <Tabla x={450} y={430} w={820} h={720} />
        <MediaArriba cortesV={v} />
        <line x1={232} y1={230} x2={232} y2={570} stroke={T.hondo} strokeWidth={5} strokeDasharray="10 8" opacity={0.7} />
        <Rotulo x={232} y={620} size={30} mono col={T.hondo}>HASTA ACÁ</Rotulo>
      </g>
    );
  },
  (t) => {
    const h = interpolate(t, [10, 70], [0, 2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const kx = 900 - rampa(t, 4, 14) * 200 - (h % 1) * 300;
    return (
      <g>
        <Tabla x={450} y={430} w={820} h={720} />
        <MediaCostado cortesH={h} />
        {h < 2 && <Cuchillo x={kx + 120} y={470 - Math.floor(h) * 90} largo={420} rot={180} />}
        <Rotulo x={450} y={680} size={32} mono col={T.hondo} op={rampa(t, 60, 70)}>PARALELO A LA TABLA</Rotulo>
      </g>
    );
  },
  (t) => {
    const x = interpolate(t, [8, 90], [0, 7], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <g>
        <Tabla x={450} y={430} w={820} h={720} />
        <MediaArriba cortesV={7} cortesX={x} cx={400} />
        {Array.from({ length: Math.floor(x * 5) }, (_, i) => {
          const cx = 720 + ((i * 37) % 120), cy = 560 + ((i * 53) % 90);
          return <rect key={i} x={cx - 14} y={cy - 14} width={28} height={28} rx={5} fill="#F6EEDC" stroke="#D6BE8E" strokeWidth={3} transform={`rotate(${(i * 41) % 60} ${cx} ${cy})`} />;
        })}
      </g>
    );
  },
  (t) => {
    const abre = rampa(t, 10, 30);
    return (
      <g>
        <rect width={900} height={860} fill="#F4F8FA" />
        <rect x={470} y={90} width={330} height={640} rx={36} fill="#EEF4F8" stroke={T.hondo} strokeWidth={6} />
        <line x1={470} y1={300} x2={800} y2={300} stroke={T.hondo} strokeWidth={5} />
        <circle cx={635} cy={500} r={90} fill="#C98C4E" opacity={abre} />
        <g transform={`translate(635 200)`}>{[0, 60, 120].map((a) => <line key={a} x1={-34} y1={0} x2={34} y2={0} stroke={T.celeste} strokeWidth={7} strokeLinecap="round" transform={`rotate(${a})`} />)}</g>
        <path d={`M 470 300 L ${470 - abre * 200} ${330} L ${470 - abre * 200} ${700} L 470 730 Z`} fill="#DCEAF2" stroke={T.hondo} strokeWidth={5} opacity={abre} />
        <Cuchillo x={40} y={790} largo={400} />
        <g transform={`translate(400 780) scale(${0.6 + 0.4 * Math.abs(Math.sin(t / 6))})`} opacity={rampa(t, 20, 30)}>
          <path d="M 0 -30 L 8 -8 L 30 0 L 8 8 L 0 30 L -8 8 L -30 0 L -8 -8 Z" fill="#FFFFFF" stroke={T.hondo} strokeWidth={3} />
        </g>
      </g>
    );
  },
];

// ── 4/12 · @turnosgastro · Orden de servicio ──────────────────────────
const MesaCuadrada: React.FC<{ t?: number }> = () => (
  <g>
    <Persona x={450} y={120} r={30} rot={180} /><Persona x={450} y={740} r={30} /><Persona x={140} y={430} r={30} rot={90} /><Persona x={760} y={430} r={30} rot={-90} />
    <rect x={230} y={210} width={440} height={440} rx={24} fill={T.papel} stroke={T.hondo} strokeWidth={6} />
  </g>
);
// Un comensal visto desde arriba (abajo en la lámina, mirando a la mesa).
const Comensal: React.FC = () => (
  <g>
    <rect x={40} y={-40} width={820} height={700} rx={30} fill={T.papel} stroke={T.hondo} strokeWidth={6} />
    <Persona x={450} y={770} r={56} />
    <Rotulo x={130} y={830} size={28} mono col={T.suave} anchor="start">IZQUIERDA</Rotulo>
    <Rotulo x={770} y={830} size={28} mono col={T.hondo} anchor="end">DERECHA</Rotulo>
    <g stroke={T.suave} strokeWidth={8} strokeLinecap="round">
      <line x1={300} y1={300} x2={300} y2={500} />{[-14, 0, 14].map((d) => <line key={d} x1={300 + d} y1={290} x2={300 + d} y2={340} strokeWidth={5} />)}
      <line x1={600} y1={290} x2={600} y2={500} /><path d="M 600 290 q 18 40 0 90" fill="none" />
    </g>
  </g>
);

const dServicio: Dibujo[] = [
  (t) => (
    <g>
      <rect width={900} height={860} fill="#F4F8FA" />
      <MesaCuadrada />
      {[[330, 330], [570, 330], [330, 530], [570, 530]].map(([x, y], i) => (
        <g key={i} transform={`translate(${Math.sin(t / 5 + i * 2) * 10} ${Math.cos(t / 6 + i) * 10 - (1 - rampa(t, i * 4, 14 + i * 4)) * 600})`}><Plato x={x} y={y} r={70} /></g>
      ))}
      <Rotulo x={450} y={470} size={140} col={T.hondo} peso={900} op={rampa(t, 24, 32)}>?</Rotulo>
    </g>
  ),
  (t) => {
    const f = rampa(t, 8, 40);
    const p = rampa(t, 40, 64, Easing.inOut(Easing.quad));
    return (
      <g>
        <rect width={900} height={860} fill="#F4F8FA" />
        <Comensal />
        <Flecha d="M 860 640 Q 840 420 560 380" p={f} />
        <g transform={`translate(${(1 - p) * 420} ${(1 - p) * 220})`}><Plato x={450} y={380} r={110} /></g>
      </g>
    );
  },
  (t) => {
    const p = rampa(t, 14, 36, Easing.inOut(Easing.quad));
    return (
      <g>
        <rect width={900} height={860} fill="#F4F8FA" />
        <Comensal />
        <Plato x={450} y={380} r={110} />
        <Flecha d="M 860 520 Q 820 280 680 250" p={rampa(t, 2, 20)} />
        <g transform={`translate(${(1 - p) * 300} ${(1 - p) * 160})`}><CopaArriba x={630} y={230} r={42} /></g>
      </g>
    );
  },
  (t) => {
    const p = rampa(t, 8, 30, Easing.inOut(Easing.quad));
    return (
      <g>
        <rect width={900} height={860} fill="#F4F8FA" />
        <Comensal />
        <Plato x={450} y={380} r={110} />
        <CopaArriba x={630} y={230} r={42} />
        <Flecha d="M 40 520 Q 80 300 220 250" p={rampa(t, 2, 20)} />
        <g transform={`translate(${-(1 - p) * 300} ${(1 - p) * 160})`}>
          <Plato x={270} y={230} r={56} comida="" />
          <ellipse cx={262} cy={226} rx={30} ry={20} fill="#E2B06A" />
          <rect x={282} y={206} width={22} height={16} rx={3} fill="#FCEBB6" />
        </g>
      </g>
    );
  },
  (t) => (
    <g>
      <rect width={900} height={860} fill="#F4F8FA" />
      <MesaCuadrada />
      {[[450, 40, "1"], [850, 430, "2"], [450, 820, "3"]].map(([x, y, n], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${rampa(t, 16 + i * 20, 26 + i * 20, Easing.bezier(0.34, 1.56, 0.64, 1))})`}>
          <circle r={40} fill={T.hondo} /><Rotulo x={0} y={16} size={44} col="#fff" peso={900}>{n}</Rotulo>
        </g>
      ))}
      <g transform={`translate(58 360) scale(${rampa(t, 84, 96, Easing.bezier(0.34, 1.56, 0.64, 1))})`}>
        <circle r={40} fill={T.hondo} /><Rotulo x={0} y={16} size={44} col="#fff" peso={900}>4</Rotulo>
        <rect x={-60} y={50} width={120} height={50} rx={25} fill={C.chip} /><Rotulo x={0} y={86} size={28} mono col={T.tinta}>PAGA</Rotulo>
      </g>
    </g>
  ),
  (t) => {
    const min = Math.floor(interpolate(t, [0, 70], [0, 40], { extrapolateRight: "clamp" }));
    const sale = rampa(t, 80, 100, Easing.in(Easing.quad));
    return (
      <g>
        <rect width={900} height={860} fill="#F4F8FA" />
        <MesaCuadrada />
        <g transform={`translate(0 ${-sale * 900})`}>
          <Plato x={450} y={300} r={70} />
          <Plato x={330} y={480} r={60} comida="" /><Plato x={570} y={480} r={60} comida="" /><Plato x={450} y={570} r={60} comida="" />
        </g>
        <rect x={610} y={20} width={260} height={90} rx={45} fill={T.hondo} />
        <Rotulo x={740} y={82} size={46} mono col="#fff">{String(min).padStart(2, "0")}:00</Rotulo>
      </g>
    );
  },
];

// ── 4/12 · @oidoapp · El costo del encargado ──────────────────────────
const dEncargado: Dibujo[] = [
  (t) => (
    <g>
      <rect width={900} height={860} fill="#F4F8FA" />
      <circle cx={720} cy={140} r={80} fill={T.papel} stroke={T.hondo} strokeWidth={6} />
      <line x1={720} y1={140} x2={720} y2={90} stroke={T.hondo} strokeWidth={6} strokeLinecap="round" transform={`rotate(${t * 9} 720 140)`} />
      <line x1={720} y1={140} x2={755} y2={140} stroke={T.hondo} strokeWidth={6} strokeLinecap="round" transform={`rotate(${t * 0.75} 720 140)`} />
      <g transform="translate(400 0)">
        <circle cx={0} cy={300} r={70} fill={T.hondo} />
        <path d="M -120 560 Q -120 400 0 400 Q 120 400 120 560 Z" fill={T.celeste} stroke={T.hondo} strokeWidth={6} />
        <g transform={`rotate(${Math.sin(t / 8) * 3} 40 470)`}>
          <rect x={10} y={420} width={70} height={120} rx={14} fill={T.tinta} />
          <rect x={18} y={430} width={54} height={96} rx={8} fill="#BFE1F6" opacity={0.6 + 0.4 * Math.abs(Math.sin(t / 3))} />
        </g>
      </g>
      <rect x={0} y={540} width={900} height={60} fill={T.hondo} />
      <rect x={0} y={600} width={900} height={260} fill="#DCEAF2" />
      {[140, 760].map((x) => <g key={x}><circle cx={x} cy={680} r={46} fill={T.papel} stroke={T.hondo} strokeWidth={5} /><line x1={x} y1={726} x2={x} y2={840} stroke={T.hondo} strokeWidth={8} /></g>)}
    </g>
  ),
  null, // el chat va aparte (HTML)
  (t) => {
    const cursor = Math.floor(t / 15) % 2 ? 1 : 0;
    const fila = (y: number, txt: string, suf: string, k: number) => (
      <g opacity={rampa(t, k, k + 12)} transform={`translate(0 ${(1 - rampa(t, k, k + 12)) * 30})`}>
        <line x1={150} y1={y} x2={390} y2={y} stroke={T.hondo} strokeWidth={6} />
        <rect x={160} y={y - 70} width={6} height={60} fill={T.hondo} opacity={cursor} />
        <Rotulo x={130} y={y - 12} size={64} col={T.tinta} anchor="end" peso={800}>{txt}</Rotulo>
        <Rotulo x={410} y={y - 12} size={40} col={T.hondo} anchor="start" peso={700}>{suf}</Rotulo>
      </g>
    );
    return (
      <g>
        <rect width={900} height={860} fill="#F4F8FA" />
        {fila(200, "", "horas por semana", 4)}
        <Rotulo x={270} y={300} size={80} col={T.hondo} peso={800} op={rampa(t, 20, 30)}>×</Rotulo>
        {fila(440, "$", "lo que vale tu hora", 28)}
        <line x1={110} y1={520} x2={790} y2={520} stroke={T.hondo} strokeWidth={4} opacity={rampa(t, 50, 60)} />
        {fila(680, "$", "por semana", 56)}
      </g>
    );
  },
  (t) => {
    const late = 0.5 + 0.5 * Math.sin(t / 5);
    return (
      <g>
        <Salon t={t} mueve={2} mozo={false} />
        <rect x={40} y={340} width={180} height={110} rx={16} fill={T.papel} stroke={T.hondo} strokeWidth={6} />
        <Rotulo x={130} y={408} size={30} mono col={T.hondo}>CAJA</Rotulo>
        {[0, 1, 2].map((i) => <Persona key={i} x={620 + i * 70} y={420} r={24} col={T.celeste} />)}
        <circle cx={450} cy={340} r={70} fill="none" stroke={T.hondo} strokeWidth={6} strokeDasharray="14 10" opacity={0.5 + 0.5 * late} />
        <Rotulo x={450} y={358} size={50} col={T.hondo} peso={900}>?</Rotulo>
      </g>
    );
  },
];

// ── Composiciones ────────────────────────────────────────────────────
export const Sabado: React.FC<{ d?: typeof sabado }> = ({ d = sabado }) => <Piezas d={d} dibujos={dSabado} />;

export const Hielo: React.FC<{ d?: DatosLaminas }> = ({ d = hielo }) => <Piezas d={d} dibujos={dHielo} />;

export const Cebolla: React.FC<{ d?: DatosLaminas }> = ({ d = cebolla }) => (
  <Piezas d={d} dibujos={dCebolla} y={[1050, 1050, 1050, 1050, 1050, 1050, 1110]} alto={[860, 860, 860, 860, 860, 860, 760]} />
);

export const Servicio: React.FC<{ d?: DatosLaminas }> = ({ d = servicio }) => (
  <Piezas d={d} dibujos={dServicio} y={[1050, 1050, 1050, 1050, 1050, 1100]} alto={[860, 860, 860, 860, 860, 780]} />
);

export const QueEs: React.FC<{ d?: typeof queEs }> = ({ d = queEs }) => {
  const p = d.pantallas;
  const f = useCurrentFrame();
  const verOido = f >= p.oido;
  return (
    <Piezas d={d} dibujos={[(t) => <Salon t={t} mueve={3} />, null, null, null, null]} extra={
      <>
        <Burbuja de={d.mensaje.de} texto={d.mensaje.texto} desde={16} hasta={50} />
        <Escena desde={d.escenas[1]} hasta={d.escenas[2] - 10} sinHoja>{(t) => <Chat t={t} lineas={d.chat} total={40} titulo="Turno de hoy" />}</Escena>
        {f >= p.entra - 2 && (
          <Telefono entra={p.entra} hora={f < p.candidatos ? "19:01" : verOido ? "19:08" : "19:06"} claves={[{ f: 0, x: 195, y: 430, z: 0.92, ty: 1230 }, { f: p.candidatos, x: 195, y: 400, z: 0.98, ty: 1240 }, { f: d.cierre - 12, x: 195, y: 400, z: 0.9, ty: 1260 }]}>
            <Publicar p={p} />
            <Pantalla n="c-candidatos" desde={p.candidatos} hasta={p.oido + 4} modo="empuja" tr={12} />
            <Resalte desde={p.verificada} hasta={p.verificada + 70} x={110} y={297} w={190} h={28} r={14} claro />
            <Toque f={p.elegir} x={195} y={448} grande />
            <Secuencia n="seq:c-oido" desde={p.oido} hasta={p.oidoFin + 4} />
            <Pantalla n="c-oido" desde={p.oidoFin} tr={4} />
          </Telefono>
        )}
      </>
    } />
  );
};

export const Encargado: React.FC<{ d?: typeof encargado }> = ({ d = encargado }) => {
  const p = d.pantallas;
  const f = useCurrentFrame();
  return (
    <Piezas d={d} dibujos={dEncargado} extra={
      <>
        <Escena desde={d.escenas[1]} hasta={d.escenas[2] - 10} sinHoja>{(t) => <Chat t={t * 0.7} lineas={d.chat} total={22} titulo="Encargado · buscando" />}</Escena>
        {f >= p.entra - 2 && (
          <Telefono entra={p.entra} hora="19:01" claves={[{ f: 0, x: 195, y: 430, z: 0.92, ty: 1230 }, { f: d.cierre - 12, x: 195, y: 430, z: 0.88, ty: 1260 }]}>
            <Publicar p={p} />
          </Telefono>
        )}
      </>
    } />
  );
};

export const PIEZAS_DICIEMBRE = [
  { d: sabado, c: Sabado },
  { d: queEs, c: QueEs },
  { d: hielo, c: Hielo },
  { d: cebolla, c: Cebolla },
  { d: servicio, c: Servicio },
  { d: encargado, c: Encargado },
] as const;
