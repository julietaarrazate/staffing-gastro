# ADR-0014 — La distancia que ve el comercio: dónde está el trabajador, no dónde vive

**Estado:** propuesto · **Fecha:** 2026-09-16

> Este ADR se escribe **antes** de tocar una línea de código, a pedido de
> Julieta. Decide un modelo de privacidad, y eso no se decide mientras se
> programa.

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

## Pendiente de decidir (Julieta)

1. **Cuánto dura "Disponible ahora".** Propuesta: **4 horas**, o hasta que lo
   apague. Suficiente para un turno de noche, corto para no quedar prendido
   solo. Alternativa más conservadora: 2 h, igual que "va en camino".
2. **Si el pin desplazado va también para el admin.** El admin hoy ve el mapa
   en sólo lectura (#168). Mi recomendación: sí, mismo desplazamiento — el
   admin modera, no necesita domicilios.
3. **Si "Disponible ahora" debería además subir al trabajador en el ranking**,
   o sólo corregir la distancia. Recomiendo **sólo la distancia** en esta
   etapa: mezclar disponibilidad con reputación dentro del mismo puntaje es lo
   que el ADR-0012 ya advirtió que enturbia un ranking.
