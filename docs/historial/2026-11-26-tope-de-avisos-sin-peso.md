# Tope a las cancelaciones con aviso que no pesan (#752)

**Antes:** avisar con 24 horas o más que no se va a un turno confirmado no
sumaba una cancelación, sin límite. Alguien podía confirmar y soltar turnos
todo el tiempo sin ningún costo.

**Después:** eso vale dos veces por período de 30 días. Desde el tercer aviso
dentro del período, la cancelación suma como cualquier otra. El período
arranca con el primer aviso y se renueva solo. El cartel de cancelar avisa
antes de confirmar si esa vez suma, y dice «Vale dos veces cada 30 días».

**Cómo:** regla pura en `backend/app/modules/worker/domain/avisos.py`;
columnas `notice_window_started_at` y `notice_cancellations_used` en
`worker_profiles` (migración 0065); `WorkerProfileRepository.use_notice_allowance`;
`ShiftService.worker_cancel` lo gasta y `ShiftService.notice_allowance_left`
se lo dice a la API (`for_worker(..., queda_aviso=)` en el detalle y en
`/shifts/mine`). Decisión de Julieta (2026-11-26); el número lo propuso la
sesión. ADR-0031, sección «Tope a los avisos que no pesan».

**Pruebas:** `backend/tests/test_tope_de_avisos.py` (7).
