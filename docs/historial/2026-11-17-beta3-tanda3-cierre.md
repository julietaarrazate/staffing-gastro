# Etapa 3 de la beta: cierre de la tanda 3 (grupos H y N)

**Pedido:** Julieta pidió la tanda 3 del triaje de la etapa 3 (grupos H y N),
con las reglas de las anteriores: un PR por grupo, revisión independiente,
suite e2e completa antes de cada push con un puerto de Playwright propio, sin
literales con forma de UUID o token en los tests, y merge con CI y Security en
verde. U068 se confirmaba renderizado en claro y oscuro.

**Qué cambió:** entraron #608 (N: guardas de rol por URL y 2FA pendiente del
admin) y #609 (H: Matches del trabajador); el detalle de cada uno está en
`2026-11-17-guardas-de-rol-y-2fa-admin.md` y `2026-11-17-matches-grupo-h.md`.
Este PR pasa esas filas a ✅ en `docs/planning/BETA_TABLERO.md`, anota lo que
quedó abierto y actualiza la etapa en `docs/STATUS.md`.

**Por qué así:** N entró primero porque en `my-shifts/page.tsx` cambiaba una
sola línea; a H se le trajo `main` y se esperó su CI. Ese CI encontró algo
que la corrida local no veía: en 360 px «Guardados» terminaba en 364 px (la
fuente se renderiza apenas más ancha en CI). Medido, las tres pestañas ya se
pasaban del margen de la página también localmente (~343 px de 328). Se
arregló en `components/ui/SegmentedControl.tsx` en tres vueltas, cada una con
revisión aparte: debajo de `sm`, `text-caption` (13 px), menos relleno y
menos espacio; pestañas que miden según su contenido y, si igual no entran,
recortan el nombre con «…» y dejan el número; y más holgura, porque con
contadores de dos cifras los nombres se recortaban a 360 px. Specs a 360 px
(dos cifras, sin recorte) y a 320 px (tres cifras, sin desborde).
U068 se miró renderizado a 360 y 390 px en los dos temas: «Guardados» entra
entera, los nombres largos se recortan con «…» sin desbordar y «Comparar» es
neutro.

`npm audit` se puso rojo a mitad de la tanda en todos los PRs (y en `main`
desde la corrida siguiente) por un advisory de picomatch (GHSA-fc5q-39xc-vjpf,
ReDoS, `<=4.0.7`) sin versión arreglada publicada: no es de estos diffs.

**Queda abierto:** en el tablero, etapa 3, «Lo que dejó abierto la tanda 3»:
el aviso al quitar una postulación de un turno cerrado, el ámbar repetido en
Matches, «Perfil» cortado en la barra del trabajador a 360 px y el primer
pedido de la campanita con el 2FA pendiente.
