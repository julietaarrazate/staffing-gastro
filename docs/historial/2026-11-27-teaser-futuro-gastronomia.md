# Teaser «El futuro de la gastronomía»: la receta y dónde quedó guardado

**Pedido:** Julieta pidió una presentación 3D de Oído parecida a una referencia
que trajo, después videos de esa presentación para redes y WhatsApp, y al final
que no se pierda nada y que cada sesión nueva sepa de qué se trata.

**Qué cambió:** nada en la app. En el repo queda la receta que rehace la
presentación y los videos (`tools/teaser-futuro-gastronomia/`, con `receta.sh`
como entrada) y la nota que explica qué es y dónde está cada pieza
(`docs/reference/TEASER_FUTURO_GASTRONOMIA.md`), con su fila en `CLAUDE.md`, en
`MAPA_DEL_CODIGO.md` y en `MAPA_DE_DOCS.md`. Fuera del repo, en una página
privada de Julieta, quedan los cuatro videos, la banda de sonido, la
presentación, el guion y el archivo de referencia.

**Por qué así:**

- **Se adaptó la referencia en vez de dibujar de cero.** Hubo dos intentos
  propios (2D y 3D); Julieta los descartó porque las personas parecían fichas
  de ajedrez y pidió conservar los cuadros de la referencia. La adaptación
  cambia solo textos: 178 reemplazos por posición exacta en el código (árbol
  sintáctico), más ocho ajustes puntuales (horas en lugar de años en el
  gráfico, meses en español, el ancho de una caja de selección).
- **El video se graba con un reloj manual**, cuadro por cuadro, porque la nube
  no tiene placa de video y en tiempo real saltearía cuadros. El sonido sí se
  graba en tiempo real, del motor de audio de la propia presentación, con un
  pitido de sincronía para alinearlo. Se descartó regenerar el sonido con otra
  herramienta: Julieta pidió conservar el original.
- **El guion y la referencia no entran al repo:** es público y los dos traen
  el texto completo de una obra ajena. Los videos tampoco, por peso.
- **En `tools/` y no en `marketing/`:** `.claude/settings.json` bloquea la
  lectura de `marketing/` y una sesión nueva no podría leer la receta.
- **Verificado:** con las entradas del archivo privado, la receta reproduce
  byte a byte la presentación publicada, las dos versiones para grabar, las
  placas y el video vertical entregado. El recorte del sonido difiere en menos
  de un milisegundo del que se usó.

**Queda abierto:** el visto bueno de Julieta antes de publicar (ítem en
`../STATUS.md` → «Pendiente de Julieta»). No se hizo el video completo de 8
minutos (unos 14.700 cuadros sin placa de video), ni se cambiaron los dibujos:
las hojas que suben al cielo no son comandas.
