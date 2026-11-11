# Panel del comercio: «Marcar como pagado» pide confirmación y un toque de más no dispara otra acción

**Pedido:** salida a beta, etapa 2 (arreglar lo que encontró la prueba de
punta a punta). Hallazgo bloqueante: en el panel del comercio, quien tocaba
dos veces «Cerrar turno» podía terminar con el turno «Pagado» sin haberlo
decidido, y al trabajador le llegaba «Te pagaron un turno». Con dos turnos
por cerrar, el segundo toque cerraba el otro.

**Qué cambió:** lo que ve el comercio:

- «Marcar como pagado» abre un diálogo: «¿Ya le pagaste este turno? Se le
  avisa a <nombre> que ya cobró este turno y no vas a poder deshacerlo», con
  «Volver» y «Sí, ya le pagué». El pago se registra recién con el «Sí».
- Después de cualquier acción del panel (publicar, cerrar, marcar pagado,
  cancelar, «no se presentó»), cuando la lista se redibuja los botones de
  acción quedan apagados un segundo y recién después se prenden. Un toque
  que cae en ese instante en el mismo lugar no hace nada: ni sobre el botón
  nuevo de esa tarjeta ni sobre el de la tarjeta que subió a ocupar su sitio.
- El diálogo tiene el mismo cuidado: recién abierto, el «Sí» está apagado un
  segundo y tocar afuera no lo cierra, para que el segundo toque de un doble
  toque no confirme ni lo haga desaparecer. «Volver» anda siempre.

Lo técnico:

- `frontend/lib/use-tap-guard.ts` (nuevo): `useTapGuard()` devuelve
  `{ locked, run }`. `run(action)` no arranca si hay otra acción en curso o
  si la pantalla se está asentando (`TAP_SETTLE_MS`, 1000 ms contados desde
  que la acción termina, no desde el toque). La decisión se toma contra un
  `ref`, así que no depende de que React ya haya repintado; `locked` es la
  copia para el `disabled`. Sirve igual para acciones inmediatas, como abrir
  un diálogo.
- `frontend/app/shifts/page.tsx`: `run()` pasa por la guarda; estado
  `confirmMarkPaidId` y el `Modal` de confirmación (el mismo componente que
  «Cancelar turno» y «No se presentó»).
- `frontend/components/ShiftActions.tsx`: props `locked` y `onMarkPaid`. El
  botón principal y los dos ítems del menú «Más» que abren una confirmación
  se apagan con `locked` (antes, sólo con una acción en curso, y «No se
  presentó» nunca). `onRun` ya no acepta `markPaid`.
- Tests: `frontend/lib/use-tap-guard.test.tsx`,
  `frontend/components/ShiftActions.test.tsx` y
  `frontend/e2e/shifts-panel-doble-toque.spec.ts` (dos toques en el mismo
  punto a 120 ms y a 700 ms, con uno y con dos turnos por cerrar; conexión
  lenta; el diálogo y su doble toque).
- Docs: fila de la guarda en `docs/reference/MAPA_DEL_CODIGO.md` y la
  confirmación en `docs/reference/PAYMENTS.md`.

El backend no cambia: `mark-paid` sigue igual.

**Por qué así:** el botón principal de la tarjeta ocupa siempre el mismo
lugar y cambia de acción con el estado; no se movió ni se reordenó nada
porque esa es la idea del panel (una sola acción por tarjeta). Hacían falta
las dos cosas:

- La confirmación sola no alcanzaba: cubre el pago, pero no el segundo toque
  que cierra otro turno, y dejaba el diálogo abriéndose solo.
- Deshabilitar los botones sólo mientras la acción está en curso (lo que ya
  había) tampoco: el segundo toque llega cuando la acción ya terminó y el
  botón nuevo está habilitado. Por eso la ventana se cuenta desde que la
  lista se redibuja.
- Se descartó ignorar el toque sin mostrar nada: un botón que se ve activo y
  no responde confunde. Apagado un segundo se entiende, y un lector de
  pantalla lo anuncia.
- Se descartó comparar la posición del toque con la del anterior: más
  código, depende del puntero (no cubre teclado) y no deja nada a la vista.
- Un segundo es lo que tarda una persona en leer el botón nuevo; cubre a
  quien vuelve a tocar porque «no pasó nada» y no frena a quien toca a
  propósito. Es un solo número (`TAP_SETTLE_MS`).

**Queda abierto:**

- El lado del trabajador (`frontend/app/my-shifts/page.tsx`) tiene el mismo
  patrón (una acción por tarjeta, en el mismo lugar) y todavía no usa la
  guarda: va en otro PR, reutilizando `useTapGuard`.
- Los links de la tarjeta («Elegir a alguien», «Chat») no pasan por la
  guarda: navegan, no cambian nada.
- El refresco de fondo del panel (cada 30 s con alguien en camino) también
  puede mover tarjetas sin que nadie toque nada; no está cubierto.
