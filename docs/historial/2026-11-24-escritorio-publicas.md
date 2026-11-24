# Las pantallas públicas en la compu: índice lateral en los legales y la encuesta alineada

**Pedido:** Julieta, 2026-11-24: optimizar todo el sistema para web y mobile (renglón 19 de
`docs/planning/ESCRITORIO_PANTALLAS.md`).

**Qué cambió:**

- `/terminos` y `/privacidad`: el texto ya tenía ancho de lectura (672 px), pero en 1440 px quedaba una tira
  angosta con los costados vacíos y 13 secciones sin forma de saltar de una a otra. Desde `lg` ahora hay un
  índice lateral fijo («En este documento», con la sección que se está leyendo resaltada) y la tarjeta pasa a
  736 px (~670 px de texto). El índice lo arma en el navegador `components/legal/IndiceLegal.tsx` leyendo los
  `h2`: **no se tocó una sola palabra de los textos** (no hay cambio de versión legal). Son páginas estáticas
  sin API, así que no aplica la trampa de las páginas server-side de `SESION_CLOUD.md` §4.
- `/encuesta`: el cielo con el título y el avance ocupaba todo el ancho con el texto pegado al borde, mientras
  las opciones iban centradas. Desde 768 px el contenido del cielo se alinea con la columna de las preguntas
  (`.encuesta-cielo` en `globals.css`).
- `/historia` (la landing anterior, para grabar reels): ya es responsive y es parte de la landing; no se toca.

En el celular no cambia nada (390 px comparado píxel a píxel: idéntico en legales y encuesta). Pruebas nuevas:
`e2e/legales-compu.spec.ts` y una al final de `e2e/encuesta.spec.ts`.

**Queda abierto:** la administración (renglón 20) y el resto de los renglones.
