# Feed: una sola composición por pantalla y sin re-renders de más

**Pedido:** Julieta, 2026-10-22: detectar y eliminar renders innecesarios,
midiendo antes y después.

**Qué cambió:** el feed montaba a la vez la versión de celular y la de
escritorio (una oculta con CSS) y, al tocar "Disponible" o cualquier control,
re-ordenaba los turnos y volvía a dibujar todas las tarjetas. Ahora:

- `frontend/app/feed/page.tsx`: `useIsDesktop` (`matchMedia` con
  `useSyncExternalStore`, `md` de Tailwind) monta sólo la composición que
  corresponde. En el servidor y la hidratación se asume celular. El orden de
  los turnos, el origen y la función de distancia quedan memorizados.
- `components/worker/FeedHero.tsx` y `components/worker/NearbyRow.tsx` con
  `memo`: no se vuelven a dibujar si sus datos no cambiaron.

**Medición** (scripts del relevamiento; build de producción con DSN, API
simulada a 80 ms; "antes" es `main` del mismo día):

| `/feed` | Antes | Después |
|---|---|---|
| Toque en "Disponible" (INP aprox., celular CPU 4x, mediana de 3×5) | ~270 ms | ~55 ms |
| Nodos DOM, celular 390 px | 2285 | 549 |
| Nodos DOM, escritorio 1280 px | 2284 | 1892 |
| TBT celular | 593 ms | 347 ms |
| Turno visible, celular | 4,39 s | 3,99 s |
| LCP celular | 4,08 s | 3,74 s |

El INP del relevamiento original era ~464 ms; ya había bajado a ~270 ms con
los arreglos de guardados (#484) y Sentry (#486). El umbral "bueno" es
200 ms.

**Queda abierto:** la grilla de escritorio sigue creando callbacks por
tarjeta (`onApply`/`onPass`); en escritorio la interacción ya está bien y no
se tocó.
