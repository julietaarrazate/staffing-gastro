# Aviso «Cerró tu turno» y calificación definitiva (U018, U111)

**Pedido:** Julieta (2026-11-17). U018: al finalizar el turno, avisar al trabajador que ya puede calificar. U111: la calificación es definitiva y la pantalla lo dice antes de enviar.

**Qué cambió:**
- Aviso nuevo `shift_finished` (`NotificationType`): `ShiftService.finish` se lo manda al trabajador asignado, en la campanita y por push. Título «Cerró tu turno», texto «Calificá a <comercio> por el turno "<título>".». Abre `/my-shifts?turno=<id>`, que salta a «Asignados» y resalta el turno (#609). Push con la política por defecto de 24 h (`push_policy.py`, `DEFAULT_POLICY_TYPES`). Frontend: `lib/types.ts` y `lib/notification-link.ts`.
- `frontend/components/ReviewBox.tsx`: debajo del comentario, «Una vez enviada, la calificación no se puede cambiar ni borrar.», sin diálogo extra.
- Backend de reseñas: ya rechazaba la segunda (409) y no hay endpoint para editar ni borrar; el mensaje ahora dice que es definitiva. Test reforzado en `tests/test_review.py`.
- Docs: `reference/NOTIFICATIONS.md` (fila nueva) y `reference/REPUTATION.md` (unicidad y definitividad).

**Por qué así:** una línea fija junto al botón avisa antes de enviar sin sumar un paso; el aviso reutiliza `_notify_worker` con `link`.

**Queda abierto:** nada.
