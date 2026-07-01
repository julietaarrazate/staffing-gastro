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
  real de distancia; cuando faltan, la distancia puntúa **neutral** (ver abajo).

## Cómo se usa

- **Matching (Haversine).** El motor calcula la distancia entre trabajador y
  turno con la fórmula de Haversine y la pondera con el **mayor peso del score
  (0.30)**, con **radio máximo de 25 km**. Ver
  [MATCHING.md](./MATCHING.md#motor-de-recomendación-scoring).
- **Sin geolocalización en alguna punta:** si al trabajador o al turno le faltan
  coordenadas, la distancia **no penaliza ni premia**: aporta un valor neutral
  (0.5). El match sigue funcionando por reputación/experiencia.
- **Búsqueda por mapa (comercio):** el comercio explora trabajadores sobre un
  mapa por rol y radio; el orden es por **cercanía simple** (sin el scoring
  ponderado). Ver [MATCHING.md](./MATCHING.md#búsqueda-por-mapa-comercio).

## Reglas de negocio

- La cercanía es **preferencia, no barrera dura**: fuera del radio máximo un
  candidato deja de recomendarse por distancia, pero el producto prioriza cubrir
  con gente cerca (coherente con la meta de **< 10 minutos**).
- La ubicación del comercio es la del **turno** (dónde se trabaja), no
  necesariamente el domicilio legal.

## Fuera de alcance (hoy)

- **Ubicación en tiempo real** del trabajador (tracking en vivo camino al turno):
  futuro; hoy la ubicación es un dato relativamente estático del perfil/turno.
- **Geocodificación automática** de direcciones a coordenadas y validación de
  barrios contra un catálogo oficial: hoy se cargan como dato; formalizarlo sería
  una integración (fase de integraciones) y, si cambia el modelo, un **ADR**.
- **Zonas / polígonos** de cobertura: hoy sólo hay punto + radio.
