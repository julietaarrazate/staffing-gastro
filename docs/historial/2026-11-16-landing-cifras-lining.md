# Landing: cifras de caja alta en los títulos serif (#PR)

**Pedido:** al pasar los títulos a Young Serif (#586), «$45.000» y los demás
montos de la landing se veían con cifras old-style, con el 4 y el 5 colgando
bajo la línea de base. Se pidieron cifras de caja alta (lining).

**Qué cambió:** `font-feature-settings: "lnum" 1` en `.font-display` y en las
dos reglas de `frontend/app/globals.css` que setean `var(--font-display)` a
mano (`.landing-h2`, `.landing-mapa-eta`). Alcanza a todos los números en
serif: los cuatro precios de `Precios.tsx` ($9.900, $20.000, $45.000 y
$70.000), el `$70.000` de `ParaTrabajar` y `Confianza`, el «~4 min» y la
hora del reloj de la landing, y los títulos de las pantallas de la app.

**Por qué así:** el subset latino de Young Serif que baja `next/font` sí trae
la feature `lnum` (GSUB: `lnum`, `pnum`, `tnum`, `frac`, `numr`, `dnom`,
`liga`, `calt`; `zero` a `nine` pasan a `zero.lf` a `nine.lf`). No hizo falta
cambiar de familia ni partir con `unicode-range`: con la fuente propia las
cifras quedan del mismo diseño que las letras. Se usó `font-feature-settings`
y no `font-variant-numeric: lining-nums` porque Tailwind arma `tabular-nums`
con ese mismo shorthand y la regla sin capa se lo pisaba (`Confianza` usa
`tabular-nums`).

**Verificación:** capturas antes/después a 390 y 1280 px en claro y oscuro
(elemento `.font-display` con dígitos): las cifras apoyan en la línea base.

**Queda abierto:** nada.
