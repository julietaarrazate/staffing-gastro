# Los errores de carga se ven como error, no como «no hay nada» (#758)

**Pedido:** que una carga fallida nunca se vea como lista vacía ni como pantalla
en blanco (ítems del tablero de la beta).

**Qué cambió:** en Buscar, Mis turnos (Matches), Inicio, Mapa y «Hoy» del admin,
si la carga falla se ve «No pudimos cargar. Revisá tu conexión y probá de nuevo.»
con «Reintentar». Casos que mostraban el vacío o algo peor:
- Buscar: el error salía en una barrita y debajo, igual, «No hay turnos en este
  rubro». Ahora el error reemplaza a la lista.
- Mis turnos: si fallaba `/applications/mine` o `/saved-shifts` se las tomaba por
  vacías («sin postulaciones»). Ahora sólo `/shifts/mine` es imprescindible
  (si falla, error en toda la pantalla); una falla de postulaciones o de
  guardados degrada únicamente su pestaña, con su `ErrorState` y «Reintentar», y
  «Asignados» sigue a la vista. Al reintentar se limpian los errores al empezar.
- «Hoy» del admin: un contador que no cargó decía «Al día» / «Ninguno ahora».
  Ahora dice «No pudimos cargar» y hay un aviso con «Reintentar»
  (`useAdminInbox().reload`); los números de la promesa también reintentan.
- Mapa: el título de la tarjeta era el texto crudo del error; ahora usa el texto
  unificado. `load` limpia el error al empezar y, si una recarga falla con turnos
  viejos en pantalla, sale un `ErrorBanner` chico con «Reintentar».
- Inicio ya tenía error con reintento; pasa al componente compartido.
- Nuevo `frontend/components/ui/ErrorState.tsx` (único, compartido, con
  `CARGA_FALLIDA_TITULO/TEXTO`) y `frontend/app/error.tsx`: pantalla de error
  general (`PaginaAviso`, «Probar de nuevo» con `reset`, link a inicio, reporte a
  Sentry sólo si hay DSN) y `app/global-error.tsx` mínimo para errores del layout
  raíz (propio `<html><body>`, estilos en línea, sin proveedores).

**Por qué así:** el vacío afirma algo sobre los datos; el error sólo admite que
no se llegó a verlos. Se reutilizó `EmptyState` y `PaginaAviso` en vez de crear
piezas nuevas.

**Tests:** `e2e/errores-de-carga.spec.ts` (Buscar claro y oscuro, Mis turnos,
Inicio, Mapa, admin Hoy: error visible, sin vacío, Reintentar recarga),
`components/ui/ErrorState.test.tsx`, `app/error.test.tsx`.

**Queda abierto:** `global-error.tsx` no se probó renderizado (no se puede forzar
un error del layout raíz en e2e). El resto de pantallas (comercio, chats, etc.) no se
revisaron; en Buscar/Mapa/Inicio, `/applications/mine` caído sigue tomándose
como «sin postulaciones» (se muestran turnos ya postulados, no un vacío).
