# Candidatos: si la carga falla, se avisa y no se muestra «nadie se postuló»

**Pedido:** reporte externo BK-8E9CFE08111D (etapa 2 de la salida a beta). En
`/shifts/[id]/candidates`, si fallaba la red o el servidor, el comercio veía
«Todavía nadie se postuló» aunque sí podía haber postulantes: podía cancelar el
turno o esperar de más.

**Qué cambió:** ahora un error nunca se muestra como lista vacía.
- Si falla la carga de postulantes: aviso de error con «Reintentar» (el
  `ErrorBanner` del design system), sin el texto de vacío.
- Si falla solo la de recomendados: los postulantes se ven normal y, en la
  pestaña Recomendados, un aviso con «Reintentar» en lugar de «Sin recomendados
  por ahora».
- Si ya había datos y una recarga falla: se conserva la lista y se avisa.
- «Todavía nadie se postuló» queda solo para cuando el servidor contestó bien
  con cero postulantes. Un turno ajeno o inexistente (404) se comporta como antes.

Técnico: `frontend/app/shifts/[id]/candidates/page.tsx` separa `load()` en
`loadApps` y `loadCands`, cada una con su propio estado de carga, error y
«ya cargó»; se quitaron los `.catch(() => [])`. Reintentar una no recarga la
otra. Test: `frontend/e2e/candidatos-error-de-carga.spec.ts` (API simulada;
falla con el código anterior).

**Por qué así:** cargas independientes en vez de una sola con
`Promise.all`: así un fallo parcial no tira la pantalla ni vacía lo que ya
estaba. Se descartó un toast, porque el error tiene que quedar visible hasta
que se reintente.

**Queda abierto:** el mismo patrón (`.catch` que vuelve error en vacío) está
en otras pantallas de listas; se reporta aparte, no se tocó acá.
