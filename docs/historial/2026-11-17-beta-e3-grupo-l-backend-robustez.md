# Beta etapa 3, grupo L: robustez del backend (U100, U103, U118)

**Pedido:** triaje de la etapa 3 de la beta (`docs/planning/BETA_ETAPA3_TRIAJE.md`): tres fallas de backend.

**Qué cambió:**
- U100: el perfil público del trabajador ya no devuelve `cv_filename` a quien no puede ver el CV (`backend/app/modules/worker/api/routes.py`, `_CONTACT_PROFILE_FIELDS`). El frontend no lo mostraba en vistas ajenas; sin cambios ahí.
- U103: registrar el recordatorio de salida ya no sube la `version` del turno. Nuevo puerto `ShiftRepository.mark_departure_reminder_sent` (UPDATE masivo, `shift/infrastructure/repositories.py`), usado por `send_departure_reminder` (`shift/application/services.py`). Un «Confirmar» con la lectura previa ya no da «El turno cambió mientras tanto».
- U118: el aviso «N postulantes para…» al comercio se recorta con «…» a los límites de `notifications` (255 / 500) antes de crearse (`application/application/services.py`); la postulación ya no falla con nombre y título larguísimos.
- Tests: `test_privacidad_datos_trabajador.py`, `test_concurrencia_turno.py`, `test_application.py`.

**Por qué así:** el ADR-0016 ya prevé que las escrituras que no pasan por `update()` no suben la versión y "no generan conflictos falsos", así que no lo contradice. Como `update()` reescribe la fila entera, una entidad leída antes traía `departure_reminder_sent_at = None` y pisaba la marca (el scheduler reenviaría el push): `_apply_fields` ahora conserva la marca de la base mientras siga asignada la misma persona; si se reasigna o desasigna, el reseteo del dominio sigue valiendo. Se descartó dejar el bump de versión y reintentar en el cliente (no resuelve la causa).

**Queda abierto:** nada. Si otro campo escrito por el sistema fuera de `update()` aparece, conviene el mismo patrón.
