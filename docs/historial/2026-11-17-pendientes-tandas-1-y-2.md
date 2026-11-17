# Tres pendientes chicos de las tandas 1 y 2 (contraste, garantía, avisos largos)

**Pedido:** cerrar tres ítems que dejaron abiertos las tandas 1 y 2 de la beta
(etapa 3), en un solo PR.

**Qué cambió:**

- **`danger-text` en claro**: pasa de `#d73d3d` a `#c22f2f`
  (`frontend/app/globals.css`, en `:root` y en el bloque de `data-theme="light"`
  de la landing; oscuro sin cambios, `#f4746f`). Contraste medido (texto
  `#c22f2f`, fórmula WCAG 2.x): sobre `card` `#ffffff` 5,61; sobre el lienzo
  `#f8fbfc` 5,40; sobre `surface` `#e5eef1` 4,77; sobre el tinte celeste
  `#deecf0` 4,64; sobre `danger-tint` `#fef2f2` 5,13. Antes: 4,54 / 4,37 /
  3,86 / 3,75 / 4,15. Se actualizaron los valores listados en
  `docs/design-system/color-system.md`, `docs/design/DESIGN_TOKENS.md` y
  `docs/design/COLOR_SYSTEM.md`.
- **«Garantía Oído»** ya no aparece en Candidatos de un turno que no admite
  asignar (`app/shifts/[id]/candidates/page.tsx`): usa el mismo `canAssign`
  de la pantalla (sólo `publicado` y `buscando_personal` cuentan). Si el
  estado del turno no cargó, se deja visible como antes. Specs en
  `e2e/candidatos-buscar-grupo-g.spec.ts`.
- **Avisos largos**: la entidad `Notification`
  (`backend/app/modules/notification/domain/entities.py`) recorta `title` a
  255 y `message` a 500, con «…» al final, en `__post_init__`; vale para todo
  aviso (chat, «salió para tu local», etc.). Se quitó el recorte puntual de
  U118 en `application/services.py`. `link` no se recorta (un enlace cortado
  llevaría a otro lado). Tests en `backend/tests/test_notification.py`: miden
  el largo del valor guardado en la fila, porque SQLite no hace cumplir el
  largo de la columna.

**Por qué así:** el token y no cada pantalla, para que todo texto de error
gane el contraste de una vez; el recorte en la entidad y no en cada servicio,
para que un aviso nuevo no pueda olvidarlo.

**Marco de la medición:** colores del tema claro (celeste) de `globals.css`,
texto `danger-text` contra el fondo indicado, sin transparencias.

**Queda abierto:** nada de estos tres ítems.
