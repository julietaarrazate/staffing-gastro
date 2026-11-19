# El resumen de ganancias suma todos los turnos, sin tope

**Pedido:** reporte externo de la beta (BK-ACA2748DAFE3). El resumen de
ganancias del perfil del trabajador dice sumar todos los turnos, pero
pasados 500 registros dejaba afuera los más viejos, sin aviso.

**Qué cambió:** el total ganado, la cantidad de turnos completados y lo
ganado en el mes ahora cuentan siempre todos los turnos, sin importar cuántos
tenga la persona. Para quien tiene pocos turnos el resultado es idéntico al
de antes.

- `backend/app/modules/shift/domain/repositories.py`: método nuevo del puerto
  `ShiftRepository.sum_worker_earnings` y su resultado `WorkerEarningsTotals`.
- `backend/app/modules/shift/infrastructure/repositories.py`: la suma corre
  en la base (`SUM`/`COUNT` con `CASE` para el mes), sin traer filas.
- `backend/app/modules/worker/application/services.py`:
  `get_my_earnings_summary` calcula el mes calendario argentino con
  `now_art()` (día 1 00:00 inclusive a día 1 del mes siguiente, exclusive) y
  se lo pasa a la consulta; se quitó `_EARNINGS_LOOKUP_LIMIT`.
- Tests en `backend/tests/test_worker_earnings.py`: más de 500 turnos
  ganados (insertados directo, 520), turnos de otro trabajador y de estados
  no ganados, y el corte de mes en hora argentina (23:30 del último día
  cuenta en su mes aunque en UTC sea el siguiente).

**Por qué así:** "turno ganado" sigue siendo FINALIZADO o PAGADO. Se eligió
un agregado en SQL, y no subir el tope, porque cualquier tope vuelve a fallar
en silencio. `list_by_worker` queda como estaba para sus otros usos. Sin
migración: no se tocan columnas.

**Queda abierto:** nada.
