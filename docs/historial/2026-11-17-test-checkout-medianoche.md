# Test de salida antes del inicio: no fallar cerca de la medianoche

**Pedido:** salió en el CI de #596 (2026-11-17, 23:56 de Argentina).

**Qué cambió:** `backend/tests/test_checkout_antes_del_inicio.py` arma un
turno que empieza en 20 minutos y esperaba «el turno empieza hoy a las» o
«el turno empieza el». Entre las 23:40 y las 00:00 de Argentina el turno cae
mañana y el backend dice, bien, «el turno empieza mañana a las 00:06»: el
test fallaba en cualquier PR que corriera a esa hora. Ahora acepta también
«mañana a las». El código de producto no cambia.

**Por qué así:** el mensaje del backend es correcto; el test no contemplaba
el cruce de día.

**Queda abierto:** nada.
