# Las tarjetas dicen quién y cuántos (G19: U065, U024, U025)

**Pedido:** salida a beta, grupo G19. En Matches → Postulaciones las tarjetas no
decían de qué comercio era el turno; en el panel del comercio el siguiente paso
no decía con quién («Asignado», «Confirmó»); y la tarjeta no decía cuántas
personas se postularon (llegaba un postulante y el botón seguía igual).

**Qué cambió:**

- Panel del comercio (`frontend/lib/shift-next-step.ts`): «Asignado a Ana.
  Esperando que confirme su asistencia.», «Beto confirmó. Te avisamos cuando
  salga para allá.», «Ana va en camino al local.», «Beto llegó al local.»,
  «… está trabajando ahora.», «… terminó de trabajar.». Se usa el primer nombre
  (`firstNameOf`): si falta o viene vacío, queda la línea de antes; sobre 18
  caracteres se corta con «…». El botón dice «Elegir a alguien (2)»; con una
  sola, «Elegir a alguien (1)»; con cero o sin dato, «Elegir a alguien».
- `GET /shifts/me` suma `pending_applicants_count`: postulaciones PENDIENTES por
  turno, en una sola consulta agrupada
  (`SqlAlchemyShiftApplicationRepository.count_pending_by_shift_ids`, puerto
  `ShiftApplicationRepository`, `ShiftService.pending_applicant_counts`). No
  cuenta retiradas, rechazadas ni aceptadas.
- `GET /applications/mine` trae `shift.company_name`, logo, portada y
  `company_verified`, con el mismo `list_by_ids` + `verified_business_user_ids`
  que `/shifts/mine` (una consulta para todos los comercios de la página). La
  tarjeta (`ShiftCard`) ya pintaba `company_name`: faltaba el dato, así que
  `app/my-shifts/page.tsx` no se tocó.
- La cantidad se actualiza sola: `/shifts` ya vuelve a pedir `/shifts/me` con
  `useLiveRefresh` (aviso del WebSocket) y reemplaza la lista entera; cubierto
  por `e2e/tarjetas-quien-y-cuantos.spec.ts`.

**Por qué así:**

- Privacidad: la cantidad es del comercio dueño, igual que `worker_name`. Se
  completa sólo en `/shifts/me`; en el feed, el turno público, `/shifts/mine` y
  `/applications/mine` viaja `null`, y `pending_applicants_count` entró en
  `WORKER_DATA_FIELDS`, así que `without_worker_data` también la borra. El
  nombre del comercio que ve el trabajador es el mismo que ya ve en el turno.
- «(1)» con una sola postulación y no «Ver postulante»: la acción es la misma
  (elegir entre quienes se postularon) y el botón no cambia de frase según la
  cifra.
- No se reusó `count_active_by_shift_ids` (lo usa admin y cuenta todo menos las
  retiradas): acá hace falta sólo lo pendiente.

**Queda abierto:** nada de G19. Las rutas del comercio que devuelven un turno
suelto (crear, publicar, detalle) no traen la cantidad (`null`): el panel se
vuelve a pedir entero y la pinta.
