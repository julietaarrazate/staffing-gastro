# Beta etapa 3 · grupo E: textos y formatos unificados (U050, U067)

**Pedido:** la prueba en la app encontró horas en 12 h y 24 h mezcladas,
«ARS» y «$» para la plata, distancias con punto y con coma, «1 turnos»,
«Mis turnos» y «Matches» para la misma pantalla del trabajador y «mozo» en
minúscula. Más el pendiente de la tanda 2: el mensaje de sin conexión de
`auth-context` y el «esperá un minuto» de `/recuperar` y `/verificar-email`.

**Qué cambió:** una regla por formato, y cada una sale de un solo helper.
- **Hora, 24 h siempre** (`20:00`): `formatShiftTime` (`lib/datetime.ts`) ahora
  fija `hourCycle: "h23"`; se borró `formatTime24` y el `formatClock` local de
  `/admin/en-vivo`. `argentinaISOToLocalInput` pasó de `hour12: false` a
  `hourCycle: "h23"` (con `hour12: false` la medianoche puede salir «24:00»).
- **Plata con «$»**, punto de miles, sin decimales: `formatArs` y
  `formatPayAmount` (ya existían). Salió «ARS» de `/map`, del comparador de
  turnos guardados, del asistente de publicar (resumen y «por hora»),
  `/admin/metricas`, `shift-share.ts` (el texto de difusión sale con el mismo `formatArs`; con un monto inválido omite la línea «Pago» en vez de poner «$0»), `WorkerGameCard` y `pedido-natural`.
- **Distancia con coma**: `formatDistance` nuevo en `lib/format.ts` (metros
  bajo 1 km, si no `formatKm`); reemplaza tres copias locales con
  `toFixed(1)` (`NearbyRow`, `CompareShiftsModal`, `OpportunityCard`) y los
  `toFixed(1)` de `/map`.
- **Plurales**: `plural(n, uno, varios)` en `lib/format.ts` (y `lib/api.ts`
  dejó de tener la suya). Corregidos «1 turnos cerca tuyo» (`/map`), turnos
  publicados y capacidad del comercio, eventos del trabajador, postulaciones
  y «de N turnos» en `/admin/en-vivo`, «Se publicaron N de M turnos» del
  evento, turnos usados del plan, y los chips de candidatos.
- **«Matches»** nombra la pantalla del trabajador en todos lados: la barra
  de escritorio (`Navbar`, antes «Mis turnos») y «Ver Matches» de
  `TurnoNoDisponible`. «Mis turnos» queda sólo para el comercio (`/shifts`).
- **Puesto con su etiqueta**: el `aria-label` de los marcadores del mapa decía
  «Turno de mozo»; ahora usa `SKILL_LABELS` («Mozo/a»).
- **Red y límite**: `NO_CONNECTION_MESSAGE`, `TIMEOUT_MESSAGE` y
  `RATE_LIMITED_MESSAGE` en `lib/api.ts`, usados por `request`,
  `auth-context` (ya no «No se pudo conectar con el servidor.») y por
  `/recuperar` y `/verificar-email`. El 429 dice en todos lados «Demasiados
  intentos. Esperá un momento y volvé a probar.».
- «Va en camino» (comercio) y «Voy en camino» (trabajador) **no se tocan**:
  son perspectivas distintas a propósito.

**Por qué así:** se centralizó en los helpers que ya existían (`format.ts`,
`pay.ts`, `datetime.ts`) en vez de crear otros. El backend ya cumplía la
regla (`services.py` usa `$15.000`, coma en km, plurales y `.label`).

**Tests:** `lib/format.test.ts` (`formatDistance`, `plural`),
`lib/datetime.test.ts` (24 h y medianoche); specs e2e que esperaban
«ARS 45.000», «4.1 km» o el texto viejo del límite, actualizados.

- **Más ajustes tras la revisión:** `formatDistance` redondea primero a
  metros (0,9996 km es «1,0 km», no «1000 m») y se usa también en `/search`,
  `CandidateSignals`, `EnRouteMap` y la landing; `plural()` tolera NaN/∞
  (0) y decimales; `formatPayAmount`/`formatMoney` (`lib/pay.ts`) redondean a
  pesos enteros y un monto inválido es «—», nunca «$NaN»; `/landing` y planes
  dicen «1 turno por mes»; `lib/errors.ts` importa `NO_CONNECTION_MESSAGE`.
- **Decisión de producto:** la pantalla `/shifts` del comercio se llama
  **«Panel»** en todos lados: barra de escritorio (antes «Mis turnos») y el
  link de vuelta de candidatos, ahora «Volver al panel».

**Queda abierto:** nada de este grupo.
