# BUGS.md — Bitácora de bugs recurrentes

Registro de bugs que ya se repitieron (mismo patrón, distinto lugar) o que vale la pena recordar
para no reintroducirlos. Cada entrada: patrón + causa raíz + fix aplicado + cómo evitarlo en
código nuevo. Mismo formato que el equivalente en `conciliacion-bancaria` (otro proyecto del EKP).

Primera versión, reconstruida a partir de `docs/STATUS.md`, `docs/TECH_DEBT.md`, los ADRs y
`git log` — no reescribe esos documentos, sólo destila el patrón reutilizable de cada fix.

---

## Fechas de negocio en zona horaria Argentina (UTC-3) vs. UTC del servidor

**Patrón:** cualquier cálculo de fecha de NEGOCIO hecho con `date.today()`/`datetime.now()` (sin
tz) en el backend (Render corre en UTC) usa el día UTC, no el día real en Argentina. Entre las
21:00 y las 00:00 ART eso adelanta un día el cálculo (ej. un cumpleaños que "ya pasó" cuando en
Argentina todavía falta un día). El bug no aparece en testing diurno, sólo en esa ventana horaria.
Mismo patrón, ya identificado y resuelto en `conciliacion-bancaria` (`app/services/tz.py`), que
Staffya no tenía hasta este fix.

- **Encontrado (2026-07-22):** `WorkerProfile.age` (`backend/app/modules/worker/domain/
  entities.py`) calculaba la edad con `date.today()` (UTC). Fix: `backend/app/core/tz.py` nuevo
  (`hoy_art()`/`now_art()`, `ZoneInfo("America/Argentina/Buenos_Aires")`, mismo diseño que
  Cuadra) + `age` usa `hoy_art()`. Test: `backend/tests/test_worker_age.py` fija 23:30 ART
  (=02:30 UTC del día siguiente) y verifica que la edad no se adelanta.
- **Auditado y descartado como falso positivo:** el conteo mensual de turnos de las suscripciones
  (`subscription/domain/entities.py::roll_period_if_expired`) **no** usa fechas de calendario —
  es una ventana rodante de 30 días sobre `datetime` completo (`period_start`/`period_end`,
  ambos UTC-aware), sin truncar nunca a `.date()`. No hay "mes calendario" al que un turno de las
  22:30 ART pueda caerle del lado equivocado: el corte de período es el mismo instante exacto se
  mire desde ART o desde UTC. Se revisó también el gating de publicación
  (`shift/application/services.py::_consume_publication_slot`) y no reintroduce el patrón. Si en
  el futuro se cambia a "mes calendario" real (ver comentario `PERIOD_LENGTH` en
  `subscription/domain/entities.py`), ese cambio sí va a necesitar `hoy_art()`/`now_art()`.
- **Frontend:** ya tenía el helper correcto desde antes (`frontend/lib/datetime.ts`, comentario
  explícito sobre por qué usa `Intl`/componentes locales y no UTC) y ningún componente usa
  `new Date().toISOString().slice(0,10)` para fecha de negocio (barrido con `grep`, cero
  resultados fuera de `node_modules`). El único uso de UTC en fechas (`app/shifts/new/page.tsx`,
  duplicar turno +7 días con `setUTCDate`) es correcto a propósito: Argentina no tiene horario de
  verano, así que +7 días en UTC preserva la hora de pared ART sin ambigüedad.
- **Excepción a propósito (no tocar):** timestamps de auditoría/creación/expiración de tokens
  siguen en UTC — `created_at`/`updated_at` (`func.now()` en todos los modelos ORM),
  `revoked_at`/`used_at` (sesiones y tokens de reset, `identity/infrastructure/repositories.py`),
  `check_in_at`/`check_out_at`/`no_show_at`/`paid_at` (`shift/domain/entities.py`), `expires_at`
  de tokens (`identity/application/services.py`). Son marcas de un instante técnico, no una fecha
  de negocio con corte de día — deben quedar comparables sin importar en qué zona corre el
  servidor.

**Cómo evitarlo:** nunca `date.today()`/`datetime.now()` sin tz para una decisión que dependa del
día calendario en Argentina — usar `hoy_art()`/`now_art()` (`backend/app/core/tz.py`) o, en el
frontend, `lib/datetime.ts`. Sólo dejar UTC en timestamps de auditoría/expiración que no
representan un "día de negocio".

---

## Pantalla en blanco si el backend está dormido (cold start de Render sin timeout)

**Patrón:** un `fetch` sin timeout explícito cuelga indefinidamente si el backend está frío
(cold start de Render, que puede tardar decenas de segundos) — el chequeo de sesión al abrir la
app quedaba esperando para siempre y la pantalla splash nunca resolvía a login ni a logueado.

- **Fix:** `frontend/lib/api.ts` agrega `timeoutMs` opcional vía `AbortController` (el chequeo de
  sesión al abrir la app lo pasa explícitamente) + `NetworkError` como clase distinta de
  `ApiError`: un timeout/fallo de red degrada a "deslogueado" en vez de tratarse como sesión
  inválida o colgar la UI. `SplashScreen` además tiene un tope duro de 6s para nunca quedar
  pegado en el logo.

**Cómo evitarlo:** cualquier `fetch` que pueda pegarle a un backend recién despertado (Render free
tier) necesita un timeout explícito y un tipo de error distinguible ("no respondió" vs. "respondió
que no", p. ej. 401). Nunca asumir que un `await fetch` resuelve en un tiempo razonable sin acotarlo.

---

## Mapa (MapLibre) que deja de responder al gesto tras navegar (pool `reuseMaps`)

**Patrón:** `@vis.gl/react-maplibre` con `reuseMaps` recicla la misma instancia interna de
`mapboxgl.Map` (WebGL/canvas) entre montajes NO relacionados, vía un pool estático de la
librería (`Maplibre.savedMaps`) compartido por todos los `MapView` de la app. El wrapper sólo
vuelve a llamar `.enable()`/`.disable()` sobre los handlers de gesto cuando cambia un prop
puntual (p. ej. `dragPan`), nunca por un cambio en el prop compuesto `interactive`. Si primero se
desmonta un mapa no interactivo (`MiniMap`, thumbnail de una tarjeta) y después se monta uno
interactivo (`/map`), éste reutiliza el `Map` con los gestos ya deshabilitados desde su
construcción original — queda "trabado" (no responde a pan/zoom) hasta refrescar la página
(que vacía el pool).

- **Fix:** `frontend/components/map/MapView.tsx` sincroniza a mano el estado real de los 8
  handlers de gesto (`scrollZoom`, `dragPan`, `touchZoomRotate`, etc.) en cada evento `load` del
  mapa — que se dispara también en el reuse simulado — en vez de confiar en que el wrapper lo
  haga por el prop `interactive`.

**Cómo evitarlo:** con `reuseMaps` (u optimizaciones de pool/reciclado análogas en cualquier
librería), nunca asumir que el estado de una instancia reciclada coincide con las props del
montaje actual — forzar la sincronización explícita en el evento de carga/reuso, no confiar en
que el wrapper reaccione a cambios de props compuestos.

---

## Pull-to-refresh nativo de Chrome Android por `overscroll-behavior` sólo en `body`

**Patrón:** al llegar al tope de una lista interna con scroll propio (`overflow-y-auto`, p. ej.
`BottomSheet`) y seguir arrastrando, el gesto no consumido escala al scroller raíz del documento.
`overscroll-behavior-y: contain` puesto sólo en `body` no alcanza: en modo estándar el "root
scroller" real es `document.scrollingElement`, que es `<html>`, no `<body>` — un gotcha
documentado de Chrome/web.dev. Sin el fix en `<html>`, Chrome Android interpreta el gesto como
pull-to-refresh nativo: aparece su spinner y recarga la página entera (parecía que "mapa + lista
se refrescaban solos", pero era un F5 real del navegador).

- **Fix:** `frontend/app/globals.css` repite `overscroll-behavior-y: contain` en el selector
  `html` además de `body`.

**Cómo evitarlo:** cualquier fix de `overscroll-behavior`/scroll-locking a nivel documento debe
aplicarse tanto a `html` como a `body` — nunca asumir que uno implica el otro, porque cuál es el
"root scroller" real depende del modo de renderizado del navegador.

---

## Postulación que quedaba "pendiente" para siempre tras ser asignada

**Patrón:** una transición de estado en una entidad relacionada (aquí, `ShiftApplication`) no se
disparaba automáticamente al ejecutar la acción principal (asignar un trabajador al turno) —
`ShiftService.assign_worker` cambiaba el estado del `Shift` pero nunca tocaba la `ShiftApplication`
PENDIENTE del trabajador elegido, que quedaba en ese estado para siempre aunque el comercio ya lo
hubiera asignado.

- **Fix:** `ShiftApplication.accept()` nuevo en el dominio (mismo patrón que `withdraw()`) +
  `ShiftService._accept_application` busca la postulación por turno+trabajador
  (`ShiftApplicationRepository.get_by_shift_and_worker`) y la acepta si está PENDIENTE; si la
  asignación fue directa (sin postulación previa) no hace nada y no falla.
- **Deuda relacionada, aceptada a propósito (no es este bug):** los demás postulantes PENDIENTE
  del mismo turno no se marcan RECHAZADA cuando el comercio elige a otro — ver
  `docs/TECH_DEBT.md` P5. Distinto problema (falta un efecto secundario adicional, no una
  transición rota) — no confundir los dos al tocar este área de nuevo.

**Cómo evitarlo:** cuando una acción principal (asignar, confirmar, cancelar) tiene entidades
relacionadas con su propio ciclo de vida, listar explícitamente TODAS las que deberían
transicionar como efecto de esa acción — no sólo la entidad raíz — y cubrirlas con un test de
integración que recorra el flujo completo, no sólo el caso feliz de la entidad principal.

---

## Cancelación tardía del comercio que no avisaba a nadie

**Patrón:** `Shift.cancel()` (el comercio cancela) es una transición terminal válida desde
cualquier estado no terminal, incluido con el trabajador ya CONFIRMADO/EN_CAMINO/trabajando — pero
no distinguía ese caso: cancelar con el trabajador ya comprometido tenía exactamente el mismo
efecto (ninguno sobre el trabajador) que cancelar un turno todavía sin nadie asignado. El
trabajador que ya había organizado su día alrededor de ese turno no se enteraba de la cancelación
por ningún canal, y no había ningún costo de reputación para el comercio.

- **Fix (ADR-0007):** `ShiftService.cancel_shift` detecta si el turno estaba en
  `COMMITTED_STATUSES` (CONFIRMADO/EN_CAMINO/CHECK_IN/TRABAJANDO/CHECK_OUT) al momento de
  cancelar. Si sí: notifica al trabajador (`shift_cancelled_late`, in-app + push best-effort) y
  penaliza al comercio (`CompanyProfile.late_cancellations`, nuevo, simétrico a
  `record_cancellation`/`record_no_show` del trabajador).

**Cómo evitarlo:** cuando una transición terminal (cancelar, cerrar, borrar) puede ejecutarse
desde distintos estados previos, preguntar explícitamente "¿a quién más afecta este cambio de
estado, y ese efecto es el mismo sin importar desde qué estado se llegó?" — si hay un estado
"comprometido" en el medio, casi siempre hace falta una rama de efectos (notificar, penalizar)
que no existe en el camino feliz sin compromiso previo.

---

Última actualización: 2026-07-22 (siembra inicial, `claude/robustez-tz-v2`).

## UI bloqueada esperando la red en interacciones en cadena (mazo de swipe congelado)

**Patrón:** una interacción que el usuario encadena rápido (swipe/like, toggles, pasos de un
wizard) hace `await` del request al backend **antes** de habilitar la siguiente interacción. En
local no se nota (latencia ~0), pero contra el backend real (Render free + Neon, con cold starts)
cada decisión congela la UI segundos: la siguiente carta/control queda visible pero "gris" e
inerte, y el usuario percibe la app rota aunque no haya ningún error.

- **Encontrado (2026-07-23, reportado por Julieta):** `SwipeDeck.tsx` esperaba el `POST
  /applications/shifts/{id}` con `busy=true` entre la animación de salida y el avance del mazo:
  tras cada like, la carta siguiente quedaba atrás (escala 0.94, opacidad 0.8 — "gris") con los
  botones deshabilitados hasta que el backend respondiera. Fix: avance **optimista** — el mazo
  pasa a estado local (`deck`), avanza apenas termina la animación (~0.3s) y la red viaja en
  segundo plano; si la postulación falla, la carta vuelve al tope del mazo y el reintento reusa
  la misma `Idempotency-Key` (misma garantía de no perder cartas que antes, sin la espera).
- **Cómo evitarlo:** en cualquier interacción encadenable, la respuesta de red no debe estar en
  el camino crítico del siguiente gesto. Patrón a seguir: actualizar la UI de inmediato, mandar
  el request en segundo plano y **revertir + avisar** si falla (igual que `toggleAvailable` en
  `app/feed/page.tsx`, que ya era optimista). El `await` bloqueante sólo se justifica cuando el
  resultado cambia qué pantalla sigue (ej. un pago).
