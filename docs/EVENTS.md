# EVENTS.md — "Eventos" y efectos de dominio (arquitectura técnica)

> Aclara un punto que **no hay que asumir**: Staffya **no tiene un bus de eventos**.
> Amplía [ARCHITECTURE.md](./ARCHITECTURE.md#eventos) y
> [NOTIFICATIONS.md](./NOTIFICATIONS.md#eventos-aclaración-de-arquitectura).

## Qué NO hay

- **No hay** event bus, broker (Kafka/RabbitMQ), colas ni outbox.
- **No hay** event sourcing: el estado es el estado actual de las tablas, no una
  secuencia de eventos rehidratable.
- **No hay** pub/sub entre procesos (el `ws_manager` es en memoria, un solo
  worker; ver [API.md](./API.md#tiempo-real-websocket)).

Introducir cualquiera de estas piezas es una **decisión arquitectónica** que
requiere un **ADR** (ver [PRINCIPLES.md](./PRINCIPLES.md) y
[CLAUDE.md](../CLAUDE.md#no-hacer)).

## Qué SÍ hay: efectos dentro del caso de uso

Lo que en el producto llamamos "eventos" (se postuló alguien, se asignó el turno,
llegó una reseña) son **efectos que el propio servicio produce de forma
sincrónica** dentro del caso de uso que genera el hito:

```
ShiftService.assign(...)          # caso de uso
  ├─ actualiza el turno (estado → asignado)
  ├─ crea una Notification para el trabajador
  └─ la empuja por WebSocket (ws_manager.broadcast_notification)
```

No hay un despachador intermedio: el efecto está **acoplado en el tiempo** al
comando. Es simple, transaccional y suficiente para la escala actual.

## Hitos que disparan efectos

Coinciden con los tipos de notificación (ver
[NOTIFICATIONS.md](./NOTIFICATIONS.md#eventos-que-generan-notificación)):
postulación, asignación, confirmación, rechazo, check-out, pago, mensaje de
chat y reseña recibida. Cada uno crea la `Notification` correspondiente y, si el
destinatario está conectado, la entrega en vivo.

## Trade-offs y cuándo migrar a un bus

| Hoy (efecto en el caso de uso) | Un bus/outbox aportaría |
|--------------------------------|-------------------------|
| Simple, sin infra extra | Desacople productor/consumidor |
| Consistencia inmediata | Reintentos y entrega garantizada |
| Un solo worker ve las conexiones WS | Fan-out entre instancias (pub/sub) |
| Efectos secundarios en la misma transacción | Procesamiento asíncrono/diferido |

**Señales para considerar el cambio (con ADR):** múltiples workers/instancias,
necesidad de reintentos confiables, integraciones externas que no pueden fallar
en línea (pagos, email), o efectos que hoy alargan la request.

> Si algún día se agrega un bus/outbox: documentarlo acá, ajustar
> [ARCHITECTURE.md](./ARCHITECTURE.md#eventos) y registrar el **ADR**.
