# Dirección «con relieve»: cinco isotipos y la landing en tres direcciones (beta, etapa 4)

**Pedido:** Julieta, 2026-11-18 (etapa 4, segunda tanda; pruebas de diseño,
sin tocar producción). Con el video de la web de una pizzería porteña como
referencia de cómo está armada una página: proponer un isotipo propio, hacer
una segunda versión de la landing de prueba y mirarlo todo renderizado. Que
no salga genérico: cada efecto sale de un objeto real de la cocina. Y como el
repo es público, no nombrar a otras marcas del rubro.

**Qué cambió:** nada en el producto. Dos pruebas publicadas como artifacts
privados y los docs al día.

- **Isotipos:** cinco conceptos en vector (voluta, pinche, campanita, grito y
  respuesta, la o que grita) a 16, 32, 180 y 512 px, en claro y oscuro, en la
  pestaña y en el celular: https://claude.ai/artifact/TqfGBkrBX1aGFJSygrsQkS.
  Recomendado «grito y respuesta», con el brief para un fileteador.
- **Landing:** Julieta pidió ver las tres direcciones propuestas, así que van
  las tres en una página con pestañas («El pase», «El bodegón», «Un servicio
  en vivo»), con la letra de cartel contra Young Serif y el tema claro o
  noche: https://claude.ai/artifact/VWPZtN8eAvxk5U2kVuE3zR.
- **Docs:** el detalle, lo que falta decidir y el orden para llevarlo a
  producción, en `docs/design-system/direccion-relieve.md`; el ítem 0 de
  `docs/STATUS.md` y el pendiente de `docs/design-system/marca-hoy.md`. Se
  sacó el nombre de la otra marca del rubro de `STATUS.md`, `marca-hoy.md`,
  `direccion-relieve.md` y la entrada del 2026-11-17.

**Por qué así:** el isotipo recomendado es el único que no existe fuera del
castellano y el que mejor aguanta los 16 px; el pinche y la campanita son
más simpáticos en grande pero se empastan o no son de nadie. En la landing se
recomienda «El pase» porque la primera pantalla explica el producto con el
gesto que le da nombre y no depende de fotos de banco. No se comparó contra
el ícono de la otra marca: Julieta pidió no nombrarla y ya no se parecen. No
hay contadores ni pagos inventados; los precios son los de `planes.ts`.

**Queda abierto:** que Julieta elija dirección, letra de los títulos e
isotipo (ítem 0 de `STATUS.md`). La app en oscuro con el relieve no se miró
en esta tanda. El historial congelado y `marketing/` no se revisaron (la
lectura está bloqueada); si nombran a la otra marca, queda ahí.
