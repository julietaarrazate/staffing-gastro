# ADR-0015 — Turno "no cubierto": qué pasa cuando el tiempo se agota

**Estado:** aceptado · **Fecha:** 2026-09-16

## Contexto

Julieta, probando la app real: *"veo que quedan puestos abiertos cuando ya
pasó la fecha, debería pasar algo con eso cuando ya la fecha pasa o la hora
se acerca"*. Con una captura concreta: un turno del 14/8 seguía el 16/9
mostrando "Paso 2 de 4: Aceptado" en el perfil del trabajador.

El diagnóstico fue más preciso que el síntoma, y encontró dos huecos
distintos.

### Hueco 1 — un turno asignado que nadie confirma queda invisible para siempre

Cuando el comercio asigna el turno a un candidato, pasa a `ASIGNADO`. Desde
ahí el trabajador tiene dos caminos: `confirm()` (→ `CONFIRMADO`) o
`reject()` (→ vuelve a `BUSCANDO_PERSONAL`). **Si no hace ninguno de los
dos, el turno queda en `ASIGNADO` para siempre.**

El scheduler ya tenía dos chequeos (ADR-0008), y ninguno lo mira:

- **Asistencia** vigila `CONFIRMADO`/`EN_CAMINO` — un turno que nunca llegó
  a confirmarse no entra ahí.
- **Escalada de urgencia** vigila `PUBLICADO`/`BUSCANDO_PERSONAL` — un turno
  ya asignado tampoco entra ahí.

`ASIGNADO` sin confirmar es, literalmente, el único estado no terminal que
ningún proceso automático del sistema recorre. Es exactamente el caso de la
captura de Julieta.

### Hueco 2 — un turno publicado que nadie tomó sigue "disponible" después de su hora

`ShiftRepository.list_open()` (lo que arma el feed/mapa del trabajador)
filtra por estado pero nunca por `start_at`. Un turno `PUBLICADO` de hace un
mes, que nunca se cubrió, sigue apareciendo como si alguien pudiera
postularse y llegar a tiempo.

## Decisión

### 1. Estado nuevo: `NO_CUBIERTO`

Terminal, alcanzable automáticamente desde `PUBLICADO`, `BUSCANDO_PERSONAL`
o `ASIGNADO` cuando pasa un período de gracia después de `start_at` sin que
el turno llegue a `CONFIRMADO`. El nombre es sugerencia de Julieta —mejor
que la alternativa considerada ("vencido"): conecta directo con la misión
del producto, "cubrir una posición eventual en menos de 10 minutos"
(`PRODUCT.md`). Un turno `NO_CUBIERTO` es, en una palabra, el fracaso de esa
misión para ese turno puntual — y decirlo así, en vez de "vencido" (que sólo
habla del reloj), es más útil para el comercio que lo lee.

**Por qué es un estado nuevo y no una reutilización de `CANCELADO`:** nadie
decide esto — no hay comercio ni trabajador detrás, es el sistema
constatando que el tiempo se agotó. Etiquetarlo como "Cancelado" en la
pantalla del comercio o del trabajador sugeriría que alguien tomó una
decisión activa, que es falso y confunde sobre a quién reclamarle.

**Por qué es terminal y no reabre** (a diferencia de `no_show()`/
`worker_cancel()`, que sí reabren a `BUSCANDO_PERSONAL`): para cuando se
dispara, `start_at` + el período de gracia ya quedaron atrás. No hay más
ventana en la que alguien pueda llegar a cubrirlo — reabrirlo a
`BUSCANDO_PERSONAL` lo pondría de nuevo en el feed como si alguien pudiera
postularse a algo cuyo horario ya pasó (exactamente el Hueco 2, aplicado a
un turno que ya se resolvió).

### 2. Sin impacto de reputación

Decisión explícita de Julieta. Un trabajador asignado que nunca confirmó
**no llegó a comprometerse** — no es lo mismo que faltar a un turno que sí
aceptó (`no_show()`, que sí penaliza). Automatizar un castigo sobre una
ambigüedad (¿no vio la notificación a tiempo? ¿se arrepintió? ¿un bug se lo
impidió?) sin que una persona lo revise es más riesgo que beneficio.

`mark_not_covered()` sólo notifica al **comercio** ("un turno quedó sin
cubrir, podés publicarlo de nuevo"). Al trabajador no se le manda nada: no
hay ninguna acción que pueda tomar con esa noticia, el momento ya pasó.

### 3. La ventana de gracia depende de `urgent`

Segunda decisión explícita de Julieta: *"si la fecha tiene margen para
cubrir el turno se puede esperar, si es para algo inmediato tiene que
resolverse en función de tiempo"*.

Se traduce al campo `urgent` que el sistema **ya tiene** —lo pone el
comercio al publicar, o el propio scheduler de escalada a los 8 minutos sin
cubrirse— en vez de inventar un cálculo nuevo de "cuánto margen tenía este
turno":

| | Ventana después de `start_at` |
|---|---|
| Turno urgente | `NOT_COVERED_GRACE_URGENT` = 30 min |
| Turno normal | `NOT_COVERED_GRACE_NORMAL` = 2 h (mismo valor que `NO_SHOW_GRACE_PERIOD`, no es casualidad: es el margen que el resto del sistema ya considera razonable para una confirmación demorada) |

### 4. `list_open()` deja de ofrecer algo cuyo horario ya pasó

Fix independiente del punto 1-3, y necesario incluso con el scheduler
funcionando: mientras un turno está **dentro** de su período de gracia,
sigue en `PUBLICADO`/`BUSCANDO_PERSONAL` — y sin este fix seguiría
apareciendo en el feed como si alguien pudiera postularse a algo cuyo
horario ya pasó.

Filtro `ShiftModel.start_at > func.now()` **en SQL**, no en Python. El resto
del repo compara fechas en Python (`_naive`, ver `domain/repositories.py`)
para los chequeos del scheduler, que traen todas las filas sin paginar y
deciden después — evita el mismatch naive/aware entre SQLite (tests) y
Postgres (producción). Acá no se puede: `list_open` pagina con
`LIMIT`/`OFFSET`, así que el filtro tiene que ir en el `WHERE` para que la
página sea correcta. Dejar que cada motor calcule su propio "ahora" con
`func.now()` evita el mismo mismatch sin sacrificar la paginación —
verificado empíricamente contra SQLite antes de confiar en el enfoque.

## Alternativas descartadas

**Reabrir a `BUSCANDO_PERSONAL`, como `no_show()`.** Ya explicado en el
punto 1: tiene sentido para un no-show (todavía puede haber margen para
cubrir con otra persona antes/durante el turno), no para algo cuyo horario
ya pasó del todo.

**Penalizar como no-show.** Descartado explícitamente por Julieta: la
ambigüedad de "nunca confirmó" no es lo mismo que "confirmó y no apareció".

**Una ventana de gracia fija para todos los turnos.** Julieta pidió
explícitamente que dependiera de la inmediatez del turno. Se usó `urgent`
(señal ya existente) en vez de calcular un "lead time" nuevo
(`start_at - published_at`), por simplicidad: el comercio ya declara
explícitamente cuándo algo es inmediato, no hace falta inferirlo.

## Consecuencias

**A favor**
- Cierra el punto ciego real: `ASIGNADO` sin confirmar deja de ser
  invisible para todo el sistema.
- El feed dice la verdad: nada de lo que se puede tocar ahí tiene el
  horario ya vencido.
- El comercio se entera y puede volver a publicar, en vez de tener un
  turno colgado sin saber que nunca se cubrió.

**En contra**
- Un estado terminal más para mapear en cada lugar que lista `ShiftStatus`
  (backend: dominio, servicio, dos repos; frontend: tipos, `ShiftCard`,
  `ShiftLifecycleStepper`, familias del panel). Aceptado: la alternativa
  (forzarlo dentro de `CANCELADO`) mentiría sobre quién decidió qué.
- Un tercer job en el scheduler, con su propia ventana de gracia — más
  superficie para razonar al tocar el ciclo de vida del turno en el futuro.

**Efecto colateral encontrado al validar:** 13 archivos de test comparten
una fecha fija (`"2026-06-28T20:00:00"`) que ya quedó en el pasado por el
simple paso del tiempo real. El fix del punto 4 hizo que 9 tests en 2
archivos, que asumían ver esos turnos en el feed sin importar cuándo
corriera el test, empezaran a fallar.

Corregidos esos 2, en dos vueltas: la primera puso la fecha 30 días en el
futuro ("bien lejos, no puede fallar") y rompió otros 2 tests distintos —
`Shift.check_in()` rechaza un check-in más de `EARLY_CHECKIN_WINDOW`
(30 min) antes de `start_at`, y esos tests confirman y marcan llegada casi
en el mismo instante. Con la fecha vieja (ya en el pasado) ese guard nunca
se disparaba, así que el problema estaba oculto. Quedó en **15 minutos**:
sigue siendo "futuro" para `list_open` y cabe cómodo en cualquier ventana de
30 minutos del dominio. Detalle completo en `docs/BUGS.md`.

Los otros 10 archivos quedan documentados como deuda técnica (`TECH_DEBT.md`,
T-DATE) — misma bomba, todavía sin estallar porque nada más los mira por
fecha.
