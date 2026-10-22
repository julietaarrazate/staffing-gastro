# Sentry sin ruido: las caídas de servicios de afuera no son errores

**Pedido:** Julieta, 2026-10-22: "eliminar cualquier deuda técnica, lo de
Sentry".

**Qué cambió:** Sentry deja de recibir los 502 y 503 que el backend devuelve a
propósito cuando Gemini, OpenStreetMap, Cloudinary o Resend no responden. El
usuario ve el mismo mensaje de siempre y el log lo sigue registrando como
aviso. Un 500 (un bug de verdad) se sigue reportando. Técnico:
`SENTRY_FAILED_STATUS_CODES` en `backend/app/core/observability.py`, pasado a
`StarletteIntegration` y `FastApiIntegration`; test en
`tests/test_observability.py`. Se comprobó con un transporte falso que un 502
y un 503 no mandan nada y un 500 sí.

**Por qué así:** de los 8 issues abiertos, 3 eran estas respuestas (texto que
Gemini no pudo interpretar, OpenStreetMap caído al importar comercios). Otros
3 (Gemini 503 y `ReadTimeout`) eran de antes de los reintentos de #462, que ya
los tratan como transitorios. Los 2 de `/turno/[id]` venían de un `curl` a
`/turno/abc` en Vercel, antes del chequeo de UUID que hoy tiene la página. Se
marcaron todos como resueltos.

**Queda abierto:** `STAFFYA-BACKEND-7` (tiene la clave vieja de Gemini en el
texto) lo borra Julieta después de rotar la clave.
