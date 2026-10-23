# Fuentes: el wordmark "oído" baja 2 KB en vez de 36 KB

**Pedido:** Julieta, 2026-10-23: seguir con el relevamiento de rendimiento
del frontend (ítem 5, fuentes), midiendo antes y después, sin que el logo
cambie.

**Qué cambió:** nada a la vista. Cada pantalla precargaba 151,6 KB de
fuentes; ahora 117,8 KB. Fraunces se usa sólo para la palabra "oído" del logo
(Navbar, login/registro, header y footer de la landing) y se precargaba
entera (36 KB de latin, con los cuatro pesos apuntando al mismo archivo
variable).

- `frontend/app/fonts/fraunces-oido.woff2` (nuevo, 2 KB): recorte del mismo
  archivo latin que servía Google Fonts, con `pyftsubset` de fonttools, sólo
  los glifos "o í d O", **manteniendo el eje variable `wght`** (100–900) y las
  tablas de layout. Fraunces es OFL: recortarla está permitido.
- `frontend/app/layout.tsx`: Fraunces pasa de `next/font/google` a
  `next/font/local` con ese archivo, misma variable `--font-fraunces` (no
  cambia `font-serif` ni ningún componente). El comentario deja el comando
  para regenerarlo si el wordmark usa otra letra.

**Por qué así:** se descartó dibujar el wordmark como SVG (no iba a quedar
idéntico al texto renderizado, y el color sale de `text-ink` que se voltea
por tema) y también `preload: false` (el logo aparecía un instante en la
serif de respaldo y después cambiaba). Con 2 KB precargados se dibuja igual
desde el primer cuadro. **DM Mono se dejó precargada**: es la de los precios,
que están en la primera pantalla de `/feed`, `/map` (el LCP de `/map` es un
precio) y `/turno`; son 2 × 8,7 KB.

**Verificación visual:** capturas del wordmark (elemento `.font-serif`) en
`/login` y `/feed`, a 390 y 1280 px, en `data-theme` claro y oscuro: las 8
son **idénticas byte a byte** antes y después.

**Medición** (scripts del relevamiento: build de producción con DSN de
Sentry, API simulada con 80 ms, celular 390×844 con CPU 4x y 4G lenta;
A/B intercalado antes/después en la misma máquina, 5 vueltas, mediana):

| celular | Antes | Después |
|---|---:|---:|
| Fuentes bajadas (todas las rutas) | 151,6 KB | 117,8 KB |
| `/` LCP | 3792 ms | 3576 ms |
| `/` FCP | 1188 ms | 1212 ms |
| `/feed` LCP | 3880 ms | 3652 ms |
| `/feed` FCP | 1136 ms | 1064 ms |
| `/turno` LCP | 3072 ms | 2900 ms |
| `/turno` FCP | 1176 ms | 1036 ms |

LCP −170 a −230 ms en celular; FCP entre −140 ms y +24 ms (ruido). En
desktop, sin throttling, no hay diferencia medible. Lighthouse en `/` quedó
igual (puntaje 76 → 75, LCP 4,50 → 4,64 s, dentro del ruido de la máquina
compartida).

**Queda abierto:** Inter y Schibsted Grotesk (47 + 45 KB precargadas) son las
dos de la interfaz y se usan en todas las pantallas; no se tocaron.
