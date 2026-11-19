# Tests de «Cerrar turno»: un «ahora» fijo en vez del reloj real

**Pedido:** Julieta, 2026-11-19. `test_la_salida_no_se_marca_antes_del_inicio` (llegó con #655) armaba un turno que empezaba en 20 minutos con el reloj real y esperaba «el turno empieza hoy»: fallaba si la suite corría entre las 23:40 y las 00:00 de Argentina (le pasó a #514).

**Qué cambió:** sólo tests y docs, nada de la app.
- `backend/tests/test_cerrar_turno_admin.py`: los tests de dominio usan `_AHORA` fijo (15:00 del 19/11 en Argentina) y `_turno()` arma el inicio desde ese instante (antes, `_AHORA` se calculaba al importar el archivo y `_turno()` volvía a leer el reloj al correr cada test, así que entre los dos podía haber minutos de diferencia en una suite larga). Test nuevo `test_antes_del_inicio_cerca_de_medianoche_dice_manana`: a las 23:50, un turno de las 00:10 «empieza mañana a las 00:10». Se corrigió un comentario que decía que el aviso al comercio lleva el día (lleva la hora sola).
- `docs/BUGS.md`: el caso inverso de «fecha futura hardcodeada»: cuando el test mira el día, ni fijo ni relativo a ciegas.

**Por qué así:** `Shift.admin_close_plan` recibe `now` por parámetro, así que el test de dominio no necesita el reloj. Se comprobó con el reloj simulado a las 23:45 de Argentina (`time-machine`, sólo local, no se agregó al proyecto): la versión vieja falla con «empieza mañana a las 00:05» y la nueva pasa. El resto del archivo se revisó: los tests de API usan el reloj real pero comparan intervalos (`empezar_turno`, `correr_reloj_del_turno`) o el prefijo del mensaje sin el día, y el aviso al comercio sale de la hora guardada en el turno.

**Queda abierto:** nada.
