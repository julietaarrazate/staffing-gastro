// Las composiciones: una por pieza. Cada una toma sus datos por defecto de src/piezas/*.datos.ts;
// para una variante, sumá otra <Composition> con otro objeto de datos en `defaultProps`.
import React from "react";
import { Composition } from "remotion";
import { QueResuelve, ParaComercios, ParaTrabajadores } from "./piezas/redes";
import { paraComercios, paraTrabajadores, queResuelve } from "./piezas/redes.datos";
import { ComoFuncionaComercios } from "./piezas/como-funciona-comercios";
import { datos as dComercios } from "./piezas/como-funciona-comercios.datos";
import { ComoFuncionaTrabajadores } from "./piezas/como-funciona-trabajadores";
import { datos as dTrabajadores } from "./piezas/como-funciona-trabajadores.datos";
import { InstalarAndroid, InstalarIphone } from "./piezas/instalar";
import { datosAndroid, datosIphone } from "./piezas/instalar.datos";
import { Match } from "./piezas/match";
import { datos as dMatch } from "./piezas/match.datos";
import { VaEnCamino } from "./piezas/va-en-camino";
import { datos as dCamino } from "./piezas/va-en-camino.datos";
import { CierreComercios } from "./piezas/cierre-comercios";
import { datos as dCierre } from "./piezas/cierre-comercios.datos";
import { Historias } from "./piezas/historias";
import { PIEZAS_DICIEMBRE } from "./piezas/diciembre";

const base = { fps: 30, width: 1080, height: 1920 };
const seg = (s: number) => Math.round(s * 30);

export const Root: React.FC = () => (
  <>
    <Composition id={queResuelve.id} component={QueResuelve} durationInFrames={seg(queResuelve.duracion)} defaultProps={{ d: queResuelve }} {...base} />
    <Composition id={paraComercios.id} component={ParaComercios} durationInFrames={seg(paraComercios.duracion)} defaultProps={{ d: paraComercios }} {...base} />
    <Composition id={paraTrabajadores.id} component={ParaTrabajadores} durationInFrames={seg(paraTrabajadores.duracion)} defaultProps={{ d: paraTrabajadores }} {...base} />
    <Composition id={dComercios.id} component={ComoFuncionaComercios} durationInFrames={dComercios.duracion} defaultProps={{ d: dComercios }} {...base} />
    <Composition id={dTrabajadores.id} component={ComoFuncionaTrabajadores} durationInFrames={dTrabajadores.duracion} defaultProps={{ d: dTrabajadores }} {...base} />
    <Composition id={datosAndroid.id} component={InstalarAndroid} durationInFrames={datosAndroid.duracion} defaultProps={{ d: datosAndroid }} {...base} />
    <Composition id={datosIphone.id} component={InstalarIphone} durationInFrames={datosIphone.duracion} defaultProps={{ d: datosIphone as any }} {...base} />
    <Composition id={dMatch.id} component={Match} durationInFrames={dMatch.duracion} defaultProps={{ d: dMatch }} {...base} />
    <Composition id={dCamino.id} component={VaEnCamino} durationInFrames={dCamino.duracion} defaultProps={{ d: dCamino }} {...base} />
    <Composition id={dCierre.id} component={CierreComercios} durationInFrames={dCierre.duracion} defaultProps={{ d: dCierre }} {...base} />
    {PIEZAS_DICIEMBRE.map((p) => <Composition key={p.d.id} id={p.d.id} component={p.c as any} durationInFrames={p.d.duracion} defaultProps={{ d: p.d }} {...base} />)}
    {Historias.map((h) => <Composition key={h.id} id={h.id} component={h.c} durationInFrames={h.dur} defaultProps={{ d: h.d }} {...base} />)}
  </>
);
