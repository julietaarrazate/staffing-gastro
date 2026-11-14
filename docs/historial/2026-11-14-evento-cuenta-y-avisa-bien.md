# El evento cuenta y avisa bien (#577)

**Pedido:** G25 de la salida a beta (U083, U086): el contador «N/M cubiertos»
del evento no bajaba al cancelar y contaba mal, y publicar un evento mandaba
un aviso por puesto a la misma persona.

**Qué cambió:** en «Mis turnos», el contador del evento no cuenta los puestos
cancelados y «cubiertos» son los confirmados en adelante (un asignado que no
confirmó no cuenta); un evento con todos los puestos cancelados no muestra
contador (`frontend/lib/evento-cobertura.ts`, usado por `app/shifts/page.tsx`).
Al publicar un evento, cada persona recibe un solo aviso «Evento X: N puestos
cerca tuyo» (`ShiftService._notify_event_workers`), y la escalada no avisa a
quien ya está confirmado en otro puesto del mismo evento que se pisa de
horario. `publish_shift` recibe `notify_nearby` para que `create_event` junte
los avisos; el ranking quedó en `_rank_nearby`, compartido con el aviso de un
turno suelto.

**Por qué así:** se reusa el tipo `new_shift_nearby` (mismo canal, push y
margen que un turno suelto) en vez de un tipo nuevo. El link abre el primer
puesto que le toca, porque no hay pantalla de evento para el trabajador. La
exclusión por solapamiento se limita al mismo evento (lo pedido); un
solapamiento con turnos de otros comercios no cambia.

**Queda abierto:** la escalada sigue siendo un aviso por puesto.
