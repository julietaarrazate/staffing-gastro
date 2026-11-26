# Reconfirmación antes del turno, construida y apagada (P3, ADR-0031) (#PR)

**Pedido:** Julieta aceptó el ADR-0031 el 2026-11-25: entre que alguien
confirma y el día del turno nadie le pregunta si sigue yendo, y la ausencia
se descubre 15 minutos después del inicio. El código se hace ahora y queda
apagado hasta que la asesoría apruebe el texto de los avisos.

**Qué cambió:** con `RECONFIRMACION_ENABLED=true`, a las 24 y a las 3 horas
del inicio la persona recibe «¿Seguís yendo…?» y en «Mis turnos» la tarjeta
le pregunta con «Sí, voy» y «No puedo». «Sí, voy» queda registrado y el
Panel del comercio dice «Camila reconfirmó que va». «No puedo» es la
cancelación de siempre; si avisa con tiempo no le suma una cancelación, y el
cartel se lo dice. Si a las 2 horas no contestó nunca, el comercio recibe
«Camila no reconfirmó…»; nadie pierde el turno por no contestar. Apagada, no
cambia nada.

Técnico: reglas puras en `backend/app/modules/shift/domain/reconfirmacion.py`
(`paso_pendiente`, `cancelacion_sin_peso`); cuatro marcas en `shifts`
(migración 0063) que escribe `ShiftRepository.mark_reconfirmation` sin subir
la versión y que se borran cuando el turno cambia de persona;
`run_reconfirmation_check` en el scheduler; `POST /shifts/{id}/reconfirm`;
la respuesta del turno suma `reconfirmation_pending`, `reconfirmed_at`,
`no_reconfirm_alert_sent_at` y `cancel_with_notice`, sólo para las partes.
Avisos nuevos: `reconfirm_request` y `worker_not_reconfirmed`. Pantalla:
`frontend/app/my-shifts/page.tsx` y `frontend/lib/shift-next-step.ts`.
Tests: `backend/tests/test_reconfirmacion.py`, `frontend/e2e/reconfirmacion.spec.ts`.

**Por qué así:** lo que el ADR dejaba abierto está anotado al final del
ADR-0031 («Implementación de P3»), con los textos de los avisos.

**Queda abierto:** que la asesoría apruebe los textos y Julieta prenda
`RECONFIRMACION_ENABLED` en Render. «Buscar reemplazo» va con la oferta
directa a suplentes.
