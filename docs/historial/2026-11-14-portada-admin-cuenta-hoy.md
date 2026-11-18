# La portada del admin cuenta lo de hoy (G26: U125, U126, U127) (#580)

**Pedido:** salida a beta, grupo G26. «Urgentes sin cubrir» de la portada del
admin sumaba urgentes de cualquier día; «Ausencias de hoy» llevaba a una lista
que no mostraba ausencias; el buscador de Personas no encontraba un local por su
nombre.

**Qué cambió:**
- «Urgentes sin cubrir» (`GET /admin/today`) cuenta sólo los urgentes abiertos
  cuyo **inicio** cae en el día argentino de hoy: `count_today` en
  `shift/infrastructure/repositories.py` filtra `start_at` en
  `[day_start, day_end)` (los límites ya los arma `day_bounds` con hora ART).
- «Ausencias de hoy» lleva a `/admin/en-vivo?filtro=ausencias`. Esa vista tiene
  un filtro nuevo «Ausencias (N)» que lee `?filtro=` y muestra la hora de la
  ausencia en cada tarjeta. Backend: `GET /admin/live-shifts?no_shows=true`
  (nuevo `ShiftRepository.list_no_shows`), y la respuesta suma `no_shows` y, por
  turno, `no_show_at`. La lista usa el mismo criterio que el contador de la
  portada (`no_show_at` en el día ART), así que los dos números coinciden.
- Personas encuentra también por nombre del local: el caso de uso
  (`AdminService.list_users`) pide los ids de usuario al puerto de comercios
  (`CompanyRepository.user_ids_by_name_search`) y los pasa a
  `UserRepository.list_all(also_user_ids=...)`; sin cruzar módulos por dentro.
- En celular el filtro elegido se trae a la vista si queda fuera de la tira.

**Por qué así:** «de hoy» se decidió por **inicio del turno en el día ART**. Un
turno que empezó ayer a las 22:00 y cruza la medianoche no cuenta hoy (ya
empezó: no es algo por cubrir), y uno que empieza mañana a las 00:00 ART tampoco.
Se descartó contar por `published_at` porque un urgente publicado hoy para el
sábado no es «de hoy». El corte es la medianoche ART (03:00 UTC), no la UTC.

**Queda abierto:** nada de este grupo. Las ausencias no se acotan por turnos
cubiertos de nuevo: aparecen estén o no cubiertas otra vez, como las cuenta la portada.
