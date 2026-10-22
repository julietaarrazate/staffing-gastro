# Publicar un turno: los avisos a la zona salen en lote

**Pedido:** Julieta, 2026-10-22: hacer la app más rápida, empezando por
encontrar queries lentas y problemas N+1, y medir antes y después.

**Qué cambió:** publicar un turno (y la escalada de urgencia, y cada puesto
de un evento) ya no espera a guardar y avisar a cada trabajador de a uno. Las
notificaciones se guardan juntas en un solo commit, las suscripciones push se
leen en una sola consulta y los push salen en paralelo. Técnico:

- `NotificationRepository.add_many` (puerto en
  `backend/app/modules/notification/domain/repositories.py`, adaptador en
  `infrastructure/repositories.py`): `created_at` se fija en Python para no
  releer cada fila. `PushSubscriptionRepository.list_by_users` trae las
  suscripciones de todos de una vez.
- `ShiftService._notify_nearby_workers`
  (`backend/app/modules/shift/application/services.py`) usa `add_many`.
- Test nuevo en `tests/test_push.py`.

**Medición** (script `bench_queries.py` del relevamiento de rendimiento:
mismo escenario con N=2 y N=20 en SQLite, cuenta sentencias SQL y commits por
pedido):

| `POST /shifts/{id}/publish` | Antes N=2 | Antes N=20 | Después N=2 | Después N=20 |
|---|---|---|---|---|
| N trabajadores cerca: sentencias | 21 | 45 | 17 | 17 |
| N trabajadores cerca: commits | 5 | 13 | 4 | 4 |
| N favoritos: sentencias | 21 | 75 | 17 | 17 |
| N favoritos: commits | 5 | 23 | 4 | 4 |

Ahora no crece con la cantidad de avisados. Antes, cada aviso hacía INSERT,
COMMIT, una relectura, una consulta de push y el envío del push, todo en
serie mientras el comercio esperaba.

**Por qué así:** se agregó un método en lote en vez de mandar los avisos a
segundo plano: mantiene el mismo comportamiento (el aviso existe cuando
responde el pedido) y saca el costo que crecía con N. Los push siguen
esperándose, pero en paralelo y no uno detrás de otro.

**Queda abierto:** el resto del relevamiento (índice de
`notifications(user_id, created_at)`, limpieza de `refresh_sessions`
vencidas, bcrypt fuera del loop, email de asignación fuera del pedido, caché
de GET públicos).
