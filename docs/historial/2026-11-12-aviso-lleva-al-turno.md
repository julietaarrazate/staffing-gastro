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
  `/feed` → Inicio) y `NotificationBell.test.tsx` (tocar el aviso navega a su
  link).
- `docs/reference/NOTIFICATIONS.md` actualizado.

**Por qué así:** llevar al turno resuelve el caso en dos toques sin tocar cómo
se recarga el Inicio. Se descartó hacer que el Inicio vuelva a pedir datos al
tocar (otro PR). Sin migración: los avisos ya guardados no se reescriben.

**Queda abierto:**
- Un turno reabierto da «no encontrado» en `/turno/[id]`; lo cambia otro PR.
  Hasta entonces, un aviso hacia un turno así no mostraría el turno.
- Un aviso de un turno que ya no está publicado (tomado, cancelado, no
  cubierto) cae hoy en el 404 por defecto de Next, en inglés; antes abría el
  Inicio. Con el tiempo es el caso más común. Lo resuelve el PR de la página
  del turno (rama `claude/turno-no-disponible`: 410 «ya no disponible» y turno
  reabierto). **Orden de merge:** este PR va después o junto con ese, no antes:
  si sale solo, la campanita se llena de avisos que llevan a un error en inglés
  y la escalada de un turno reabierto queda sin salida.
- Sin sesión (push en un celular con la sesión cerrada), `/turno/{id}` muestra
  la vista pública con «Postulate en Oído», que lleva al registro; no ofrece
  iniciar sesión ni vuelve al turno después de entrar.
- Avisos que apuntan a la pantalla donde la persona ya está (`shift_assigned`
  a `/my-shifts`, `new_applicant` a `/shifts/{id}/candidates`) tampoco recargan
  con esa pantalla abierta; conviene que lo mire el PR de recarga.
- Los avisos viejos con `/feed` siguen sin hacer nada con el Inicio abierto.
- La copia en el borde de `/turno/{id}` (`frontend/cloudflare/turno-cache.mjs`)
  puede mostrar hasta 10 minutos como abierto un turno recién tomado al entrar
  por el push.
- El Inicio y el Mapa siguen cargando sólo al montar (otro PR).
- El radio de los avisos no se tocó (otro PR).
