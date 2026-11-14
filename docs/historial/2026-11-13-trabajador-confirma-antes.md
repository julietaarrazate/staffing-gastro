# El trabajador confirma antes de lo que no tiene vuelta atrás (#552)

**Pedido:** clave T2a de la revisión de la etapa 2 (hallazgos U004 y U005): un toque de más en «Rechazar», «Cancelar mi asignación» o «Me fui» actuaba sin preguntar, y dos toques en «Llegué» terminaban marcando también la salida.

**Qué cambió:**
- `frontend/app/my-shifts/page.tsx`: «Rechazar», «Cancelar mi asignación» y «Me fui» abren la confirmación (el mismo `Modal` que retirar una postulación) con la consecuencia en una línea. «Llegué»/«Marcar llegada» y la apertura de cada confirmación pasan por `useTapGuard`, así un toque sobre un botón recién aparecido no cuenta. Con el turno todavía sin empezar, «Me fui» no se ofrece: se ve «Llegada marcada · el turno empieza hoy a las 20:00».
- `frontend/lib/datetime.ts`: `formatShiftStartPhrase`.
- `backend/app/modules/shift/domain/entities.py`: `Shift.check_out` rechaza antes de `start_at` con el horario en hora argentina (`format_inicio_art`, nuevo en `backend/app/core/tz.py`).
- Tests: `backend/tests/test_checkout_antes_del_inicio.py`, `frontend/e2e/trabajador-confirma-antes.spec.ts`; el test de insignias de `test_no_show_and_late_cancellation.py` ahora usa un turno ya empezado.

**Por qué así:** el texto de cancelar dice que cuenta como cancelación porque `REPUTATION.md` (ADR-0004) la suma siempre que se cancela una asignación confirmada, y rechazar antes de confirmar no suma. No se inventó ninguna penalidad. La guarda del cliente es comodidad: la regla vive en el dominio.

**Queda abierto:** quien marcó la llegada temprano y tiene que irse antes del inicio no puede cancelar ni marcar salida hasta que el turno empieza (máximo 30 minutos); decidir si se permite cancelar desde «llegada marcada» es una decisión de producto. Además, los diálogos del comercio y el segundo toque sobre un diálogo que se está cerrando (`components/ui/Modal.tsx`) van en otro PR.
