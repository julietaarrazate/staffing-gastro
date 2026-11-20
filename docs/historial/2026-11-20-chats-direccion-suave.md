# Chats con la dirección suave (#PR_NUM)

**Pedido:** Julieta, 2026-11-20: seguir la migración a la dirección suave
(ADR-0028) con Chats, sobre la maqueta `Chats` de la prueba de identidad por
pantalla (https://claude.ai/artifact/WJn8NkYTpvSsa81RpoR2Jg), en una tanda de
tres sesiones en paralelo (Mis turnos, Buscar de quien trabaja y Chats). «El
cielo corto y liso, sin nubes, con el título en letra normal; debajo, la hoja
con la lista, donde cada chat cuelga de su turno. La conversación abierta con
la misma piel (burbujas suaves, el campo de escribir como `.campo`, enviar
como la única acción).» Sólo la piel.

**Qué cambió:** `/chats` y `/chats/[shiftId]`. Quién puede escribirle a
quién, qué se ve de la otra persona, cuándo existe un chat, el visto, el
reintento de un envío y los avisos (sin conversaciones, error, «Reconectando...»,
conversación no encontrada) quedaron igual.

- **La lista:** un cielo corto y liso con «Chats» en letra normal (antes
  «Mensajes», en la letra de títulos; la barra de abajo ya decía «Chats») y,
  en la hoja, una fila por chat separada por una raya fina: la foto o la
  inicial, el nombre, cuándo llegó lo último, el último mensaje y, colgando
  debajo, el turno en un chip. Lo sin leer se nota por el nombre y el mensaje
  más negros, la hora en azul y el contador en azul hondo (antes era ámbar,
  y la fila abierta en la compu tenía un tinte ámbar: ahora lleva el relleno
  del campo).
- **Cuándo llegó lo último:** la hora si es de hoy («18:12»), el día si es
  de esta semana («lun») y el día y el mes si es anterior («9 nov»), como en
  la maqueta. Antes decía «hace 3 h» / «hace 5 d».
- **El turno, con su nombre:** un turno sin título llegaba como «mozo»; en la
  lista y en el encabezado ahora se lee «Mozo/a», como en el resto de la app.
- **La conversación en el celular:** su propio cielo corto con la vuelta (un
  botón redondo de vidrio), la foto, el nombre y el turno; la hoja con los
  mensajes y, abajo, el campo con relleno y «Enviar».
- **Las burbujas:** sin borde; lo propio en celeste (antes, tinte ámbar) y lo
  ajeno con el relleno del campo. «Enviar» queda como el único ámbar de la
  pantalla.
- **En la compu:** el cielo con «Chats» arriba y una sola hoja con la lista a
  la izquierda y la conversación a la derecha; el encabezado de la
  conversación va sobre la hoja, con una raya debajo.

Técnico:

- `frontend/app/chats/layout.tsx`: la raíz lleva `.estilo-suave`; el cielo
  (`.app-cielo.cielo-limpio`) se guarda en el celular con una conversación
  abierta; la hoja es `.hoja` en la lista y `.hoja-compu` con una
  conversación abierta (en el celular, la hoja es la de la conversación). Las
  filas usan `Avatar` (antes dibujaban la foto a mano).
- `frontend/app/chats/[shiftId]/page.tsx`: el encabezado es
  `.app-cielo.cielo-limpio.cielo-celular` (el cielo se apaga desde `md`) y los
  mensajes van en `.hoja-celular`. El campo es `.campo`.
- `frontend/app/chats/ConversationsContext.tsx`: `shiftLabel` (el puesto a su
  nombre).
- `frontend/lib/datetime.ts`: `formatMessageWhen`, con tests en
  `lib/datetime.test.ts`.
- `frontend/components/ui/MessageBubble.tsx` (compartida con Soporte): sólo
  suma las clases `burbuja`, `burbuja-mia`, `burbuja-ajena` y `burbuja-meta`;
  `globals.css` las vuelve suaves dentro de `.estilo-suave`. Soporte no
  cambia.
- `frontend/app/globals.css`: reglas nuevas al final («Chats con la dirección
  suave»); no se tocó ninguna existente.
- `frontend/e2e/chats-suave.spec.ts`: la lista, la conversación en el celular
  (un solo ámbar), el envío, la compu lado a lado y el contraste de la hora de
  la burbuja en claro y en oscuro.

**Por qué así:**

- **Dos clases de hoja (`.hoja-compu`, `.hoja-celular`) en vez de `.hoja`:**
  en el celular la hoja de una conversación abierta sube sobre el cielo de la
  conversación, y en la compu sobre el de la pantalla, así que la misma caja
  no puede ser la hoja en los dos anchos. Se descartó dibujar el encabezado
  dos veces (uno por ancho): duplica el nombre en la página.
- **Lo propio en celeste y no en azul hondo:** un hilo largo de burbujas
  azul hondo pesaba más que la acción; el celeste alcanza con la posición y
  la cola.
- **El subtítulo («Coordiná los detalles…») pasó a la hoja**, arriba de la
  lista, y sólo cuando hay conversaciones: el cielo corto lleva el título
  solo, y sin conversaciones el aviso vacío ya lo dice.

**Queda abierto** (está en la maqueta y no es piel, no se agregó):

- **Las dos secciones «De tus próximos turnos» / «De turnos que ya hiciste»**
  y **el día y la hora del turno en el chip** («Bartender · hoy, 20:00»):
  `GET /chats` no manda la fecha del turno. El chip lleva sólo el título o el
  puesto.
- **«Vos: …» delante del último mensaje cuando es propio:** `GET /chats` no
  dice de quién es el último mensaje.
- **Dos iniciales en el avatar** («LV»): `Avatar` muestra una, en toda la
  app.
- **El encabezado de la compu sigue diciendo «Mensajes»** y la campanita con
  avisos es un segundo ámbar en la pantalla: los dos son del encabezado, que
  se migra al final, solo.
