# La barra flota, se va la franja del encabezado y «Publicar turno» es un «+» (#712)

**Pedido:** Julieta, 2026-11-20: llevar al código lo que decidió sobre la
maqueta del lienzo «Oído · identidad por pantalla» (`.barra`, `.barra-comercio`
y `.mas` de `project/oido.css`;
[decisión](./2026-11-20-barra-y-encabezado-decidido.md)). Las tres cosas
juntas, en un PR, sin nada más. Lo que la maqueta no dibuja (por dónde se llega
a los avisos sin la campanita, y la compu) lo vio antes en capturas y dijo «lo
que sea útil, estético, simple y quede mejor en la app»: quedó lo recomendado.

**Qué cambió (lo que se ve):**

- **Celular, quien trabaja y el comercio: ya no hay encabezado.** El cielo de
  cada pantalla llega hasta arriba. «oído» y la campanita (un botón de vidrio)
  van sobre el cielo del Inicio y del Panel; las demás pantallas arrancan con
  su título.
- **La barra de abajo flota:** una píldora blanca con sombra difusa, a 16 px
  de los costados y 18 del borde de abajo; la pestaña activa lleva un óvalo
  celeste detrás del ícono. Reemplaza a la del 2026-11-19 (pegada al borde,
  con la raya azul).
- **Los avisos, fuera del Inicio y del Panel:** la cuenta de los que están sin
  leer va sobre la pestaña Inicio (o Panel) de la barra. Un toque lleva ahí,
  donde está la campanita. El lector de pantalla lo dice: «Inicio, 2 avisos
  sin leer».
- **La campanita del celular abre una hoja** que sube desde abajo, no el
  desplegable: el cielo recorta lo que se le sale y 320 px de desplegable no
  entran en un celular chico.
- **«Publicar turno» del comercio** es el «+» redondo azul hondo al lado de la
  barra, en todas sus pantallas menos mientras publica. En el cielo del Panel,
  «Publicar turno» sigue en ámbar cuando no hay a quién elegir (es la acción
  de la pantalla); con «Elegir a quién va» a la vista ya no se repite en
  vidrio, y queda «Evento».
- **La compu:** la misma píldora, arriba, con «oído», las secciones (la activa
  con su óvalo celeste), la campanita en todas las pantallas y «Salir». Para el
  comercio, «Publicar turno» al lado en azul hondo; en tablet se achica al «+».
- **Sin sesión** (ingreso, alta, legales, el turno compartido) el encabezado
  queda como estaba: esas pantallas se migran en su PR. **El admin** conserva
  arriba el logo y la campanita también en el celular, porque sus pantallas no
  tienen cielo.

**Lo técnico:**

- `frontend/lib/avisos.tsx` (nuevo): `AvisosProvider` y `useAvisos`. Todo lo que
  era estado de `NotificationBell` (la lista, el socket, las relecturas, marcar
  leído, el chat abierto) pasó acá sin cambios de comportamiento, y se monta
  una vez en `app/layout.tsx`. Era necesario: la campanita era **lo único que
  escuchaba los avisos** y avisaba a las pantallas (`lib/live-refresh.ts`), y
  ahora hay pantallas sin campanita y pantallas con dos lugares que muestran
  la cuenta.
- `components/NotificationBell.tsx`: sólo cómo se ve. `variante="barra"` (el
  desplegable de la compu) y `variante="vidrio"` (el botón sobre el cielo, con
  la lista en `ui/Sheet`). `CuentaAvisos` es el numerito, compartido con la
  barra de abajo.
- `components/BottomNav.tsx` y `.barra-app*` en `globals.css`: la píldora, el
  óvalo, la cuenta en la pestaña y el «+». El contenedor no recibe toques:
  alrededor de la píldora se toca lo que hay detrás.
- `components/Navbar.tsx`: con sesión dibuja `BarraConSesion` (`.barra-compu`,
  `.barra-compu-mas`); sin sesión, la franja de antes. Marca
  `data-cromo="app"` en `<html>` para quien no lleva encabezado en el celular.
- `--chrome-bottom` pasó de 5 a 5,75 rem (18 + 64 + 10 de aire) y, con
  `data-cromo="app"`, `--chrome-top` en el celular es sólo la zona segura.
  Todas las pantallas de alto fijo y las acciones pegadas abajo ya restaban
  esas variables, así que se acomodaron solas.
- El lugar reservado para la barra se pinta del color de la hoja en las
  pantallas suaves (`main:has(.estilo-suave)`), para que la hoja siga por
  detrás de la píldora; `.bajo-barra-hoja` hace lo mismo en Buscar del
  comercio, que todavía no se migró. La zona segura de arriba se pinta del
  color con el que arranca el cielo (`.cielo-de-pantalla` marca los cielos del
  Inicio y del Panel, que pueden ser hondos).
- `Logo` suma `sobreCielo` (toma la tinta del cielo).

**Lo que encontró la revisión independiente y la suite (arreglado en el PR):**

- *Avisos de la cuenta anterior a la vista.* El proveedor no se desmonta al
  cerrar sesión (la campanita de antes sí): quien entraba después en el mismo
  equipo veía la lista y la cuenta de la otra persona hasta que respondía su
  pedido. Ahora la lista tiene dueño (la cuenta, no el token, que también
  cambia al renovarse la sesión): se vacía al cambiar, no se muestra en el
  render intermedio y una respuesta que llega tarde se descarta
  (`lib/avisos.cambio-de-cuenta.test.tsx`).
- *Avisos pedidos antes de confirmar la sesión.* El token guardado llega antes
  que `/auth/me`: el admin con el alta de dos pasos pendiente pedía avisos que
  el backend rechaza (lo cortó `barra-de-abajo.spec.ts`). El proveedor espera a
  `user`, como hacía la campanita.
- *Las pestañas sin foco de teclado* (quedaba `foco-propio` sin su anillo): el
  foco va por dentro de la pestaña.
- *El comercio sin cuenta de avisos en Publicar y Candidatos:* la pestaña Panel
  está activa en esas pantallas pero no hay campanita; la cuenta se oculta
  sólo en el Panel mismo.
- *El recorrido guiado* perdía el paso «Publicar turno» con a quién elegir:
  el «+» y el botón de la compu llevan el ancla, y `GuidedTour` toma la que
  está a la vista (`anclaVisible`).
- La bienvenida no lleva `data-cromo` (sumaba dos veces la zona segura), y lo
  que pasa por detrás de la barra de arriba de la compu se esfuma en el lienzo.

**Cómo se probó:** la suite e2e completa y los unitarios; todas las pantallas
renderizadas en claro y oscuro, celular y compu; y la app real en local
(`tools/e2e-local`) con un comercio, una trabajadora y un admin: el aviso llega
en vivo a la pestaña sin recargar (postulación → Panel, asignación → Inicio),
la hoja de avisos abre y lleva a la pantalla del aviso, «Postularme» queda
arriba de la barra, y al cerrar sesión vuelve la landing.

**Por qué así:**

- *La cuenta en la pestaña y no la campanita en todos los cielos:* es lo que
  se decidió («sólo en Inicio y Panel»), no suma un botón a cada pantalla y
  funciona igual en las que no tienen cielo. Cuesta dos toques en vez de uno
  desde otra pantalla; el aviso del celular (push) ya lleva directo.
- *La cuenta sigue en ámbar*, como estaba en la campanita: es la misma señal en
  los dos lugares. No es una acción, así que no compite con el ámbar de la
  pantalla.
- *La compu con la píldora arriba y no una columna al costado:* es el mismo
  objeto que en el celular, no cambia el ancho de ninguna pantalla y deja la
  campanita y «Salir» donde estaban.
- *Los nombres de las secciones no se tocaron* («Matches», «Mensajes», «Turnos»
  en la compu): cambian con la pestaña única de Buscar y Mapa.

**Queda abierto:**

- Juntar Buscar y Mapa en una pestaña (seis → cinco, «Matches» → «Turnos»):
  aparte y después, como estaba decidido.
- Las pestañas de las pantallas (la pista hundida de la maqueta) siguen sin
  decidir.
- El color de la barra del navegador (`themeColor`) sigue blanco: en Chrome de
  Android, sin instalar, queda una franja blanca del sistema sobre el cielo.
  Cambiarlo por pantalla es otro trabajo.
- La zona segura del iPhone (notch) no se puede simular en la sesión: hay que
  mirarla en la app instalada.
