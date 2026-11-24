# La Administración en la compu: ya estaba casi toda bien, dos retoques

**Pedido:** Julieta, 2026-11-24: optimizar todo el sistema para web y mobile (renglón 20 de
`docs/planning/ESCRITORIO_PANTALLAS.md`).

**Qué cambió:** se miraron las diez pantallas de `/admin/*` a 1440 px en claro y oscuro (con datos de varios
ítems). La cáscara común (`PantallaAdmin`: menú lateral fijo de 13 rem y contenido, marco de 72 rem) ya
aprovechaba el ancho: tarjetas de «Hoy», «Turnos en vivo», «Verificación» y «Crecimiento» en grilla de dos o
tres, lista de «Personas» y ficha a lo ancho, «Seguridad» con ancho de lectura. Sólo dos cosas estaban mal
y se arreglaron detrás de `md:`:

- «Crecimiento»: la pastilla «Prioridad baja» se partía en dos líneas en la tarjeta de un comercio con nombre
  largo (`app/admin/leads/page.tsx`).
- «Métricas», «Semana por semana»: los encabezados «Publicados», «Cubiertos» y «Cumplidos» se cortaban a la
  mitad de la palabra (`components/admin/SerieSemanal.tsx`).

Ningún dato ni acción cambió. A 390 px las capturas son idénticas píxel a píxel. Dos pruebas nuevas en
`frontend/e2e/admin-suave.spec.ts` (bloque «en la compu (1440 px)»).

**Por qué así:** el marco de 72 rem alcanza para tablas y paneles de la admin; no hace falta uno más ancho.
Las demás pantallas no se tocaron por tocar.

**Queda abierto:** nada.
