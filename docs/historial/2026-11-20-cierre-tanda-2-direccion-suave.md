# Cierre de la segunda tanda en paralelo de la dirección suave (#708)

**Pedido:** Julieta, 2026-11-20: «mergeá todo lo que queda pendiente cuando
esté verde».

**Qué cambió:** entraron el Panel del comercio (#706), el Perfil de quien
trabaja (#705) y el Mapa (#707). Con eso están migradas todas las pantallas
que tienen maqueta en el lienzo. Este PR sólo pone al día el párrafo de la
etapa 4 de `docs/STATUS.md`.

**Por qué así:**

- Esta vez no hubo ningún choque: cada sesión tenía indicado un lugar
  distinto de `globals.css` y editó sólo su renglón del tablero.
- El orden fue el de llegada. El Panel ya traía el `main` del momento y
  entró sin otra corrida; al Perfil y al Mapa se les trajo `main` y se
  esperó su CI.
- La corrida del Mapa falló en un test ajeno,
  `e2e/pestanas-relieve.spec.ts`: comparaba el alto de la raya de las
  pestañas con igualdad exacta y recibió 3,0000153 px. Ya había tirado
  corridas del Perfil y del Panel. Se arregló la comparación (tolerancia de
  5 milésimas) en el PR del Mapa; no se salteó nada.
- Estos tres PRs se mergearon sin que Julieta viera antes las capturas, por
  su pedido. Quedaron en cada sesión para mirarlas después.

**Queda abierto:**

- Mirar el Mapa de noche con calles de verdad: el filtro que apaga el mapa
  base no se pudo ver en las sesiones (no hay salida a los mosaicos). Si no
  se lee, es la regla `.estilo-suave .maplibregl-canvas` de `globals.css`.
- Decisiones de aspecto que tomaron las sesiones y Julieta no confirmó: el
  ámbar de «Postularme» sólo en el primer turno de Buscar y en el elegido
  del Mapa; dos columnas en la compu en Buscar; la zona debajo del nombre en
  el Perfil; los textos nuevos del primer día en el Panel.
- La variante `comanda` de `ShiftCard` quedó sin uso (y su fila en
  `direccion-relieve.md`); el marrón por rubro sigue en `ShiftCard` y en
  Buscar del comercio.
- La barra de abajo y el encabezado, y lo que no tiene maqueta
  (`docs/planning/DIRECCION_SUAVE_PANTALLAS.md`).
