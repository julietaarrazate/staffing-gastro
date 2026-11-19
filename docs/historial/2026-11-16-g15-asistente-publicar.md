# G15: el asistente de publicar recuerda el paso y el borrador, y la IA no pisa lo cargado a mano

**Pedido:** salida a beta, grupo G15 (hallazgos U057 y U135, y el reporte externo BK-7DCC7E4AB945): una IA lenta en «Describí el turno» pisaba lo que la persona ya había cargado, «Atrás» del navegador sacaba del asistente, y una recarga a mitad de un intento de publicar perdía las keys de idempotencia.

**Qué cambió:**
- La IA completa sólo los campos que la persona no tocó, y sólo salta de paso si la persona sigue en el paso donde pidió. Si ya avanzó, avisa «Completamos lo que no habías cargado» y no la mueve (`applyParsedDraft` y `mezclarConIA` en `frontend/lib/borrador-turno.ts`).
- El paso va en la dirección (`/shifts/new?paso=2`): «Atrás» del navegador vuelve al paso anterior y el botón «Atrás» de la pantalla usa el historial (`frontend/lib/paso-url.ts`). Una dirección abierta en frío no saltea pasos incompletos.
- El borrador del formulario, qué campos tocó la persona, el turno ya creado en el servidor, el pedido de crear pendiente y las keys de idempotencia viven en `sessionStorage` (`frontend/lib/borrador-turno.ts`, `useIdempotencyKeys(persistKey)` en `frontend/lib/idempotency.ts`). Se borran al publicar y al cerrar sesión (`clearSession` en `frontend/lib/auth-context.tsx`). El pedido de crear se guarda ANTES de mandarlo, así una recarga repite el mismo pedido con la misma key.
- `/bienvenida` (trabajador y comercio): el paso va en `?paso=` conservando `?next=` (`frontend/lib/use-paso-url.ts`) y lo cargado sobrevive a una recarga.
- Todo acceso a `sessionStorage` pasa por `frontend/lib/almacen-sesion.ts`, con try/catch.
- Tests: `frontend/lib/borrador-turno.test.ts`, `frontend/lib/idempotency.test.ts` y `frontend/e2e/asistente-publicar-paso.spec.ts`.

**Por qué así:** el paso en la dirección y no en un estado propio, para que el historial del navegador haga lo esperable sin código extra de «Atrás». `sessionStorage` y no `localStorage`: el borrador es de esta pestaña y no tiene que pasar a otra cuenta ni quedar días. La guarda de doble toque (`useTapGuard`) no se tocó. Se descartó marcar «tocado» por diferencia con el valor inicial: un campo que la persona vuelve al valor por defecto seguiría pareciendo sin tocar.

**Queda abierto:** el borrador del asistente de eventos (`/shifts/new-event`) no tiene este tratamiento.
