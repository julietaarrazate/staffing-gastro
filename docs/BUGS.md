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

## Encuadre de foto que sube el espejo de lo que se ve (`ImageCropModal`)

**Patrón:** la vista previa corre la imagen con `translate(offset)` y el
lienzo de salida la dibujaba en `centro - offset·k`, con el signo al revés.
Una foto centrada se ve igual en la vista previa y en el recorte subido, así
que el error sólo aparece si el usuario mueve la foto, y nadie lo mueve en
un test. Estuvo desde 2026-07-30 (fotos de perfil) hasta 2026-09-23.

- **Encontrado (2026-09-23):** al adaptar el recorte a 16:9 para la foto del
  local, releyendo la cuenta. Confirmado midiendo el JPEG subido en el
  navegador: 43,8% de rojo con el signo viejo contra 56,3% con el corregido,
  sobre una imagen mitad roja y mitad azul arrastrada a la derecha.

**Cómo evitarlo:** si algo se dibuja dos veces (una vista previa y un
render final), la geometría va en **una** función pura
(`cropDrawRect`), con un test que **mueve** la imagen. Un caso centrado no
prueba nada, porque el signo no cambia el resultado.

---

## Un mock que borra la parte cara de una dependencia borra también la que se rompe

**Patrón:** el test mockea una dependencia externa con la versión *mínima* que hace pasar la
pantalla, no con una que tenga la misma FORMA que la real. Cuando la diferencia entre las dos
formas es justo el camino de código que falla, la suite queda verde con la app rota en
producción — y peor: la suite verde se usa después como evidencia de que el problema está en
otro lado.

- **Encontrado (2026-09-10):** `e2e/mocks.ts` respondía todo pedido de `style.json` con
  `{version: 8, sources: {}, layers: []}`. Un estilo sin fuentes no obliga a MapLibre a levantar
  su web worker; el estilo real de CARTO sí. Cuando maplibre-gl 6 (PR #329) empezó a fallar al
  crear el worker dentro del bundle de Next —`import.meta.url` no es una URL http(s), su propia
  función devuelve `""` y termina en `new Worker("", {type:"module"})`—, **los 79 tests E2E
  siguieron pasando** mientras `/map` quedaba en blanco para todos los usuarios, en los dos roles.
  Y el PR anterior había escrito "no era el estilo mock vacío de los tests" como hipótesis
  descartada, sin haberla probado nunca contra el mock.
  Fix del bug: `frontend/lib/map/worker.ts` + `frontend/scripts/copy-maplibre-worker.mjs` sirven
  el worker desde el propio origen y lo declaran en `config.WORKER_URL`. Fix del **agujero de
  test**, que es lo que importa acá: `frontend/e2e/mapa-worker.spec.ts` sirve un estilo con
  fuente vectorial, capa que la usa, glyphs y sprite, y exige **marcadores en el DOM** — no que
  exista el `<canvas>`, que existía igual estando todo roto.

**Cómo evitarlo:** al mockear una dependencia pesada, preguntarse *qué trabajo real le estoy
ahorrando* — worker, parseo, WebGL, red — y si ese trabajo es justamente donde puede romperse.
Si lo es, el mock tiene que conservar la forma aunque no el contenido (una fuente con 0 tiles,
no cero fuentes). Y aserción sobre lo que **cuelga** de que la dependencia funcione, nunca sobre
que el contenedor exista.

**Corolario de método:** una hipótesis anotada como "descartada" sin el experimento que la
descarta es peor que no anotarla — la próxima sesión la lee y no la vuelve a mirar.

---

## Una falla de carga que no se muestra es un bug invisible

**Patrón:** un gate del tipo `{cargado && contenido}` es correcto para evitar montar cosas antes
de tiempo, pero si nunca se agrega el camino de error, cualquier falla —red, CDN caído, un
archivo que no está donde se lo espera— se ve como una caja perfectamente en blanco. El usuario
no tiene nada que reportar más que "no se ve", y el equipo no tiene nada que buscar.

- **Encontrado (2026-09-10):** `MapView` montaba sus hijos sólo tras el evento `load` (fix
  correcto del #329). Con el worker de maplibre roto, `load` no llegaba nunca: sin fondo, sin
  pines, sin mensaje y **sin un solo error en consola** (el `error` del worker llega con
  `message` vacío y maplibre no lo re-emite). Tardó un día en llegar como reporte y otro tanto
  en aislarse. Fix: pasados 15s sin `load`, `MapView` muestra "No pudimos cargar el mapa" con un
  botón **Reintentar** que construye un mapa nuevo (`key`), y hay un spec que lo fija.

**Cómo evitarlo:** todo gate de carga necesita su rama de fallo *antes* de mergearse. Si no hay
forma barata de detectar el error puntual, alcanza un timeout generoso: tarde y con mensaje es
infinitamente mejor que nunca y en blanco.

---

## Aserción sincrónica sobre algo que escribe un handler asíncrono (falso rojo de E2E)

**Patrón:** en un spec de Playwright se guarda un dato desde un `page.route(...)` —el cuerpo de
un pedido, un contador de llamadas— y después se lo asevera con un `expect(...)` seco, sin
esperar. El handler corre cuando el pedido efectivamente sale, así que la aserción compite con
la red: pasa siempre en una máquina descansada y falla sola cuando la máquina está cargada.
Aparece como flake, pero tiene causa raíz y no es "el CI que anda mal".

- **Encontrado (2026-09-10):** `e2e/ai-assistant-fab.spec.ts`, `buscar_turnos`, hacía
  `expect(requestBody).not.toBeNull()` justo después del `click()`. Falló en una corrida con la
  máquina saturada; la captura mostraba el botón todavía en "Cargando…", o sea el pedido en
  vuelo. Fix: `await expect.poll(() => requestBody).not.toBeNull()`.

**Cómo evitarlo:** todo lo que escribe un handler de `page.route` se lee con `expect.poll` (o se
espera con `page.waitForRequest`), nunca con un `expect` inmediato.

---

## `evaluateAll()` en un spec de E2E: la única API de Playwright que NO espera

**Patrón:** es la hermana de la entrada de arriba, pero por otro motivo. Casi todo lo de
Playwright reintenta solo (`expect(locator)`, `locator.click()`, `locator.evaluate()` — este
último espera a que el elemento esté *attached*). **`locator.evaluateAll()` no.** Corre una vez
sobre lo que haya en ese instante y, si todavía no se renderizó nada, devuelve `[]` sin error.
El test falla mucho después, con un mensaje que no dice nada del origen:
`Expected length: 4 / Received length: 0`.

- **Encontrado (2026-09-16):** `e2e/acciones-rapidas.spec.ts`, "ninguna acción repite un destino
  del nav de abajo", leía los `href` con `fila.getByRole("link").evaluateAll(...)` apenas
  después del `goto`. Verde en local siempre; **rojo en CI** (run #670), con los otros dos tests
  del MISMO archivo en verde — porque esos dos usan `expect(...)`, que reintenta. Fix: esperar
  primero con `await expect(fila.getByRole("link")).toHaveCount(4)` y recién ahí leer los `href`.

**Cómo evitarlo:** antes de un `evaluateAll`, poner el `expect` que espera por lo que se va a
leer. Es una línea, y convierte un rojo mudo en una aserción que dice qué faltaba.

**Nota honesta de método:** este caso NO se pudo reproducir en local (~35 corridas con 4 workers
y la CPU cargada, servidor frío y caliente). El diagnóstico se sostiene en el log y en la
semántica documentada de la API, no en una reproducción. Cuando pasa eso conviene decirlo: un
arreglo justificado por lectura vale, pero no hay que venderlo como verificado.

---

## Un `<input>` crudo sin `text-ink`: se ve bien en claro y desaparece en oscuro

**Patrón:** en Oído el lienzo siempre es crema, pero la TINTA de body/html es oscura en los dos
temas por defecto (`color: var(--foreground)` hereda del token de texto, que sólo cambia dentro
de superficies invertidas como `.bg-card`). Un `<input>`/`<select>` que NO declara su propio
`text-ink` no hereda "gris seguro": hereda esa tinta oscura fija. Sobre `bg-surface` en claro
(un beige) igual se lee, así que el bug pasa desapercibido en el tema por defecto — y sólo se
manifiesta cuando `bg-surface` se invierte a oscuro y el texto oscuro queda sobre fondo oscuro.

Es una variante silenciosa del defecto de septiembre (tarjetas del color del lienzo, foco a
1.00:1): ahí faltaba un TOKEN de fondo; acá falta una CLASE de texto en un elemento puntual, así
que ni siquiera se ve en un review del sistema de tokens — hay que mirar el `<input>` mismo.

- **Encontrado (2026-09-16):** los `<input type="datetime-local">` de `/shifts/new` y
  `/shifts/new-event` (más un `<select>` de puesto en el evento y el input de mensaje de
  `/chats/[shiftId]`). Contraste medido en oscuro: **1.08:1** contra un mínimo AA de 4.5:1 —
  prácticamente el mismo color. Reportado por Julieta como "en el modo oscuro cuando pones la
  hora no se ve". Lo notable: una auditoría previa de estos MISMOS inputs (F1,
  `TECH_DEBT.md`, 2026-08-05) los revisó y decidió con motivo dejarlos con estilo propio en vez
  de migrarlos al Design System — decisión correcta, pero esa revisión comprobó la elección de
  componente, no el contraste en oscuro. Son dos preguntas distintas y conviene no confundirlas.

**Cómo evitarlo:** todo `<input>`/`<select>` fuera de `TextField` (que ya trae `text-ink` de
fábrica) declara su propio color de texto explícitamente. No alcanza con "se ve bien" en el tema
por defecto — hay que tocar el toggle de tema antes de dar un input por terminado.

**Detectarlo en bloque:** un elemento con texto crudo no se ve por `grep` de clases sueltas (el
`className` puede venir de un `cn(...)` con lógica condicional). Sirve extraer el tag completo
respetando llaves anidadas y revisar si su clase final matchea `text-(ink|white|night|focus-ink)`
— así se encontraron los 8 casos reales de esta pasada, descartando 3 falsos positivos que
resultaron estar dentro de comentarios.

---

## Modo oscuro: redefinir un `-text` sin redefinir su `-tint` (y el hairline que se queda claro)

**Patrón:** los tokens semánticos vienen en pares — `--color-X-tint` (fondo pálido del chip) y
`--color-X-text` (su texto). En el modo oscuro real (v5.0, el lienzo se oscurece entero) el bloque
`:root[data-theme="dark"]` aclara los `-text` en TODA la página. Si los `-tint` no se redefinen,
siguen siendo los pálidos de `:root` y cada chip queda con texto claro sobre fondo casi blanco.
Mismo mecanismo con `--color-line`: si el bloque oscuro no lo pisa, los bordes de tarjetas,
inputs y header quedan con el hairline claro y brillan sobre el fondo oscuro.

- **Encontrado (2026-09-22):** al renderizar el home nuevo del trabajador en oscuro. Chip activo
  "Cerca tuyo" y chips de estado del panel: ámbar `#e8920f` sobre `#fffbeb` ≈ **2.4:1**. Los bordes
  blancos venían de un `--color-line` que se perdió al corregir un typo en el mismo bloque (el
  bloque tenía `--line` pero no `--color-line`, y los componentes usan `ring-line`/`border-line`,
  que leen `--color-line`). `tsc`, build, Vitest y los 111 E2E pasaban.

**Cómo evitarlo:** cuando un bloque de tema toca un `-text`, tocar en el mismo lugar su `-tint`
(hoy: velo del propio color, `rgba(…, 0.14–0.18)`). Y no confundir `--line` (lo que lee `body`) con
`--color-line` (lo que leen las utilidades `ring-line`/`border-line`): son dos tokens. La
verificación que lo detecta es mirar una pantalla con chips y bordes en oscuro, no leer el CSS.

---

## Dos `asyncio.run` sobre el mismo motor async (la siembra demo que nunca corrió)

**Patrón:** `scripts/startup_seed.py` corría cada tarea con su propio `asyncio.run(...)`. El
motor de `app.core.database` es un global, y el pool de asyncpg ata cada conexión al event loop
que la abrió. La primera tarea terminaba y su loop se cerraba, pero la conexión volvía al pool;
la segunda la reusaba desde un loop nuevo → `got Future ... attached to a different loop`. Un
`except Exception` que imprime y sigue (correcto para no tumbar el arranque) lo convertía en una
línea de log que nadie leía, y en SQLite (los tests) no pasa.

- **Encontrado (2026-09-23):** con `SEED_DEMO_DATA=true` y dos deploys, Neon seguía con 0
  cuentas demo. Primero se culpó a `render.yaml` (que el blueprint pisaba al panel) y se cambió
  eso — sin efecto. La causa apareció al correr el `CMD` del contenedor contra un Postgres local.
  Roto desde 2026-08-16.

**Cómo evitarlo:** un script que usa el motor global corre **todo en un solo `asyncio.run`** y
cierra el pool (`await engine.dispose()`) dentro de ese loop. Y antes de tocar configuración
por un "no corre", reproducir el comando real contra la base real (Postgres, no SQLite): un
error tragado se parece a un flag apagado.

---

## Un endpoint de detalle que sólo pide "estar logueado" (`GET /shifts/{id}`)

**Patrón:** la ruta pedía `AuthUserDep` y nada más (`_current_user`, ni siquiera se usaba), y
devolvía el `ShiftResponse` entero. Ese schema lo arman las pantallas de las PARTES del turno, así
que trae datos de una persona: la posición en vivo del trabajador que va en camino
(`en_route_*`), dónde marcó llegada y salida, quién lo tomó, quién faltó. "Estar logueado" no es
una autorización cuando cualquiera puede crearse una cuenta (o entrar como invitado) y los ids
circulan públicamente (`/turno/{id}` se comparte por WhatsApp).

- **Encontrado (2026-09-22):** al armar el detalle de turno con sesión, que iba a leer este
  endpoint. Reproducido con tests antes del arreglo (otro trabajador leía `en_route_latitude`
  de un turno ajeno).

**Cómo evitarlo:** un endpoint que devuelve un recurso por id decide **quién es el que mira**
(parte del recurso / cualquier otro) y recorta lo que es de una persona para el segundo caso
(`_is_party_to` + `_without_worker_data` en `shift/api/routes.py`). Un parámetro
`_current_user` sin usar en una ruta de lectura es la señal para revisar.

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

## Imágenes de Cloudinary servidas a resolución completa (feed lento en mobile)

**Patrón:** `lib/cloudinary.ts::uploadImage` guarda el `secure_url` **original** de
Cloudinary (la foto tal cual se subió, 1–4 MB), y los componentes lo renderizan
directo en `<img src>` a tamaños chicos (avatares de 32–96 px, heros de tarjeta).
El navegador baja la foto entera y la encoge por CSS: en el feed foto-first del
trabajador, sobre datos móviles, eso son varios MB por pantalla y segundos de
espera para algo que se ve del tamaño de una tarjeta.

- **Encontrado (2026-07-23):** feed (`OpportunityCard` hero), `Avatar` (usado en
  todas las listas: feed, Matches, panel, candidatos), y perfiles públicos de
  comercio/trabajador servían el original. Fix: helper `cldThumb(url, width)` en
  `lib/cloudinary.ts` que inserta transformaciones de Cloudinary en la URL
  (`f_auto,q_auto` → WebP/AVIF, `c_limit,dpr_auto,w_<n>` → ancho tope al render
  real, con densidad de pantalla). Aplicado en `Avatar` (por su `px`), el hero
  del feed (w_800) y los heros de perfil (w_800).
- **Cómo evitarlo:** cualquier `<img>` que muestre una foto subida por el
  usuario debe pasar la URL por `cldThumb(url, anchoDeRender)`. El helper es
  idempotente y sólo toca URLs de `res.cloudinary.com` — las de otros hosts
  (avatar de Google, seed externo) pasan sin cambios, así que es seguro
  aplicarlo siempre. `next/image` no se usa (las fotos son de un host externo y
  el proyecto sirve `<img>` crudo, TECH_DEBT F5); `cldThumb` da el 80% del
  beneficio (formato/tamaño) sin ese cambio.

---

## Una fecha "futura" hardcodeada en un test, que deja de serlo con el tiempo real

**Patrón:** un fixture de test escribe una fecha absoluta ("2026-06-28T20:00:00") en vez de
calcularla relativa a "ahora", porque en el momento de escribirla estaba cómodamente en el
futuro. El test pasa sin drama durante meses — hasta que el reloj real la alcanza, momento en el
que empieza a fallar, casi siempre por un motivo que no tiene nada que ver con lo que ese test
dice probar (un filtro nuevo que sí mira la fecha, o un chequeo del scheduler que antes no
llegaba a tocarla). El mensaje de fallo no menciona la fecha para nada, así que el diagnóstico
arranca de cero cada vez.

- **Encontrado (2026-09-16):** 13 archivos de test (`grep -l '"2026-06-28T20:00:00"' tests/*.py`)
  comparten el mismo `_shift_payload()` con esa fecha fija. El fix de ADR-0015 agregó un filtro
  real (`list_open` excluye turnos cuyo `start_at` ya pasó) y **9 tests en 2 archivos** empezaron
  a fallar de golpe — todos asumían que un turno publicado con esa fecha seguía viéndose en el
  feed, sin importar cuándo corriera el test. Quedan 10 archivos más con la misma bomba, todavía
  sin estallar porque nada más los mira por fecha (detalle y lista completa en `TECH_DEBT.md`,
  T-DATE).

**Cómo evitarlo:** cualquier fecha de un fixture que el dominio vaya a comparar contra "ahora"
—turnos, vencimientos, cualquier `start_at`/`end_at`— se calcula relativa a
`datetime.now(timezone.utc)` en el momento de construir el payload, nunca como string literal.
Si dos tests necesitan la MISMA fecha para comparar entre sí, calculan la base una vez y suman
`timedelta` desde ahí — el punto de partida es lo único que no puede ser fijo.

**Segunda vuelta, mismo arreglo (2026-09-16):** el primer intento puso el `start_at` relativo
30 días en el futuro — "bien lejos, no hay forma de que esto falle". Rompió DOS tests más:
`Shift.check_in()` rechaza marcar llegada más de `EARLY_CHECKIN_WINDOW` (30 min) ANTES de
`start_at`, y varios tests de este archivo confirman y hacen check-in casi en el mismo instante
en que crean el turno. Con el `start_at` original hardcodeado (ya en el pasado por el paso del
tiempo), ese guard nunca se disparaba —un `start_at` pasado siempre cumple "no es demasiado
temprano"—, así que el problema estaba oculto. "Relativo al futuro" no alcanza: **la fecha tiene
que respetar TODAS las ventanas de tiempo cercanas que el dominio vaya a chequear**, no sólo la
que motivó el cambio. Se resolvió con 15 minutos — suficiente para seguir siendo "futuro" (el
filtro de `list_open`) y cómodamente adentro de cualquier ventana de gracia de 30 minutos del
dominio.
