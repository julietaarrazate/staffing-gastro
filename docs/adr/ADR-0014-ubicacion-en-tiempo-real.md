# ADR-0014 — La distancia que ve el comercio: dónde está el trabajador, no dónde vive

**Estado:** aceptado e implementado · **Fecha:** 2026-09-16

> Este ADR se escribió **antes** de tocar una línea de código, a pedido de
> Julieta. Decide un modelo de privacidad, y eso no se decide mientras se
> programa. El fix de S4 (el pin exacto sobre el domicilio, `TECH_DEBT.md`)
> se implementó primero y por separado, porque no dependía de que este ADR
> se aprobara — "Disponible ahora" (abajo) construye arriba de ese mismo
> mecanismo (`fuzz_point`).

## Contexto

La misión del producto es **cubrir una posición eventual en menos de 10
minutos**. Todo el ranking de matching, el radio del mapa y el "a 1,6 km" que
lee el comercio se apoyan en una sola pregunta: *¿qué tan lejos está esta
persona?*

Hoy esa pregunta se contesta con el dato equivocado.

### Lo que hay de cada lado

**Del lado del trabajador, el modelo correcto ya existe.**
`frontend/lib/current-location.ts` distingue explícitamente "dónde vivís" de
"dónde estás ahora". Su comentario plantea el caso exacto:

> *El diseño anterior asumía que trabajás donde vivís […] vivís en Palermo,
> ahora estás en Retiro, y un turno en Retiro te queda "lejos" según el
> sistema.*

Se toma sólo cuando el trabajador la pide, vive lo que dura la pestaña
(`sessionStorage`) y **no pisa** la zona del perfil.

**Del lado del comercio, no existe.**
`matching/infrastructure/repositories.py` arma cada candidato con
`latitude=model.latitude, longitude=model.longitude` — los campos **del
perfil**. La distancia que decide a quién se le avisa, cómo se ordenan los
candidatos y qué ve el comercio en `/search` sale de la dirección guardada.

O sea: el trabajador puede decirle al sistema dónde está, y el sistema no se lo
cuenta a la única persona que necesita saberlo.

### Las dos formas en que esto falla

1. **El que está ahí y parece lejos.** Vive en Quilmes, ahora está a tres
   cuadras del local. El sistema lo ordena último o directamente lo deja fuera
   del radio. Un turno que se podía cubrir en 10 minutos no se cubre.
2. **El que está lejos y parece cerca.** Vive enfrente, hoy está a 40 km. El
   comercio lo contacta, espera, y recién ahí se entera. Se gastaron los
   minutos que el producto promete ahorrar.

El segundo es el más caro, porque **gasta la promesa central**: el comercio
aprende que el "a 1,6 km" de la app no quiere decir nada.

### Por qué el GPS mostraba Retiro

Reportado en la prueba en vivo del 2026-09-16: *"el GPS me muestra como si
estuviese en Retiro donde trabajo, y no donde estoy en este momento."*

`lib/geolocation.ts` pide la posición con `enableHighAccuracy: true` y
`timeout: 10_000`, sin `maximumAge`. En interiores, un fix de GPS de alta
precisión en 10 segundos falla seguido; cuando falla, la promesa se rechaza y
la pantalla cae a la ubicación del perfil — sin decirlo. El usuario ve un punto
en un lugar donde no está y no tiene forma de saber que es el dato viejo.

Son dos defectos distintos y conviene no mezclarlos: **que el fallback exista
es razonable; que sea mudo, no.**

### Un hallazgo que cambia el encuadre

Al auditar esto apareció algo que nadie había pedido revisar.
`components/WorkerSearchMap.tsx` dibuja cada trabajador disponible en
`worker.latitude` / `worker.longitude` **exactas**, sin desplazamiento ni
redondeo. Esas coordenadas vienen del perfil, y el perfil se carga en el
onboarding con `MapAddressPicker` — o sea que, para la mayoría, **son su
domicilio**.

Resultado: cualquier comercio con una cuenta activa ve hoy un pin sobre la casa
de personas que nunca trabajaron para él y que no aceptaron nada. Es un
problema de privacidad **mayor** que el que este ADR viene a resolver, y vive
en el código desde antes.

## Decisión

### 1. La distancia se mide desde "acá estoy ahora" cuando el trabajador lo prendió, y desde el perfil cuando no

Se agrega un estado explícito del trabajador —**"Disponible ahora"**— que
captura **una** posición y la deja vigente por una ventana corta.

Mientras está vigente, el matching y la búsqueda del comercio miden desde ahí.
Cuando vence, se vuelve solo a la zona del perfil. **Nunca hay un estado en el
que el sistema use una posición que el trabajador no prendió.**

### 2. El modelo de privacidad es **el mismo** que el de "va en camino", no uno nuevo

El ADR de "va en camino" (#320/#321) ya resolvió este problema una vez, y su
modelo se reusa tal cual:

| | "Va en camino" (existe) | "Disponible ahora" (este ADR) |
|---|---|---|
| Quién lo prende | El trabajador | El trabajador |
| Arranca solo | Nunca | Nunca |
| Qué se guarda | Sólo la última posición | Sólo la última posición |
| Recorrido | **Nunca** | **Nunca** |
| Ventana | 2 h antes del turno | TTL corto desde que se prende |
| Se borra | Al llegar y en las 4 transiciones que desasignan | Al vencer el TTL, al apagarlo y al cerrar sesión |
| Quién lo ve | El comercio de **ese** turno | Ver punto 3 |

Reusarlo no es pereza: es que el usuario tenga **un solo** modelo mental de qué
pasa con su ubicación en esta app, en vez de dos parecidos con reglas distintas.
Los guards van en el **dominio**, como en `Shift.report_en_route_location`, no
en la UI.

### 3. El comercio ve **qué tan lejos**, no **dónde** — y eso corrige también el bug viejo

Quien no tiene un turno asignado con vos no ve tu punto. Ve:

- una **distancia** ("a ~1,5 km"), y
- su **frescura** ("actualizado hace 6 min" / "zona del perfil").

El pin exacto en el mapa del comercio se reemplaza por una posición
**desplazada dentro de la zona**, con una precisión que alcanza para decidir a
quién contactar y no alcanza para ir a golpear una puerta.

Esto arregla de paso el hallazgo de arriba: **deja de haber un pin sobre la
casa de nadie**, esté prendido "Disponible ahora" o no.

La frescura se muestra siempre, incluso en el caso viejo. Un "a 1,6 km" sin
fecha es la clase de número que hace tomar decisiones mal.

### 4. El fallback del GPS deja de ser mudo

Cuando `getCurrentPosition` falla o vence el timeout y la pantalla cae a la
ubicación del perfil, se dice: *"No pudimos ubicarte ahora — te estamos
mostrando tu zona guardada"*, con la acción para reintentar. Además se sube el
`timeout` y se permite `maximumAge` corto, para que un fix reciente del sistema
cuente en vez de forzar uno nuevo que adentro de un local no va a llegar.

## Alternativas descartadas

**Seguimiento en segundo plano.** Descartado y ya estaba descartado: gasta
batería, exige un permiso que mucha gente niega, en una PWA no corre con la app
cerrada, y sobre todo es vigilancia de alguien que todavía no está trabajando.
Este producto le pide a la gente el DNI y una selfie; el saldo de confianza no
da para además saber dónde están todo el día.

**Usar el GPS en silencio, sin estado explícito.** Técnicamente sale más
barato y es el peor de todos: nadie entiende por qué la app sabe dónde está, y
el día que se entiende, se desinstala.

**No hacer nada.** Sostenible sólo si aceptamos que "cerca" significa "vive
cerca". Para un marketplace de eventuales en tiempo real, no lo es. Pero además
no es neutro: deja en pie el pin sobre el domicilio, que es un problema hoy,
independientemente de esta decisión.

**Mostrar el punto exacto del trabajador al comercio.** Contesta la pregunta
con más precisión de la que hace falta y expone a la parte con menos poder de
la relación. El comercio necesita decidir a quién llamar, no saber dónde está
parada una persona.

## Consecuencias

**A favor**
- El "a 1,6 km" pasa a querer decir algo, y con eso la promesa de los 10
  minutos se apoya en un número real.
- El trabajador que se movió deja de perder turnos que podía cubrir.
- Desaparece el pin sobre el domicilio, que hoy es una exposición real.
- Un solo modelo de ubicación en toda la app.

**En contra, y hay que decirlo**
- Es una función que **hay que prender**, así que al principio la va a usar
  poca gente y la mejora se va a notar despacio.
- Dos fuentes de distancia (vigente / perfil) es más complejidad en el
  matching y en los tests que una sola.
- Desplazar el pin le saca precisión a una pantalla que hoy se ve prolija. Es
  un costo aceptado a cambio de no publicar domicilios.

**Obligaciones si esto se aprueba**
- `/privacidad` se actualiza **en el mismo PR**, igual que con "va en camino".
- Los guards (ventana, TTL, quién puede leer qué) van en el dominio, con tests
  del caso de uso, no en el componente de React.
- El desplazamiento del pin y el borrado al vencer necesitan test propio: son
  justamente lo que nadie va a mirar a ojo cuando se rompa.

## Decidido (Julieta, 2026-09-16)

1. **Cuánto dura "Disponible ahora": 4 horas** (`AVAILABLE_NOW_TTL`,
   `worker/domain/entities.py`) desde que se prende, o hasta apagarlo a mano.
   Razón: alcanza para una sesión de búsqueda real (el trabajador todavía no
   tiene turno, no es un trayecto puntual como "va en camino") sin acercarse
   a quedar prendido "todo el día" por olvido.
2. **El pin desplazado va también para el admin: sí, sin excepción.** Mismo
   endpoint (`/matching/search`) que usa el comercio — el admin no tiene
   ningún vínculo operativo con el trabajador que justifique ver más.
3. **"Disponible ahora" sólo corrige la distancia, nunca sube el ranking.**
   `scoring.py` no se tocó: la posición vigente reemplaza a la del perfil
   como INPUT del mismo cálculo de distancia que ya existía, con el mismo
   peso (0.30) — no es una señal nueva en la fórmula.

## Implementación (resumen — detalle completo en el PR)

- **Dominio** (`worker/domain/entities.py`): `WorkerProfile.go_available_now`/
  `stop_available_now`/`is_available_now`, tres columnas nuevas
  (`available_now_latitude/longitude/until`, migración `0032`).
- **Resolución de posición, un solo lugar**
  (`matching/infrastructure/repositories.py::_resolve_position`): mientras
  está vigente, la posición de "Disponible ahora" reemplaza a la del perfil
  para TODO lo que mida distancia — el mapa (`search_workers`) y el matching
  de un turno (`get_top_candidates`) comparten esta resolución, así que
  ninguno de los dos tuvo que aprender que existen dos fuentes posibles.
- **Scheduler:** cuarto chequeo (`run_available_now_cleanup`) que borra la
  posición vencida — minimización de datos, no una regla de negocio (
  `is_available_now` ya trata como apagado a quien venció).
- **Frontend:** `AvailableNowToggle` (trabajador, en `/profile`) y la señal
  "Disponible ahora · hace X min" en `/search` (lista + punto verde en el
  marcador del mapa), sólo cuando está vigente — su ausencia ya es "zona del
  perfil", no hace falta decirlo aparte.
- **No implementado a propósito:** apagarlo al cerrar sesión (tercera vía de
  borrado mencionada en la tabla del punto 2 de la Decisión). El TTL de 4h y
  el apagado manual ya acotan la exposición; tocar `IdentityService.logout`
  —módulo más sensible del repo— para un caso marginal (cerrar sesión sin
  apagarlo a mano, dentro de esas 4h) no valía el riesgo. Si se retoma,
  componer en la capa API de `identity/api/routes.py::logout` (mismo patrón
  que `matching` compone con `verification`), nunca acoplar los dominios.

## Actualización 2026-11-18 (U072, decisiones 3 y 1 del tablero de la beta)

**«Va en camino» se apaga al instante también para el comercio.** La tabla
del punto 2 decía que la posición de «va en camino» se borra «al llegar y en
las 4 transiciones que desasignan». Faltaba el caso más obvio: que la persona
lo apague. «Dejar de compartir» sólo dejaba de mandar posiciones nuevas; la
última quedaba guardada y el comercio la seguía viendo, con su hora, hasta la
llegada (hallazgo U072 de la prueba de punta a punta). El texto de la app
decía «podés cortarlo cuando quieras», y eso no era del todo cierto.

Desde ahora:

- **Apagar borra.** `DELETE /shifts/{id}/en-route` (`Shift.stop_en_route`)
  borra la última posición en el momento. El comercio vuelve a ver el turno
  «Confirmado», sin mapa; su panel lo refleja en el próximo refresco (cada 30
  segundos mientras hay un viaje). Un turno en `EN_CAMINO` por el paso viejo
  `depart` (ADR-0008) vuelve a `CONFIRMADO`. Apagar dos veces no es un error.
- **Sin aviso al comercio.** «Dejó de compartir» no le pide hacer nada.
- **Volver a prender no repite «salió para tu local».** Ese aviso se
  controlaba mirando si ya había una posición guardada; como ahora la
  posición se puede borrar a mitad del viaje, el aviso tiene su propia marca
  (`Shift.en_route_announced_at`, migración 0052), que dura lo que el viaje.
- **Sólo se da por borrada cuando el servidor lo confirma.** Si el pedido no
  sale (sin red, el servidor ocupado, un choque con otra escritura), la app
  lo reintenta sola unas veces y, si no puede, lo dice: «No pudimos borrar tu
  última ubicación: el comercio todavía la ve». La persona no se queda
  creyendo que ya no la ven.
- **Apagar gana las carreras** (las encontró la revisión independiente antes
  del merge). El reporte periódico que ya estaba en la red termina antes de
  que salga el borrado, y uno que todavía esperaba el GPS ya no se manda: si
  no, llegaba después del borrado y volvía a guardar la posición sin que
  nadie lo supiera. En el servidor, si el apagado choca con un reporte
  (control de versión del turno), se repite en vez de responder 409.
- **El recordatorio «avisá cuando salgas»** mira si ya se le avisó al
  comercio (`en_route_announced_at`), no si hay una posición guardada: a
  quien salió y apagó no se le recuerda nada.
- **Salir de la pantalla sin apagar** sigue como antes: deja de mandar, y la
  última posición queda con su hora hasta la llegada. Lo nuevo es que al
  volver la tarjeta lo dice («el comercio todavía ve tu última ubicación») y
  ofrece «Borrar mi última ubicación».

La fila «Se borra» de «va en camino» queda: **al apagarlo, al llegar y en
las transiciones que desasignan**. Con eso los dos mecanismos («va en
camino» y «Disponible ahora») se apagan igual, que era la idea del punto 2.

**Texto de `/privacidad`** (versión `2026-11-18-1`): dice que al apagarlo se
borra la posición y el comercio deja de verla (sin prometer «en el momento»:
sin conexión el borrado no puede salir, y la app lo avisa), corrige «hasta dos
horas antes» por «desde dos horas antes» (la ventana se abre dos horas antes
del turno; el texto anterior decía lo contrario de lo que hace la app), y
suma la decisión 1: el identificador del dispositivo para los avisos se
borra también al cerrar sesión en ese dispositivo (la app ya lo hace:
`releasePushFromAccount` al cerrar la sesión, `frontend/lib/auth-context.tsx`).

Lo que el texto no cubre, a propósito: el aviso «salió para tu local» que
ya recibió el comercio dice a qué distancia estaba la persona en ese momento,
y ese texto no se borra (es un aviso ya entregado, con la distancia y no el
punto). Y el identificador del dispositivo se da de baja al cerrar sesión con
un solo pedido: si falla (sin conexión), el dispositivo pasa a la próxima
cuenta que ingrese ahí; no se da de baja cuando la sesión vence sola.

Descartado: borrar la posición también al salir de la pantalla. El comercio
perdería de vista a quien sólo abrió el chat para avisar que llega, y la
decisión 3 habla de cuando la persona lo apaga.
