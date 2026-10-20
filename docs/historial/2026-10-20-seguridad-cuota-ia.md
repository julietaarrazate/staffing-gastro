# Topes de uso de la IA: por día y por cuenta, y uno global

**Pedido:** Julieta, 2026-10-20, como parte de la revisión de seguridad
(ítem «Revisión de seguridad del 2026-10-20» de `../STATUS.md`, prioridad media).

**Qué cambió:** los límites de la IA eran sólo de 15 consultas cada 10
minutos por cuenta (frenan un doble click). No había tope por día ni uno de
toda la app, así que creando varias cuentas se agotaba la cuota de Google y
la IA quedaba caída para todos, o subía la factura si el plan es pago.

- `backend/app/core/gemini.py`: `_reserve_daily_call` cuenta las llamadas
  de toda la app por día de Argentina y, al llegar a
  `settings.gemini_daily_limit`, responde `GeminiUnavailableError` (la
  pantalla ya muestra "no está disponible, completá a mano").
- `backend/app/core/config.py`: `gemini_daily_limit` (env
  `GEMINI_DAILY_LIMIT`, default 1000, `0` = sin tope). Documentado en
  `docs/reference/DEPLOY.md`.
- `assistant/api/routes.py` y `shift/api/routes.py` (`parse-text`): 60
  consultas por día y por cuenta, además del límite corto que ya había.
- Tests: `test_global_daily_limit_stops_calls_to_gemini`. En `conftest.py`
  el tope global queda en 0 para el resto de la suite.

**Por qué así:** el contador vive en memoria porque hoy hay una sola
instancia del backend; con varias, cada una tendría su tope (anotado en el
código).

**Queda abierto:**

- **Decisión de Julieta:** ¿exigir email verificado para usar la IA? Frena
  mejor las cuentas falsas, pero un comercio nuevo no podría usar "Describí
  el turno" hasta verificar. No se hizo sin su "sí".
- Si el plan de Google es el gratis (250 por día), bajar
  `GEMINI_DAILY_LIMIT` en Render a unos 200.
