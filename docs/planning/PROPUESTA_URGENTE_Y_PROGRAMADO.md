# Propuesta: dos carriles (urgente y programado), puntualidad real, eventos y captación

**Estado:** propuesta, nada decidido. Lo que se apruebe pasa a un ADR propio
antes del código. **Fecha:** 2026-11-13. **Pedido:** Julieta, como dueña:
«abrí todas las posibilidades y da las mejores soluciones».

Completa a [`PROPUESTA_COBERTURA_URGENTE.md`](./PROPUESTA_COBERTURA_URGENTE.md)
(2026-10-14), que ya desarrolla el carril urgente; acá no se repite.

## 1. La idea

Oído resuelve dos problemas distintos y hoy los trata igual:

| | Urgente | Programado |
|---|---|---|
| Qué es | Se cayó alguien: hace falta una persona ya | Un turno o un evento con fecha futura |
| Qué importa | Velocidad (como pedir un auto) | Que la persona calce (como contratar) |
| Quién decide | El primero que cumple y acepta | El comercio, con tiempo y una lista ordenada |
| Qué manda en el orden | Cercanía y estar disponible ahora | Experiencia y cumplimiento; la distancia sólo filtra |

**Qué es urgente:** lo marca el comercio, o el turno empieza en menos de 6
horas. Un programado que llega a 6 horas del inicio sin cubrir pasa solo al
carril urgente. (Hoy existe una sola escalada, a los 8 minutos de publicado.)

## 2. Carril urgente

Hoy cubrir depende de tres pasos de personas (postularse, que el comercio
elija, confirmar). Lo propuesto, en orden de impacto:

1. **Tomar el turno con un toque** (asigna y confirma a la vez; gana el
   primero). Sólo lo pueden tomar quienes cumplen: tienen el puesto, están
   libres en ese horario y tienen identidad verificada o turnos hechos en
   Oído sin ausencias. Durante los primeros 2 minutos lo ven sólo los
   favoritos del local y quienes ya trabajaron ahí.
2. **Avisos por tandas**, de cerca a lejos, con sugerencia de subir el pago
   si nadie toma (detalle en la otra propuesta, §3).
3. **«De guardia»:** el trabajador avisa con anticipación cuándo está para
   urgentes («hoy de 18 a 24»). Extiende «Disponible ahora», que dura 4 horas
   y hay que prenderlo en el momento. Quien está de guardia recibe primero.
4. **Aviso de respaldo por WhatsApp** a quien no abrió el aviso del celular
   (después de la beta: necesita WhatsApp Business).

## 3. Carril programado

Tres caminos posibles:

| Camino | A favor | En contra |
|---|---|---|
| A. Sólo postulación (hoy) | Simple, ya existe | Depende de quién vio el aviso; el orden pesa 30 % la distancia |
| B. Sólo búsqueda del comercio por fecha y horario | El comercio controla | Le da trabajo a quien no tiene tiempo; exige que todos carguen su agenda |
| **C. Mixto (recomendado)** | Las tres entradas llegan a una sola lista ordenada | Hay que construir la agenda |

**Camino C:**

- El trabajador **se postula** por su cuenta, como hoy.
- La app **invita** a postularse a quienes mejor calzan y figuran libres ese
  día.
- El comercio puede **buscar por fecha y horario** e invitar a alguien
  puntual (asignar a una persona ya existe: se reutiliza).
- **Orden de la lista para programados:** ① ya trabajó en ese local o es
  favorito ② experiencia comprobada en el puesto (turnos hechos en Oído y
  referencias verificadas, §6) ③ cumplimiento: sin ausencias, puntualidad,
  pocas bajas ④ calificación ⑤ a igualdad, quien se postuló antes. La
  distancia deja de sumar puntos: sólo deja afuera a quien no puede llegar.
- **Agenda de disponibilidad** del trabajador: días y franjas habituales, más
  fechas bloqueadas. Los turnos confirmados la ocupan solos. Hoy el perfil
  sólo tiene un «disponible sí/no».
- **Plazo para elegir:** recordatorio al comercio cuando hay postulantes; si
  a 6 horas del inicio no eligió, el turno pasa al carril urgente y los
  postulantes lo ven primero.
- **Reconfirmación:** 24 horas y 3 horas antes, «¿Seguís yendo?» con un
  toque. Quien no contesta dispara el aviso al comercio.

Primer paso barato: cambiar el orden de la lista (no necesita datos nuevos).
La agenda y la búsqueda por fecha son el paso grande.

## 4. Puntualidad real

Son dos cosas distintas y hoy están mezcladas:

- **Llegar a horario** es lo que le importa al local.
- **Marcar la llegada** es cómo se entera la app.

Hoy cuenta como puntual quien marca hasta 15 minutos después del inicio; el
único recordatorio sale 20 minutos después de empezado el turno.

Propuesta:

1. **Puntual es estar a la hora de inicio.** La llegada se puede marcar desde
   30 minutos antes, así que quien llega bien tiene tiempo de sobra. Queda un
   margen de 5 minutos sólo para el trámite de marcar (sacar el celular,
   señal), no para llegar tarde.
2. **Que nadie se olvide de marcar:** aviso 10 minutos antes («Cuando entres
   al local, marcá tu llegada»), otro a la hora de inicio y otro a los 5
   minutos. Con «Va en camino» prendido, cuando el celular llega al local la
   app ofrece marcar con un toque.
3. **El comercio tiene la última palabra.** A la hora de inicio, si la
   persona no marcó, le llega «Ana todavía no marcó la llegada» con dos
   botones: «Ya llegó» (a horario o tarde) y «No llegó». Así un olvido no se
   convierte en una ausencia, y una demora no se esconde.
4. **Reputación:** la puntualidad se calcula sobre la hora real. Quien no
   marca queda como tarde, salvo que el comercio diga que llegó a horario. El
   comercio ve la demora en minutos («llegó 8 min tarde»), no sólo un
   porcentaje.
5. **«No se presentó»** se puede marcar desde los 10 minutos, y el turno se
   reofrece como urgente (decisión 4 del tablero).

Cambia `docs/reference/REPUTATION.md` y el ADR-0008. Privacidad: marcar con
la ubicación de «Va en camino» necesita revisar su ADR antes.

## 5. Eventos sin bajas el día del evento

1. **Reconfirmación obligatoria** 24 y 3 horas antes. Quien no reconfirma a
   tiempo recibe un último aviso y después libera el puesto.
2. **Suplentes:** los postulantes no elegidos quedan en una lista ordenada.
   Ante una baja, el puesto se le ofrece al primero, para tomar con un toque.
3. **Sobrecupo opcional** en eventos grandes: un suplente cada diez puestos.
   El organizador decide si le paga por estar de guardia.
4. **La baja a último momento pesa más** en la reputación que una baja con
   días de aviso. Hoy toda baja de un turno confirmado cuenta igual.
5. **Tablero del evento:** quién reconfirmó, quién va en camino, quién llegó.

## 6. Muchos trabajadores con experiencia real

1. **Referencias verificadas.** El trabajador carga dónde trabajó y el
   contacto del encargado; al encargado le llega un link y contesta con un
   toque si trabajó ahí y si lo recomienda. Da el sello «Referencia de
   [local]» y, de paso, ese encargado conoce Oído.
2. **«Traé a tu equipo».** El comercio que entra invita a sus extras de
   siempre: llegan como favoritos y con la referencia de ese local. (Hoy
   existe el camino inverso: el trabajador invita a su comercio.)
3. **Base de respaldo, con permiso.** No se puede cargar gente a la base sin
   su consentimiento (ley de datos personales): la base se arma con altas
   propias. Canales: escuelas de gastronomía, bolsas de trabajo, grupos de
   extras. El admin tiene hoy captación de comercios (`/admin/leads`); falta
   la de trabajadores, con estado «invitado / se registró / completó perfil».
4. **Nivel «experiencia comprobada»:** con referencias o turnos hechos sin
   ausencias. Da prioridad en los urgentes y en el orden de los programados.

## 7. Lo que no decide ingeniería

- **Seguro y relación laboral.** Quién asegura a la persona es una consulta
  para la asesoría. Lo mismo vale para lo que exige esta propuesta
  (reconfirmar, estar de guardia, bajas que pesan más): conviene que la
  asesoría lo revise, porque cuánto control ejerce la plataforma puede pesar
  en cómo se lee la relación con el trabajador.
- **Cobro de la suscripción sin comisión.** Falta comparar con números de
  hoy un QR propio, la transferencia con alias y otras integraciones.

## 8. Orden sugerido

| # | Qué | Tamaño | Cuándo |
|---|---|---|---|
| 1 | Puntualidad real (§4, sin la marca por ubicación) | Chico | Antes de la beta |
| 2 | Orden de la lista para programados (§3) | Chico | Antes de la beta |
| 3 | Reconfirmación 24 h y 3 h (§3 y §5) | Mediano | Antes de la beta si entra |
| 4 | Tomar el urgente con un toque (§2) | Mediano | Primer cambio después de los graves |
| 5 | Referencias verificadas y «Traé a tu equipo» (§6) | Mediano | Con la beta andando |
| 6 | Agenda y búsqueda por fecha (§3) | Grande | Con la beta andando |
| 7 | Suplentes y sobrecupo de eventos (§5) | Grande | Cuando haya eventos reales |
