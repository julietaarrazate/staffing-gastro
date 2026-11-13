# Tanda 2/3a de la salida a beta: siete arreglos en `main` (#554)

**Pedido:** Julieta, salida a beta, etapa 2. Hacer la prueba en la app de #546
y #547 y después los cinco arreglos ya diseñados (U019, U079, U020, U004/U005
y U076/U077/U078).

**Qué cambió:** quedaron en `main` #546 (evento con zona), #547 (cerca es
cerca), #549 (llegar antes es puntual), #550 («No se presentó» recién 15
minutos después del inicio), #551 (sin reseñas no es «0,0»), #552 (el
trabajador confirma antes) y #553 (cancelar avisa). Cada uno tiene su entrada
en esta carpeta. Este PR sólo actualiza `docs/planning/BETA_TABLERO.md` (filas,
decisiones que esperan a Julieta con la recomendación de quien coordina, y lo
que salió de las pruebas y las revisiones sin hallazgo propio) y suma una
receta a `docs/reference/SESION_CLOUD.md`.

**Por qué así:**

- **El tablero se actualizó en un PR aparte y no en cada arreglo.** Las filas
  de la tanda son contiguas: cinco PRs editándolas habrían chocado entre sí.
- **Cada arreglo lo hizo un agente y lo revisó otro que intentó romperlo**;
  después se probó en la app real (`tools/e2e-local`, todavía en #527) con
  todas las ramas juntas. Las revisiones encontraron cosas que los tests del
  autor no veían: un mensaje que mandaba a una acción inexistente (#552), un
  texto de confirmación armado con datos viejos y un fallo de base al guardar
  avisos que rompía la respuesta (#553), un test que fallaba sólo en el orden
  de archivos de CI (#550).
- **Los que cambian una regla esperaron el "sí" de Julieta** (#547, #549,
  #550, #552, #553); #546 y #551 entraron con el permiso permanente.
- **Se mergearon de a uno.** Tres pares se pisaban en una o dos líneas
  (importaciones agregadas en el mismo lugar y dos constantes pegadas): al
  mergear el primero de cada par hubo que traerle `main` al otro y esperar su
  CI.

**Queda abierto:**

- Al mergear #549 y #552 con un minuto de diferencia `main` quedó en rojo por
  un test (el código estaba bien): se corrigió en #555 y la receta quedó en
  `docs/reference/SESION_CLOUD.md`.

- Las decisiones de Julieta y la lista de menores, en
  `docs/planning/BETA_TABLERO.md`.
- La sesión se cortó una vez por el cupo de uso con cuatro agentes a medias
  (se retomaron sin pérdida porque el trabajo estaba en disco y el estado en
  el tablero). Conviene no pasar de tres agentes a la vez.
- Siguiente tanda (sesión nueva): diseñar U006/U007/U008, U082/U089,
  U021/U123, «pantallas al día» (U013/U014/U016) y U080; y el reporte
  BK-7DCC7E4AB945.
