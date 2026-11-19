# Recetas de la sesión cloud: migraciones en paralelo, logs de Render y Dependabot (#659)

**Pedido:** Julieta, 2026-11-19: dejar escrito lo que se aprendió en la tanda del 18 y 19/11 (fase 0 del plan de crecimiento), para que la próxima sesión no lo redescubra.

**Qué cambió:** sólo `docs/reference/SESION_CLOUD.md`, sección 5 («Git, GitHub y CI»):
- **Migraciones con el mismo número desde dos sesiones** (pasó con 0054, 0055 y 0056): antes de pushear y antes de cada merge, mirar la cabeza real en `origin/main`, renumerar encima y correr `test_cadena_migraciones.py`.
- **Logs de Render:** se leen con el conector `mcp__Render__` (R mayúscula), workspace «My Workspace», servicio `staffya-backend` (`srv-d9jq42qd0e5s7396omvg`). El de minúscula responde «unauthorized». Reemplaza la línea vieja que decía que el MCP de Render no conectaba.
- **Los campos `extra` de logging no salen en los registros** (formato de texto): lo que importa va en el mensaje.
- **Dependabot:** mergear de a uno y poner al día el siguiente con `update_pull_request_branch`; con conflicto, Dependabot rebasea solo los PRs que nadie tocó.
- La ruta del repo en la sección 1 (`/home/user/…` o `/home/claude/…`, según el entorno).

**Por qué así:** cada punto le costó vueltas a una sesión de la tanda; la regla de `CLAUDE.md` es dejar la fricción repetible como receta en este archivo, no en EKP.

**Queda abierto:** nada.
