// T6-05 con tomas reales: el video de stock a pantalla completa en cada escena, los textos del guion en una
// hoja blanca arriba y el mismo cierre de cuenta que la versión de láminas. Datos en sabado-real.datos.ts.
import React from "react";
import { Cielo } from "../kit/base";
import { CierreCuenta } from "../kit/lamina";
import { Mezcla } from "../kit/sonido";
import { TituloHoja, TomaVideo } from "../kit/toma";
import { NOMBRE_TURNOS } from "./diciembre.datos";
import { sabadoReal } from "./sabado-real.datos";

export const SabadoReal: React.FC<{ d?: typeof sabadoReal }> = ({ d = sabadoReal }) => (
  <Cielo>
    {d.tomas.map((toma, i) => <TomaVideo key={i} toma={toma} desde={d.escenas[i]} hasta={d.escenas[i + 1] ?? d.cierre} />)}
    {d.titulos.map((t, i) => <TituloHoja key={i} t={t} />)}
    {d.cierreCuenta && <CierreCuenta desde={d.cierre} lineas={d.cierreCuenta.lineas} acento={d.cierreCuenta.acento} size={d.cierreCuenta.size} cuenta={d.cuenta} nombre={NOMBRE_TURNOS} fotos={d.fotosCierre} />}
    <Mezcla s={d.sonido} />
  </Cielo>
);
