# Videos del 1 al 4/12 desde los guiones aprobados

**Pedido:** Julieta, 2026-11-22: producir con `marketing/remotion` los 6 videos del 1 al 4/12
según la pestaña Guiones del documento de crecimiento, respetando la sección Tono, y mandarle
los mp4 para revisar.

**Qué cambió:** seis piezas nuevas, cada una con sus datos aparte (`src/piezas/<pieza>.datos.ts`):

| Fecha | Cuenta | Código | id (`npm run render -- <id>`) |
|---|---|---|---|
| 1/12 | @turnosgastro | T6-05 Cosas que solo entiende quien laburó un sábado | `t6-05-sabado` |
| 1/12 | @oidoapp | Qué es Oído, en 30 segundos | `que-es-oido-30s` |
| 2/12 | @turnosgastro | T2-09 El hielo es la mitad del trago | `t2-09-hielo` |
| 3/12 | @turnosgastro | T3-05 Una cebolla en 20 segundos | `t3-05-cebolla` |
| 4/12 | @turnosgastro | T1-04 El orden de servicio que nadie te explicó | `t1-04-orden-servicio` |
| 4/12 | @oidoapp | C2-07 El costo que no ves | `c2-07-costo-encargado` |

- `src/kit/guion.tsx`: escena = texto del guion arriba (zona segura) + lámina blanca con un dibujo
  animado; cierre con el logo de la cuenta (el pinche en @turnosgastro, el «oído» fileteado en
  @oidoapp). Las piezas de @oidoapp usan las pantallas reales de la app
  (`src/piezas/tramo-publicar.tsx`: publicar, postulantes con «Identidad verificada» resaltada solo
  donde está, «¡Oído!»).
- Sonido: cuatro efectos CC0 nuevos de Freesound (hielo, coctelera, cuchillo sobre tabla, copa;
  fuentes en `sonidos/FUENTES.md`), la música entra a los 2 s (o cuando el guion la pide:
  `sonido.musicaDesde`) y el murmullo se puede subir o bajar por pieza (`murmulloDb`). La
  impresora de comandas quedó solo en T6-05 y en «Qué es Oído», muy baja.

**Por qué así:** los guiones piden tomas (salón desde arriba, cebolla, vasos) que no tenemos
filmadas y generar imágenes con IA usa créditos (ADR-0030): se resolvieron como dibujos animados
en la paleta de la marca. Sin voces, sin manos (la nota de seguridad de T3-05 no aplica).

**Fecha de apertura:** Julieta la pasó del 13/12 al 12/12 («más mística, número portal»). Los
dos videos de @oidoapp dicen «Abre el 12/12»; en el documento de crecimiento se cambiaron los
mensajes de TURNO y CUBRIR, los textos de las publicaciones, las metas y el calendario (el
viernes 11 anuncia «El 12/12 abre Oído», el sábado 12 suma la pieza de apertura y el plan de
contenido sigue desde el domingo 13 como estaba); en el repo, `docs/planning/BETA_TABLERO.md`.

**Prueba con video real (22/11):** Julieta sintió las láminas «muy básicas». Sin gasto, se probó
T6-05 con tomas de stock de Mixkit (`t6-05-sabado-real`): sólo clips con «Stock Video Free
License»; los «Restricted» son de uso personal y quedan afuera. El kit suma `toma` por escena
(video a pantalla completa, recortado a vertical, con el texto en una hoja blanca arriba);
`tomas/FUENTES.md` lista las tomas y `tomas/bajar-tomas.sh` las baja (no van a git). Pexels y
Pixabay piden clave o bloquean la descarga automática. En stock libre no hay toma de «la carta
en la mesa» ni de un ticket imprimiéndose: se usaron una mesa vista desde el mozo y una mesa larga.

**Queda abierto:** revisión de Julieta de los seis mp4; después, subirlos con los links
etiquetados. Zernio sigue esperando `ZERNIO_API_KEY` en el entorno.
