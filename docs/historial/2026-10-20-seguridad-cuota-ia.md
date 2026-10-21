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
- Si el plan de Google es el gratis (250 por día), bajar los
  `GEMINI_DAILY_LIMIT_*` en Render para que sumen unos 200.

**Revisión del 2026-10-21:** la revisión del PR encontró dos problemas y se
corrigieron acá. (1) Las cuentas invitadas de la beta son una por rol,
compartida por todos los que entran con el PIN, así que el tope de 60 por
día "por cuenta" lo agotaban entre todos los testers y la IA quedaba en 429
para todos. Ahora `per_account_quota_key`
(`identity/api/dependencies.py`) arma la clave del tope: para las cuentas
invitadas es cuenta + IP real del cliente (`app.core.edge.client_ip`); las
cuentas normales siguen contando por cuenta aunque cambien de IP. Lo usan
`parse-text`, `/assistant/query` y `/assistant/worker-query`. (2) El tope
global era uno solo: con unas 17 cuentas de trabajador autoregistradas se
gastaban las 1000 llamadas en `worker-query` y se apagaba también
"Describí el turno" de los comercios y la sugerencia de soporte. Ahora hay
un presupuesto por función (`DAILY_BUDGETS` en `core/gemini.py`; cada
llamada dice el suyo): `parse_text` 500, `asistente` 200, `trabajador` 250
y `soporte` 50 (suman las mismas 1000), configurables con
`GEMINI_DAILY_LIMIT_PARSE_TEXT`, `_ASISTENTE`, `_TRABAJADOR` y `_SOPORTE`
(reemplazan a `GEMINI_DAILY_LIMIT`, que no llegó a producción; documentado
en `docs/reference/DEPLOY.md`). Los tests se mudaron a
`backend/tests/test_gemini_cuota_diaria.py` (invitados en distintas IP no se
pisan, una cuenta normal no gana tope cambiando de IP, agotar el presupuesto
del trabajador no apaga `parse-text` ni soporte), así
`test_gemini_shift_parser.py` queda como en `main` y no choca con el PR de
la clave de Gemini. El límite corto (15 cada 10 minutos) de estos tres
endpoints usa la misma clave, así los testers invitados tampoco se traban
entre sí por ese lado (test
`test_invitados_de_distintas_ip_no_comparten_el_limite_corto_de_parse_text`).
