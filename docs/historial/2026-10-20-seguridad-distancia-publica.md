# La distancia que ve el comercio sale del pin desplazado

**Pedido:** Julieta, 2026-10-20, como parte de la revisión de seguridad
(ítem «Revisión de seguridad del 2026-10-20» de `../STATUS.md`, prioridad alta).

**Qué cambió:** el mapa del comercio ya mostraba el pin del trabajador
desplazado 150–350 m (TECH_DEBT S4, ADR-0014 §3), pero `distance_km` salía
exacta desde el domicilio o la posición en vivo. Con tres búsquedas desde
puntos distintos se podía triangular dónde vive o dónde está alguien.

- `backend/app/modules/matching/application/services.py`:
  `_public_distance_km` mide desde el mismo punto desplazado que dibuja el
  mapa y redondea a 0,1 km. La usan `search_workers` (también para el filtro
  por radio y el orden) y la salida de `get_top_candidates`.
- El ranking de `get_top_candidates` y el aviso de turnos
  (`shift/application/services.py`) siguen con la distancia real: deciden a
  quién conviene avisar y no salen hacia el comercio.
- `backend/tests/test_matching.py`: el test de coordenadas exactas ahora
  exige que la distancia sea la del pin.
- `docs/TECH_DEBT.md` (S4) decía que la distancia mostrada era la real; se
  corrigió.

**Por qué así:** es lo que ya pedía ADR-0014 §3 ("qué tan lejos, no dónde",
"a ~1,5 km"), así que no hace falta ADR nuevo. Medir desde el pin hace que la
distancia no agregue información a lo que el mapa ya muestra. Se descartó
redondear en bandas la distancia real: con suficientes búsquedas los bordes
de las bandas siguen acotando el punto.

**Queda abierto:** nada de este tema. El resto de la revisión sigue en el
ítem «Revisión de seguridad del 2026-10-20» de `../STATUS.md`.

**Revisión del 2026-10-21:** el arreglo no cerraba el agujero en el top de
candidatos (`/shifts/{id}/candidates`): `distance_km` salía del pin, pero el
`score` se seguía calculando con la distancia real. Un comercio con tres
turnos de lat/lng elegidas despejaba la distancia real de las diferencias de
score (Δdist = Δscore·25/0,30) y triangulaba el domicilio. Ahora
`rank_candidates`/`score_candidate` reciben la función de distancia
(`distance_fn`, en `matching/domain/scoring.py`) y `MatchingService.get_top_candidates`
le pasa la distancia pública (pin desplazado, redondeada a 0,1 km), así que el
puntaje y su tope por radio usan exactamente lo que se muestra y el score no
revela más que `distance_km`. El aviso a trabajadores cercanos
(`shift/application/services.py`, `_notify_nearby_workers`) sigue con la
distancia real: no sale hacia el comercio. `/matching/search` no devuelve
score y ya filtraba con la distancia pública. Test:
`test_top_candidates_score_does_not_leak_the_real_distance` (dos turnos a
distinta distancia real dentro de la misma banda dan el mismo score).
