# Buscar en la compu, sin el conmutador Lista / Mapa

**Pedido:** Julieta, 2026-11-24: de lo que quedó abierto en la versión de escritorio (#740), sacar el
conmutador Lista / Mapa de Buscar en la compu.

**Qué cambió:** desde `lg` (1024 px), `/buscar` ya muestra el mapa de turnos al lado de la lista
(#740), así que el conmutador del cielo llevaba a otra pantalla con lo mismo. Ahora no se muestra ahí
(`lg:hidden!` en `app/buscar/page.tsx`; el `!` porque `.conmutador` pone su propio `display`). En el
celular y la tablet sigue igual. `/map` conserva su conmutador, y su «Lista» vuelve a Buscar.

Pruebas: `e2e/lista-mapa.spec.ts` recorre la ida y vuelta a 390 y a 900 px (antes, a 1280) y suma
una prueba a 1280 (Buscar sin conmutador, el Mapa con el suyo); en `e2e/buscar-suave.spec.ts` la
prueba de foco suelta el resaltado enfocando «Urgentes» en vez del conmutador.

**Por qué así:** dos caminos a lo mismo confunden y ocupan el cielo. `/map` queda: es la vista del mapa
grande y se sigue pudiendo abrir.

**Queda abierto:** nada de este cambio.
