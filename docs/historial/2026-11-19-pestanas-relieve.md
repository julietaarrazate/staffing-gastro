# Las pestañas con la dirección «con relieve» (beta, etapa 4)

**Pedido:** Julieta, 2026-11-19: después de la barra de abajo, las pestañas
de toda la app. La prueba de la app no las dibujaba, así que se le mostraron
tres opciones puestas sobre las pantallas ya migradas (el Panel, Mis turnos y
Candidatos, a 390 px; antes había preguntado «¿viste las pantallas que ya se
hicieron?» y mandó una captura del Panel): una raya azul hondo, una pista
recta con la activa llena en azul y fichas de carpeta. Eligió **la raya**.

**Qué cambió:** las pestañas de Mis turnos, el Panel, Candidatos, el alta
(«Soy trabajador/a» / «Soy comercio») y el admin (En vivo, Métricas, Soporte,
Comercios a captar). La lógica es la misma: qué pestaña hay, qué filtra cada
una, sus contadores.

- **Texto plano sobre un filete.** La activa en tinta con una raya azul hondo
  de 3 px debajo (celeste de noche), que se desliza a la que se toca; las
  demás en `ink-soft`. Sin la pista gris ni la píldora blanca con sombra.
- **Cada pestaña mide lo que su nombre**, a la izquierda, y no una parte igual
  del ancho. En el Panel, donde las cinco no entran en 390 px, scrollean de
  costado como antes y el filete llega hasta el borde.

Contraste medido renderizado a 390 px, contra el fondo de detrás de las
pestañas:

| | Claro (lienzo) | Noche (lienzo) | Alta, claro (tarjeta) | Alta, noche |
|---|---|---|---|---|
| Activa | 18,2 | 16,7 | 18,9 | 15,2 |
| Las demás | 7,3 | 9,0 | 7,6 | 8,2 |
| Raya | 7,8 | 10,6 | 8,1 | 9,6 |

Técnico: `components/ui/SegmentedControl.tsx` (el nombre del componente queda;
la pista lleva `data-pestanas`). El filete es una sombra hacia adentro y no un
`border-b`, así la raya lo tapa sin salirse de la caja. El Panel pasa de
`min-w-[540px]` a `w-max min-w-full`; donde las pestañas scrollean (el Panel y
el «En vivo» del admin) el contenedor lleva `py-1` de aire para que el
contorno de foco, que va 4 px por fuera, no quede cortado. En el «En vivo» la
tira que scrollea pasó a ser el contenedor, y el efecto que trae el filtro
elegido a la vista mide contra él. Spec nuevo: `e2e/pestanas-relieve.spec.ts`.

**Por qué así:**

- **El mismo gesto que la barra de abajo:** la raya azul hondo dice «acá
  estás» en las dos. El relieve queda para el objeto de cada pantalla (el
  botón principal, la comanda, el destacado), como pide el ADR-0027.
- **La pista recta con la activa en azul** se leía como un botón apretado y en
  el Panel quedaba azul sobre azul con el riel; **las fichas** sumaban un
  tercer lenguaje, de navegador.
- **Los chips de filtro** del admin («Comercios a captar») no son pestañas y
  siguen como estaban.

**Revisión independiente** (otro agente; nueve pantallas, claro y oscuro, a
320, 360, 390 y 1280 px, con teclado, contadores de hasta cuatro cifras y
«reducir movimiento»): aprobada con dos arreglos, hechos acá.

- En el «En vivo» del admin a 360 px, con `?filtro=ausencias`, «Todos» quedaba
  asomando a medias y al llegarle con el teclado el navegador no la movía: el
  contorno salía cortado. Ahora la pestaña que recibe el foco se trae entera a
  la vista, con aire (`scroll-padding`) en los dos contenedores que scrollean.
- En Mis turnos a 320 px los tres nombres se recortaban con «…» aun con
  contadores de una cifra: entre pestañas van 10 px en el celular (no 16) y el
  número va más pegado. (Con 12 px entraban en local con 11 px de sobra y en
  la primera corrida de CI no: el test ahora mide con Inter ya cargada.) Con contadores de dos cifras a 320 sigue el «…», con
  el número a la vista, como antes.

Anotó además que el filete del Panel termina a 16 px del borde, alineado con
el contenido, y que en «Métricas» la página mide de más hasta que cargan las
tarjetas (no es de las pestañas).

**Queda abierto:** los botones secundarios, los pasos tachados a mano, los
colores de los sellos y el detalle del turno (ítem 0 de `STATUS.md`).
