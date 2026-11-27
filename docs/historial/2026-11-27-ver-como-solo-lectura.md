# «Ver como» es sólo para mirar (#PR)

**Antes:** con «Ver como», la admin recibía un token igual al de la persona:
podía postularse, cancelar, publicar, escribir en un chat o marcar avisos como
leídos a nombre de un usuario real, y el servidor no distinguía esa sesión de
la de la persona (PRI-09).

**Después:** el token de «Ver como» lleva la marca de la admin que lo pidió
(`imp`). Con esa marca el servidor responde 403 (`impersonation_read_only`) a
todo pedido que no sea de lectura, en la única puerta por la que pasa todo
pedido autenticado, así un endpoint nuevo queda cubierto solo. Cada rechazo
queda en el log con la admin, la cuenta, el método y la ruta. La franja dice
«Sólo lectura» y, si se intenta una acción, la app muestra «Estás viendo esta
cuenta en sólo lectura: no se puede cambiar nada».

**Cómo:** `IMPERSONATED_BY_CLAIM` y `AuthenticatedSession.impersonated_by`
(`identity/application`), `get_current_session`
(`identity/api/dependencies.py`), `AdminService.impersonate(user_id, admin_id)`,
`frontend/components/ImpersonationBanner.tsx`. Decisión de Julieta del
2026-11-24.

**Queda:** el registro de cada uso (quién miró a quién y cuándo) sigue yendo
al log del servidor, que no se conserva para siempre; guardarlo en una tabla
pide sumarle infraestructura al módulo de admin.

**Pruebas:** `backend/tests/test_admin.py` (2 casos nuevos). En la app real:
recorrer cinco pantallas de una trabajadora no dispara ninguna escritura, y
cancelar un turno confirmado responde 403 sin cambiar nada.
