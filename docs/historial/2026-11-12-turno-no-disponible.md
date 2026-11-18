# El link de un turno: se abre si se reabrió, y dice «ya no está disponible» en castellano si se tomó

**Pedido:** salida a beta, etapa 2 (arreglar lo que encontró la prueba de
punta a punta). Dos hallazgos graves con la misma causa de fondo, la página
pública del turno (`/turno/[id]`): un turno reabierto aparecía en el Inicio
pero su página decía que no existía, y el link de un turno ya tomado,
cancelado o vencido (y cualquier dirección inexistente) mostraba «404 | This
page could not be found.», en inglés y sin salida.

**Qué cambió:**

Lo que ve la persona:

- Un turno que volvió a buscar gente (la persona asignada lo rechazó, se bajó
  o no se presentó) se abre desde el Inicio y desde el link compartido, con
  su botón para postularse.
- El link de un turno que ya se tomó, que el comercio canceló, que quedó sin
  cubrir o cuya hora ya pasó muestra **«Este turno ya no está disponible»**,
  con la explicación «Ya se cubrió o el comercio lo dio de baja.» y una salida
  según quién mira: trabajador con sesión, «Ver otros turnos» (Inicio) y «Ver
  mis turnos»; sin sesión, «Crear mi perfil gratis» y «Ya tengo cuenta»;
  comercio, «Ir a mi panel»; admin, «Ir al panel». No muestra ningún dato del
  turno.
- Cualquier dirección que no existe (y el link de un turno inexistente)
  muestra **«No encontramos esa página»** con «Volver al inicio».

Lo técnico:

- `backend/app/modules/shift/api/routes.py` (`get_shift_public`): responde
  200 mientras el turno esté abierto a postulaciones (`OPEN_STATUSES` y hora
  de inicio por delante, la misma regla que el Inicio); **410** con sólo
  `{"detail": "Este turno ya no está disponible"}` si fue público y dejó de
  estar abierto; 404 si nunca fue público o no existe. La regla vive en el
  dominio: `Shift.was_published` y `Shift.is_open_for_applications(now)`
  (`shift/domain/entities.py`). El 410 lleva `Cache-Control: no-cache`.
- `frontend/lib/turno-publico.ts`: traduce la respuesta a `abierto`,
  `no_disponible` o `no_encontrado`.
- `frontend/app/turno/[id]/layout.tsx` corta lo que no existe (sube a
  `app/not-found.tsx`) y `page.tsx` corta lo que ya no está disponible (cae
  en `app/turno/[id]/not-found.tsx`, que dibuja
  `components/TurnoNoDisponible.tsx`). Las dos pantallas comparten
  `components/PaginaAviso.tsx`.
- `frontend/lib/theme.tsx`: `ThemeProvider` pone `data-theme` al montar si
  falta (ver «Por qué así»).
- Tests: backend en `tests/test_shift.py` (reabierto 200; asignado,
  confirmado, cancelado, hora pasada y no cubierto 410 sin datos; borrador,
  borrador cancelado e inexistente 404) y `tests/test_cache_publico.py`;
  frontend en `lib/turno-publico.test.ts`, `components/TurnoNoDisponible.test.tsx`,
  `app/turno/[id]/turno.test.tsx`, `app/not-found.test.tsx`,
  `lib/theme.test.tsx` y el E2E `e2e/pagina-no-encontrada.spec.ts`.
- Docs corregidos: `reference/API.md` (no listaba el endpoint público),
  `reference/MAPA_DEL_CODIGO.md`, `reference/QUE_EXISTE_HOY.md`,
  `reference/DEPLOY.md` y `reference/SESION_CLOUD.md`.

**Por qué así:**

- **410 y no un 200 con un campo `disponible: false`:** el resto de la API
  avisa con el código HTTP, y un 410 no puede traer datos del turno por
  descuido. Es la única excepción a «ajeno o inexistente = 404», y sólo
  revela que ese link existió, que es lo que ya sabe quien lo recibió. Un
  borrador sigue siendo 404.
- **«Fue público» no depende sólo de `published_at`:** los turnos anteriores
  a ese campo no lo tienen. A todo estado que no sea borrador se llega
  pasando por publicado, salvo cancelado (que también se alcanza desde el
  borrador): sólo ahí decide `published_at`.
- **Hora pasada = hora de inicio pasada**, igual que el Inicio: lo que el
  Inicio deja de ofrecer, la página deja de mostrarlo como abierto.
- **Las dos pantallas responden 404, no 200.** La caché del borde
  (`frontend/cloudflare/turno-cache.mjs`) guarda hasta 10 minutos toda
  respuesta 200 de `/turno/[id]`. Si «ya no disponible» fuera un 200, un turno
  que se reabre seguiría viéndose cerrado desde el link, que es justo el
  problema que se venía a arreglar. Para que cada 404 tenga su pantalla se
  usa cómo anida Next los `not-found.tsx`: el de una carpeta envuelve a su
  página pero no a su layout. Se descartó una sola pantalla para los dos casos
  (el 410 no serviría para nada) y redirigir a una página fija (se pierde la
  dirección del turno, y al reabrirse no alcanza con recargar).
- **El tema.** Al mirar las capturas, la oscura de «ya no disponible» salía
  igual a la clara. Una pantalla que sale de `notFound()` llega como HTML
  vacío y se dibuja en el navegador, así que el `<script>` anti-flash del
  layout no corre y `<html>` quedaba sin `data-theme`. `ThemeProvider` ahora
  lo pone antes del primer pintado, sólo si falta: en una carga normal no
  cambia nada.
- **Sin sesión no se ofrece «Ver otros turnos»:** el Inicio pide sesión y el
  botón rebotaría en el login. Va el mismo destino que «Postulate en Oído» en
  el turno abierto, más «Ya tengo cuenta» para quien abrió el link en un
  navegador donde no entró.

**Queda abierto:**

- **Falta la pantalla de error general** (`frontend/app/error.tsx`): si la API
  no contesta mientras se arma `/turno/[id]`, sale la pantalla de error de
  Next, en inglés. No se hizo acá a propósito.
- **«Ya no disponible» no se ve hasta que carga el JavaScript** (llega como
  HTML vacío, igual que la 404 anterior). La de una dirección inexistente sí
  viene armada del servidor.
- **El E2E de CI no cubre «ya no disponible»:** la página se arma en el
  servidor y el build de CI no tiene una API simulada. Lo cubren los tests de
  componente y se miró renderizado a mano contra una API simulada (claro y
  oscuro, 390 y 1280 px, con y sin sesión, y navegando desde adentro de la
  app).
- **Quien es parte del turno** (el comercio dueño, la persona asignada) ve la
  misma pantalla de «ya no disponible» si abre el link público: no se lo
  lleva a su turno. Los botones de la app sólo llevan a esa página desde el
  Inicio, con turnos abiertos.
- **El comercio no puede compartir un turno reabierto desde su panel:** el
  botón «Compartir» de «Más acciones» sólo aparece en `publicado`
  (`frontend/components/ShiftActions.tsx`). El link ya anda; falta ofrecerlo.
- La API todavía deja **postularse a un turno abierto cuya hora ya pasó**
  (`application/application/services.py` mira el estado, no la hora). Desde
  la app ya no se llega, porque ni el Inicio ni la página lo ofrecen.
- La pantalla de «ya no disponible» dice lo mismo para tomado, cancelado y
  vencido. Distinguirlos pediría que la API diga el motivo, y hoy no dice
  nada del turno a propósito.
