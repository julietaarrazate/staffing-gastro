# LOCATION.md — Ubicación (dominio)

> Dónde está el turno y dónde está el trabajador. No es una entidad propia: es un
> **value object** compartido. Alimenta [MATCHING.md](./MATCHING.md#motor-de-recomendación-scoring)
> (distancia) y la búsqueda por mapa.

## Qué es

La ubicación es el dato que hace posible la promesa de Staffya: **cubrir cerca y
rápido**. Aparece en dos lados:

- **Turno:** dónde hay que ir a trabajar (dirección + barrio/ciudad +
  coordenadas del comercio).
- **Trabajador:** desde dónde se mueve (barrio/ciudad + coordenadas), para medir
  cercanía a los turnos.

No hay una tabla `Location`: es información **embebida** en el turno y en el
perfil (ciudad/barrio como texto + latitud/longitud opcionales).

## Forma del dato

- **Ciudad / barrio:** texto legible (AR/LATAM). En CABA se usa el **barrio**
  (Palermo, Recoleta, etc.) como unidad práctica de cercanía humana.
- **Coordenadas:** `lat` / `lng` opcionales. Cuando existen, habilitan el cálculo
  real de distancia; cuando faltan, «cerca» se decide por **ciudad** (ver abajo).

## Cómo se usa

- **Matching (Haversine).** El motor calcula la distancia entre trabajador y
  turno con la fórmula de Haversine y la pondera con el **mayor peso del score
  (0.30)**, con **radio máximo de 25 km**. Ver
  [MATCHING.md](./MATCHING.md#motor-de-recomendación-scoring).
- **Sin geolocalización en alguna punta:** si al trabajador o al turno le faltan
  coordenadas, la distancia **no penaliza ni premia** en el puntaje: aporta un
  valor neutral (0.5). Pero para entrar hace falta ser de la **misma ciudad**
  que el turno (comparada sin mayúsculas ni tildes): sin distancia y sin
  ciudad en común no se avisa ni se muestra.
- **Turno publicado sin zona** (ni coordenadas ni ciudad; la API lo acepta):
  se mide desde el **local del comercio**, en el aviso, en los recomendados y
  en el feed (`shift/domain/nearby.py::zone_of`,
  `shift/application/zones.py`). Es sólo para medir: el turno sigue sin
  ubicación propia en la tarjeta y en el mapa. Un turno que sí dice su ciudad
  se compara por esa ciudad, aunque el local quede en otra. Si el comercio
  tampoco tiene ubicación, no se le avisa a nadie y el turno sólo se ve en
  Buscar.
- **Feed del trabajador (Inicio y Mapa):** `GET /shifts/feed` devuelve sólo
  los turnos a **40 km** o menos de la **zona del perfil**; con el perfil sin
  coordenadas, los de su ciudad; sin zona, todos. Buscar (`scope=all`)
  muestra todo, ordenado por distancia. El filtro grueso es una caja de
  coordenadas en SQL (`app/core/geo.py::bounding_box`, sin PostGIS) y la
  distancia exacta se mide en Python (`shift/domain/nearby.py`). La
  ubicación del momento del dispositivo ("Estoy acá", el GPS del mapa) **no
  viaja al servidor**: la pantalla hace su propio corte desde ese punto
  (`frontend/lib/current-location.ts::nearbyOnly`), en el Inicio y en el
  Mapa. Quien está a más de 40 km de la zona de su perfil ve esas dos
  pantallas vacías, con el botón a Buscar.
- **"Disponible ahora" y el feed miran lugares distintos.** Mientras está
  prendido, el aviso «Turno cerca tuyo» y los recomendados miden desde esa
  posición (ADR-0014); el feed sigue midiendo desde la zona del perfil. Con
  "Disponible ahora" prendido lejos de la zona del perfil puede llegar el
  aviso de un turno que el Inicio no lista (el aviso abre el turno igual), y
  al revés. Unificarlo es una decisión de producto y de privacidad pendiente.
- **Búsqueda por mapa (comercio):** el comercio explora trabajadores sobre un
  mapa por rol y radio; el orden es por **cercanía simple** (sin el scoring
  ponderado). Ver [MATCHING.md](./MATCHING.md#búsqueda-por-mapa-comercio).

## Reglas de negocio

- La cercanía es **barrera dura** (desde el 2026-11-13; antes era sólo
  preferencia y un turno se le avisaba como «cerca tuyo» a alguien de otra
  provincia): fuera del radio no se avisa, no se recomienda y no se muestra
  en el Inicio ni en el Mapa. 25 km para el primer aviso y los recomendados,
  40 km para la escalada y para el feed. Adentro del radio sigue siendo el
  factor de mayor peso del puntaje (coherente con la meta de **< 10 minutos**).
- La ubicación del comercio es la del **turno** (dónde se trabaja), no
  necesariamente el domicilio legal.

## Fuera de alcance (hoy)

- **Ubicación en tiempo real** del trabajador (tracking en vivo camino al turno):
  futuro; hoy la ubicación es un dato relativamente estático del perfil/turno.
- **Geocodificación automática** de direcciones a coordenadas y validación de
  barrios contra un catálogo oficial: hoy se cargan como dato; formalizarlo sería
  una integración (fase de integraciones) y, si cambia el modelo, un **ADR**.
- **Zonas / polígonos** de cobertura: hoy sólo hay punto + radio.
