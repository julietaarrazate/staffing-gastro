# Candidatos: si la carga falla, se avisa y no se muestra «nadie se postuló»

**Pedido:** reporte externo BK-8E9CFE08111D (etapa 2 de la salida a beta). En
`/shifts/[id]/candidates`, si fallaba la red o el servidor, el comercio veía
«Todavía nadie se postuló» aunque sí podía haber postulantes: podía cancelar el
turno o esperar de más.

**Qué cambió:** ahora un error nunca se muestra como lista vacía.
- Si falla la carga de postulantes: aviso de error con «Reintentar» (el
  `ErrorBanner` del design system), sin el texto de vacío.
- El aviso de postulantes se ve en las dos pestañas (también al entrar por
  `?tab=recomendados`, que es lo que pasa al volver de un perfil).
- Si falla solo la de recomendados: los postulantes se ven normal con una línea
  discreta «No pudimos cargar los recomendados. Reintentar» y, en la pestaña
  Recomendados, el aviso completo en lugar de «Sin recomendados por ahora».
- El texto del error es neutro («Reintentá en un momento»): no culpa a la
  conexión cuando la falla es un 403 u otra que no es de red.
- Si ya había datos y una recarga falla: se conserva la lista y se avisa.
- «Todavía nadie se postuló» queda solo para cuando el servidor contestó bien
  con cero postulantes. Un turno ajeno o inexistente (404) se comporta como antes.

Técnico: `frontend/app/shifts/[id]/candidates/page.tsx` carga cada lista con
un hook local `useLoadedList` (loading, error, items; 404 = vacío vía
`isNotFound`; una respuesta vieja que llega tarde no pisa a la nueva). Se
decide por `items.length > 0` en vez de un «ya cargó», así con error nunca se
ve el vacío. Reintentar una lista no recarga la otra. Test:
`frontend/e2e/candidatos-error-de-carga.spec.ts` (API simulada; falla con el
código anterior).

**Por qué así:** cargas independientes en vez de una sola con
`Promise.all`: así un fallo parcial no tira la pantalla ni vacía lo que ya
estaba. Se descartó un toast, porque el error tiene que quedar visible hasta
que se reintente.

**Queda abierto:**
- El mismo patrón (`.catch` que vuelve error en vacío) está en:
  `frontend/app/my-shifts/page.tsx:99-101`, `frontend/app/feed/page.tsx:179-180`,
  `frontend/app/buscar/page.tsx:93-94`, `frontend/app/map/page.tsx:229` y
  `frontend/components/admin/AdminInbox.tsx:70-71`. Se reporta aparte.
- Duda de producto: un turno ajeno o inexistente (404) sigue mostrando
  «Todavía nadie se postuló»; se dejó como estaba, falta decidir si debería
  decir «no encontramos este turno».
