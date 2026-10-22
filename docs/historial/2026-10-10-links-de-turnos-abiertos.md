# Los links de turnos que vuelven a buscar gente ya abren

**Pedido:** Julieta preguntó si los links de la app compartidos por WhatsApp
abrían. El de la home sí; revisando los de turnos apareció este bug.

**Qué pasaba:** la página pública de un turno (`/turno/{id}`, la que abre
quien recibe el link) sólo aceptaba turnos en estado PUBLICADO. Pero un
turno también está abierto en BUSCANDO_PERSONAL, que es adonde vuelve
cuando el asignado lo rechaza, cancela o falta: sigue en el feed y se podía
compartir, y el link abría en "Turno no encontrado". Además, el botón
"Compartir por WhatsApp" aparecía en "Mis postulaciones" y en guardados
aunque el turno ya estuviera cerrado.

**Qué cambió:**

- `GET /shifts/{id}/public` acepta `OPEN_STATUSES` (PUBLICADO o
  BUSCANDO_PERSONAL), el mismo criterio que el feed y que el detalle con
  sesión (`backend/app/modules/shift/api/routes.py`).
- `ShareShiftButton` se oculta solo cuando el turno no está abierto
  (`isShareable` en `frontend/lib/shift-share.ts`), así ninguna pantalla lo
  muestra de más. El panel del comercio también lo muestra en
  BUSCANDO_PERSONAL (antes sólo en PUBLICADO).

**Tests:** `test_shift.py` (turno que vuelve a buscar gente → 200; asignado
→ 404) y `frontend/lib/shift-share.test.ts`.

**Por qué así:** la regla vive en un lugar en cada lado (`OPEN_STATUSES` en
el backend, `isShareable` en el frontend) en vez de repetir el chequeo en
cada pantalla que muestra el botón.
