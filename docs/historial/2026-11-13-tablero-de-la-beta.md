# Tablero de la salida a beta y reglas de trabajo acordadas

**Pedido (Julieta, 2026-11-13):** "fijate si es mejor ir haciendo versiones o alguna manera de marcar lo ya realizado así no nos pisamos ni volvemos sobre lo hecho", y aceptó la propuesta para usar mejor el modelo ("acepto tu propuesta para optimizar uso y tokens manteniendo máxima eficacia").

**Qué cambió:**
- `docs/planning/BETA_TABLERO.md` (nuevo): las seis etapas de la salida a beta y, para la etapa 2, cada bloqueante, cada reporte externo y cada grupo de graves con su estado y su PR; lo que salió de las revisiones, las decisiones que esperan a Julieta y las pruebas que tiene que hacer una persona. El detalle de cada hallazgo (pasos, capturas) sigue en el tablero privado de la etapa 1, porque este repo es público.
- `CLAUDE.md`: reparto de modelos (quien coordina diseña y hace lo delicado; arreglos y revisiones de pantalla en Sonnet; lo mecánico en Haiku), una conversación por etapa o por tanda, y el **permiso permanente** para mergear arreglos con CI y Security en verde, revisión independiente aprobada y prueba en la app, avisando después; se pregunta antes si toca textos legales, precios, datos de producción o una regla del producto.
- `docs/STATUS.md`: primer ítem de «Qué sigue», que apunta al tablero.

**Por qué así:** el estado de la etapa 2 vivía en notas de una sola conversación; al cortarse el cupo de uso o reiniciarse la máquina había que reconstruirlo. Un tablero en el repo, editado en el mismo PR que cambia una fila, lo deja a la vista de cualquier sesión. No se agregan números de versión: cada cambio ya tiene su PR y su entrada de historial, y el tablero dice qué falta.

**Estado al escribirlo:** en `main` los 3 bloqueantes, 7 de los 9 reportes externos y la primera tanda de graves (#537, #538, #539, #544); abiertos #546 (evento con zona) y #547 (cerca es cerca), revisados y sin la prueba en la app; #527 (etapa 1) sigue abierto.

**Queda abierto:** cuando se mergee #527 hay que unir su ítem de `docs/STATUS.md` con el de este PR y enlazar `tools/e2e-local` desde `CLAUDE.md` (el link apunta a un archivo que todavía no está en `main`).
