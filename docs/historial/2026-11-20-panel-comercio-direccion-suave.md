# El Panel del comercio con la dirección suave (#706)

**Pedido:** Julieta, 2026-11-20 (por la sesión que coordina la tanda): seguir
la migración a la dirección suave (ADR-0028) con el Panel del comercio, sobre
las maquetas `C-Panel`, `C-Panel-vacio` y `C-Panel-nadie` de la prueba de
identidad por pantalla (https://claude.ai/artifact/WJn8NkYTpvSsa81RpoR2Jg).
«El cielo hondo (el servicio en marcha) con el número de turnos de hoy y sus
tres estados; debajo, la hoja con los turnos como tarjetas o filas suaves; los
estados vacío y «nadie se postuló» como en sus maquetas. Sin el marrón por
rubro. Las mismas acciones de hoy y un solo ámbar por pantalla.» Sólo la piel;
`ShiftCard` no podía cambiar para las demás pantallas.

**Qué cambió:** la pantalla `/shifts`. Las pestañas, qué turno va en cuál, las
acciones, sus confirmaciones, los avisos, los eventos y los errores quedaron
igual.

- **Arriba, el cielo.** Con algún turno en curso (buscando o en marcha) es el
  **cielo hondo**: «Hola, Julieta. Hoy tenés» y el número grande de turnos de
  hoy, con sus tres estados (Buscando, En marcha, Terminados). Cuenta todo
  lo que está en curso más lo que hoy ya terminó; uno de anoche que sigue en
  marcha pasada la medianoche cuenta como de hoy. Si algo de lo que está en
  curso es de otro día, dice «Tenés en curso» y cuenta sólo lo que está en
  curso: así el número habla siempre de los mismos turnos que las pestañas
  y que el turno que se ofrece elegir. Mientras alguno está buscando, el
  chip «Marchando» con el punto que late (se apaga con «reducir
  movimiento»).
- **A quién elegir, en el cielo.** Si un turno tiene postulaciones
  pendientes: «Cocinero/a, hoy a las 21:00 · Ya se postularon 4» y el ámbar
  «Elegir a quién va», que lleva a sus candidatos (el que empieza antes, si
  hay varios). Si están buscando y nadie se postuló: «Todavía nadie cantó
  «oído»».
- **Sin nada en curso, el cielo de día:** «¿Te falta alguien hoy?» y
  «Publicar turno». El primer día (sin ningún turno), la hoja cuenta «Así
  sale un turno» en tres pasos, en lugar de la ilustración y el segundo botón
  de publicar.
- **Debajo, la hoja:** el asistente, los eventos, las pestañas y los turnos
  como **filas suaves**: a la izquierda las iniciales de quien lo cubre o,
  mientras no lo cubre nadie, el cielo con el ícono del puesto; el puesto, el
  horario y el lugar; a la derecha el estado en palabras (verde lo que salió
  bien, rojo lo cancelado) y el pago. Debajo los cuatro pasos con su barra y
  las mismas acciones. Lo que ya no tiene nada pendiente queda hundido, sin
  perder contraste.
- **Un solo ámbar:** «Elegir a quién va» cuando hay a quién elegir (y
  «Publicar turno» pasa a vidrio); si no, «Publicar turno». La acción de cada
  fila («Elegir a alguien (4)», «Cerrar turno», «Marcar como pagado»,
  «Publicar turno» de un borrador) va en **azul hondo**; «Chat» y «Más»,
  quietos.
- **«Enviar calificación» también en azul hondo, acá y en Mis turnos**
  (`ReviewBox` es la misma pieza): con las estrellas puestas era un segundo
  ámbar en las dos pantallas. La caja de la calificación pasó del crema al
  relleno suave.
- Se fueron el saludo en brocha, la banda azul con el riel, las comandas de
  papel y los sellos de goma.

Técnico:

- `frontend/components/employer/CieloPanel.tsx` (el cielo) y
  `frontend/components/employer/TurnoPanel.tsx` (la fila; mismos datos que la
  comanda de `ShiftCard` del lado del comercio: aviso de pago bajo, pasos,
  «va en camino»). **`ShiftCard` no se tocó**; su variante `comanda` quedó sin
  uso en la app (se borra en el cierre de la migración, con lo demás «con
  relieve»).
- `frontend/lib/panel-comercio.ts`: las familias de estado (salieron de la
  página, sin cambios) y `resumenPanel`, lo que responde el cielo, con sus
  tests (`panel-comercio.test.ts`). Todo sale de lo que ya trae
  `GET /shifts/me`.
- `frontend/components/ShiftActions.tsx` (sólo la usa el panel): el principal
  en `.boton-hondo`, «Chat» y «Más» en `.boton-quieto`.
  `frontend/components/ReviewBox.tsx`: `.caja-resena` y el botón en
  `.boton-hondo`. `worker/TurnoSuave.tsx` sólo exporta el mapa de tonos del
  estado, para no duplicarlo.
- `frontend/app/globals.css`: un bloque nuevo («El panel del comercio con la
  dirección suave»), sin tocar reglas existentes: `.pulso-cielo`,
  `.boton-cielo`, `.panel-vidrio`, `.boton-hondo`, `.caja-resena`,
  `.panel-asistente` y el foco blanco sobre el cielo hondo.
- E2E: `panel-suave.spec.ts` (reemplaza a `panel-relieve.spec.ts`),
  `panel-estados-suave.spec.ts` (era `sellos-relieve.spec.ts`: los mismos
  estados, ahora palabras con color sobre la fila), y se adaptaron
  `panel-arriba`, `shifts-panel-status`, `shift-lifecycle-stepper` (los pasos
  del panel son barras) y `mis-turnos-suave` (el botón de calificar). Se
  borró `botones-relieve.spec.ts`: medía «Evento» y «Más» rectos y con filete
  en el Panel, que ya no existen.

**Por qué así:**

- **El número de turnos y no «Buscamos hace 3 min».** La maqueta termina la
  frase en el tiempo de búsqueda, pero el turno no trae cuándo se publicó
  (`created_at` es de cuando se creó el borrador): mostrarlo sería inventar
  un dato. Se usó lo que pedía el encargo y lo que dice «Identidad por
  pantalla»: el número de turnos de hoy y sus tres estados.
- **Una pieza propia en vez de un modo más de `ShiftCard`,** como hizo Mis
  turnos: `ShiftCard` la usan otras pantallas que no podían cambiar.
- **Azul hondo para la acción de la fila,** no quieta como en Mis turnos: en
  el panel casi todas las filas tienen una acción que es del comercio
  («Cerrar turno», «Marcar como pagado») y al lado de «Chat» y «Más» quietos
  se perdía. Es el azul del «+» de publicar de la maqueta.
- **«Publicar turno» siempre en el mismo lugar del cielo,** y cambia de ámbar
  a vidrio cuando el ámbar es «Elegir a quién va»: en la maqueta publicar es
  el «+» redondo al lado de la barra, que llega con el PR de la barra.

**Revisión independiente** (otro agente, intentando romperlo, 28 escenarios
en claro y oscuro de 320 a 1280 px): sin bloqueantes. Encontró que el cielo
contaba mal un turno que cruza la medianoche y que mezclaba días (el número
sólo de hoy junto a un «elegir» de otro día); se corrigió la regla de arriba,
con sus tests. También una ciudad larguísima sin espacios que corría la
página y el número pegado a «turnos» para quien lo oye. Probado además en
el entorno local (`tools/e2e-local`) contra el backend real: primer día,
nadie se postuló, una postulación, el ámbar hasta Candidatos y cancelar
desde la fila.

**En la fila ya no va el nombre del comercio** (la comanda lo mostraba con
link a su perfil): es el panel del propio comercio. Va, en cambio, el nombre
de quien cubre el turno, que ya venía en `/shifts/me` y se usaba en la línea
de «qué está pasando».

**Queda abierto** (está en la maqueta y es función nueva, no piel):

- «Buscamos hace N min» (falta la fecha de publicación del turno).
- Las fotos de quienes se postularon en el cielo (`/shifts/me` sólo manda la
  cantidad).
- En «nadie se postuló»: «Ya estamos avisando más lejos, hasta 5 km», «Subí
  el pago» con el monto sugerido, «Invitá a alguien de tus favoritos» y
  «Cambiá el horario» (hoy un turno publicado no se edita). El aviso de pago
  por debajo de lo habitual sigue en la fila, como antes.
- La foto de quien cubre el turno en la fila (hoy van las iniciales: el turno
  trae el nombre, no la foto) y «Va en camino» como estado de la fila (sigue
  como mapa o nota debajo).
- El «+» redondo de publicar y la barra flotante: van con el PR de la barra.
- Los diálogos de confirmación siguen con el botón de antes (son hojas
  compartidas, sin maqueta todavía).
