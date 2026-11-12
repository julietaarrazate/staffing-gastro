# Guardar una parte del perfil ya no pisa lo demás (foto del Inicio e interruptor «Disponible»)

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
- Tests: `lib/worker-profile.test.ts`, `components/worker/WorkerGameCard.test.tsx`
  y `e2e/inicio-disponible-perfil.spec.ts` (los dos últimos fallan con el
  código anterior).

**Por qué así:** un único lugar para "guardar una parte", en vez de que cada
pantalla arme el payload. No se tocó el backend.

**Queda abierto:** entre leer y escribir sigue habiendo una ventana de
milisegundos en la que un guardado de otra pestaña se podría perder. El
arreglo de fondo es un guardado parcial en el backend (PATCH que sólo cambie
los campos enviados). Sin ítem nuevo en `STATUS.md` por pedido del
coordinador.
