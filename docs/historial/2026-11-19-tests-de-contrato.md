# Tests de contrato: los mocks de los e2e salen de respuestas reales del backend

**Pedido:** Julieta quería que los mocks del frontend no mientan. En G8 los tests pasaban con un 422 que el servidor nunca mandaba para ese caso; un mock escrito a mano puede inventar campos o faltarle los que el backend sí manda.

**Qué cambió:** no cambia nada que vea el usuario. Es infraestructura de tests.
- `backend/tests/test_contrato_frontend.py` (nuevo): recorre escenarios reales con el cliente ASGI (sesión de cada rol, login, refresh y logout; un turno en cada estado visto por cada parte; feed, `shifts/me`, `shifts/mine`, página pública; postulaciones y postulantes; candidatos; avisos; planes y suscripción, también con el cobro prendido; perfiles) y los errores 400, 401, 403 (rol y candado de dos pasos con `code`), 404 de no-disclosure, 409, 410, 422 y 402. Guarda status y cuerpo normalizados en `frontend/e2e/contrato/respuestas.json`: UUID a ids legibles (`shift-1`), tokens a `token-de-prueba`, fechas fijas, listas ordenadas donde las filas comparten `created_at`. Con `ACTUALIZAR_CONTRATO=1` reescribe el archivo; sin la variable compara la forma y falla con el comando para regenerar.
- `frontend/e2e/contrato.ts` (nuevo): `respuesta`, `deContrato` (tira error si un cambio agrega una clave que la respuesta real no tiene, también anidada), `fulfillContrato`, `opcionesDeContrato`.
- `frontend/lib/contrato.test.ts` (nuevo): cada respuesta se asigna a su tipo de `lib/types.ts` (con los literales ensanchados a `string`), así que `tsc --noEmit` falla si un tipo promete un campo que el backend no manda; y prueba que `deContrato` rechaza claves inventadas.
- 16 specs migrados: `errores-del-turno`, `errores-de-validacion`, `cancelar-turno`, `auth`, `sesion-vencida`, `candidatos-buscar-grupo-g`, `candidatos-error-de-carga`, `postulantes-desasignados`, `subscription`, `mis-turnos-relieve`, `shifts-panel-status`, `volver-a-postularse`, `segundo-toque-trabajador`, `trabajador-confirma-antes`, `pantallas-al-dia`, `tarjetas-quien-y-cuantos`.
- Docs: `frontend/e2e/contrato/README.md`, fila en `docs/reference/MAPA_DEL_CODIGO.md`, párrafo en `docs/reference/SESION_CLOUD.md` §3.

**Qué encontró (mocks que no calzaban con el backend, ya corregidos):**
- «Llegué» antes de tiempo: el mock mandaba 409 con «Todavía falta para marcar tu llegada»; el backend manda 400 con «Todavía no podés marcar tu llegada: se habilita desde las HH:MM…».
- Suscripción: los mocks omitían `limite_exigido`, que el backend siempre manda (en la beta, `false`): tres specs probaban una pantalla de «N de M turnos usados» que hoy no se ve. `price_ars` llega como texto, el mock mandaba número.
- Panel de turnos: el mock mandaba `quantity: 2`; el backend sólo admite 1.
- Aviso de postulante nuevo: el mock mandaba `type: "new_application"`; el real es `new_applicant`.
- Retirar una postulación ya retirada: el mock decía «Ya estaba retirada»; el backend dice «No se puede retirar una postulación en estado retirada».
- Sesión: los mocks mandaban `status: "activo"` e `is_active`; el backend manda `status: "active"` y no manda `is_active`. El 401 real dice «No autorizado», no «Token inválido o expirado». El login y el refresh reales traen `user` y `two_factor_setup_required`.
- Turno: los mocks mandaban 7 a 30 campos de los 40 que manda el backend; las listas de `shifts/me` no traen `company_name` (el detalle sí). Postulantes sin `identidad_verificada` ni `motivo`; la asignación devolvía `{id, status}`.
- Horarios: el backend devuelve `start_at`/`end_at` sin zona (`2026-12-20T20:00:00`) y `created_at` con `+00:00`; los mocks usaban `-03:00`.
- Tipos de `lib/types.ts` contra las respuestas reales: ninguno promete un campo que falte. Sobran en los tipos `created_at` (User, WorkerProfile, CompanyProfile), `published_at` y `first_assigned_at` (Shift), que el backend manda y el frontend no declara (inofensivo).

**Por qué así:** un solo archivo generado por un test del backend, en vez de fixtures a mano o un cliente OpenAPI, porque lo que importa es la respuesta que el servidor da en un escenario real (incluidos los errores y sus textos), no el schema. Se compara la forma y no los valores para que un cambio de texto no rompa CI, y sí un campo que aparece, desaparece o cambia de tipo. Los UUID y tokens se normalizan porque gitleaks escanea todo el repo.

**Queda abierto:** migrar el resto de los ~90 specs que todavía arman turnos, sesiones y errores a mano (priorizar los que mockean errores). Errores que el backend no genera (5xx, 429, corte de red) siguen a mano. Un campo que en el escenario es `null` queda `null` en el contrato: no se prueba con valores.
