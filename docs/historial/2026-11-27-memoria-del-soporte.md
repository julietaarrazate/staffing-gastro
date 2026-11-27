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

## Después de la revisión independiente

- **La memoria se podía envenenar.** Quien abre un ticket controla el asunto y
  la consulta, y eso quedaba como precedente de sugerencias futuras: podía
  escribir algo que imitara una respuesta del equipo o una instrucción. Ahora
  cada texto ajeno va entre etiquetas propias, sin poder cerrarlas, y el
  pedido dice que es dato y no instrucciones.
- **Se quitan mails y tiras largas de dígitos** (teléfonos, CUIT, CBU) de los
  casos ajenos antes de enviarlos.
- **«El equipo» es quien tiene rol admin**, dicho explícito; un ticket abierto
  por alguien del equipo no es precedente.
- **Se filtra en la consulta** que el ticket tenga respuesta del equipo: antes
  una tanda de tickets cerrados sin contestar podía dejar la categoría sin
  memoria.
- Sigue valiendo lo principal: la sugerencia es un borrador que revisa una
  persona.
