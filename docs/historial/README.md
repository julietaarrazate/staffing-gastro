# historial/ — Bitácora de Oído, un archivo por cambio

Acá queda **qué se hizo y por qué**. El estado vigente (qué está abierto hoy)
está en [`../STATUS.md`](../STATUS.md).

## Por qué un archivo por cambio

Hasta el 2026-10-03 la bitácora era un solo `STATUS.md` que crecía sin fin
(5.091 líneas). Dos costos se repetían en cada sesión:

- **Encontrar lo vigente costaba de 4 a 9 llamadas.** "Qué sigue" estaba en
  la línea 4.400 y su título no coincidía con el nombre con que lo citaba
  `CLAUDE.md`, así que el `grep` que todas las sesiones probaban primero
  caía en un puntero y no en la sección.
- **Casi todos los PRs chocaban en el merge.** Cada uno reescribía el
  bloque "Última actualización" del principio, y dos PRs en paralelo
  siempre se pisaban. Un PR en conflicto además se queda sin corrida de CI
  (ver [`../reference/SESION_CLOUD.md`](../reference/SESION_CLOUD.md)).

Con un archivo nuevo por cambio no hay línea compartida que dos PRs puedan
tocar, y `ls docs/historial` ya está en orden cronológico.

## Cómo agregar una entrada

En el mismo PR del cambio, creá `docs/historial/AAAA-MM-DD-tema-corto.md`
(fecha de Argentina, tema en minúsculas con guiones). Si dos cambios caen el
mismo día, el tema los distingue.

```markdown
# Título en una línea (#PR)

**Pedido:** quién lo pidió y qué quería, en una o dos líneas.

**Qué cambió:** lo que ve el usuario, y después lo técnico con rutas de
archivo (`frontend/...`, `backend/app/modules/...`).

**Por qué así:** la decisión y lo que se descartó, con el motivo.

**Queda abierto:** lo que no se hizo. Si es trabajo, va también como ítem en
`../STATUS.md` → "Qué sigue (estado vigente)".
```

Si el cambio corrige algo que estaba escrito mal en otro doc, decilo en la
entrada y corregí el doc en el mismo PR.

## Lo anterior

[`ARCHIVO-2026-07-a-2026-10-03.md`](./ARCHIVO-2026-07-a-2026-10-03.md) es la
bitácora vieja completa, congelada. Para buscar ahí, `grep -n` por número de
PR (`#345`), por fecha (`2026-09-2`) o por los títulos `^## |^### `.
