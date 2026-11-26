# Puntualidad real (P1, ADR-0008) (#PR)

**Pedido:** mejora P1, aprobada por Julieta el 2026-11-13 y puesta primera
en el orden el 2026-11-26: todo el orden de los postulantes se apoya en la
puntualidad, y hoy ese dato mezclaba «llegar a horario» con «acordarse de
marcar».

**Qué cambió:** puntual es marcar hasta 5 minutos después del inicio (antes
15). La persona recibe tres recordatorios: 10 minutos antes, a la hora y 5
minutos después. A la hora de inicio, si no marcó, el comercio recibe «Ana
todavía no marcó la llegada» y en el Panel aparece «Ya llegó», que pregunta si
fue a horario o tarde; lo que diga queda en la puntualidad de la persona, que
recibe un aviso. «No se presentó» se puede marcar desde los 10 minutos (antes
15). Con la llegada marcada, el Panel dice cómo llegó («Ana llegó 8 min
tarde»).

Técnico: reglas en `backend/app/modules/shift/domain/punctuality.py`
(`PUNCTUALITY_TOLERANCE`, `recordatorio_pendiente`, `punctuality_of` con lo
que dijo el comercio); `Shift.company_check_in` y tres columnas en `shifts`
(migración 0064); `ShiftService.send_checkin_reminder(paso)` y
`company_check_in`; el chequeo de asistencia del scheduler;
`POST /shifts/{id}/company-check-in`. Avisos nuevos: `worker_not_checked_in`
y `arrival_marked_by_company`. Pantalla: `frontend/components/ShiftActions.tsx`
y `llegadaDe` en `frontend/lib/shift-next-step.ts`. Tests:
`backend/tests/test_puntualidad_real.py`.

**Por qué así:** está en la actualización del 2026-11-26 del ADR-0008. Quedó
afuera marcar la llegada por ubicación.

**Queda abierto:** nada de esta mejora. La puntualidad ya guardada en
producción no se recalcula.
