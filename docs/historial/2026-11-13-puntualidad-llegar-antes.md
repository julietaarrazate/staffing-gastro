# Llegar antes es ser puntual (T3a, hallazgo U019)

**Pedido:** quien marcaba la llegada 24 minutos antes quedaba como impuntual
(«Puntualidad 0 %»), aunque la app deja marcar hasta 30 minutos antes.

**Qué cambió:** es puntual quien marca la llegada hasta 15 minutos después del
inicio; cualquier llegada anterior cuenta como puntual. La regla es la función
pura `arrived_on_time` en `backend/app/modules/shift/domain/punctuality.py`
(con `PUNCTUALITY_TOLERANCE`, que antes vivía en el servicio);
`ShiftService._was_punctual` la usa. Antes se comparaba el valor absoluto de la
diferencia. Doc: `docs/reference/REPUTATION.md`. Tests:
`backend/tests/test_punctuality.py` (24 y 14 min antes, en hora, +15 sí, +16 no).
El frontend no repite la regla.

**Por qué así:** el dominio es dueño de la regla, no el caso de uso; sin
migración porque `punctuality_rate` es un promedio móvil guardado.

**Queda abierto:** `punctuality_rate` (y `events_completed`) ya guardados no se
recalculan: quienes llegaron antes en turnos pasados siguen con el valor viejo
(más bajo). Se corregiría con un script único que, por trabajador, recorra sus
turnos finalizados con `check_in_at` y recompute `punctuality_rate` con
`arrived_on_time`; requiere aprobación de Julieta por tocar datos de producción.
