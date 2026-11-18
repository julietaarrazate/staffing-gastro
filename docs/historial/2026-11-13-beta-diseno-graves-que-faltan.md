# Beta, etapa 2: diseño de los graves que faltan

**Pedido:** Julieta, 2026-11-13: seguir la salida a beta arrancando por
diseñar los grupos sin empezar, y decirle qué hace falta de ella antes de
escribir código.

**Qué cambió:** sólo documentación.
[`planning/BETA_DISENO_GRAVES.md`](../planning/BETA_DISENO_GRAVES.md) tiene el
diseño de los 27 grupos (56 hallazgos graves y los 2 reportes externos que
quedaban): qué se cambia, en qué archivos, qué se prueba, en qué orden para
que dos PRs no toquen el mismo archivo a la vez, y quién lo hace. En el
[tablero](../planning/BETA_TABLERO.md) esas filas pasaron de «sin empezar» a
«diseñado», con su número de grupo, y se sumaron las decisiones 10 a 15.

**Por qué así:** el diseño de «pantallas al día» de la tanda anterior había
quedado en las notas de una conversación y se perdió con ella; ahora vive en
el repo y se borra grupo por grupo al mergear. Se leyó el código sólo donde el
diseño no era obvio (refresco del panel y la campanita, sesión, postulantes).
Decisiones de diseño que conviene no rediscutir:

- «Pantallas al día» se dispara con el aviso que ya llega por la campanita,
  no con una consulta periódica nueva: cada pedido despierta la base, que
  tiene cuota.
- Los cuatro hallazgos de sesión van en un solo PR: son el mismo archivo y la
  misma promesa.
- Quien rechaza, cancela o falta necesita un estado propio en la postulación
  (`desasignada` con motivo): hoy queda «aceptada» y nada lo distingue.

**Decisiones:** el mismo día Julieta aceptó las recomendaciones («sí a todo
lo que sea seguro y mejor para el sistema») y dio su criterio: cada decisión
tiene que servir para cubrir un puesto rápido. Quedaron tomadas las 1 a 6 y
las 10 a 15, y anotados en el tablero cinco pedidos de producto (búsqueda
distinta para urgentes y programados, base de trabajadores con referencias,
eventos sin bajas, seguro, cobro sin comisión).

**Queda abierto:** todo el código. Esperan a Julieta las decisiones 7, 8, 9,
16 y 17 (la 17 es la puntualidad: hoy hay 15 minutos de margen).
