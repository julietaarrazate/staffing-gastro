# Tres arreglos chicos de seguridad (auditoría autorizada)

**Pedido:** Julieta, 2026-10-15. Una auditoría de seguridad autorizada dejó tres
ajustes menores; se resuelven juntos.

**Qué cambió:**

- `POST /auth/refresh` y `POST /auth/logout` ahora verifican el header `Origin`:
  si viene y no está en `CORS_ORIGINS`, responden 403 ("Origen no permitido").
  Sin `Origin` (clientes que no son navegador) siguen funcionando igual.
  Dependencia reutilizable en `backend/app/core/origin.py`, usada en
  `backend/app/modules/identity/api/routes.py`.
- Los 422 de validación mantienen la forma `detail: [{type, loc, msg}]` pero ya no
  devuelven `input`, `ctx` ni `url` (handler en `backend/app/main.py`). El frontend
  (`lib/api.ts`) solo usa `detail` cuando es texto, así que no cambia nada ahí.
- `POST /shifts/{id}/assign` con un `worker_profile_id` inexistente responde 404
  "Trabajador no encontrado" (antes terminaba en error de base de datos). Se
  consulta el puerto `WorkerProfileRepository` ya inyectado en `ShiftService`;
  nueva `AssigneeNotFoundError` en el dominio de shift.
- Tests: `backend/tests/test_seguridad_origen_y_validacion.py` y uno nuevo en
  `backend/tests/test_shift.py`.

**Por qué así:** el chequeo de `Origin` es el mínimo que cubre la cookie
`SameSite=None` sin sumar tokens ni cambiar el frontend. Rechazar solo cuando el
header existe evita romper clientes no-navegador.

**Queda abierto:** nada.
