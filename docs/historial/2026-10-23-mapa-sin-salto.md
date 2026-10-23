# Mapa: la lista de turnos ya no salta al abrir (CLS 0,197 → 0) (#498)

**Pedido:** Julieta, 2026-10-23: seguir con el relevamiento de rendimiento
del frontend (ítem 7, salto del mapa), midiendo antes y después.

**Qué cambió:** en `/map` (celular), la hoja de abajo con las tarjetas de
turnos aparecía con un alto provisorio y, apenas la app medía la pantalla,
saltaba a su lugar. Ahora aparece directamente en su lugar final; el
arrastre y el toque en la manija funcionan igual.

En `frontend/components/worker/MapSheet.tsx`: el panel arrancaba con
`height: "58%"` y pasaba al alto medido en px por `ResizeObserver` (459 →
669 px en 390×844). Ahora el alto es siempre `88%` del contenedor (el snap
más alto; el `div.md:hidden` de afuera no está posicionado, así que el %
resuelve contra el mismo contenedor que se mide) y, mientras no hay medida,
el corrimiento vertical va en % de su propio alto
(`1 − SNAPS[i] / SNAPS[MAX]`). Con la medida, todo sigue en px como antes
para el drag.

**Por qué así:** el cambio de alto era la única fuente de layout shift de la
pantalla (`cls-sources.mjs /map worker`: `div.absolute.inset-x-0.bottom-0`
`[300,459] → [90,669]`). Un `translateY` no cuenta como shift, así que
alcanza con que el alto sea el final desde el primer cuadro.

**Medición** (scripts del relevamiento: build de producción con DSN de
Sentry, API simulada con 80 ms, celular 390×844 con CPU 4x y 4G lenta;
A/B intercalado antes/después, 5 vueltas, mediana):

| `/map` celular | Antes | Después |
|---|---:|---:|
| CLS | 0,197 | 0 |
| Fuentes de shift (`cls-sources.mjs`) | 1 (el sheet) | ninguna |
| LCP | 4040 ms | 4096 ms |
| TBT | 722 ms | 787 ms |

LCP y TBT quedan en el ruido (±10 % entre corridas); en desktop el sheet no
existe y nada cambia.

**Queda abierto:** nada de este ítem.
