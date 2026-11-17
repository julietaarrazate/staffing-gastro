# Beta etapa 3, grupo D: errores sin conexión y límites de intentos (U113, U144)

**Pedido:** triaje de la etapa 3 de la beta. Sin red se mostraba un genérico, los errores del servidor salían en inglés («Bad Gateway») y los bloqueos por intentos decían «Esperá un momento» sin decir cuánto.

**Qué cambió:**
- Sin conexión: «No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.» (`frontend/lib/api.ts`, `NetworkError`; `frontend/lib/errors.ts`, `getErrorMessage` ahora reconoce `NetworkError` y el `TypeError` crudo de fetch, y el timeout se distingue como «El servidor tardó demasiado en responder.»).
- 5xx o respuesta sin `detail`: ya no se muestra `res.statusText`; `statusFallbackMessage(status)` da el texto en español (502/503/504: servidor no disponible; otros 5xx: «Algo falló de nuestro lado»). Un `detail` en inglés de un 5xx sin código («Internal Server Error», «Bad Gateway»…) se traduce igual; uno propio en español se respeta.
- 429: `backend/app/core/rate_limit.py` calcula cuánto falta (`retry_after`, el intento más viejo de la ventana), manda `Retry-After` y el texto dice «Esperá N segundos/minutos». El 429 del 2FA (`identity/api/routes.py`) también manda `Retry-After: 900`. `main.py` expone `Retry-After` por CORS. Si el `detail` no trae el tiempo, el frontend lo agrega desde el header (`withRetryAfter`).
- Tests: `backend/tests/test_rate_limit.py`, `frontend/lib/api.test.ts`, `frontend/lib/errors.test.ts`; se ajustó el texto en `frontend/e2e/limite-de-intentos.spec.ts`.

**Por qué así:** el tiempo va en el texto del backend (no sólo en el header) porque sin `expose_headers` el navegador no lee `Retry-After`; el header cubre clientes y proxies. Se descartó cambiar `auth-context.tsx` (otro grupo): sus `NetworkError` propios con «No se pudo conectar con el servidor.» siguen igual.

**Queda abierto:** los textos fijos de `/recuperar` y `/verificar-email` («Demasiados intentos, esperá un minuto.») y los `NetworkError` de `auth-context.tsx` no usan aún el texto nuevo.
