# U081: un turno con la salida marcada no se cancela (#632)

**Pedido:** Julieta, salida a beta, etapa 2 (decisión 2 del tablero): «un
turno ya trabajado no se cancela. Con la salida marcada, el comercio finaliza
y paga; un problema va por soporte».

**Qué cambió:**

- Con la salida marcada, el menú del turno ya no ofrece «Cancelar turno». Si
  la persona marcó la salida mientras el comercio tenía el panel abierto, al
  tocar «Cancelar turno» el diálogo se cierra con «La persona ya marcó la
  salida: este turno se finaliza y se paga, no se cancela.»
- El servidor lo rechaza con 400 y un texto que dice qué hacer («Finalizalo y
  pagalo; si hubo un problema, escribinos desde Soporte»). No suma
  cancelación tardía ni avisa a nadie.
- «Cancelar el evento entero» saltea el puesto con la salida marcada.
- Técnico: `NOT_CANCELLABLE_STATUSES` y `Shift.is_cancellable`
  (`backend/app/modules/shift/domain/`), que usan `Shift.cancel()` y
  `ShiftService.cancel_event`; espejo en `frontend/lib/cancelar-turno.ts`
  (`isCancellable`). `components/ShiftActions.tsx` tenía su propia lista de
  estados y ahora usa esa función.

**Por qué así:** la regla va en el dominio, no en el caso de uso, para que
ningún otro camino (el evento, uno futuro) cancele un turno trabajado. Desde
la llegada (`check_in`, `trabajando`) se sigue pudiendo cancelar, con
cancelación tardía: hay casos reales y ya tienen su costo. Detalle en
[ADR-0007](../adr/ADR-0007-no-show-y-cancelacion-tardia.md), actualización
2026-11-18.

**Queda abierto:** nada de U081.
