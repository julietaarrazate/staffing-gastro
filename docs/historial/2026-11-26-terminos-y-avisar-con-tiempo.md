# Términos: qué hace Oído, y avisar con tiempo no cuenta (#750)

**Pedido:** Julieta consultó a su abogado, que aprobó el encuadre «Oído es
sólo intermediario» con un texto largo de referencia. Pidió que los Términos
queden cortos, en el idioma de la app, y que estén antes de la beta
(2026-11-26; hoy los usuarios son personas de confianza).

**Qué cambió:**
- `/terminos` ya decía lo central (plataforma de intermediación, no es
  empleador ni parte, no garantiza, el comercio define y paga, nadie está
  obligado). Se sumaron cuatro frases: en «Qué es Oído», que Oído ordena y
  sugiere y deciden las partes; en «Cancelaciones y ausencias» (antes «Cancelaciones y no-show»: la gente no entiende «no-show»), que si no
  marcás la llegada el comercio puede indicar si llegaste y si fue a
  horario; en «Límite de responsabilidad», que usar Oído no reemplaza las
  obligaciones legales de cada parte y que Oído responde por lo propio.
  Versión legal `2026-11-26-1` (backend y `frontend/lib/legal.ts`).
- La tarjeta «Garantía Oído» de Candidatos pasa a llamarse «Si algo falla»:
  los Términos dicen que Oído no garantiza la asistencia ni es garante.
- Avisar con 24 horas o más que no vas a un turno confirmado no suma una
  cancelación, con la reconfirmación prendida o apagada
  (`ShiftService.worker_cancel`, `cancel_with_notice` en la respuesta). Antes
  dependía de `RECONFIRMACION_ENABLED` y, apagada, la app contaba cualquier
  cancelación aunque los Términos hablaran de cancelar «muy sobre la hora».

**Por qué así:** no se copió el texto largo: repetía lo que ya estaba y en
otro registro. Se agregó sólo lo que faltaba y lo que hace que el texto
coincida con lo que la app hace.

**Aceptar una versión nueva (agregado el mismo día):** cuando los términos
cambian, a quien ya tiene cuenta la app le pide aceptarlos antes de seguir
(«Actualizamos los Términos»: «Acepto» o «Cerrar sesión»). `GET /auth/me`
suma `terms_acceptance_required`; `POST /auth/terms/accept` deja otra fila en
`terms_acceptances` con el canal `app` (la anterior queda como historia).
Pantalla: `frontend/components/TerminosNuevos.tsx`, montada en
`app/layout.tsx`; no aparece sobre `/terminos` ni `/privacidad`, ni mientras
una admin mira otra cuenta con «Ver como». Las cuentas invitadas compartidas
no aceptan nada. Tests: `backend/tests/test_aceptar_terminos_nuevos.py`,
`frontend/e2e/terminos-nuevos.spec.ts`.

**«No-show» ya no se le dice a nadie:** en `/terminos` la sección es
«Cancelaciones y ausencias», y en Métricas la tarjeta es «Ausencias».

**Queda abierto:** con «Ver como», el servidor no distingue la sesión de la
admin de la de la persona, así que no puede impedir que acepte por ella si
llamara a la API a mano (la pantalla no lo ofrece); se cierra con «Ver como»
sólo para mirar (PRI-09). Cuando se prenda la reconfirmación o exista la
oferta directa, una frase para cada una (borradores en el documento privado
de la consulta legal).
