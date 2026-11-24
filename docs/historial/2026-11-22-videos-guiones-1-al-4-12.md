# Videos: tomas reales de stock, sonido de Mixkit y apertura el 12/12 (#734)

**Pedido:** Julieta, 2026-11-22: producir los videos del 1 al 4/12 desde los guiones. Con la primera
versión en láminas dibujadas dijo que se veía «muy básico»; pidió probar gratis con video real y,
después, mejorar música y efectos. También movió la apertura del 13/12 al 12/12.

**Qué cambió:**

- **T6-05 con tomas reales** (`t6-05-sabado-real`): mismos textos, tiempos y cierre que `t6-05-sabado`
  (de #735), cada escena con video de stock a pantalla completa y el texto en una hoja blanca arriba
  (`marketing/remotion/src/kit/toma.tsx`, `src/piezas/sabado-real*.ts(x)`).
- **Tomas:** Mixkit, sólo clips con «Stock Video Free License»; los «Restricted» son de uso personal y
  quedan afuera. Lista y verificación en `tomas/FUENTES.md`; `tomas/bajar-tomas.sh` las baja (1080p, no
  van a git).
- **Sonido:** música («Upbeat Jazz») y efectos de Mixkit (licencias libres para redes): ambientes por
  tramo, golpe en cada corte, pop en cada texto, un efecto por escena y la música más presente (unos
  6 dB debajo de los efectos). `src/kit/sonido.tsx` suma `musica`, `musicaDb` y `ambiente`;
  `sonidos/bajar-mixkit.sh` baja los archivos (no van a git), lista en `sonidos/FUENTES.md`.
- **Apertura el 12/12:** cierres de los videos de @oidoapp (`diciembre.datos.ts`),
  `docs/planning/BETA_TABLERO.md`, `docs/planning/PROPUESTA_HORARIOS_EQUIPO.md` y el documento de
  crecimiento (mensajes de TURNO y CUBRIR, textos de las publicaciones, metas; el calendario anuncia
  «El 12/12 abre Oído» el viernes 11, suma la pieza de apertura el sábado 12 y sigue desde el 13).

**Por qué así:** otra sesión hizo en paralelo las seis piezas en láminas y entraron a `main` (#735) como
base; este PR las tenía duplicadas con otros nombres y se rehízo sobre esa base, dejando sólo lo que
`main` no tenía. Pexels y Pixabay piden clave o bloquean la descarga automática; Mixkit no. Se evaluó el
formato de roomix.ai (mini historia con un personaje animado y cierre con gráfico): la historia necesita
generación con IA paga (ADR-0030), así que quedó para más adelante; el cierre con gráfico se puede hacer
gratis en Remotion.

**Queda abierto:** pasar las otras cinco piezas a tomas reales con este sonido. En stock libre no hay
toma de «la carta en la mesa» ni de un ticket imprimiéndose (se usaron una mesa vista desde el mozo y
una mesa larga). Zernio sigue esperando `ZERNIO_API_KEY` en el entorno.
