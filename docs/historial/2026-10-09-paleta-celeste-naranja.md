# La paleta de la landing pasa de violeta a celeste y naranja

**Pedido:** Julieta, 2026-10-09, en el hilo "Identidad de marca de Oído".
Quería cambiar el violeta por otro color "sin rehacer todo". Se le
propusieron petróleo, bordó y cobalto con el mismo contraste que el violeta;
mandó en cambio una referencia (un sitio de pasta con paneles celestes y
letra naranja). Eligió el celeste claro, descartó el petróleo para las
superficies oscuras y, en una tarjeta de decisión, eligió el naranja de la
referencia para los botones (contra el ámbar `#ffab25`, que sobre el celeste
casi desaparece: 1,40:1).

**Qué cambió:**

1. **Sólo valores en el bloque de tokens**, que pasa a llamarse
   `[data-palette="celeste"]` (`globals.css`, prendido por
   `LandingStory.tsx`). Lienzo celeste claro `#c4e3ed`, botones naranja
   `#e64c1e` con tinta, texto destacado y anillo de foco en azul hondo
   `#1c5478`, recesado y mapa `#b5daeb`, noche fría `#121619`. Tabla y
   contrastes: [`design-system/color-system.md`](../design-system/color-system.md),
   "Propuesta v6".
2. **Las superficies con letra blanca van en azul hondo liso**
   (`--gradient-brand: none`): el banner del mozo, "Recomendado", el reloj
   cubierto y el resultado. Ningún componente cambió para esto: siguen
   usando `bg-brand` y `bg-secondary`.
3. **El borde del secundario sobre esas superficies vuelve al 60%** que
   pidió Julieta el 2026-10-08 (4,07:1 sobre el azul liso). Con el violeta
   había quedado en 80% por el brillo del degradé; esa decisión pendiente
   se cierra.
4. **Letra chica sobre la banda naranja del "¡Oído!" en tinta llena**
   (`ActoOido.tsx`, `RelojDelTurno.tsx`): al 70% daba 3,40:1; ahora 4,87.

**Por qué así:**

- **El celeste es el lienzo y no la superficie de marca**, porque es claro:
  como superficie de marca habría obligado a pasar a tinta toda la letra
  blanca de las tarjetas, y el resultado entra desde la noche con el texto
  ya escrito encima, así que en la transición la tinta no se habría leído.
  Como lienzo, el cambio es de valores y el celeste domina igual, como en
  la referencia.
- **El azul hondo es el mismo tono del celeste**, oscurecido hasta que el
  blanco dé 8,11 (lo mismo que daba el violeta). Sin brillo: un brillo
  celeste tendría la misma luminancia que el naranja (1,04:1) y el botón
  vibraría encima.
- **El naranja nunca va como letra** (2,87 sobre el celeste, 3,49 sobre
  `#f3f3f3`): el texto destacado pasa al azul hondo.

**Medido:** contraste de todos los textos visibles de la landing a 390×844,
animada y con "reducir movimiento". Lo único bajo el piso son los grises
chicos de las tarjetas que ya estaban así con v5.0 (ver la entrada del
2026-10-08) y un "·" separador al 45% sobre el azul hondo (2,99). La
landing sigue sin oscurecerse con el tema oscuro (fija `data-theme="light"`).

**Queda abierto:** que Julieta apruebe la paleta y el logo, que sigue en el
ámbar `#d97706` y junto al naranja queda fuera de familia. El PDF del design
system y el paquete para el diseñador (`/mnt/project-files/design-system/`)
documentan la versión violeta: no se rehicieron, por pedido de ahorrar
trabajo.
