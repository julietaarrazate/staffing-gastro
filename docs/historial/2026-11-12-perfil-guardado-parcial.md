# Guardar una parte del perfil ya no pisa lo demás (foto del Perfil, interruptor «Disponible» del Inicio y bienvenida) (#PR)

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
  dispositivo después de abrir esa página. Si el guardado de la foto falla,
  la tarjeta avisa «No pudimos guardar tu foto» (antes quedaba sin guardar y
  sin aviso).
- Volver a entrar a la bienvenida con el perfil ya creado ya no lo borra: se
  guarda sólo lo que se completó y «Dejar para después» no escribe nada.

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
- Foto del Perfil: el guardado que falla se maneja y se avisa en la tarjeta
  (antes el rechazo quedaba sin manejar); estilo `text-xs font-semibold
  text-danger-text`. Si un reintento falla en la subida pueden verse los dos
  avisos (el de subida y el viejo de guardado): se acepta.
- Inicio: el perfil que devolvió el servidor al guardar se recuerda
  (`lastSavedProfile`) y es lo que se cachea si una carga en vuelo descarta
  su copia vieja; así ir a Perfil y volver durante la primera carga no deja
  el interruptor en «Disponible». Mientras el guardado está en vuelo
  (`savingProfile`) `load` tampoco aplica su perfil (sin parpadeo) y un
  segundo toque no manda otro PUT.
- `/bienvenida` (trabajador): si el POST da 409 (el perfil ya existe), ya no
  cae a un PUT con un payload corto que borraba descripción, CV, idiomas y
  fecha de nacimiento: guarda sólo lo que capturó el asistente con
  `saveProfilePart` (los años de experiencia sólo si se completó el campo),
  y «Dejar para después» no escribe nada.
- **Decisión sobre la cuenta invitada:** es una sola cuenta compartida por
  rol y cada ingreso con PIN pasa por `/bienvenida`; ahí el reemplazo del
  perfil entero es lo deseado (el probador siguiente no hereda datos del
  anterior). Se decide por la cuenta, no por la URL: `WorkerOnboarding`
  compara el mail con `invitado.trabajador@oido.beta` (`GUEST_ACCOUNTS` en
  `backend/app/modules/identity/application/services.py`). Una versión previa
  usaba `?invitado=1` en la URL y una cuenta real que la escribiera perdía el
  perfil; se sacó la marca y el login volvió a `/bienvenida`.
- Inicio: si el guardado falla, `toggleAvailable` relee sólo el perfil (no
  recarga todo el Inicio: sin conexión la recarga también falla y tapaba la
  lista de turnos con «No se pudo cargar»). Si no hay perfil todavía (404),
  avisa «Completá tu perfil para marcarte disponible» y no relee nada.
- El mail de la cuenta invitada se exporta desde `lib/worker-profile.ts` y un
  test de vitest lo compara con `GUEST_ACCOUNTS` del backend.
- Tests: `lib/worker-profile.test.ts`, `components/worker/WorkerGameCard.test.tsx`,
  `e2e/inicio-disponible-perfil.spec.ts` (incluye tocar con el refresco en
  vuelo, el guardado fallido con la carga en vuelo, el guardado fallido sin
  conexión que conserva los turnos y el perfil inexistente) y
  `e2e/bienvenida-perfil-existente.spec.ts` (dejar para después, terminar con
  detalles conservando lo existente, invitado reemplaza, cuenta real con
  `?invitado=1` no reemplaza). Los E2E de perfil existente, de Inicio y los
  unitarios fallan con el código anterior; el del invitado fija una decisión
  (con el código anterior también pasa).

**Por qué así:** un único lugar para "guardar una parte", en vez de que cada
pantalla arme el payload. No se tocó el backend.

**Queda abierto:**
- Entre leer y escribir sigue habiendo una ventana de milisegundos en la que
  un guardado de otra pestaña se podría perder. El arreglo de fondo es un
  guardado parcial en el backend (PATCH que sólo cambie los campos enviados).
- El formulario completo del perfil manda la disponibilidad que cargó al
  abrirse: desde una pestaña vieja pisa lo que se haya cambiado con el
  interruptor del Inicio.
- El onboarding del comercio conserva el PUT corto tras un POST fallido.

Sin ítem nuevo en `STATUS.md` por pedido del coordinador.
