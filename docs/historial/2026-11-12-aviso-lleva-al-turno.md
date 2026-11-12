# El aviso «Turno cerca tuyo» lleva al turno

**Pedido:** salida a beta, etapa 2 (hallazgo U015 de la prueba de punta a
punta): con el Inicio abierto, tocar el aviso de turno cerca no hacía nada y
el turno nuevo no aparecía hasta recargar.

**Qué cambió:** el aviso «Turno cerca tuyo» (primera tanda) y el «¡Urgente!
Turno … cerca tuyo» (escalada) ahora abren `/turno/{id}`, donde la persona se
postula. Antes llevaban a `/feed`, la misma pantalla donde ya estaba.
- `backend/app/modules/shift/application/services.py`
  (`_notify_nearby_workers`): `link=f"/turno/{shift.id}"`. Es el mismo link que
  usa el push (`repositories.py` manda `notification.link`), y `sw.js` ya
  navega a esa URL, así que no hizo falta tocarlo.
- `frontend/lib/notification-link.ts` y `notification/domain/value_objects.py`:
  el destino por tipo (`/feed`) queda sólo como respaldo para avisos viejos sin
  `link`; los viejos guardados con `/feed` siguen yendo al Inicio.
- Tests: `test_shift.py` (aviso al publicar), `test_scheduler.py` (aviso de la
  escalada) y `lib/notification-link.test.ts` (turno cerca → turno; viejo con
  `/feed` → Inicio).
- `docs/reference/NOTIFICATIONS.md` actualizado.

**Por qué así:** llevar al turno resuelve el caso en dos toques sin tocar cómo
se recarga el Inicio. Se descartó hacer que el Inicio vuelva a pedir datos al
tocar (otro PR). Sin migración: los avisos ya guardados no se reescriben.

**Queda abierto:**
- Un turno reabierto da «no encontrado» en `/turno/[id]`; lo cambia otro PR.
  Hasta entonces, un aviso hacia un turno así no mostraría el turno.
- El Inicio y el Mapa siguen cargando sólo al montar (otro PR).
- El radio de los avisos no se tocó (otro PR).
