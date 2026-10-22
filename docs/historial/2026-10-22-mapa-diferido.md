# El mapa (maplibre) deja de venir en la carga inicial de tres pantallas

**Pedido:** Julieta, 2026-10-22: reducir el bundle con lazy loading y medir
antes y después.

**Qué cambió:** el turno público (`/turno/[id]`), el alta (`/bienvenida`) y
"Datos del comercio" (`/profile/edit`) importaban maplibre (~286 KB
comprimidos) de forma estática. Ahora lo cargan con `next/dynamic` y
`ssr: false`, como ya hacía `ShiftCard`, con un esqueleto del mismo tamaño
mientras llega. Archivos: `frontend/components/ShiftDetail.tsx`,
`frontend/app/bienvenida/page.tsx`, `frontend/components/CompanyProfileForm.tsx`.

**Medición** (scripts del relevamiento de rendimiento: build de producción,
API simulada con 80 ms, celular 390x844 con CPU 4x y 4G lenta, mediana de 3;
Lighthouse 13.5 en celular; con DSN de Sentry, como en producción):

| | Antes | Después |
|---|---|---|
| JS inicial `/bienvenida` (gzip) | 554 KB | 261 KB |
| JS inicial `/profile/edit` (gzip) | 555 KB | 262 KB |
| `/turno` celular, LCP | 5,9 s | 3,2 s |
| `/turno` Lighthouse celular, puntaje | 59 | 65 |
| `/turno` Lighthouse celular, LCP | 7,4 s | 7,0 s |

En `/turno` el JS total no baja, porque el mapa chico se muestra igual: se
carga después de pintar la página en vez de antes. El TBT de `/turno` quedó
en el margen de ruido (664 → 875 ms en una corrida, ±10 % entre corridas).

**Queda abierto:** en el turno público, cambiar el mapa interactivo por una
imagen estática sacaría los 286 KB del todo. El resto del relevamiento
(Sentry diferido, pedidos por tarjeta del feed, fuentes, imagen del inicio,
salto del mapa) va en PRs aparte.
