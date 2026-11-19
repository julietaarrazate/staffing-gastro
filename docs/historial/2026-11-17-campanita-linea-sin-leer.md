# Campanita en claro: línea entre avisos sin leer

**Pedido:** ítem 13 de `docs/STATUS.md`: en tema claro no se veía la línea
divisoria entre dos avisos sin leer seguidos (visto en las capturas de
[Marcar todas como leídas](./2026-10-30-notificaciones-marcar-todas.md)).

**Qué cambió:** en `frontend/components/NotificationBell.tsx`, la fila de un
aviso sin leer usa `border-secondary` en lugar de `border-line`; la leída
sigue con `border-line`. Verificado renderizado a 390 px en claro y oscuro
(2 a 3 avisos sin leer y uno leído): en claro la línea aparece; en oscuro la
captura es idéntica a la de antes.

**Por qué así:** en claro `--color-line` y `--color-primary-tint` valen los
dos `#deecf0`, así que la hairline desaparecía sobre el tinte. No se tocaron
los tokens globales (los usa toda la app). `--color-secondary` ya existe y
da `#c4e3ed` en claro, visible sobre el tinte, y en oscuro `rgba(196,227,237,.12)`,
que equivale a la hairline de antes. `secondary-strong` se descartó: en oscuro
no está redefinido y heredaría un verde viejo.

**Queda abierto:** nada.
