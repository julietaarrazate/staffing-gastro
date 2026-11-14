# Tickets de soporte que se pueden reabrir (G27, U128) (#576)

**Pedido:** salida a beta, hallazgo U128 y decisión 12 del tablero: los tickets cerrados no se podían reabrir, y un mensaje del admin en un ticket cerrado le llegaba a la persona sin que ella pudiera contestar.

**Qué cambió:** un mensaje del admin en un ticket cerrado lo reabre, y la persona puede contestar. El admin tiene un botón «Reabrir» en el ticket cerrado (y un aviso de que escribirle también lo reabre). La persona sigue sin poder reabrirlo: su mensaje en un ticket cerrado da 400, y `POST /support/tickets/{id}/reopen` le da 403. El aviso a la persona dice «Reabrimos tu ticket "…" y hay una respuesta nueva. Podés contestar.» cuando el mensaje reabrió el ticket; si el ticket ya estaba abierto, el aviso es el de siempre.
- `backend/app/modules/support/domain/entities.py` (`SupportTicket.reopen()`), `domain/exceptions.py` (`TicketNotClosedError`), `application/services.py` (`add_message` reabre si escribe el admin; `reopen_ticket`; `_notify_reply(reopened=)`), `api/routes.py` (`POST /support/tickets/{id}/reopen`, sólo admin; ticket inexistente 404, ya abierto 400).
- `frontend/app/support/[id]/page.tsx`: botón «Reabrir» y aviso, sólo para el admin con el ticket cerrado.
- Pruebas: `backend/tests/test_support.py` (6 nuevas), `frontend/e2e/support.spec.ts` (2 nuevas).

**Por qué así:** no hace falta migración: el estado `abierto` ya existía. Reabrir con el botón no avisa a la persona (no hay nada que leer todavía); el aviso sale cuando el admin escribe. Ajeno sigue siendo 404 al leer y al escribir; en `/reopen` un no-admin recibe 403 por rol, antes de mirar el ticket, así que no revela si existe.

**Queda abierto:** nada de este grupo.
