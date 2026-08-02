# ADR-0009 — Escalada automática de urgencia si un turno no se cubre rápido

**Estado:** aceptado · **Fecha:** 2026-08-02

## Contexto

Sesión de reflexión de negocio con Julieta sobre estrategia de crecimiento
(quién es el cliente del marketplace, cómo escala un negocio hiperlocal, y
por qué la densidad de oferta en un barrio importa más que la cobertura
geográfica amplia — ver `docs/STATUS.md` del mismo día). Conclusión: antes
de invertir en crecimiento hacía falta poder **medir** la promesa central
("cubrir un puesto en menos de 10 minutos", `PRODUCT.md`) — resuelto en el
mismo día con `AdminService.get_stats` (tiempo real de cobertura, panel
`/admin`).

El paso natural siguiente, identificado en esa misma conversación como el de
mayor valor: hoy, si un turno publicado **no** se cubre rápido, no pasa
nada. `ShiftService._notify_nearby_workers` ya avisa a los 10 candidatos
mejor rankeados apenas se publica (el aviso que "cierra el circuito del
marketplace", según su propio docstring) — pero es un aviso único, de una
sola vez. Si esos 10 no se postulan, el turno queda esperando pasivamente a
que alguien lo encuentre scrolleando el feed, exactamente el problema que
ese primer aviso ya había resuelto para el momento de publicar. La misión
del producto no se sostiene sola pasado ese primer instante.

## Decisión

### 1. Campo nuevo: `Shift.escalated_at`

Marca si (y cuándo) un turno ya fue escalado — para que la escalada ocurra
**una sola vez** por turno (mismo criterio que
`checkin_reminder_sent_at`/ADR-0008: sin este campo, el scheduler
reintentaría en cada tick). Migración `0021`, nullable, sin backfill.

### 2. `ShiftService.escalate_urgency(shift_id)`

Dos efectos, sobre un turno todavía abierto (`PUBLICADO`/
`BUSCANDO_PERSONAL`) que no se cubrió en `ESCALATION_DELAY` (8 minutos,
valor semilla — un poco antes de los 10 minutos de la promesa, para actuar
mientras todavía hay margen):

1. **`urgent = True`**: el turno sube al principio del feed
   (`ShiftRepository.list_open` ya ordena `urgent` primero — no hizo falta
   tocar esa query). Además de subir en el feed, el campo ya se usaba para
   filtrar/ordenar en otros lugares del matching existente.
2. **Segundo aviso a un círculo más amplio**: reutiliza
   `_notify_nearby_workers` (antes privado y de un solo uso desde
   `publish_shift`, ahora parametrizado) con radio y tope de candidatos
   mayores (`ESCALATION_RADIUS_KM` = 1.6× el radio por defecto,
   `ESCALATION_NOTIFICATION_LIMIT` = 20 vs. 10 de la primera tanda) y copy
   de urgencia ("¡Urgente! ... no encuentra a nadie"). Notificación nueva:
   `NotificationType.URGENT_SHIFT_NEARBY`.

**Solapamiento con la primera tanda, aceptado a propósito:** no hay forma de
excluir a quienes ya recibieron el primer aviso — `Notification` no tiene
`shift_id` (ver ADR-0008, mismo límite que ya había obligado a agregar
`checkin_reminder_sent_at` directo en `Shift` en vez de consultar el
historial de notificaciones). Un recordatorio duplicado para alguien que ya
vio el turno y no se postuló no es necesariamente ruido: es, en el peor
caso, un recordatorio de que sigue urgente.

### 3. Mismo scheduler que ADR-0008, ahora con dos chequeos

`attendance_scheduler.py` se renombra a `scheduler.py` (mismo loop
`asyncio`, mismo gateo a `settings.is_production`, mismo `CHECK_INTERVAL` de
5 minutos): un tick corre primero el chequeo de asistencia (check-in/
no-show) y después el de escalada de urgencia, cada uno con su propio
try/except (un chequeo que falla no bloquea al otro). No se justificaba un
segundo loop/infraestructura para una tarea de la misma naturaleza
(recorrer turnos según cuánto tiempo pasó desde un timestamp) sobre el mismo
módulo de dominio.

## Por qué

- **8 minutos, no 10:** escalar en el instante exacto en que se incumple la
  promesa llega tarde — el objetivo es evitar incumplirla, no reaccionar
  después. Valor semilla, ajustable con datos reales (mismo criterio que el
  resto de las tolerancias del repo).
- **Reutilizar `_notify_nearby_workers` en vez de duplicar:** el mecanismo
  de rankear+notificar candidatos ya existía y es correcto; parametrizar
  radio/tope/copy es la extensión mínima, no una reimplementación.
- **Un solo scheduler:** misma justificación que ADR-0008 — no introducir
  infraestructura nueva (el plan free de Render sigue sin Cron Job) para una
  tarea de la misma forma (recorrer turnos por timestamp) que ya tiene loop.

## Fuera de alcance (explícito)

- **Excluir de la segunda tanda a quienes ya recibieron la primera:**
  requeriría que `Notification` tuviera `shift_id` (cambio de esquema más
  amplio, no específico de esta feature). Documentado como costo aceptado
  arriba.
- **Más de una escalada por turno** (ej. escalar de nuevo a los 20 minutos
  con un radio aún mayor): la primera escalada ya cubre el caso de uso
  pedido; si con datos reales se ve que hace falta una segunda ronda, es
  extensión natural de `escalated_at` (pasaría a acumular estados en vez de
  ser un flag simple).
- **Recalibrar `ESCALATION_DELAY`/`ESCALATION_RADIUS_KM`/
  `ESCALATION_NOTIFICATION_LIMIT` con datos reales:** valores semilla
  declarados como ajustables, no definitivos.
- **Notificar al comercio que su turno fue escalado:** por ahora sólo lo ve
  reflejado en que el turno pasa a "urgente" en su propio panel; un aviso
  push específico queda para cuando haya señal de que hace falta.

## Consecuencias

- ✅ La promesa central ("<10 min") deja de depender de que los primeros 10
  candidatos avisados se postulen: si no lo hacen, el sistema reacciona
  solo.
- ✅ Con la métrica de cobertura (mismo día, panel `/admin`) ahora hay
  manera de medir si esta escalada realmente mueve la aguja del tiempo
  promedio de cobertura.
- ✅ Tests en `backend/tests/test_scheduler.py` (renombrado desde
  `test_attendance_scheduler.py`).
- ⚠️ Migración `0021` agrega `shifts.escalated_at` (nullable, sin backfill).
- ⚠️ `attendance_scheduler.py` → `scheduler.py` (y su test): cualquier
  referencia directa al nombre del módulo viejo (imports, monkeypatch en
  tests) tiene que actualizarse — ya hecho en este mismo cambio.
