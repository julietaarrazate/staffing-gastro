# Escape cierra sólo la capa de más arriba

**Pedido:** reporte externo (BK-0C3A2D8D7EE2) en la etapa 2 de la salida a beta: con dos capas abiertas a la vez, un Escape las cerraba a las dos.

**Qué cambió:** al publicar un turno se abren juntas la confirmación «¡Turno publicado!» y, debajo, el pedido de activar notificaciones. Un Escape cerraba ambas y dejaba registrado (`staffya_push_prompt_shown`) que la persona había rechazado las notificaciones sin haber visto el pedido, así que no se le volvía a ofrecer. Ahora el primer Escape cierra sólo la confirmación; el pedido sigue ahí y no queda registrado. Un segundo Escape cierra el pedido. Nada cambia en el aspecto ni en el foco de las capas.

Técnico: nuevo `frontend/lib/use-escape-layer.ts` (pila de capas abiertas con un único listener de `keydown`; manda la mayor prioridad y, a igual prioridad, la última abierta). `Modal` (prioridad 60, su z-index), `Sheet` y `DiscoverDeck` (50) lo usan en lugar de escuchar Escape cada uno por su cuenta. Tests: `frontend/lib/use-escape-layer.test.tsx` (dos capas apiladas, prioridad, Modal sobre Sheet y el caso de publicar con el pedido de notificaciones real).

**Por qué así:** la prioridad es el z-index porque el orden de apertura no alcanza (la confirmación y el pedido se abren en el mismo tick y lo que se ve arriba es el Modal, `z-[60]`). Una pieza compartida evita duplicar la lógica en cada capa.

**Queda abierto:** nada. Cualquier capa nueva que maneje Escape debe usar `useEscapeLayer`.
