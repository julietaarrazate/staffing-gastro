# Un renglón por pantalla, para migrar en paralelo sin chocar (#700)

**Pedido:** Julieta, 2026-11-20: «¿hay una manera de abrir varias sesiones,
trabajar en paralelo y que no haya esos conflictos? Así no se corre todo dos
veces el CI». Y, con las pantallas que faltan: en tandas en paralelo.

**Qué cambió:** sólo docs. El estado de la migración a la dirección suave
pasó a `docs/planning/DIRECCION_SUAVE_PANTALLAS.md`: un renglón por pantalla,
separados por una línea en blanco, con la maqueta del lienzo, los archivos y
qué no va en paralelo. El párrafo de la etapa 4 de `docs/STATUS.md` apunta
ahí y ya no se edita en cada PR. La receta quedó en
`docs/reference/SESION_CLOUD.md` (sección 3) y la fila en `CLAUDE.md`.

**Por qué así:** el 2026-11-20 los PRs #697, #698 y #699 no se pisaban en el
código, pero los tres reescribían el mismo párrafo de `STATUS.md`: a cada uno
hubo que traerle `main`, resolver y esperar otra corrida de CI. Es el mismo
problema que tenía la bitácora antes de pasar a un archivo por cambio. Con un
renglón por pantalla y una línea en blanco entre renglones, git junta solo
los cambios de dos sesiones.

**Queda abierto:** la segunda corrida de CI sobre los PRs juntos sigue (es la
regla del 2026-11-13, y todas las pantallas tocan `globals.css`); la hace la
sesión que mergea la tanda. El mapa del código es una tabla: dos PRs que
editen filas pegadas todavía pueden chocar ahí.
