# Auditoría del proyecto y primer arreglo: datos del trabajador por puertas laterales (#416)

**Pedido:** Julieta pidió auditar el proyecto y después arreglar lo
encontrado "con buenas prácticas", empezando por lo más grave.

**Qué se auditó (2026-10-10, sobre `58eb3d7`):** los chequeos completos
(backend `pytest` 545 en verde, `tsc`, lint, 154 tests unitarios, `build`,
`pip-audit` y `npm audit` sin vulnerabilidades) y una revisión de código en
tres frentes: seguridad del backend, corrección del dominio y frontend.

**Qué cambió en este PR (privacidad):**

- `GET /workers/{id}`: el perfil público ya no trae `latitude`, `longitude`
  ni `birth_date` salvo para el propio trabajador o admin. Era el domicilio
  exacto que el mapa del comercio ya desplazaba (TECH_DEBT S4): se llegaba
  a él con el `profile_id` que el mismo mapa entrega.
  `backend/app/modules/worker/api/routes.py`.
- `PUT /saved-shifts/{id}` sólo acepta turnos abiertos o el propio (ajeno y
  no abierto = 404), `GET /saved-shifts` no lista borradores, y recorta los
  datos del trabajador si quien guardó no es quien tomó el turno.
  `backend/app/modules/saved_shift/`.
- `GET /applications/mine`: al postulante que no quedó no le llega quién
  tomó el turno ni su posición en vivo. `backend/app/modules/application/api/routes.py`.
- El recorte (`without_worker_data`) pasó de privado en
  `shift/api/routes.py` a público en `shift/api/schemas.py`, para que lo use
  cualquier endpoint que embeba un `ShiftResponse`.
- PIN del acceso invitado: de constante en el código a env var
  `GUEST_ACCESS_PIN`; sin ella, `POST /auth/guest` responde 404. La
  comparación pasó a bytes (un PIN con `ñ` daba 500).
- Tests: `backend/tests/test_privacidad_datos_trabajador.py` (5 de sus 8
  tests fallan sin el arreglo) y `test_guest_login.py`.

**Por qué así:** se recortan campos en vez de crear un schema público nuevo
para no tocar el contrato del frontend (los campos ya eran opcionales y la
vista pública no los usaba). El PIN sale del código aunque Julieta lo había
pedido "sin variables", porque el repo es público y con él se entraba como
comercio; el valor viejo quedó en la historia de git y no se reusa.

**Queda abierto** (resto de la auditoría, en orden; también en `STATUS.md`):

1. Transiciones del turno sin bloqueo ni control de versión: dos acciones
   simultáneas (cancelar y confirmar, dos asignaciones) se pisan.
2. Idempotencia: una key cuya primera llamada falló queda reservada 24 h y
   el reintento da 409.
3. Frontend: "Va en camino" deja de enviar al vencer el token de 15 min;
   formularios de perfil y "duplicar turno" se recargan con cada refresh;
   no hay reintento ante un 401.
4. Autenticación: entrar con Google a una cuenta creada con ese email y sin
   verificar; el rate limit no ve la IP real detrás del proxy de Render;
   `ADMIN_EMAILS` no exige email verificado.
5. Dominio: urgencias que se avisan para turnos ya empezados; NO_CUBIERTO
   deja postulaciones pendientes; insignias que no se recalculan con el
   rating; no se puede volver a postular tras retirarse; el cupo de
   publicación se consume aunque publicar falle; "puntual" no contempla la
   llegada temprana permitida.
6. Menores: chat visible para el siguiente asignado, endpoints de push sin
   validar, token del WebSocket en los logs, enumeración de emails,
   `alembic/env.py` con 4 de los módulos, huecos del test de capas, botón
   "Reintentar" del mapa y chips de rubro ilegibles en oscuro, ~9 campos sin
   nombre accesible, lint que recorre `public/maplibre/`.
