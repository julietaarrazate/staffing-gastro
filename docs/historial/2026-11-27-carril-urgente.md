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

**Por qué así:** [ADR-0032](../adr/ADR-0032-carril-urgente.md). Se mide contra
el momento de la postulación (quien se postuló con días de anticipación no vio
«Puedo ir ya»), y se descartó «gana el primero sin que el comercio elija»
porque siempre aceptan las dos partes.

**Queda abierto:** prender `URGENTE_DIRECTO` en producción cuando `/terminos`
diga que quien se ofrece para ya queda confirmada al ser aceptada (cambia el
texto legal: sube `LEGAL_TERMS_VERSION`, con el sí de Julieta). Un turno que
cruza las 6 horas mientras la persona ya estaba postulada muestra «Te
ofreciste» aunque se haya postulado antes (el servidor igual le pide
confirmar): sólo el texto del estado, no la regla.

**Pruebas:** `backend/tests/test_urgente_directo.py` (9),
`frontend/components/worker/ConfirmarPuedoIr.test.tsx`, casos nuevos en
`SwipeDeck.test.tsx`, `ShiftDetail.test.tsx` y `lib/applicants.test.ts`,
`frontend/e2e/carril-urgente.spec.ts` (9, claro y oscuro).
