# Campanita: "Marcar todas como leídas" y avisos de turnos sólo a trabajadores (#PR)

**Pedido:** Julieta (admin), con captura: la campanita mostraba "9+" para
siempre. Su cuenta tenía 86 avisos sin leer, casi todos "turno cerca tuyo"
(`new_shift_nearby` / `urgent_shift_nearby`), que son para trabajadores.

**Qué cambió:**

- En el panel de la campanita, a la derecha de "Notificaciones", un botón
  de texto **"Marcar todas como leídas"** que aparece sólo si hay no leídos.
  Es optimista: se ve leído al instante y, si el pedido falla, vuelven a no
  leídos en silencio sólo los que se marcaron (un aviso que llegó por
  WebSocket mientras tanto no se toca). Color de link (`text-primary-text`:
  azul hondo en claro, celeste en oscuro), así el único ámbar del panel
  sigue siendo el contador. El encabezado pasó de 36 a 44 px de alto (panel
  `w-80`, en 390 y 1280 px) para que el botón tenga el blanco táctil mínimo.
  `frontend/components/NotificationBell.tsx`, test en
  `NotificationBell.test.tsx`.
- Backend: `POST /api/v1/notifications/read-all` marca leídos todos los no
  leídos del usuario actual en un solo `UPDATE` y devuelve `{"marked": n}`.
  Puerto `NotificationRepository.mark_all_read`, adaptador SQLAlchemy y
  `NotificationService.mark_all_read` (`backend/app/modules/notification/`).
- **Sólo trabajadores son candidatos y reciben avisos de turnos cerca.** La
  causa: la cuenta de Julieta es `role=admin` pero tiene un `worker_profile`
  viejo de pruebas, y `SqlAlchemyCandidateRepository.list_available`
  (`backend/app/modules/matching/infrastructure/repositories.py`) tomaba a
  cualquiera con perfil disponible. Ahora además exige `role = worker` y
  `status = active`. Ese mismo método alimenta tres cosas, y las tres
  mejoran: el aviso al publicar y al escalar
  (`ShiftService._notify_nearby_workers`), los candidatos que ve el comercio
  (`/shifts/{id}/candidates`) y el mapa de búsqueda (`/matching/search`). Un
  admin o un suspendido ya no aparecen en ninguna.

**Por qué así:** el filtro va en la consulta y no en
`_notify_nearby_workers` porque el problema es el mismo en las tres
pantallas: un perfil de trabajador colgado de una cuenta que no es de
trabajador no es un candidato. El estado `active` se suma porque el
criterio ya existía (`User.is_active` bloquea el login de un suspendido):
avisarle un turno o recomendarlo no sirve. No se borraron datos: los 86
avisos los vacía Julieta con el botón nuevo, y el `worker_profile` viejo
queda (ya no tiene efecto). Sin migración.

**Queda abierto:** (ítem en `STATUS.md`) con varios avisos sin leer seguidos, en claro no se ven
las líneas entre filas: el tinte de no leído (`primary-tint`) y la hairline
(`line`) son el mismo `#deecf0`. Es de antes; no se tocó.
