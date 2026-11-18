# U080: un turno reabierto que ya empezó se reofrece como urgente y se paga lo que resta

**Pedido:** Julieta, decisiones 4, 16, 18 y 19 del tablero de la beta
(2026-11-13 y 2026-11-18). Hallazgo U080 de la prueba de punta a punta: al
reabrirse un turno por una ausencia nadie recibía un aviso nuevo y, como ya
había empezado, tampoco volvía al Inicio. El comercio se quedaba sin la
persona y sin chance de reemplazo, con horas de turno por delante.

**Qué cambió:**

- Si la persona que tenía el turno falta, cancela o rechaza **con el horario
  ya empezado**, el turno se vuelve a ofrecer como urgente hasta que termina.
  Sólo si le queda al menos 1 hora; con menos pasa a «no cubierto» en el
  momento, con un aviso al comercio que dice por qué.
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
- A quien toma un turno ya empezado, el recordatorio de llegada y la ausencia
  (manual y automática) se le cuentan **desde que confirmó**, no desde el
  inicio; y ese turno no le mueve la puntualidad.
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
- Con menos de 1 hora el turno se cierra en la misma operación, en vez de
  quedar en «Buscando personal» hasta la pasada de cobertura: el comercio veía
  durante hasta 2 horas un turno que nadie podía tomar.
- El valor por hora y el monto fijado los calcula el backend; el frontend no
  hace ninguna cuenta de plata.
- Puntualidad del reemplazo: se eligió «no mueve» porque es reversible
  mientras se decide si corresponde medir «X minutos desde que confirmó».
  Está aislado en `punctuality_of`.
- Los tests que armaban un turno con el inicio ya pasado y lo confirmaban
  después ahora describen a un reemplazo: se les agregó `confirmo_a_tiempo`
  (`backend/tests/_turno_empezado.py`) para que sigan probando «confirmó a
  tiempo y no llegó».

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
