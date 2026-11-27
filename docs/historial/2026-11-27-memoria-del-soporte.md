# El soporte recuerda cómo se resolvieron los casos parecidos (#757)

**Antes:** «Sugerir» en un ticket (panel de admin) armaba el borrador de
respuesta sólo con la conversación de ese ticket. Cada ticket empezaba de
cero, sin el criterio con que el equipo ya había resuelto otros iguales.

**Después:** la sugerencia lleva además los últimos cuatro tickets cerrados de
la misma categoría que el equipo contestó: la primera consulta de la persona
y la última respuesta de soporte. Cada ticket que se cierra con respuesta
mejora las sugerencias siguientes, sin reentrenar nada. La pantalla dice en
cuántos casos se apoyó. Sigue siendo sólo un borrador: lo revisa y lo envía
una persona.

**Cuidados:** cada texto de un precedente se recorta a 600 caracteres (tope de
tamaño y de costo); el pedido le dice al modelo que esos casos son de otras
personas y que no copie nombres, montos ni fechas; no entran tickets de otra
categoría, ni los cerrados sin respuesta del equipo, ni el propio. El
proveedor no cambia (Gemini, el mismo que ya recibía la conversación).

**Cómo:** `ResolvedCase` (`support/domain/entities.py`),
`SupportMessageRepository.list_resolved_cases`, `SupportService.precedents_for`,
`suggest_ticket_reply(..., precedents)` en `core/gemini.py`,
`precedents_used` en la respuesta y en `frontend/app/support/[id]/page.tsx`.
Pedido de Julieta del 2026-11-27.

**Pruebas:** `backend/tests/test_support.py` (2 casos nuevos),
`frontend/e2e/support.spec.ts`.
