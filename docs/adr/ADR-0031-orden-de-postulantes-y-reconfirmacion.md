# ADR-0031 — El más adecuado que llega a tiempo: orden de los postulantes (P2) y reconfirmación (P3)

**Estado:** aceptado (Julieta, 2026-11-25) · **Fecha:** 2026-11-25 ·
**Origen:** mejoras P2 y P3 del [tablero de la beta](../planning/BETA_TABLERO.md)
(aprobadas el 2026-11-13), de
[`PROPUESTA_URGENTE_Y_PROGRAMADO.md`](../planning/PROPUESTA_URGENTE_Y_PROGRAMADO.md) §3 y §5.

## Principio

**Oído no compite por encontrar al trabajador que vive más cerca, sino a la
persona más adecuada que realmente puede cubrir el turno en el tiempo que el
comercio necesita.** (Julieta, 2026-11-25.)

La consecuencia es que hay **dos carriles**. En el **urgente** (lo marca el
comercio, o el turno empieza en menos de 6 horas) mandan estar libre ahora y
llegar a tiempo. En el **programado** mandan que la persona calce, y la
distancia sólo deja afuera a quien no puede llegar: no suma puntos. Siempre
hay primero **filtros obligatorios** y después un **orden**.

Este ADR fija el orden del carril programado (P2) y la reconfirmación (P3). El
carril urgente con «tomar con un toque» es P4 y lleva su propio ADR.

## Contexto

- **Postulantes** (la pestaña de Candidatos): hoy los ordena el frontend
  (`frontend/lib/applicants.ts`, `rankApplicants`). Van al final quienes ya
  tuvieron el turno y lo dejaron (ADR-0026). Después vienen quienes tienen
  turnos hechos en Oído, ordenados por calificación, puntualidad y cantidad de
  turnos. A igualdad, decide quién se postuló antes. La distancia ya no pesa,
  pero el orden **no sabe si la persona es favorita del local o ya trabajó
  ahí, ni si tiene ausencias o cancelaciones**, y cuenta los turnos sin mirar
  el puesto.
- **Recomendados** (a quién invitar, desde el backend):
  `matching/domain/scoring.py` suma la distancia al 30 % (`MatchWeights`),
  junto con la reputación al 25 % y la experiencia, la puntualidad y el
  cumplimiento al 15 % cada una. La experiencia son los años **declarados**
  por el trabajador.
- **Recordatorios de hoy:** al asignar, la persona confirma
  (`asignado → confirmado`). Antes del turno recibe el aviso «avisá que vas en
  camino» y, si no marca la llegada, el recordatorio de llegada. **Nadie le
  pregunta si sigue yendo entre que confirma y el día del turno**, que en un
  programado pueden ser días. La ausencia se descubre recién 15 minutos
  después del inicio, cuando ya es tarde para cubrirla bien.
- **El 12/12 nadie tiene historial.** Un orden que sólo premia el historial no
  ordena nada al principio, y además deja al fondo a quien recién llega.

## Decisión

### 1. Orden de los postulantes en turnos programados (P2)

**Filtros obligatorios.** No cambian. A los postulantes no se los filtra: se
postuló quien quiso. Quien ya tuvo este turno y lo dejó va siempre al final,
con su marca (ADR-0026). Los recomendados siguen pasando por los filtros de
hoy: tener el puesto, estar disponible y estar dentro del radio.

**Orden**, de mayor a menor peso. Cada criterio sólo desempata al anterior:

1. **Confianza del local:** es favorita del comercio o ya hizo un turno
   terminado en ese local.
2. **Sin faltas:** 0 ausencias en Oído. Quien tiene alguna ausencia baja,
   aunque tenga buena calificación.
3. **Experiencia comprobada en el puesto:** turnos terminados en Oído en
   **ese puesto**. Los años declarados no cuentan.
4. **Cumplimiento:** puntualidad real (P1, cuando exista; mientras tanto la
   de hoy) y pocas cancelaciones.
5. **Calificación** promedio, sólo con turnos que la respalden.
6. **Identidad verificada.**
7. **Orden de postulación.**

**Los nuevos tienen lugar.** Una persona sin turnos en Oído, **con identidad
verificada y sin ausencias** no queda escondida. Lleva el sello «Nuevo en
Oído · identidad verificada» y, entre quienes no tienen historial, va
primero. No hay cupos ni posiciones reservadas: el comercio ve por qué cada
uno está donde está.

**Dónde vive el orden:** se mueve al backend, a una función de dominio en
`matching`, para que el mismo orden sirva a la lista, al «Mejor candidato» y
a las invitaciones. La respuesta de postulantes suma cuatro datos que el
comercio ya puede ver en la ficha o que son suyos: `es_favorito`,
`trabajo_aca`, `turnos_en_el_puesto` e `identidad_verificada`. No se expone
ningún dato nuevo de la persona.

**Recomendados en turnos programados:** la distancia pasa a **filtro**
(dentro del radio) con peso 0. Su 30 % se reparte en experiencia comprobada
(+15) y cumplimiento (+15). En turnos urgentes, el puntaje de hoy no cambia
hasta P4.

### 2. Reconfirmación antes del turno (P3)

Sólo para turnos **confirmados**:

- **24 horas antes:** un aviso «¿Seguís yendo mañana a las 21:00 a Bar
  Lavalle?» con dos botones, «Sí, voy» y «No puedo». No se manda si el turno
  se confirmó con menos de 24 horas de anticipación.
- **3 horas antes:** el mismo aviso. No se manda si la persona confirmó o
  reconfirmó en las últimas 3 horas.
- **«Sí, voy»:** queda registrado y el comercio ve «Reconfirmó» en la fila
  del turno.
- **«No puedo»:** es la cancelación del trabajador de hoy (`worker_cancel`),
  con su motivo. El turno vuelve a buscar personal y avisa a los postulantes.
  Ver la pregunta abierta 1 sobre si cuenta igual.
- **Si no contesta**, 2 horas antes del inicio el comercio recibe un aviso:
  «Camila no reconfirmó el turno de hoy a las 21:00», con «Escribirle» y
  «Buscar reemplazo». **Oído no le saca el turno sola:** decide el comercio.
  «Buscar reemplazo» deja a Camila asignada hasta que el comercio elige a otra
  persona, así nunca hay un rato sin nadie.
- No contestar **no penaliza** ni baja la reputación. Sólo informa.

Va por los avisos que ya existen (push y la lista de avisos), sin canales
nuevos. Los horarios del scheduler se calculan con `now_art()`.

## Qué no cambia

- El carril urgente, la escalada a los 8 minutos y los avisos por tandas: eso
  es P4.
- Las penalidades de cancelación y de ausencia (ADR-0004 y ADR-0007).
- Quién ve qué: el orden usa datos que el comercio ya ve, o que son suyos (sus
  favoritos y sus turnos terminados).

## Decisiones de Julieta (2026-11-25)

1. **«No puedo» avisado con 24 horas o más antes del inicio** se registra
   como cancelación del trabajador, pero **sin el peso de cancelación
   tardía**. Así se premia avisar temprano en vez de faltar. Con menos de 24
   horas, incluida la reconfirmación de las 3 horas, cuenta como hoy.
2. **«No volver a mandarme a esta persona»:** después de la beta, en un ADR
   propio (qué ve cada lado y cómo se evita que se use para discriminar). No
   entra acá.
3. **Asesoría:** el código se hace ahora y la reconfirmación queda **apagada**
   (un ajuste de configuración, apagado por defecto) hasta que la asesoría
   apruebe el texto de los avisos. El orden de los postulantes (P2) no espera:
   se prende con el deploy.

## Consecuencias

- El comercio ve primero a quien mejor calza, también el día 1: los favoritos
  y los verificados ordenan aunque no haya historial.
- Una falta se conoce horas antes y no 15 minutos después del inicio.
- Más avisos al trabajador: dos por turno programado. Hoy no hay forma de
  apagar avisos por tipo; si molestan, se ve con datos de la beta.
- Hay que mantener el orden en un solo lugar (backend). El frontend deja de
  ordenar y muestra lo que llega.

## Cómo se prueba

- Dominio: el orden con casos de favorito, sin historial, verificado, con
  ausencia y con experiencia en otro puesto.
- Scheduler: la reconfirmación a 24 y 3 horas, sus excepciones (confirmado
  hace poco), «Sí, voy», «No puedo» y sin respuesta con el aviso al comercio.
  Fechas con `hoy_art()` y `now_art()`.
- e2e: la lista de Candidatos en ese orden, con el sello «Nuevo en Oído», y
  la fila del Panel con «Reconfirmó» o «No reconfirmó».

## Implementación de P2 (2026-11-26)

Lo que el ADR dejaba sin número, como quedó en el código:

- **Los postulantes de un turno urgente** conservan el orden de antes de P2
  (primero quien tiene turnos hechos; después calificación, puntualidad y
  cantidad), ahora también desde el backend. El carril se decide al pedir la
  lista: un programado pasa a urgente cuando le faltan menos de 6 horas.
- **Cumplimiento** = turnos hechos sobre hechos más cancelaciones, por la
  puntualidad. Se compara en tramos de 10 puntos, y la calificación en
  décimas: con el número entero, una diferencia mínima decidiría siempre y
  los criterios de abajo no desempatarían nunca. Sin compromisos vale 0,5.
- **Experiencia comprobada en los recomendados:** un factor nuevo (0,15),
  turnos terminados en ese puesto con tope de 10. Los años declarados
  conservan su 0,15.
- **Sello:** el backend manda `nuevo_verificado`; la pantalla no lo calcula.
- **No se tocó** a quién le llega el aviso «Turno cerca tuyo» al publicar un
  turno programado: sigue con el puntaje de siempre (con distancia).

## Implementación de P3 (2026-11-26)

Construida y **apagada** (`RECONFIRMACION_ENABLED`, por defecto `false`):
apagada no sale ningún aviso y «Sí, voy» no existe. **Actualización
2026-11-26:** que avisar con 24 horas o más no sume una cancelación vale
siempre, también con la reconfirmación apagada: los Términos dicen que pesa
cancelar «muy sobre la hora», y la app contaba cualquier cancelación. Lo que el ADR dejaba abierto, como quedó:

- **Los dos botones** no van en el aviso (los avisos de Oído no tienen
  botones): el aviso lleva a «Mis turnos», donde la tarjeta del turno
  pregunta «¿Seguís yendo a este turno?» con «Sí, voy» y «No puedo».
- **El margen de «No puedo».** El primer aviso sale justo a las 24 horas,
  así que nadie podría contestarlo «con 24 horas o más». Contestar «No puedo»
  dentro de las 3 horas de ese aviso cuenta como avisado con tiempo. El
  cartel de cancelar le dice a la persona si le cuenta o no.
- **El segundo aviso** no sale si confirmó o reconfirmó en las 3 horas
  anteriores a la hora del aviso (no a «ahora»: si no, el aviso salteado
  saldría un rato después).
- **El aviso al comercio** sale sólo si la persona no contestó **nunca**: si
  dijo «Sí, voy» al primer aviso y no contestó el segundo, no se alarma al
  comercio.
- **«Buscar reemplazo» no está.** Dejar a la persona asignada mientras el
  comercio elige a otra pide reasignar un turno confirmado, que hoy no
  existe. Va con la oferta directa a suplentes (ADR propio, junto con P4).
  El aviso al comercio lleva al turno, desde donde puede escribirle.

**Textos de los avisos** (actualizados el 2026-11-26 después de la consulta
legal: se pregunta por la disponibilidad, no se controla si la persona va a
cumplir; «reconfirmar» queda como nombre interno):

- A la persona, a las 24 y a las 3 horas: «¿Seguís disponible para este
  turno?» / «Mañana a las 21:00 en Bar Lavalle. Indicá si mantenés tu
  disponibilidad para que el comercio pueda organizarse.»
- En la tarjeta del turno: la misma pregunta, con «Sí, sigo disponible» y «Ya
  no estoy disponible». Al contestar que sí: «Tu disponibilidad quedó
  actualizada. El comercio ya puede ver tu respuesta.»
- Al cancelar con tiempo: «El comercio va a buscar a otra persona. Como
  avisás con tiempo, no suma a tus cancelaciones.»
- Al cancelar sobre la hora: «El comercio va a buscar a otra persona. Esta
  cancelación suma a las cancelaciones que los comercios ven en tu perfil.»
- Al comercio, a las 2 horas sin respuesta: «Todavía no hay respuesta de
  Camila» / «Aún no indicó si mantiene su disponibilidad para el turno de hoy
  a las 21:00. Podés escribirle o decidir cómo seguir.»
- En el Panel: «Camila confirmó que sigue disponible.» / «Camila todavía no
  respondió si sigue disponible.»
