# Recordatorio a las 24 h y cierre automático a las 72 del turno sin cerrar (decisión 24)

**Pedido:** Julieta (decisión 24, 2026-11-18). Un turno con la salida marcada
que el comercio no cerraba quedaba «en marcha» para siempre: la persona veía
«Esperando que el comercio cierre el turno» y no podía calificar ni verlo en
sus ganancias. Regla: recordatorio al comercio a las 24 horas de la salida y
cierre automático a las 72, con la puntualidad ya registrada en la llegada.

**Qué cambió:**

- **Comercio:** a las 24 h de la salida le llega «Te falta cerrar un turno»
  («La persona marcó la salida de "X" el martes 17/11 a las 15:00. Cerralo
  para poder calificarla y registrar el pago. Para que cuente como pago a
  tiempo, registralo hasta el jueves 19/11 a las 23:00. Si no lo cerrás, se
  cierra solo el viernes 20/11 a las 15:00.», fechas reales en hora
  argentina; si el plazo de pago ya pasó, «Si registrás el pago ahora, ya
  cuenta como pago tardío.»), una sola
  vez. A las 72 h, «Oído cerró
  un turno» («Cerramos automáticamente "X": pasaron 72 horas desde que la
  persona marcó la salida. Te queda marcarlo como pagado: como pasaron más
  de 48 horas desde el fin del turno, cuenta como pago tardío.»). Con la cuenta
  suspendida no recibe ninguno de los dos. En el panel, la línea de estado
  del turno con la salida marcada suma «Si no lo cerrás, se cierra solo el
  viernes 20/11 a las 15:00.» (`frontend/components/ShiftActions.tsx`).
- **Trabajador:** al cierre automático le llega «Se cerró tu turno» («"X" se
  cerró solo porque pasaron 72 horas desde tu salida. Ya podés calificar a
  <comercio>.», mismo link que el aviso de cierre). En «Mis turnos», mientras
  espera: «Esperando que el comercio lo cierre. Si no, Oído lo cierra el
  viernes 20/11 a las 15:00 (72 horas después de tu salida).»
  (`frontend/app/my-shifts/page.tsx`, texto en `lib/shift-next-step.ts`).
- **Backend:** migración `0056` (`shifts.finish_reminder_sent_at`,
  `shifts.auto_finished_at`; `down_revision = "0052"`, se encadena al
  integrar con las ramas que usan 0053 a 0055). `FINISH_REMINDER_DELAY` y
  `AUTO_FINISH_DELAY` en `shift/application/services.py`;
  `ShiftService.send_finish_reminder` (UPDATE condicional sin versión,
  `mark_finish_reminder_sent`), `ShiftService.auto_finish` y
  `Shift.auto_finish`; los efectos del cierre (reputación con la puntualidad
  de la llegada y aviso al trabajador) pasaron a un solo método,
  `_save_finished`, que usan `finish` y `auto_finish`. Scheduler:
  `run_finish_check()` en el loop. Tipos de aviso nuevos
  `shift_finish_reminder` y `shift_auto_finished` (enum, destino, política de
  push por defecto, `frontend/lib/types.ts` y `notification-link.ts`).
- Tests: `backend/tests/test_cierre_automatico.py` y los de
  `lib/shift-next-step.test.ts` y `components/ShiftActions.test.tsx`.

**Por qué así:** el recordatorio tiene tipo propio (y no reusa
`shift_checked_out`, de urgencia alta) para que su push vaya con urgencia
normal: sale a la hora de la salida más un día, que puede ser de madrugada.
Dice la fecha real de la salida y no «hace un día», porque la pasada puede
llegar tarde (primer despliegue, Render dormido). El aviso de cierre al
trabajador reusa `shift_finished` (es el mismo hecho) con texto propio. El
aviso al comercio del cierre automático es tipo nuevo porque no había uno del
comercio que dijera «se cerró». La marca del recordatorio no sube la versión
para que no le dé «El turno cambió» al comercio que está por cerrar, y el
repositorio no la pisa con una lectura vieja. La puntualidad vive en un solo
lugar para que un cambio de su cálculo entre en los dos caminos a la vez.

**Queda abierto:** al desplegar, un turno que ya llevaba más de 72 h con la
salida marcada se cierra en la primera pasada, sin recordatorio previo. El
recordatorio cae a la misma hora del día de la salida (de noche, si la salida
fue de noche; el push va con urgencia normal). Marcar pagado después del
cierre automático cuenta como pago tardío (`PAYMENT_TOLERANCE` son 48 h desde
el fin del turno): Julieta decidió dejarlo así y avisarlo antes, en el
recordatorio y en el aviso del cierre.
