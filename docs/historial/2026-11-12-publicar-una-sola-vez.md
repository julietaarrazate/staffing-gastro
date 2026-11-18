# Publicar un turno: un intento crea un solo turno, y el plan cuenta sólo lo que se publicó

**Pedido:** salida a beta, etapa 2 (arreglar lo que encontró la prueba de
punta a punta y lo que reportó una herramienta externa de revisión). Dos
hallazgos graves con la misma raíz, publicar son dos pedidos y ninguno de
los dos lados se acordaba del otro:

- Con mala señal, quien tocaba «Publicar turno», veía un error y volvía a
  tocar terminaba con dos turnos iguales publicados, o con uno publicado y
  un borrador suelto en el panel.
- «Mi plan» decía «3 de 5 turnos usados» con un solo turno publicado: cada
  intento de publicar se descontaba del plan, también los que no publicaban
  nada.

**Qué cambió:** lo que ve el comercio:

- Mientras sigue en el asistente, volver a tocar «Publicar turno» después
  de un error publica el mismo turno. No aparece un segundo turno ni un
  borrador de más en el panel.
- Si entre un intento y el otro cambió algo (el pago, el horario, la zona),
  se publica lo que está viendo en el resumen.
- En «Mi plan», los turnos usados son los que publicó. Tocar dos veces,
  publicar el mismo borrador desde dos pestañas o reintentar después de un
  error no gasta turnos.
- El aviso de tope del plan sigue igual: el borrador queda guardado para
  publicarlo desde el panel.

Lo técnico:

- `frontend/app/shifts/new/page.tsx`, `publish()`: el asistente guarda en
  un `ref` el borrador del intento (`draft`: id y datos guardados) y el
  pedido de crear que quedó sin respuesta (`pendingCreate`).
  - Sin borrador conocido: `POST /shifts` con la key `create-shift`. Si el
    pedido anterior quedó sin respuesta se repite tal cual (misma key,
    mismo cuerpo), y el backend devuelve el borrador que ya había creado.
  - Con borrador y formulario cambiado: `PUT /shifts/{id}` antes de
    publicar. Si esa edición queda sin respuesta no se sabe qué guardó el
    servidor, así que el próximo intento vuelve a guardar aunque la persona
    haya deshecho el cambio.
  - `POST /shifts/{id}/publish` con la key del turno. Las dos keys y el
    borrador se sueltan recién cuando publicar respondió bien (antes la de
    crear se borraba entre un pedido y el otro, y por eso el reintento
    creaba un turno nuevo).
  - Un rechazo del servidor al crear (4xx que no sea 409) sí descarta el
    pedido pendiente: no se creó nada y el próximo intento sale con el
    formulario corregido.
- `backend/app/modules/shift/application/services.py`:
  `_consume_publication_slot` se separó en `_ensure_publication_allowed`
  (consulta el plan, levanta el 402, no guarda nada) y
  `_register_publication` (suma al uso). `publish_shift` ahora consulta,
  valida la transición, guarda el turno y recién ahí suma. Un turno que ya
  no está en borrador (400) o que cambió otro pedido a la vez (409,
  ADR-0016) no llega a sumar. `create_event` pasa por el mismo camino.
- Tests: `backend/tests/test_uso_del_plan_al_publicar.py` (publicar bien
  suma uno; volver a publicar, publicar un cancelado y perder la carrera no
  suman; la misma `Idempotency-Key` suma una vez; con el tope prendido los
  intentos fallidos no gastan el cupo; un evento suma uno por puesto; y el
  recorrido del reintento contra la API real: editar el borrador con
  `PUT /shifts/{id}`, que no tenía tests ni uso en el frontend, y publicar)
  y `frontend/e2e/publicar-una-sola-vez.spec.ts`, con una API simulada que
  guarda los turnos y trata la `Idempotency-Key` como el backend, para
  medir qué le queda al servidor y no sólo qué dice la pantalla.
- Docs: `docs/reference/API.md` (cuándo sube `turnos_usados_mes`), la fila
  de `/shifts/new` en `docs/reference/MAPA_DEL_CODIGO.md` y el nombre de la
  función en `docs/BUGS.md`.

**Por qué así:**

- *El asistente retoma el borrador en vez de publicar en un solo pedido.*
  Un endpoint nuevo «crear y publicar» sería lo más corto de explicar, pero
  cambia el contrato de la API y deja sin resolver el tope del plan, que
  necesita que el borrador exista para publicarlo después. Con lo que ya
  había (`PUT /shifts/{id}` y la idempotencia de los dos `POST`) alcanza.
- *El pedido de crear se repite igual aunque el formulario haya cambiado.*
  El backend responde 422 a una key repetida con otro cuerpo, y una key
  nueva crearía un segundo borrador si el primero había llegado. Repetir el
  original y editar después cubre los dos casos con un pedido de más.
- *Contar después de guardar, no reservar y devolver.* Sumar primero y
  restar si la publicación falla deja el contador mal cada vez que la
  devolución no llega a correr. Al revés, lo peor que puede pasar es un
  turno publicado sin contar, a favor del comercio.
- *Sin transacción única.* Guardar el turno y el contador juntos es la
  solución de fondo (deuda anotada en ADR-0016), pero toca todos los
  módulos; con el orden nuevo ya no hace falta para este caso.

**Queda abierto:**

- El borrador del intento vive en memoria: si la persona recarga la página
  o sale del asistente después de un error, el borrador queda en el panel
  (se puede publicar desde ahí) y un asistente nuevo crea otro. Guardar el
  intento pendiente entre recargas es un cambio aparte.
- El contador del plan se lee, se suma y se guarda: dos publicaciones
  simultáneas de turnos distintos del mismo comercio pueden contar una
  sola. Ya era así y es a favor del comercio; se resuelve con una suma
  atómica o con la transacción única de ADR-0016.
