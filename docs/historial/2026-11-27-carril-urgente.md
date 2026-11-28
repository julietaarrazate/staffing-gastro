# Carril urgente: «Puedo ir ya» y confirmación directa (#PENDIENTE)

**Pedido:** Julieta (2026-11-27): en un turno que empieza pronto, que la
persona que se ofrece quede confirmada apenas el comercio la acepta, sin
pedirle otra confirmación.

**Qué cambió:** con `URGENTE_DIRECTO` prendido (apagado por defecto), si el
turno empieza en menos de 6 horas:

- Quien trabaja ve **«Puedo ir ya»** en lugar de «Postularme» (Inicio y
  «Descubrir rápido», Buscar, Mapa, detalle del turno, guardados). Al tocarlo
  no postula: abre «¿Podés ir a este turno?» con «Sí, puedo ir» (el único
  ámbar) y «Ahora no». Después dice «Te ofreciste para este turno. Si te
  aceptan, queda confirmado.»
- El comercio ve la marca **«Puede ir ya»** y el botón **«Aceptar»** (fila) o
  **«Aceptar a <nombre>»** (tarjeta y ficha). Al aceptar, el turno pasa directo
  a `confirmado` y «¡Oído!» dice «<Nombre> ya se había ofrecido: el turno quedó
  confirmado.» Si la persona ya tomó otro turno en ese horario (409), se
  muestra el mensaje y la lista se recarga.

Técnico: `backend/app/modules/shift/domain/urgente.py`,
`ShiftService._se_ofrecio_para_ya` y `_aceptar_y_confirmar`,
`ShiftResponse.apply_commits`, `ApplicantResponse.se_ofrecio_para_ya`
(`application/api/`); `frontend/components/worker/ConfirmarPuedoIr.tsx` (el
diálogo, el hook `useConfirmarPuedoIr` y los textos: un solo lugar),
`frontend/lib/applicants.ts` (`PUEDE_IR_YA`, `textoElegir`) y
`frontend/components/candidate/*`. Contrato de e2e regenerado.

**Por qué así:** [ADR-0032](../adr/ADR-0032-carril-urgente.md). El
reconocimiento «Puedo ir ya» se guarda al postular (no se deduce de la fecha),
y se descartó «gana el primero sin que el comercio elija»
porque siempre aceptan las dos partes.

**Términos (aprobado por la dueña, 2026-11-28):** una sola frase nueva en
`/terminos`, sección «Publicar y postularse a turnos»: «En turnos que empiezan
en menos de 6 horas, si te ofrecés con "Puedo ir ya" y el comercio te acepta,
el turno queda confirmado.» No se tocó ninguna otra frase ni `/privacidad`.
`LEGAL_TERMS_VERSION` sube a `2026-11-28-1` en el backend
(`identity/domain/value_objects.py`) y en `frontend/lib/legal.ts`: todas las
cuentas aceptan de nuevo.

**Queda abierto:** prender `URGENTE_DIRECTO` en producción (los Términos ya lo dicen).

**Corrección tras la revisión independiente (2026-11-27/28):** el servidor
decidía por `created_at` y no por lo que la persona vio. Ahora el
consentimiento es explícito y se guarda: `POST /applications/shifts/{id}`
acepta `{"puedo_ir_ya": true}` y la postulación guarda `se_ofrecio_para_ya`
(columna nueva, migración 0067). Una pantalla vieja recibe 409
`puedo_ir_ya_requerido`, abre la pregunta y reintenta. Aceptar, «Puede ir ya»
y «Te ofreciste…» leen sólo esa columna; si el comercio cambia el horario se
borra; volver a postularse la recalcula. El mail de aceptación tiene variante
«ya quedó confirmado», y la pregunta suma «Si después no podés ir, cuenta como
una cancelación.» Detalle en el ADR-0032.

**Pruebas:** `backend/tests/test_urgente_directo.py` (16),
`frontend/components/worker/ConfirmarPuedoIr.test.tsx`, casos nuevos en
`SwipeDeck.test.tsx`, `ShiftDetail.test.tsx` y `lib/applicants.test.ts`,
`frontend/e2e/carril-urgente.spec.ts` (9, claro y oscuro).
