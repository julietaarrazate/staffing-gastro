# Guardar una parte del perfil ya no pisa lo demás (foto del Perfil, interruptor «Disponible» del Inicio y bienvenida)

**Pedido:** salida a beta, etapa 2 (arreglar lo que encontró la prueba de
punta a punta y un reporte externo). Hallazgo U053 y reporte BK-676ABE51EF2C,
misma causa.

**Qué cambió:** lo que ve la persona que busca turnos:

- Tocar el interruptor «Disponible» del Inicio ya no borra el nombre del CV
  (antes pasaba a mostrarse como el nombre interno del archivo) ni deshace
  lo que acababa de guardar en su perfil, aunque la conexión sea lenta y el
  Inicio todavía esté mostrando datos viejos.
- Cambiar la foto desde la tarjeta del perfil ya no pisa la descripción,
  oficios, CV o disponibilidad que la persona guardó en otra pestaña o
  dispositivo después de abrir esa página.

Lo técnico:

- `PUT /workers/me/profile` reemplaza el perfil entero. Las dos pantallas
  armaban el payload con una copia cargada antes (y `toggleAvailable` además
  no mandaba `cv_filename`).
- `frontend/lib/worker-profile.ts`: helper nuevo `saveProfilePart(token,
  cambios)`: lee el perfil del servidor justo antes de escribir y manda el
  perfil completo con los cambios encima (`toWorkerProfileInput`). Devuelve
  lo que respondió el servidor.
- `frontend/components/worker/WorkerGameCard.tsx` (`savePhoto`) y
  `frontend/app/feed/page.tsx` (`toggleAvailable`) lo usan; después de
  guardar la pantalla se queda con lo que devolvió el servidor (el Inicio
  también actualiza su caché de pantalla).
- `frontend/components/WorkerProfileForm.tsx` pasó al mismo helper: ya leía
  antes de guardar, el comportamiento es el mismo.
- Inicio: una carga en vuelo no pisa un guardado posterior. `load()` descarta
  el perfil que leyó si, mientras tanto, se guardó la disponibilidad (contador
  `profileSaves`); sin eso, con conexión lenta la pantalla volvía a
  «Disponible» aunque el servidor ya tuviera «No disp.». También `origin`
  depende sólo de la zona del perfil, así tocar «Disponible» no redibuja las
  tarjetas (`originFor` acepta `Pick<WorkerProfile, "latitude"|"longitude">`).
- Foto del Perfil: si el guardado falla, se avisa en la tarjeta (antes el
  rechazo quedaba sin manejar).
- Inicio: el perfil que devolvió el servidor al guardar se recuerda
  (`lastSavedProfile`) y es lo que se cachea si una carga en vuelo descarta
  su copia vieja; así ir a Perfil y volver durante la primera carga no deja
  el interruptor en «Disponible». Mientras el guardado está en vuelo
  (`savingProfile`) `load` tampoco aplica su perfil (sin parpadeo) y un
  segundo toque no manda otro PUT.
- Foto del Perfil: si el guardado falla, el aviso usa el mismo estilo que el
  error de subida de `ImageUpload` (`text-xs text-danger-text`).
- `/bienvenida` (trabajador): si el POST da 409 (el perfil ya existe), ya no
  cae a un PUT con un payload corto que borraba descripción, CV, idiomas y
  fecha de nacimiento: guarda sólo lo que capturó el asistente con
  `saveProfilePart` (los años de experiencia sólo si se completó el campo),
  y «Dejar para después» no escribe nada.
- **Decisión sobre la cuenta invitada:** es una sola cuenta compartida por
  rol y cada ingreso con PIN pasa por `/bienvenida`; ahí el reemplazo del
  perfil entero es lo deseado (el probador siguiente no hereda datos del
  anterior). El login de invitado navega a `/bienvenida?invitado=1` y, con esa
  marca, la rama 409 hace el PUT completo de antes.
- Tests: `lib/worker-profile.test.ts`, `components/worker/WorkerGameCard.test.tsx`
  y `e2e/inicio-disponible-perfil.spec.ts` (incluye tocar con el refresco en
  vuelo) y `e2e/bienvenida-perfil-existente.spec.ts` (dejar para después, terminar con detalles conservando lo existente, e invitado reemplaza); los E2E fallan con el
  código anterior.

**Por qué así:** un único lugar para "guardar una parte", en vez de que cada
pantalla arme el payload. No se tocó el backend.

**Queda abierto:** entre leer y escribir sigue habiendo una ventana de
milisegundos en la que un guardado de otra pestaña se podría perder. El
arreglo de fondo es un guardado parcial en el backend (PATCH que sólo cambie
los campos enviados). Sin ítem nuevo en `STATUS.md` por pedido del
coordinador.
