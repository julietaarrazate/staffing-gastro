# La paleta celeste vuelve al ámbar de siempre

**Pedido:** Julieta, 2026-10-09, en el hilo "Identidad de marca de Oído".
Con la paleta celeste ya en toda la app (#410) y el logo pendiente,
preguntó si el ámbar viejo no quedaba mejor que el nuevo. Se le mostró una
comparación lado a lado (logo, botón principal y tarjeta "Mejor valorado")
y eligió el ámbar de siempre.

**Qué cambió:** en el bloque "PALETA CELESTE" de `globals.css`,
`--color-primary` vuelve a `#d97706` y `--color-primary-strong` a
`#b45309`; en oscuro, el ámbar como texto, su tinte y el anillo de foco
vuelven a `#e8920f`. Nada más: los componentes ya leían el token.

**Por qué:** el `#ffab25` es casi tan claro como el celeste (1,40:1) y los
botones se perdían encima; el `#d97706` da 2,36. Además es el color del
logo, así que el logo no se rediseña y logo y acción quedan de una familia.
La tinta sobre el ámbar sigue en 5,93.

**Queda abierto:** alivianar el celeste (dejarlo sólo en lo importante y
sacarlo lleno del modo oscuro) y un efecto esmerilado que Julieta quiere
mostrar con referencias.
