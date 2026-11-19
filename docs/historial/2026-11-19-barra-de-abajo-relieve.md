# La barra de abajo con la dirección «con relieve» (beta, etapa 4)

**Pedido:** Julieta, 2026-11-19: seguir la dirección «con relieve» con lo que
es de toda la app, un PR cada cosa y en orden: la barra de abajo, las
pestañas, los botones secundarios, los pasos tachados a mano, los colores de
los sellos y el detalle del turno. Ésta es la primera.

**Qué cambió:** la barra de secciones del celular (`components/BottomNav.tsx`),
para los tres roles. La lógica es la misma: las pestañas de cada rol, adónde
llevan, cuándo no se muestra.

- **Pegada al borde y lisa**, como en la segunda prueba de la app
  (https://claude.ai/artifact/MEN8VhUv43HM2sE9pH6kmF): fondo de tarjeta, sin
  vidrio ni desenfoque, con un filete arriba.
- **Lo activo es una raya azul hondo** de 3 px sobre la pestaña (celeste de
  noche), con el nombre en tinta. Se fue la píldora celeste detrás del ícono.
- **Las demás en `ink-soft`.** Antes iban en `ink/40`, que sobre el blanco
  daba 2,6 de contraste.

Contraste medido con la barra renderizada a 390 px (nombre contra el fondo de
la barra; la raya contra el mismo fondo):

| | Claro | Noche |
|---|---|---|
| Pestaña activa | 18,9 | 15,2 |
| Las demás | 7,6 | 8,2 |
| Raya | 8,1 | 9,6 |

Test: `e2e/barra-de-abajo.spec.ts` suma un caso por tema (raya de 3 px, sin
fondo detrás del ícono, fondo opaco y sin desenfoque, nombres a 4,5 o más y la
raya a 3 o más).

**Por qué así:**

- **Fondo de tarjeta y no el cromo de vidrio.** La prueba la dibuja lisa, del
  color de la tarjeta, como un objeto apoyado y no flotando (ADR-0027, punto
  4). De noche queda un punto más clara que el encabezado, que sigue de
  vidrio hasta que le toque.
- **La raya arriba y no abajo:** es el borde que toca la pantalla, y es el
  mismo gesto que van a tener las pestañas (elegido por Julieta el mismo día).
- **Todas en negrita.** Cambiar el peso sólo en la activa movía el ancho del
  nombre al tocar.

**Revisión independiente** (otro agente; los tres roles, de 320 a 430 px,
claro y oscuro, con teclado y con contenido pasando por debajo): aprobada con
un arreglo, hecho acá. El contorno de foco iba por fuera de la pestaña: abajo
y en las puntas lo cortaba el borde de la pantalla, y arriba se fundía con la
raya de la activa, que es del mismo azul. Primero se corrió el contorno
hacia adentro, y en la segunda mirada cruzaba las letras de «Matches» a 360
px. Quedó un anillo propio por dentro de la pestaña (`foco-propio` con un
`::after`, como las tarjetas del mapa): a 1 px de los costados y 2 px por
debajo de la raya, entero y separado de ella; lo cubre el mismo test. A 320
px «Matches» ocupa casi toda su pestaña (53 px) y el anillo la roza. Anotó también que la barra mide
61 px (antes unos 67) y el contenido sigue reservando 80 (`--chrome-bottom`):
quedan 19 px de aire al final de cada pantalla, como antes quedaban 13.

**Decisiones del día:** antes de escribir las seis piezas, Julieta eligió cómo
van las que la prueba no dibujaba: las pestañas con raya azul hondo (vio las
tres opciones puestas sobre el Panel, Mis turnos y Candidatos), los pasos
tachados en un renglón y, en el detalle del turno, el pago como último
renglón de la comanda. Quedó escrito en `design-system/direccion-relieve.md`.

**Queda abierto:** las pestañas, los botones secundarios, los pasos tachados
a mano, los colores de los sellos y el detalle del turno (ítem 0 de
`STATUS.md`). El encabezado de la app (`Navbar`) sigue con el cromo de vidrio.
