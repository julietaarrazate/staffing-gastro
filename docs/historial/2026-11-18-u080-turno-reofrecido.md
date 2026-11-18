# U080: un turno reabierto que ya empezó se reofrece como urgente y se paga lo que resta

**Pedido:** Julieta, decisiones 4, 16, 18 y 19 del tablero de la beta
(2026-11-13 y 2026-11-18). Hallazgo U080 de la prueba de punta a punta: al
reabrirse un turno por una ausencia nadie recibía un aviso nuevo y, como ya
había empezado, tampoco volvía al Inicio. El comercio se quedaba sin la
persona y sin chance de reemplazo, con horas de turno por delante.

**Qué cambió:**

- Si la persona que tenía el turno falta, cancela o rechaza **con el horario
  ya empezado**, el turno se vuelve a ofrecer como urgente. Sólo si le
  quedan al menos 2 horas; con menos pasa a «no cubierto» en el momento, con
  un aviso al comercio que dice por qué. Ya reofrecido, sale de la oferta
  cuando le quedan menos de 2 horas, y si nadie confirmó pasa a «no
  cubierto» (decisión 19: Julieta subió el mínimo de 1 a 2 horas el mismo
  día, ver abajo).
- A quienes están cerca les llega un aviso urgente con el **valor por hora**
  («Paga $10.000 por hora, desde que llegás»). A quien ya tuvo ese turno y lo
  dejó, no. Las tarjetas (Inicio, «Cerca tuyo», Buscar, Mapa y su pin,
  detalle, Mis turnos, compartir) dicen «Ya empezó · hasta las HH:MM» y
  muestran el valor por hora, nunca el monto del turno entero.
- Quien lo toma **cobra lo que resta desde que marca la llegada**: ese monto
  queda fijo al llegar, es el que ve en su tarjeta («Por lo que restaba del
  turno desde la llegada») y el que suman sus ganancias. El comercio lo ve en
  su panel y en «¿Ya le pagaste este turno?».
- El comercio recibe **un aviso** cuando alguien confirmado falta (antes no
  recibía ninguno): qué pasó y qué hizo la app con el turno. El diálogo de «No
  se presentó» dice de antemano si el turno se va a reofrecer o queda sin
  cubrir, y el panel marca el turno «Reofrecido como urgente hasta las HH:MM».
- A quien toma un turno **reofrecido** ya empezado, el recordatorio de
  llegada y la ausencia (manual y automática) se le cuentan **desde que
  confirmó**, no desde el inicio; y ese turno no le mueve la puntualidad. Un
  turno común confirmado después del inicio sigue como antes de U080.
- Técnico: migración `0053` (`shifts.reoffered_at`, `confirmed_at`,
  `prorated_pay_amount`). Dominio en `backend/app/modules/shift/domain/entities.py`
  (`Shift._reopen` devuelve `Reapertura`; `expected_from`, `amount_due`,
  `hourly_pay_amount`, prorrateo en `check_in`) y `punctuality.py`
  (`punctuality_of`). Casos de uso en `shift/application/services.py`
  (`_record_reopen`, `_announce_reopen`, `_notify_reoffer`,
  `coverage_deadline`) y `scheduler.py`. Feed y ganancias en
  `shift/infrastructure/repositories.py` (`_open_stmt`, `sum_worker_earnings`
  con `COALESCE`). API: `ShiftResponse` suma `reoffered_at`,
  `hourly_pay_amount`, y para las partes `prorated_pay_amount` y
  `confirmed_at`. Frontend: `payView` en `frontend/lib/pay.ts` es el único
  lugar que decide qué pago mostrar; `formatShiftWhenLive` en
  `lib/datetime.ts`; `lib/turno-reofrecido.ts` para los textos del panel.
- Docs: ADR-0015 y ADR-0008 (actualización 2026-11-18), ADR-0007 (ya no es una
  decisión pendiente), `DOMAIN.md`, `NOTIFICATIONS.md`, `REPUTATION.md`,
  `QUE_EXISTE_HOY.md`, `SHIFT.md`, `MAPA_DEL_CODIGO.md`.

**Por qué así:**

- Un solo paso de dominio (`_reopen`) para las cuatro transiciones que
  reabren: antes cada una repetía «soltar a la persona y volver a buscar», y
  la regla de la hora habría quedado copiada cuatro veces.
- Con menos de 2 horas el turno se cierra en la misma operación, en vez de
  quedar en «Buscando personal» hasta la pasada de cobertura: el comercio veía
  durante hasta 2 horas un turno que nadie podía tomar.
- El valor por hora y el monto fijado los calcula el backend; el frontend no
  hace ninguna cuenta de plata.
- Puntualidad del reemplazo: se eligió «no mueve» porque es reversible
  mientras se decide si corresponde medir «X minutos desde que confirmó».
  Está aislado en `punctuality_of`.

**Corregido tras la revisión independiente (mismo día):**

- **Un turno común cambiaba de reglas si la persona confirmaba tarde.**
  `Shift.taken_after_start`, `punctuality_of` y `esperadoDesde` (frontend)
  miraban sólo «confirmó después de `start_at`»: un turno común asignado
  antes del inicio (o en la gracia de «no cubierto») y confirmado tarde
  dejaba de medir la puntualidad y corría el recordatorio y la ausencia
  desde la confirmación. Ahora eso vale **sólo en un turno reofrecido**. Se
  quitó el helper de tests `confirmo_a_tiempo` (y el ajuste equivalente en
  `empezar_turno`): tapaba este error, y los tests de asistencia, scheduler y
  «no cubierto» vuelven a ser los de antes de U080. Test nuevo del turno
  común confirmado tarde.
- **Suspensión:** `_reopen_for_worker_suspension` descartaba lo que
  devolvía `release_worker()`. Hoy sólo llegan turnos no empezados (ADR-0024,
  punto 3), pero ahora usa el resultado y el mismo aviso que el resto
  (`_announce_reopen`), sin restaurar rechazados si el turno quedó cerrado.
  ADR-0015 dice que suspender al reemplazo de un turno reofrecido no lo
  reofrece: sigue hasta la ausencia automática, contada desde que confirmó.
- **Plata en el admin:** la ficha mostraba lo publicado. Ahora muestra lo que
  se cobra (`amount_due`), «$34.932 de $40.000» si difiere
  (`formatAmountDue` en `frontend/lib/pay.ts`). `Shift.amount_due` es la
  referencia; el `COALESCE` de `sum_worker_earnings` y `payView` dicen que
  son su espejo. No hay otros lugares que muestren o sumen lo cobrado con
  `pay_amount` (avisos de pago sin monto, sin exportes; la referencia de
  pago y el asistente usan lo publicado a propósito).
- **Carrera en la cobertura:** `mark_not_covered` relee el turno y, si
  todavía no corresponde (`coverage_deadline`, que pasa a `end_at` si se
  reofreció en el medio), no hace nada.
- **Diálogo de «No se presentó»:** a menos de 15 minutos del umbral (hoy 2
  horas) dice las dos posibilidades, porque lo decide el reloj del servidor al
  marcarlo.
- **El mínimo pasó de 1 a 2 horas** (decisión 19 actualizada por Julieta el
  mismo día: nadie toma un turno reabierto por una sola hora), en las dos
  puntas: para reofrecer al reabrir, y para seguir ofreciéndolo
  (`Shift.offered_until` = `end_at` − 2 h: feed, página pública, soporte,
  postularse y el plazo de «no cubierto»). Una sola constante,
  `REOFFER_MIN_REMAINING`, con su espejo `REOFFER_MIN_REMAINING_MS` en
  `frontend/lib/turno-reofrecido.ts`. El filtro de `_open_stmt` compara
  `end_at` contra un límite calculado en Python en UTC (sumar un intervalo a
  `now()` cambia según el motor). Los avisos y el panel dicen «hasta las
  HH:MM» con la hora en que deja de ofrecerse; las tarjetas del trabajador
  siguen mostrando el fin del horario.
- **Quien dejó el turno y lo seguía viendo:** no hizo falta cambiar nada.
  Inicio, Buscar y Mapa ya esconden los turnos con la postulación
  `desasignada` (`appliedShiftIds` en `frontend/lib/applications.ts` la
  cuenta como «ya postulado», desde G4).

**Queda abierto:**

- Falta que Julieta confirme la puntualidad de quien toma un turno ya
  empezado (hoy no se mueve).
- `/terminos` dice que «el comercio define las condiciones del turno
  (posición, horario, paga…)». No contradice el pago prorrateado, pero no lo
  nombra: ver si conviene sumar una línea (texto legal: decide Julieta).
- `ApplicationService.apply` no mira la hora de inicio de un turno común (por
  la API se puede postular a un turno abierto que ya empezó y todavía no se
  cerró; ninguna pantalla lo ofrece). Para el reofrecido sí se rechaza pasado
  el final.
- La página `/turno/[id]` (se arma en el servidor) no se capturó en esta
  sesión; usa `ShiftDetail`, cubierto por los tests de `payView`.
- Siguen para Julieta: la puntualidad del primer turno de un reemplazo
  (queda en 1.0) y que un reofrecido se pueda tomar hasta el último minuto.
- `appliedShiftIds` mira las 50 postulaciones más recientes de
  `/applications/mine`: a quien tenga más, una `desasignada` vieja se le
  podría escapar (caso raro, no se tocó).
