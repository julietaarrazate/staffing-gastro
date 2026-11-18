# Cancelar un evento entero con un botón (U084)

**Pedido:** Julieta, 2026-11-17 (etapa 3 de la beta, decisión sobre U084):
«Sí, un botón, con los mismos avisos y la misma penalidad por cancelación
tardía que cancelar cada puesto». Hasta ahora un evento de seis puestos se
cancelaba de a uno.

**Qué cambió:**

- Panel del comercio (`/shifts`): la fila del evento («Boda Martínez · 1/3
  cubiertos») suma «Cancelar» mientras quede algún puesto que se pueda
  cancelar. Abre «¿Cancelar el evento entero?», que relee el panel y dice
  cuántos puestos se cancelan, que a quien esté asignado o postulado se le
  avisa y, sólo si aplica, cuántas cancelaciones tardías suma («Una persona
  ya confirmó: te suma una cancelación tardía…»). Abrir y confirmar pasan
  por la guarda de doble toque, como «Marcar como pagado».
- Backend: `POST /shifts/events/{event_id}/cancel` (con idempotencia) →
  `ShiftService.cancel_event`, que recorre los puestos del evento del
  comercio (`ShiftRepository.list_by_event`) y cancela cada uno con la misma
  rutina que `cancel_shift` (`_cancel_owned`: rechaza postulaciones
  pendientes, suma la tardía si había alguien comprometido, avisa). Lo ya
  terminado, pagado, sin cubrir o cancelado se saltea. Evento ajeno o
  inexistente: 404; sin nada para cancelar: 400 «Este evento ya no tiene
  puestos para cancelar.».
- Frontend: `cancelEventConfirmCopy` en `lib/cancelar-turno.ts`.

**Por qué así:** la decisión fue «las mismas reglas que cada puesto», así
que no hay una regla de evento: es el mismo caso de uso en un bucle, y una
persona confirmada en dos puestos del evento recibe dos avisos, igual que si
el comercio los cancelara de a uno. Cada puesto se guarda por separado: si
algo falla a mitad de camino, reintentar cancela lo que quedó.

**Queda abierto:** nada.
