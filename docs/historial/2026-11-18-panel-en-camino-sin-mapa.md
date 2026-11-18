# Panel del comercio: «va en camino» también sin mapa

**Pedido:** Julieta. Cuando la persona confirmada toca «salí» y comparte «va en camino», el turno puede seguir en `confirmado` con `en_route_at` cargado. El panel seguía diciendo «Confirmó. Te avisamos cuando salga para allá.» y, si el turno no tenía coordenadas, no mostraba nada del viaje.

**Qué cambió:** el texto del próximo paso dice «Ana va en camino al local.» (o «Va en camino al local.» sin nombre) apenas hay `en_route_at`, con o sin mapa. Si el turno no tiene coordenadas (o falta la posición de la persona) pero hay reporte de viaje, `ShiftCard` muestra una nota con «Ana va en camino» y «hace N min» (`formatAgo`, mismo lenguaje que el pie de `EnRouteMap`), sin mapa vacío ni hueco. Cuando el viaje se apaga (`en_route_at` vuelve a null) todo vuelve a «Confirmó. Te avisamos cuando salga para allá.». Archivos: `frontend/lib/shift-next-step.ts` (`effectiveStatus`, único lugar que decide), `frontend/components/ShiftCard.tsx`, tests en `frontend/lib/shift-next-step.test.ts` y `frontend/e2e/en-camino-sin-mapa.spec.ts`.

**Por qué así:** el estado del turno no cambia hasta la llegada, así que el dato que manda es `en_route_at`; resolverlo en `nextStepFor` evita duplicar la regla en cada pantalla. No cambia ninguna regla de privacidad: el comercio no ve nada que antes no viera (ADR-0014, U072).

**Queda abierto:** la nota sin mapa repite «va en camino» junto al texto del próximo paso; se dejó así por ser la misma señal que con mapa.
