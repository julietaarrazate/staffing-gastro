# Apagar los datos demo y purgar las cuentas demo de producción

**Pedido:** Julieta, 2026-10-22. Ya hay usuarios reales y quiere "dejarlo
limpio" antes de que un tercero (Breken, revisión automática de código)
tenga acceso al repo.

**Qué cambió:** la app deja de mostrar los 12 comercios y 14 trabajadores
demo y sus turnos. Técnico:

- `render.yaml`: `SEED_DEMO_DATA` pasa a `"false"` (también en el panel de
  Render, para que no se contradigan). El arranque ya no siembra ni repone
  turnos demo; las fotos de las 4 cuentas invitado/prueba (`@oido.beta`)
  siguen corriendo siempre, no cuelgan de este flag.
- Ese mismo día Julieta hizo **público** el repo (para que corra GitHub
  Actions), y con eso la contraseña demo de `scripts/seed_demo_data.py`
  quedó a la vista de cualquiera. Como medida inmediata, antes de la purga,
  las 26 cuentas pasaron a `status='suspended'` (no pueden entrar ni renovar
  sesión) y se borraron sus `refresh_sessions`. El seed no pisa cuentas que
  ya existen, así que la suspensión se mantiene aunque el flag siga prendido.
- Neon (`staffya-us-east`): antes de borrar, rama de respaldo
  `respaldo-pre-purga-demo-2026-10-22`. Después se borraron las cuentas con
  email `@staffya.com`: 26 cuentas y, en cascada, 228 turnos demo con sus
  postulaciones, chats, reseñas y sesiones. Antes se verificó que ningún
  turno real tuviera asignado a un trabajador demo; sí se fueron 7
  postulaciones y 1 turno guardado de usuarios reales sobre turnos demo.
- Docs: `reference/DEPLOY.md`, `reference/PENDIENTE_OPERATIVO.md` y
  `STATUS.md` (se quita el pendiente). La fila de `DEPLOY.md` decía
  "APAGADO desde 2026-08-07" mientras estaba prendido: corregida.

**Por qué así:** la revisión del 2026-10-20 lo marcó como riesgo alto. La
contraseña de las cuentas demo está en el repo, y con una cuenta de comercio
demo se ven trabajadores reales. Además, los turnos demo entraban en la
referencia de pago (ADR-0012). Se respaldó en una rama de Neon en vez de un
`pg_dump` porque es instantánea y se restaura desde el panel.

**Queda abierto:** sin datos demo, el feed se ve vacío hasta que haya turnos
reales. La rama de respaldo se puede borrar en unas semanas si no hizo falta.
