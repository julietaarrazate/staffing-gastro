# Ahorro de tokens: CLAUDE.md como índice y ajustes de `.claude/`

**Pedido:** Julieta notó que la ventana de consumo pasaba del 50% de tokens: había que evitar relecturas y gasto sin sentido, con Opus para orquestar y modelos más chicos para ejecutar.

**Qué cambió:** `CLAUDE.md` pasó de 569 líneas (35.564 bytes) a 65 (≈7 KB) y quedó como índice. Lo que sobraba se movió sin reescribirlo a `docs/reference/QUE_EXISTE_HOY.md`, `PENDIENTE_OPERATIVO.md` y `MAPA_DE_DOCS.md`. Se agregó una sección "Ahorro de tokens" (qué leer, qué no, tests proporcionales, modelos). `.claude/settings.json` deniega la lectura de `marketing/`, lockfiles, `node_modules`, `ARCHIVO-*`, `docs/mockups`, `docs/audits` y artefactos de build. `.claude/agents/mecanico.md` es un subagente con `model: haiku` para trabajo mecánico.

**Medición (carga al arrancar: CLAUDE.md + STATUS + MAPA_DEL_CODIGO):** antes 805 líneas / 51.451 bytes; después 301 líneas / 22.763 bytes (−56%). Solo `CLAUDE.md`: −88% de líneas, −81% de bytes. Tokens ≈ bytes/3,5 (estimación).

**Por qué así:** `CLAUDE.md` se carga entero en cada sesión; el detalle de producto y los pendientes de Julieta solo importan en tareas puntuales.
