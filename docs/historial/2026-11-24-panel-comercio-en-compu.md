# El Panel del comercio en la compu: dos turnos por fila y el cielo ordenado

**Pedido:** Julieta, 2026-11-24: seguir con la versión de escritorio por las pantallas del comercio,
desde el renglón 1 de `docs/planning/ESCRITORIO_PANTALLAS.md` (el Panel).

**Qué cambió:** mirado a 1440 px, el Panel ya usaba el marco de 1024 px con el cielo en dos columnas y
las familias en grilla, pero desde 1280 px ponía tres tarjetas por fila: cada una quedaba de ~300 px y el
horario («23:00 – 02:00 · 3 h») y la persona se partían en dos o tres líneas. Ahora:

- Los turnos van de a dos por fila como mucho (~470 px cada uno): horario, persona y barrio en una línea.
- El chip «Evento» va junto a «Marchando» (antes quedaba pegado al borde de la columna izquierda, flotando
  en el medio del cielo).
- El Panel vacío cuenta «Así sale un turno» con los tres pasos en fila desde `lg`, en vez de una columna
  angosta con media pantalla vacía.

En el celular no cambia nada (capturas comparadas píxel a píxel a 390 px: sólo difieren el puntito que
late y las nubes, que se mueven). Técnico: `frontend/app/shifts/page.tsx` (grilla y pasos) y
`frontend/components/employer/CieloPanel.tsx` (fila de estado con `md:justify-start`). Dos pruebas nuevas
en `frontend/e2e/panel-suave.spec.ts`.

**Por qué así:** el renglón 2 (Candidatos con la ficha al lado) es el que pone lista y detalle; el Panel
es una lista de turnos por estado, y en el marco común dos columnas alcanzan para leer cada tarjeta
entera. Se descartó ensanchar el marco sólo para el Panel: lo fija el renglón 0 para toda la app.

**Queda abierto:** el resto de las pantallas del comercio (renglones 2 a 8).
