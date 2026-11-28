# La persona confirma si cobró el turno (#PENDIENTE)

**Pedido:** la dueña (2026-11-27). Oído no mueve plata: el comercio le paga a la persona por fuera y hasta hoy sólo el comercio marcaba el turno como «pagado». La persona también tiene que poder decir si cobró.

**Qué cambió:** sobre un turno terminado (`finalizado` o `pagado`) que le fue asignado, la persona ve «¿Ya cobraste este turno?» en Mis turnos, con «Sí, cobré» y «Todavía no».
- «Sí, cobré» es definitivo, vale con el pago marcado o no, y avisa suave al comercio («<Nombre> confirmó que cobró»).
- «Todavía no» se avisa una sola vez por turno. Si el comercio marcó «pagado», vale desde ese momento; si no marcó nada, desde 24 h después del fin del turno (hasta entonces el botón está apagado y dice la fecha y hora). Avisa al comercio («<Nombre> avisó que todavía no cobró el turno del <fecha>. Si ya le pagaste, pedile que lo confirme; si no, coordinalo por el chat.») y abre un ticket de soporte en la categoría `pagos`, a nombre de la persona y atado al turno. Después puede pasar a «Sí, cobré»; el registro de que avisó queda.
- Estados posteriores: «Confirmaste el cobro» y «Avisaste que no cobraste: soporte ya lo sabe». El comercio, en su turno, ve «<Nombre> confirmó que cobró» o «avisó que todavía no cobró».
- Nadie es sancionado: sólo se registra y se avisa. El estado del turno y `paid_at` no cambian.

Técnico: columnas `shifts.worker_confirmed_paid_at` y `worker_reported_unpaid_at` (migración 0066, sin modelo nuevo para `tests/conftest.py`); reglas en `shift/domain/cobro.py` y métodos de `Shift` (`worker_confirm_payment`, `worker_report_unpaid`, `unpaid_report_opens_at`); casos de uso `ShiftService.confirm_payment_received` / `report_payment_missing`; rutas `POST /shifts/{id}/payment-received` y `/payment-missing` (404 si es ajeno o inexistente, 400 con texto para la persona si no corresponde, idempotentes, con `Idempotency-Key`). El ticket se abre por el puerto `PaymentReportOpener` (dominio de shift), con el adaptador `shift/infrastructure/support_gateway.py` que usa `SupportService`. Tipos de aviso nuevos `worker_confirmed_paid` (push por defecto) y `worker_reported_unpaid` (push de acción sobre turno). Los tres campos nuevos son datos de la persona: `WORKER_DATA_FIELDS` los borra para quien no es parte. Frontend: `components/CobroDeLaPersona.tsx`, `CobroEnElTurno.tsx`, `lib/cobro.ts`. Bajo «Ver como» el servidor da 403 `impersonation_read_only` y el motivo se muestra en el lugar, como en las otras acciones.

**Revisión independiente (2026-11-28), arreglos:** «Todavía no» ahora es a prueba de fallas: la marca se guarda, después se abre el ticket y se guarda su id (`shifts.unpaid_report_ticket_id`, también en 0066), y recién entonces se avisa al comercio; si el ticket falla, la persona ve el error y el reintento completa lo que faltó (un ticket y un aviso, no dos). Si la persona no tiene perfil, no se abre el ticket y queda un `logger.error`. Las fechas del plazo se comparan en UTC sin importar la zona de quien llama (sin zona se toma como UTC). Un turno cancelado o vencido sin cubrir tiene su propio mensaje. Tests nuevos: «Ver como» (403 `impersonation_read_only`), comercio y persona suspendidos, carrera «sí»/«no», cancelado, ausencia, borde exacto de las 24 h, ticket que falla.

**Capturas miradas** (scratchpad de la sesión, `cobro-<estado>-<tema>-<ancho>.png`): `cobro-pregunta-{light,dark}-{390,320}`, `cobro-avisado-{light,dark}-{390,320}`, `cobro-confirmado-{light,dark}-{390,320}` y `cobro-comercio-{light,dark}-{390,320}`; todas miradas, sin cortes ni desborde a 320.

**Por qué así:**
- El plazo se cuenta desde `end_at` (no desde la salida real), igual que la tolerancia de «pago a tiempo».
- Con el pago del comercio, «Todavía no» vale desde `paid_at` y no desde `end_at`: un turno puede cerrarse con el horario todavía por delante, y antes de que el comercio diga «pagado» no hay nada que contradecir.
- «Avisó que no cobró» no usa ámbar: la pantalla ya tiene el suyo.
- Textos legales: no se tocaron. `/terminos` («Límite de responsabilidad») dice que Oído no responde por «pagos acordados», que son entre comercio y trabajador; esto es coherente: Oído sólo registra y avisa.

**Queda abierto:** la reputación «pago a tiempo» del comercio NO cambia en este PR. Paso siguiente: decidir si «No cobré» (o «Sí, cobré» tardío) debe entrar en `on_time_payment_rate`, y qué hace la admin con los tickets de pagos.
