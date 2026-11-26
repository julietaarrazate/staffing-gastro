# Cierre de la sesión del 2026-11-24/25: escritorio, ADR-0031 y lo pensado

**Pedido:** Julieta, 2026-11-25: dejar escrito todo lo pensado en la sesión para que una sesión
nueva arranque sabiéndolo, sin tener que repetirlo.

**Qué cambió:** sólo documentos.

- `STATUS.md`: ítem nuevo «Lo próximo» con el orden acordado (código de P2 y P3 según el
  ADR-0031, P1 y PRI-09/07, el Panel vacío en la compu, precios y horarios con punteros al
  documento privado). El ítem de la versión de escritorio pasa a hecho, con lo decidido.
- Documento privado de crecimiento: pestaña nueva **«Precios y planes»** (análisis de planes,
  precios, comisión de Mercado Pago y lo fiscal para el contador) y la **evaluación de horarios
  del equipo** al final de su pestaña (veredicto y criterios para seguir o cortar). Lo de
  precios, números y estrategia va ahí y no acá porque el repositorio es público.

**Lo que se hizo en la sesión** (cada cosa tiene su entrada): Panel del comercio en la compu
(#739), todas las demás pantallas de escritorio (#740), Buscar sin el conmutador en la compu
(#741), ADR-0031 aceptado (#742).

**Decisiones de la sesión que no tienen otra entrada:**

- «Instalar como app» (artefactos de Claude como programas de escritorio, beta del 24/11): no
  sirve para los usuarios de Oído (cada uno necesitaría una cuenta de Claude; Oído ya se instala
  como PWA). Como herramienta interna sólo vale para algo que cruce varias fuentes o sea
  temporal; para la beta alcanza con el admin. Se arma si en la primera semana falta enterarse
  de algo a tiempo.
- Las pantallas de mapa (`/search`, `/map`) van a todo el ancho a propósito; el resto, en el
  marco de 1024 px. Se mantiene.
- Ante el modelo de «dos carriles» que le propusieron a Julieta: coincide con la propuesta
  aprobada del 13/11; se tomó el principio «el más adecuado que llega a tiempo, no el más
  cercano» (ADR-0031). El ETA por rutas y las habilidades finas quedan para después.

**Queda abierto:** lo de «Lo próximo» en `STATUS.md`.
