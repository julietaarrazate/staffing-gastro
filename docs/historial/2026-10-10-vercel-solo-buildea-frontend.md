# Vercel sólo buildea cuando cambia el frontend

**Pedido:** a Julieta le llegó el aviso de Vercel de 75% de uso en el plan
Hobby y preguntó si era por Oído.

**Qué pasaba:** el medidor alto era **Build CPU Minutes (23 h 6 min)**.
Todo el uso de la app en sí era mínimo (193 MB de transferencia, 27 mil
requests al CDN, 4,1 mil invocaciones de funciones, 0 optimización de
imágenes). Los 8 proyectos de la cuenta comparten esa cuota, y Oído tuvo
100 deploys en 13 días (76 previews; 25 sólo el 2026-10-09). Vercel armaba el
frontend entero en cada push a cualquier rama, aunque el cambio fuera sólo
del backend o de docs (por ejemplo, #416 y #417).

**Qué cambió:** `frontend/vercel.json` con un `ignoreCommand` que saltea el
build si no cambió nada dentro de `frontend/` desde el último deploy de la
rama (`VERCEL_GIT_PREVIOUS_SHA`, o el commit anterior). Probado con commits
reales: el #417 (sólo backend) sale 0 → se saltea; un rango con cambios de
la landing sale 1 → buildea; un SHA que no está en el clon sale 128 →
buildea (ante la duda, buildea). Documentado en
`docs/reference/DEPLOY.md`.

De paso: el PIN del acceso invitado tiene que ser de **dígitos** (el campo
del login abre el teclado numérico; Julieta puso letras y no podía
tipearlas). Corregido en `STATUS.md`, `PENDIENTE_OPERATIVO.md`,
`render.yaml` y el comentario del servicio. Y `STATUS.md` ítem 5: Vercel ya
corre Node 24.x, CI sigue en 22.

**Por qué así:** en el repo y no en el panel, para que quede versionado y
visible en el PR. Se descartó apagar los previews: siguen siendo la forma de
ver un cambio de UI antes del merge.

**Queda abierto:** opcional, activar en Vercel la retención de deploys
(Settings → Deployment Retention) para que se borren los previews viejos
(2,33 GB de deploys y 7,1 GB de funciones guardados; no cuenta para el 75%).
