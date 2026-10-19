# Un backend despertando ya no cierra la sesión

**Pedido:** Julieta, a partir de la auditoría de interfaz del 2026-10-11
(hallazgo B01, el primero de la lista de prioridades).

**Qué ve el usuario:** si Oído se abre mientras el backend está arrancando
en frío (Render responde 502-504 un rato), la persona sigue con su sesión y
la pantalla queda en su lugar. Antes terminaba en `/login` con la sesión
borrada y tenía que volver a escribir su contraseña, justo cuando abría la
app por un aviso urgente.

**Qué cambió (técnico):** `frontend/lib/api.ts` suma `isTransientFailure`:
sin red, timeout, 5xx, 408 o 429 cuentan como "el backend no está", no como
"la sesión no sirve". `frontend/lib/auth-context.tsx` usa esa función en los
cuatro lugares donde antes sólo miraba `NetworkError` (renovación del token
y restauración de la sesión al abrir). Sólo un rechazo real (401/403 del
refresh) cierra la sesión.

Tests: `frontend/lib/api.test.ts` (qué estados son transitorios) y
`frontend/e2e/auth.spec.ts` ("un 503 del backend al abrir la app no cierra
la sesión").

**Por qué así:** el código ya separaba "sin red" de "token inválido"
(`docs/BUGS.md`, pantalla en blanco por cold start), pero un 503 llegaba como
`ApiError` igual que un 401. Se descartó convertir los 5xx en `NetworkError`
dentro de `api.ts`: cambiaría lo que reciben las ~30 pantallas que muestran
el error.

**Queda abierto:** las pantallas siguen mostrando el texto técnico del
backend ante un 5xx (hallazgo B06 de la misma auditoría).
