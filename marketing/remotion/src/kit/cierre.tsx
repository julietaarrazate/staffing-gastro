// El cierre: el «oído» fileteado (sólo acá) y el llamado.
import React from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { BancoNubes, BotonAmbar, C, Estrellas, F, Nube } from "./base";

export type DatosCierre = { boton: string; bajada?: string; linea2?: string };

export const Cierre: React.FC<{ desde: number; boton: string; bajada?: string; linea2?: string; noche?: boolean; cuenta?: string }> = ({ desde, boton, bajada, linea2, noche, cuenta }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < desde) return null;
  const t = frame - desde;
  // El cielo entra limpiando lo anterior.
  const lim = interpolate(t, [0, 12], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const s = spring({ frame: t - 4, fps, config: { damping: 12, stiffness: 120, mass: 0.9 } });
  const b = spring({ frame: t - 14, fps, config: { damping: 14, stiffness: 160 } });
  const l = spring({ frame: t - 20, fps, config: { damping: 18, stiffness: 140 } });
  const respira = 1 + 0.012 * Math.sin(t / 9);
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 30 }}>
      <div style={{ position: "absolute", inset: 0, opacity: lim,
        background: noche ? `radial-gradient(110% 60% at 85% 0%, rgba(154,201,231,.12), transparent 60%), linear-gradient(180deg, ${C.noche0}, ${C.noche1} 50%, ${C.noche2})`
          : `radial-gradient(120% 70% at 88% 0%, rgba(255,255,255,.24), transparent 60%), linear-gradient(180deg, ${C.cielo0}, ${C.cielo1} 52%, ${C.cielo2})` }}>
        {noche ? <Estrellas /> : <><Nube k="a" x={620} y={170} w={520} prof={0.3} op={0.8} /><Nube k="c" x={-380} y={330} w={720} prof={0.15} op={0.55} /></>}
      </div>
      <div style={{ position: "absolute", left: 540, top: 690, width: 860, transform: `translate(-50%,-50%) scale(${(0.7 + 0.3 * s) * respira}) rotate(${(1 - s) * -6}deg)`, opacity: Math.min(1, s * 2) }}>
        <Img src={staticFile("marca/oido-filete.svg")} style={{ width: "100%", filter: "drop-shadow(0 26px 40px rgba(15,58,91,.28))" }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1035, display: "flex", justifyContent: "center", transform: `translateY(${(1 - b) * 60}px) scale(${0.85 + 0.15 * b})`, opacity: Math.min(1, b * 1.6) }}>
        <BotonAmbar>{boton}</BotonAmbar>
      </div>
      {bajada && (
        <div style={{ position: "absolute", left: 60, right: 60, top: 1210, textAlign: "center", fontFamily: F.mono, fontWeight: 500, fontSize: 40, letterSpacing: "0.04em", color: noche ? C.claro : C.tintaCielo, opacity: Math.min(1, l * 1.5), transform: `translateY(${(1 - l) * 30}px)` }}>{bajada}</div>
      )}
      {cuenta && (
        <div style={{ position: "absolute", left: 60, right: 60, top: 1272, textAlign: "center", fontFamily: F.texto, fontWeight: 700, fontSize: 40, color: noche ? C.celeste : C.hondo, opacity: Math.min(1, l * 1.3) }}>{cuenta}</div>
      )}
      {linea2 && (
        <div style={{ position: "absolute", left: 60, right: 60, top: cuenta ? 1345 : 1290, textAlign: "center", fontFamily: F.texto, fontWeight: 600, fontSize: 34, color: noche ? C.celeste : C.hondo, opacity: Math.min(1, l * 1.2) }}>{linea2}</div>
      )}
      {!noche && <BancoNubes y={1560} op={lim} />}
    </div>
  );
};
