# Cuentas suspendidas: qué pasa con sus turnos (G6: U023, U097, U095)

**Pedido:** salida a beta, grupo G6 (decisiones 10 y 12 de Julieta,
2026-11-13). Suspender una cuenta sólo cambiaba su estado: se podía asignar a
una persona suspendida, los turnos de un comercio suspendido seguían a la
vista y los que tenían a alguien quedaban colgados, y al ingresar se veía un
error genérico. La especificación es
[ADR-0024](../adr/ADR-0024-efectos-de-una-suspension.md).

**Qué cambió:**

- **Asignar** a una cuenta suspendida da 409 «Esta persona no puede tomar
  turnos por ahora. Elegí a otra.», antes de tocar el turno o a los demás
  postulantes (`ShiftService.assign_worker`, `AssigneeUnavailableError`). La
  lista de postulantes y su contador en el panel ya no la muestran
  (`list_by_shift_enriched`, `count_pending_by_shift_ids` en
  `application/infrastructure/repositories.py`).
- **Ingreso:** con la contraseña correcta (también con Google y al renovar
  una sesión abierta, que la suspensión ya había revocado), 403 con
  `{code: "account_suspended", message: "Tu cuenta está suspendida. Si creés
  que es un error, escribinos a hola@oido.com.ar"}` (`_account_suspended` en
  `identity/api/routes.py`; `IdentityService.refresh`). Con la contraseña mal,
  el 401 de siempre. El ingreso lo muestra en el mismo aviso que cuando la
  sesión termina por eso (`app/login/page.tsx`, `isAccountSuspended` en
  `lib/api.ts`; también `GoogleAuthButton`).
- **Comercio suspendido:** sus turnos abiertos no salen en Inicio, Buscar ni
  el Mapa, no se escalan (`_from_active_company` en
  `shift/infrastructure/repositories.py`, subconsulta en la misma sentencia),
  su página pública responde 410 «ya no disponible», el detalle da 404 a quien
  no es parte y no aceptan postulaciones (`ApplicationService.apply`). No
  cambian de estado. Los asignados o confirmados que no empezaron se cancelan
  con aviso a esa persona y sin cancelación tardía.
- **Trabajador suspendido:** sus turnos asignados, confirmados o «en camino»
  vuelven a buscar personal (`Shift.release_worker`), los demás postulantes
  vuelven a estar en carrera y el comercio recibe aviso; no se le suma una
  cancelación.
- Lo que ya empezó (llegada marcada en adelante) no se toca.
- **La admin ve antes** cuántos turnos se ocultan, se cancelan o se reabren:
  `GET /admin/users/{id}/suspension-preview` y el diálogo de «Suspender» en
  `app/admin/personas/[id]` (frases en `suspensionImpactLines`,
  `components/admin/people.ts`). «Sí, suspender» espera a que termine de
  contar; si no puede contar, lo dice y deja seguir.
- **Reactivar** no toca turnos: lo oculto vuelve a verse porque el filtro mira
  el estado de la cuenta en cada pedido.
- Avisos nuevos (tipos existentes `shift_cancelled` y `shift_reopened`) en
  [`NOTIFICATIONS.md`](../reference/NOTIFICATIONS.md).
- Arquitectura: reglas puras y puerto `AccountSuspensionEffects` en
  `shift/domain/suspension.py`; lo implementa `ShiftService` y lo recibe
  `AdminService` (inyectado en `admin/api/dependencies.py`). Sin migración.
- Tests: `backend/tests/test_cuentas_suspendidas.py` (un bloque por efecto),
  `components/admin/people.test.ts`, y los E2E de `admin-personas.spec.ts` y
  `auth.spec.ts`.

**Por qué así:**

- *Efectos antes que el estado.* Los repositorios guardan cada cambio por
  separado (no hay una transacción que abarque varios), así que
  `AdminService.suspend_user` aplica primero los efectos y recién después
  marca la cuenta. Si un efecto falla, la cuenta queda activa y la admin ve el
  error; al repetir, los turnos ya resueltos no vuelven a entrar y siguen los
  que faltaban. Nunca queda una cuenta suspendida con turnos colgados (hay un
  test que lo fija).
- *Ocultar en la consulta y no después:* la página del feed sale entera y el
  feed no suma un viaje a la base (el test de consultas constantes del feed
  sigue en su número).
- *Tipos de aviso existentes:* reabrir y cancelar ya tenían tipo, destino y
  política de push; un tipo nuevo sumaba migración de nada.
- El ADR decía que `assign_worker` consulta la cuenta del comercio; consulta
  la del trabajador. Se corrigió esa línea de «Consecuencias».

**Queda abierto:**

- Las postulaciones pendientes de un trabajador suspendido no se retiran: se
  ocultan de la lista y del contador, y vuelven a verse si se lo reactiva.
- Un turno guardado («Guardados») de un comercio suspendido sigue en la lista
  del trabajador; al abrirlo da «no encontrado» y no acepta postulación.
