# Cuando Gemini no responde, el asistente reintenta y avisa distinto

**Pedido:** Julieta recibió de Sentry 4 errores en `/api/v1/assistant/query` (un 5xx de Google, un `ReadTimeout` y dos "No pudimos interpretar el texto").

**Qué cambió:** `backend/app/core/gemini.py` reintenta hasta 2 veces (con espera corta) los 5xx, 429, timeouts y errores de red; el timeout pasó de 15 a 20 s. Si se agotan, lanza `GeminiUnavailableError` y se loguea como `warning` (no llega a Sentry como error). Las rutas del asistente (comercio y trabajador) y `shifts/parse-text` devuelven 503 con "El asistente no está disponible en este momento. Probá de nuevo en unos minutos." en vez de 502 "No pudimos interpretar el texto". Los 4xx (clave, modelo, permisos) siguen como error, sin reintento. Tests en `backend/tests/test_gemini_shift_parser.py`.

**Por qué así:** el 5xx y el timeout vienen de Google y no se evitan, pero el usuario no debe creer que su texto estaba mal ni nosotros recibir un error por cada caída. Los 4xx son de configuración y sí tienen que alertar.

**Queda abierto:** el soporte de tickets (`support/api/routes.py`) mantiene su mensaje 502 propio.
