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

**Queda abierto:** todo el código. Los grupos G4, G6, G11, G14 y G25 esperan
las decisiones 10 a 15; U080, U081 y U072 siguen esperando las 2, 3 y 4.
