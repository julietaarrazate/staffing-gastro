# Inicio: la foto de la rueda se pide desde el HTML, sin esperar a hidratar

**Pedido:** Julieta, 2026-10-23: seguir con el relevamiento de rendimiento
del frontend (ítem 6, LCP de la landing), midiendo antes y después.

**Qué cambió:** en el celular la primera pantalla del inicio aparece un poco
antes: la foto más grande de la rueda (el LCP) ya no espera a que cargue el
JavaScript para empezar a bajarse. Nada cambia a la vista.

En `frontend/components/landing/HeroRueda.tsx`:

- La rueda se arma en el navegador (depende del ancho), así que sus fotos no
  estaban en el HTML del servidor, y además iban con el `loading="lazy"` por
  defecto de `next/image`. Lighthouse marcaba ~0,5 s de "resource load delay"
  en el LCP.
- Ahora `Rueda` llama a `preload()` de `react-dom` con el mismo srcset que usa
  `next/image` (`getImageProps`) para las fichas 0 y 1: sale como
  `<link rel="preload" as="image" fetchpriority="high">` en el `<head>` del
  HTML. Las fichas a la vista en 390 px (0, 1 y la última) van `eager`; el
  resto sigue `lazy`.

**Por qué así:** `priority` está deprecado en Next 16 y, como la rueda no se
renderiza en el servidor, no alcanzaba para que el pedido saliera del HTML.
Un primer intento precargando sólo la ficha 0 no mejoró nada: el LCP en
mobile es la ficha 1 (la 0 queda recortada arriba y pinta menos área). Con
las dos precargadas el "resource load delay" baja de ~480 ms a ~20 ms.

**Medición** (scripts del relevamiento: build de producción con DSN de
Sentry, API simulada con 80 ms, celular 390×844 con CPU 4x y 4G lenta;
A/B intercalado antes/después en la misma máquina, 5 vueltas, mediana;
la máquina estaba compartida y cargada, por eso el intercalado):

| `/` celular | Antes | Después |
|---|---:|---:|
| LCP (measure-vitals) | 3620 ms | 3468 ms |
| Lighthouse: puntaje | 73 | 78 |
| Lighthouse: LCP | 4,87 s | 4,50 s |
| Lighthouse: "resource load delay" del LCP | ~480 ms | ~20 ms |
| Bytes de imágenes | 74,5 KB | 74,5 KB |

En desktop no cambia nada medible (604 → 672 ms de LCP, dentro del ruido
de ±10 % entre corridas).

**Queda abierto:** el resto del LCP es esperar a hidratar: la rueda recién
se pinta cuando corre su `useEffect`. Renderizarla en el servidor (con un
ancho por defecto) sacaría ese tramo, pero cambia cómo se arma la rueda y
va aparte. Separar los estilos `.landing-*` del CSS global (render-blocking)
tampoco se hizo.
