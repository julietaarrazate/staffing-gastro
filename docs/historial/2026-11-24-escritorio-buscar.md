# Buscar y Mapa en la compu: el mapa al lado de la lista en Buscar de quien trabaja

**Pedido:** Julieta, 2026-11-24: optimizar todo el sistema para web y mobile (renglones 4 y 10 de
`docs/planning/ESCRITORIO_PANTALLAS.md`: Buscar y Mapa, del comercio y de quien trabaja).

**Qué cambió:** mirado a 1440 px renderizado (claro y oscuro):

- Comercio (`/search`, busca personal; no usa `/buscar` ni `/map`, el renglón 4 apuntaba a rutas de quien
  trabaja): ya estaba bien: panel de 400 px con título, filtros y personas en una columna, y el mapa
  ocupando el resto. Sin cambios de código; se agregó la prueba de la disposición.
- Quien trabaja, Mapa (`/map`): ya estaba bien (mismo panel de 400 px + mapa). Sin cambios; prueba nueva.
- Quien trabaja, Buscar (`/buscar`): era sólo lista (dos columnas de tarjetas en el marco de 1024 px) y
  para ver el mapa había que cambiar de pantalla. Desde `lg` ahora son lista (una columna, ~460 px) y mapa
  de turnos al lado, pegado arriba mientras se baja por la lista. Tocar un pin resalta su fila y la lleva
  al centro; pasar el mouse por una fila resalta su pin. El mapa abre donde está la persona; sin ubicación,
  en el primer turno con coordenadas y sin el punto azul ni el anillo (`sinOrigen` en `ShiftMap`). En
  celular y tablet no se monta (ni baja MapLibre): 390 px comparado píxel a píxel, sólo difieren nubes y pines
  que se animan.

Técnico: `frontend/app/buscar/page.tsx`, `frontend/components/worker/ShiftMap.tsx` (prop `sinOrigen`),
estilos `.buscar-mapa-lateral` y `.fila-buscar-celda` al final de `frontend/app/globals.css`. Pruebas nuevas
en `e2e/buscar-suave.spec.ts`, `e2e/buscar-comercio-suave.spec.ts` y `e2e/mapa-suave.spec.ts`.

**Por qué así:** Buscar y Mapa son la misma tarea vista de dos maneras (ADR-0028, conmutador Lista / Mapa);
en la compu hay lugar para las dos a la vez, y el conmutador queda para el celular. Se reusó `ShiftMap`
tal cual en vez de otro mapa. Se descartó cambiar `/map` y `/search`: ya eran lista y mapa lado a lado.

**Queda abierto:** el conmutador Lista / Mapa sigue visible en compu en `/buscar` (lleva a `/map`, que
sigue siendo válido); si se quiere ocultar, es decisión de producto. El mapa de `/buscar` muestra todo el
mercado (`scope=all`), no sólo lo cercano.
