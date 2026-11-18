# La landing híbrida llega al código: letra mixta, relieve, la carta y el pie azul hondo (beta, etapa 4)

**Pedido:** Julieta, 2026-11-18: seguir con la etapa 4, landing y app. Lo
que sigue en `docs/design-system/direccion-relieve.md` era llevar al código
el híbrido que eligió como base (la landing publicada con brocha, carta y
relieve: https://claude.ai/artifact/9Bq2jU9LK7xaCj6b4T2Bxz).

**Qué cambió:** la landing (`/`) conserva el cielo, las nubes, la rueda de
fotos, las secciones y casi todos sus textos. Cambia esto:

- **Letra mixta.** «Encontrá tu …» y «¿Te falta alguien hoy?» van en brocha
  (Sedgwick Ave Display), en mayúsculas y en azul; la palabra que cambia
  sigue en ámbar. Los títulos de sección van en Abril Fatface en lugar de
  Young Serif. Lo anotado a mano, en Mansalva. Las tres se cargan sólo en la
  landing (`frontend/components/landing/letras.ts`); las preguntas
  frecuentes pasan a Inter.
- **Botones con el relieve del filete:** sombra dura azul hondo que se
  aprieta al tocar, en lugar de la sombra difusa. También la impresora de la
  comanda, el mapa y la oferta de «Para trabajar», que ya no flota.
- **Los precios son una carta de bodegón** (`Precios.tsx`): papel con doble
  filete, cada plan como un plato, «sugerencia de la casa» en el Básico y
  «No cobramos cubierto. Tampoco comisión por turno.» al pie. Al lado, una
  pizarra donde la tiza escribe el plan elegido y marca el tope con palitos
  de a cinco. Los planes, los precios y el destino del botón son los mismos;
  ahora hay un solo «Empezar con <plan>», que sigue al plato elegido.
- **El mapa, sin reloj ni minutos:** se fueron el relojito (20:46 → 20:54) y
  el «~3 min» del pie. Queda la distancia.
- **El cierre, sin el Sol de Mayo**, y **el pie en azul hondo** con la letra
  en blanco.

Técnico: tokens del relieve en `frontend/app/globals.css` (`--relieve`,
`--shadow-relieve*`, `--radius-relieve`; ADR-0027), clases nuevas
`.landing-cartel`, `.landing-plano`, `.landing-carta*`, `.landing-plato*`,
`.landing-pizarra`, `.landing-tiza*`; se borró el CSS del reloj, del sol, de
las tarjetas de precios y de `.landing-flota`. Tests: `e2e/landing.spec.ts` y
`e2e/plan-elegido.spec.ts` prueban la carta (un plato elegido, un botón).

**Por qué así:** se partió de la landing publicada y se cambió de a una
pieza, que es la lección de la segunda prueba. Tres cosas se apartan de la
prueba, las tres mirándola renderizada: el marco de la pizarra va en blanco
(en celeste pálido se perdía contra el panel); el puesto de la oferta
(«Mozo/a») va en Inter, porque en brocha la barra se leía como una letra y
la brocha quedó decidida sólo para el inicio, el cierre y la carta; y el pie
no repite la palabra «oído», que ya está gigante justo arriba. La landing
sigue siendo siempre clara (la noche de la prueba era un interruptor de la
prueba, no un pedido).

La revisión independiente (otro agente, en siete anchos de 320 a 1920 px,
con teclado, con «reducir movimiento» y con la app en oscuro) encontró tres
cosas que se arreglaron acá: a 320 y 360 px el nombre del plato en brocha se
encimaba con el precio (de 380 px para abajo el precio baja a su renglón); a
320 px «TU» quedaba solo en el título del inicio (baja a 2,75 rem); y un plan
de la API sin `features` tiraba la sección entera. Las tres tienen su test en
`e2e/landing.spec.ts`. Anotó además que la palabra ámbar sobre el cielo da
entre 3,0 y 3,2 de contraste: pasa para texto grande, justo; es el mismo
ámbar de antes y no se tocó.

**Queda abierto:** la app, pantalla por pantalla (ítem 0 de `STATUS.md`).
Julieta todavía no dijo qué de la segunda prueba de la app entra y en qué
orden. La comanda conserva su hora («Comanda · Tu bar · 20:46»); si también
se lee como promesa, se saca. Los textos son los de la landing publicada,
salvo los de la carta («La carta · planes para el local», «sugerencia de la
casa», «No cobramos cubierto. Tampoco comisión por turno.», «Hoy marcha»):
ninguno afirma algo nuevo del producto.
