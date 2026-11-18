# El panel del comercio con la dirección «con relieve» (beta, etapa 4)

**Pedido:** Julieta, 2026-11-18, después de ver el Inicio del trabajador:
«me gusta la dirección que están tomando las pantallas, se siente con más
personalidad y color», y «después seguí con el Panel del comercio». Es la
segunda pantalla del orden de `docs/design-system/direccion-relieve.md`.

**Qué cambió:** el panel del comercio (`/shifts`). La lógica es la misma: qué
turnos se piden, las pestañas por familia, las acciones de cada turno y sus
confirmaciones.

- **El saludo en brocha** y **«Publicar turno» como el botón con relieve**
  (ámbar, con la sombra dura del filete, que se aprieta al tocarlo). «Evento»
  queda plano al lado, y el buscador es recto, como en el Inicio.
- **Los turnos son comandas de papel:** el puesto en brocha, el local y el
  barrio debajo, el pago, y el estado como **sello de goma** (verde lo que
  salió bien, rojo sólo lo cancelado, azul hondo lo que está en curso). Ya
  no llevan la banda de color ni la foto arriba.
- **Los que están en curso cuelgan del riel:** «Buscando personal» y «En
  marcha» van sobre una banda azul hondo, debajo de la barra del riel con sus
  remaches. Terminados, cancelados y borradores van debajo, sobre el lienzo.

Técnico: `frontend/components/ShiftCard.tsx` suma el prop `comanda` (la raíz
pasa a ser `Comanda` y cambia la cabeza; el cuerpo es el mismo) y el estado
lleva `data-testid="shift-status"`. `app/shifts/page.tsx` arma dos grupos
(`enElRiel` y `fueraDelRiel`) dentro de `shifts-panel-list`. En
`globals.css`: `.app-banda`, `.riel` y `.boton-relieve`, con sus tokens
(`--app-banda`, `--app-banda-tinta`, `--app-banda-relieve`).

**Por qué así:**

- **El riel es una banda y no un carrusel.** En la prueba las comandas
  colgaban una al lado de la otra y se deslizaban. Las del panel real llevan
  acciones, el mapa de «va en camino» y la calificación: en un carrusel se
  esconden turnos y se tocan botones al deslizar. Quedaron en lista (grilla
  en pantallas anchas), sobre la misma banda azul hondo y bajo el mismo
  riel, con las pestañas de siempre para filtrar.
- **El vacío de una pestaña en curso va sobre el lienzo.** Su texto no se
  leería sobre el azul: una familia sin turnos no cuelga del riel.
- **Sobre la banda el relieve va un tono más hondo** (más claro de noche): el
  azul de siempre es el de la banda y no se vería.
- **El papel es papel en los dos temas**, como en el Inicio: adentro la
  comanda va forzada a claro, así que los pasos, los botones y la
  calificación se ven igual de día y de noche.
- **`ShiftCard` no se duplicó.** La usan también «Mis turnos» del
  trabajador, la ficha del comercio, Candidatos y el «En vivo» del admin, que
  siguen con la tarjeta de siempre hasta que les toque: les alcanza con pasar
  `comanda`.

Tests que verificaban la forma anterior se actualizaron, no se aflojaron: el
estado se busca por su marca y no por ser una píldora, su contraste se mide
contra el papel, y los colores de los pasos son los de claro también de noche
(`shift-lifecycle-stepper.spec.ts`, `shifts-panel-status.spec.ts`,
`panel-tablet.spec.ts`). Spec nuevo: `panel-relieve.spec.ts`.

**Revisión independiente** (otro agente; de 320 a 1280 px, en claro y
oscuro, con teclado, y en los estados cargando, error, vacío, sin perfil y
con eventos): aprobado con arreglos, hechos acá.

- El foco del link del comercio no se veía en claro dentro de la banda
  (heredaba el blanco de la banda sobre el papel blanco): el foco de adentro
  de una comanda va siempre en azul hondo.
- A 320 px el sello y los cuatro pasos no entraban en un renglón y la página
  se corría 2 px: en la comanda los pasos bajan de renglón.
- Las comandas sin nada pendiente (pagada, cancelada, no cubierta) se
  atenuaban con opacidad y el sello quedaba en 2,7 a 3,2 de contraste: ahora
  pierden el relieve y quedan apoyadas, con un filete, a contraste completo.
- El contador de cada familia sobre el lienzo daba 3,5: va sin opacidad.

**Queda abierto:** Candidatos y Mis turnos (ítem 0 de `STATUS.md`). Los
botones de adentro de la comanda («Elegir a alguien», «Chat», «Más») son el
`Button` de toda la app y siguen como estaban: con «Publicar turno» y «Elegir
a alguien» hay dos ámbar en la pantalla, como antes de este cambio. La barra
de abajo y las pestañas (`SegmentedControl`) también son de toda la app.
