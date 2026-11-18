# Etapa 3 de la beta: cierre de la tanda 3 (grupos H y N)

**Pedido:** Julieta pidió la tanda 3 del triaje de la etapa 3 (grupos H y N),
con las reglas de las anteriores: un PR por grupo, revisión independiente,
suite e2e completa antes de cada push con un puerto de Playwright propio, sin
literales con forma de UUID o token en los tests, y merge con CI y Security en
verde. U068 se confirmaba renderizado en claro y oscuro.

**Qué cambió:** entraron #608 (N: guardas de rol por URL y 2FA pendiente del
admin), #609 (H: Matches del trabajador) y #611 (pendientes de N: la barra de
abajo entra en 320 px y la campanita no pide nada con el 2FA pendiente); el
detalle de cada uno está en `2026-11-17-guardas-de-rol-y-2fa-admin.md`,
`2026-11-17-matches-grupo-h.md` y `2026-11-17-beta3-grupo-n-pendientes.md`.
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
Julieta eligió primero esperar el arreglo y después decidió una excepción con
vencimiento (#612, hasta el 2026-12-17); con eso #611, #609 y este PR se
mergearon con CI y Security en verde. Al traer `main`, #609 chocó con #603 en
`shift/infrastructure/repositories.py` (dos funciones nuevas en el mismo
lugar): quedaron las dos.

Julieta pidió además resolver lo que había quedado abierto en la tanda antes
de seguir. En #609: el aviso al quitar una postulación de un turno cerrado,
un solo ámbar por tarjeta según lo que el backend deja hacer («Voy en camino»
desde 2 h antes, «Llegué» desde 30 min antes y deshabilitado hasta entonces),
el círculo de comparar en azul de marca y los recordatorios que abren el
turno (`/my-shifts?turno=`, que se limpia de la URL tras saltar). En #611:
el login y `/auth/me` dicen si el admin tiene el alta de 2FA pendiente, así
la campanita no pide nada desde la primera carga; la revisión encontró que
entrar con otra cuenta sin cerrar sesión heredaba la marca, y se corrigió.

**Queda abierto:** en el tablero, etapa 3, «Lo que dejó abierto la tanda 3».
