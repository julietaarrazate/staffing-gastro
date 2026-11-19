# Test de llegada temprana: la salida se marca con el turno ya empezado

**Pedido:** el CI de `main` quedó en rojo al cerrar la tanda 2/3a de la salida
a beta (un test de 1.050), con los siete arreglos ya mergeados.

**Qué cambió:** sólo tests. `test_finish_with_early_checkin_counts_as_punctual`
(`backend/tests/test_attendance.py`, de #549) marcaba la llegada 24 minutos
antes del inicio y enseguida la salida. Desde #552 el servidor no deja marcar
la salida antes del inicio, así que el test recibía 400. Ahora, después de la
llegada, el test hace pasar 25 minutos (`correr_reloj_del_turno`, nuevo en
`backend/tests/_turno_empezado.py`: corre para atrás inicio, fin y llegada) y
recién ahí marca la salida: la llegada sigue quedando 24 minutos antes del
inicio y la puntualidad da 100 %. El test ahora afirma el resultado de la
llegada y de la salida (antes un rechazo pasaba de largo hasta el `finish`).

**Por qué así:** el comportamiento de la app es el que se quería (llegar antes
es puntual, y la salida es desde el inicio); lo que estaba mal era el test, que
describía un recorrido que la app ya no permite. Los dos PRs pasaron su CI por
separado: #549 se probó con `main` sin #552 y se mergearon con un minuto de
diferencia. No chocaban en el texto, chocaban en el significado.

**Queda abierto:**
- Antes de mergear varias ramas hermanas conviene correr la suite sobre todas
  juntas, no sólo mirar que no choquen en el texto (queda en la receta de
  `docs/reference/SESION_CLOUD.md`, en #554).
- Render publica cada commit de `main` sin esperar al CI: el commit con el
  test en rojo quedó en producción (el código era correcto).
