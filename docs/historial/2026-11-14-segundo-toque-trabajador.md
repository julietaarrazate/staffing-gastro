# Segundo toque, segunda parte: publicar, postularse y retirar (G2: U006, U007, U008)

**Pedido:** salida a beta, grupo G2 de `docs/planning/BETA_DISENO_GRAVES.md`. Un
doble toque (el segundo llega a ~700 ms) no tiene que disparar la acción
siguiente. Se reusa `frontend/lib/use-tap-guard.ts`; no hay otra guarda.

**Qué cambió (lo que ve el usuario):**

- Publicar: pasar de paso («Continuar», «Atrás», elegir el puesto) pasa por la
  guarda, así que el segundo toque de «Continuar» ya no cae sobre «Publicar
  turno». Mientras la pantalla se asienta los botones se ven deshabilitados.
- Postularse en el mazo («Descubrir rápido»): «Postularme» pasa por la guarda y
  no se rehabilita a los 300 ms de la animación, así que el segundo toque no
  postula la carta que quedó debajo. Tocar la carta para abrir el detalle
  tampoco responde durante el asentamiento.
- Postularse en la grilla del Inicio (escritorio): la tarjeta postulada queda en
  su lugar, marcada «Postulado», hasta la próxima carga; las demás no se corren
  bajo el dedo. Descartar («No, gracias») sigue sacando la tarjeta, pero también
  pasa por la guarda.
- Diálogos (`components/ui/Modal.tsx`): mientras se cierra, la capa sigue
  recibiendo el toque y se lo traga (el velo no cierra nada y el diálogo queda
  `inert`); la pantalla de atrás no lo recibe. Vale para todos. Primera versión
  con `pointer-events-none`: descartada, dejaba pasar el toque a lo de atrás.
- Retirar una postulación (`app/my-shifts/page.tsx`): `withdrawApplication`
  ignora un segundo pedido en curso (`withdrawingRef`); «Sí, cancelar» y
  «Cancelar postulación» pasan por la guarda y se ven deshabilitados. Si el
  servidor contesta 400 o 404 (la postulación ya no estaba pendiente) la lista
  no se revierte: se recarga en silencio. Con cualquier otro error la
  postulación vuelve a su mismo lugar de la lista, sin pisar el resto.

**Qué cambió (técnico):** `OpportunityCard` recibe `locked` y `applied`;
`app/feed/page.tsx` guarda `appliedInGrid` (se vacía en cada `load` salvo que la carga haya empezado antes de una postulación) y `load` tiene guarda de «último pedido gana»; en el asistente de publicar, «Atrás» y las tarjetas de puesto también se ven deshabilitadas; `SwipeDeck`
corre `applyCurrent` dentro de `tapGuard.run` (la red sigue en segundo plano, la
guarda cubre la animación y el asentamiento). No se tocó `useLiveRefresh` ni la
guarda de «último pedido gana» de `my-shifts`; `tapGuard.locked` ya estaba en el
`paused`.

**Por qué así:** el diálogo de retirar queda deshabilitado 1 s tras abrirse
porque abrirlo es una acción guardada; es el mismo criterio de los diálogos de
U005 (rechazar, cancelar asignación, «Me fui»). Se descartó una segunda guarda
propia del retiro: `withdrawingRef` cubre el pedido en curso y la guarda cubre
el toque que cae después.

**Pruebas:** `frontend/e2e/segundo-toque-trabajador.spec.ts` (doble toque a 700
ms: publicar, postularse en mazo y grilla, retirar), `SwipeDeck.test.tsx`,
`Modal.test.tsx`. El e2e del Modal pone un botón de prueba bajo «Volver» y hace dos toques seguidos: falla con `pointer-events-none`. También hay e2e de retirar con 400 (no revierte, recarga) y con 500 (vuelve a su lugar). Sin test: la carga vieja del feed que termina tarde (sólo ocurre al recargar por una búsqueda del asistente mientras se postula).

**Queda abierto:** «Confirmar» turno asignado (`act(id, "confirm")`) en Mis
turnos no pasa por la guarda; no estaba en G2.
