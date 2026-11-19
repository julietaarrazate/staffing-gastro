# Lo guardado en el navegador va atado a la cuenta, no a la sesión (#672)

**Pedido:** pasada por clase de error del 2026-11-19 (SES-02, SES-03, SES-04, todos menores). Decisión de quien coordina: el borrador de la misma cuenta se conserva cuando la sesión vence o se revoca; lo de la cuenta anterior se limpia cuando entra otra cuenta.

**Qué cambió:** si la sesión vence mientras alguien armaba un turno en «Publicar», al volver a entrar con la misma cuenta el borrador sigue. Si entra otra cuenta, o la cuenta sale a propósito (acá o en otra pestaña), no queda nada de la anterior. Técnico:
- `frontend/lib/cambio-de-cuenta.ts` (nuevo): `limpiarDeLaCuentaAnterior()` borra borradores (`staffya:borrador:*`), `staffya_ai_*_draft`, `staffya_plan_elegido` y la caché de módulo (`"worker-feed"` y el resto); `esOtraCuenta()` compara contra la última cuenta de la pestaña (`staffya_ultima_cuenta` en `sessionStorage`, sobrevive al vencimiento).
- `frontend/lib/auth-context.tsx`: `clearSession` ya no borra borradores (SES-02). La llama «Salir» y la rama `markGone` sin motivo de otra pestaña (SES-03). `startSession` la llama si la cuenta nueva no es la anterior y siempre limpia `pendingTwoFactor` (SES-04). No se tocó la renovación entre pestañas (`oido-renovar-sesion`).
- Las claves del asistente de IA viven ahora en `cambio-de-cuenta.ts` y `use-ai-assistant.ts` las reexporta (evita un ciclo de importación con `auth-context`).
- Tests: `frontend/lib/auth-context.test.tsx` (seis casos) y `frontend/e2e/sesion-vencida.spec.ts` (vence con borrador a medias, vuelve a entrar y sigue).

**Por qué así:** el borrador ya guarda `owner` y las pantallas descartan los ajenos, así que conservarlo es seguro; lo que no tiene dueño (IA, plan elegido, caché) se limpia por cambio de cuenta. «Salir» a propósito sigue borrando todo (computadora compartida).

**Queda abierto:** nada.
