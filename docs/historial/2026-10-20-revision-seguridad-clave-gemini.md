# Revisión de seguridad 2026-10-20 y clave de Gemini fuera de la URL

**Pedido:** Julieta, 2026-10-20. El error `STAFFYA-BACKEND-7` de Sentry
mostraba la clave de Gemini entera. Pidió saber si estaba expuesta, revisar el
resto del sistema y arreglar todo por prioridad, dejando el avance escrito
para seguir en otras sesiones.

**Qué cambió:**

- `backend/app/core/gemini.py`: la clave viaja en el header
  `x-goog-api-key`, no en `?key=` de la URL. Con la clave en la URL, `httpx`
  la incluye en el texto de `HTTPStatusError`, y así llegó a Sentry.
- `backend/app/core/observability.py`: `before_send=scrub_sentry_event`.
  Tapa en todo el evento los campos sensibles (`password`, `new_password`,
  `pin`, `token`, `id_token`, `authorization`, `cookie`, etc.), los
  `?key=`/`&token=` dentro de textos y los `Bearer …`. Si limpiar falla, el
  evento no se manda.
- El token del WebSocket tampoco queda en los logs de Render: ver
  [`2026-10-20-seguridad-token-ws-logs.md`](./2026-10-20-seguridad-token-ws-logs.md),
  que va en este mismo PR porque toca el mismo archivo.
- Tests: `test_api_key_goes_in_header_not_in_url`
  (`tests/test_gemini_shift_parser.py`) y dos del scrubber
  (`tests/test_observability.py`).

**Por qué así:** el header es la forma documentada por Google y saca la clave
de cualquier URL que se loguee. El `before_send` es la segunda capa: el
scrubber por defecto de `sentry_sdk` no conoce `new_password` ni `pin`.

**Queda abierto:**

- Julieta: crear una clave nueva en Google AI Studio, borrar la vieja,
  cargar la nueva en Render (`GEMINI_API_KEY`) y **borrar** (no resolver)
  `STAFFYA-BACKEND-7` en Sentry después del deploy de este PR.
- El resto de la revisión quedó como ítem «Revisión de seguridad del 2026-10-20» de `../STATUS.md`, en orden de
  prioridad, con un PR por tema. Se describe por tema y archivo, sin cómo
  explotarlo.
