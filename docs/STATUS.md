# STATUS.md — Bitácora de avance del proyecto

> **Leer esto primero al arrancar una sesión.** Resume dónde estamos, qué está
> en vuelo y qué sigue, para no tener que releer todo el historial.
> **Regla de mantenimiento:** actualizar esta bitácora en el mismo PR cada vez
> que se mergea un cambio relevante (o inmediatamente después).

*Última actualización: 2026-08-09 (**Auditoría de producto/UI: batch UX
(PR6) — race condition en `/search`, límites de caracteres y errores de
formulario anunciados.** Dos hallazgos agrupados:
- **D4 — race condition en `/search`:** al montar se buscaba con el centro
  por defecto (Obelisco) y otra vez cuando `getCurrentPosition` resolvía
  con la ubicación real, sin cancelar la primera — si la respuesta vieja
  llegaba después (variación de latencia normal), pisaba los resultados
  correctos. Fix: contador de secuencia en `app/search/page.tsx` (sin tocar
  `lib/api.ts`); una respuesta que ya no es la más reciente se descarta en
  silencio.
- **D5/F4 — `TextField` sin `maxLength` ni error asociado al campo:**
  `components/ui/TextField.tsx` no tenía forma de reflejar el límite de
  caracteres del backend ni de asociar un error a su input (`aria-invalid`/
  `aria-describedby`) — toda la validación era un `<p>` suelto al pie del
  formulario. Agregadas ambas props (`maxLength`, `error` con `role="alert"`
  + `useId()` para el id); aplicado `maxLength` a los 3 campos concretos del
  hallazgo (nombre del evento, dress code en los dos wizards, nombre del
  comercio); agregado `role="alert"` a los `<p>` de error general de
  `register`, `WorkerProfileForm` y `CompanyProfileForm` para que un lector
  de pantalla los anuncie. 3 tests unitarios nuevos (`TextField.test.tsx`).
  La migración de `CompanyProfileForm` del `<input>` crudo al `TextField`
  del design system queda para el próximo PR (C3), junto con el focus trap
  de `Modal`/`Sheet` (F1).

Verificado: `tsc`/`build`/lint limpios, Playwright 28/28, Vitest 55/55.

Antes, mismo día: **Auditoría de producto/UI: batch de
polish (PR5) — overflow, `<h1>` de `/profile`, botones en loading y
consistencia visual.** Cinco hallazgos chicos y de bajo riesgo agrupados en
un solo PR (para no multiplicar corridas de CI, ver el punto anterior):
- **E1 — overflow real en "Pago c/u" del wizard de evento:** confirmado con
  Playwright (516px de contenido en un viewport de 320-412px). Causa:
  `<input type="number">` dentro de un `<label className="flex flex-1">`
  sin `min-w-0` no se achica por debajo de su ancho intrínseco. Fix:
  `min-w-0` en los labels e inputs de "Cantidad"/"Pago c/u"
  (`app/shifts/new-event/page.tsx`). Test de regresión nuevo en
  `overflow-audit.spec.ts` a 320px específicamente en esa ruta.
- **F2 — `/profile` no tenía `<h1>`:** rompía la navegación por headings.
  Agregado con el mismo patrón visual que el resto de las pantallas.
- **F3 — los botones en `loading` perdían su nombre accesible:** el
  spinner de `components/ui/Button.tsx` no tenía texto ni `aria-busy`.
  Agregado `aria-busy={loading}` + `<span className="sr-only">Cargando…</span>`.
- **C2 — el botón/link primario naranja tenía dos radios distintos**
  (`rounded-full` en 6 lugares vs. el token `--radius-btn` del design
  system): unificados todos a `--radius-btn`
  (`app/turno/[id]`, `app/chats/[shiftId]` —de paso, el botón "Enviar"
  también estaba por debajo del mínimo de 44px de alto, corregido—,
  `app/shifts`, `Navbar`, `ShiftActions`, `ImageCropModal`).
- **C4 — tamaño de `<h1>` de pantalla inconsistente:** unificado a
  `text-2xl` en `/map` (panel lateral), `/feed`, `/turno/[id]` y el propio
  wizard de evento (que además tenía DOS tamaños distintos en el mismo
  flujo, entre su formulario y su pantalla de resultado).

Verificado: `tsc`/`build`/lint limpios, Playwright 28/28 (incluye el test
nuevo de E1), Vitest 52/52.

Antes, mismo día: **CI: filtro por carpeta para no gastar
minutos de más.** Julieta corre CI con presupuesto acotado (2000 min/mes) y
notó que el workflow (`.github/workflows/ci.yml`) corría los 3 jobs
completos (`pytest`, `tsc`+`build`, Playwright) en cada push, sin importar
qué había cambiado — una PR 100% de frontend igual pagaba el `pytest`
completo, y viceversa. Fix: job nuevo `changes` (usa `dorny/paths-filter`)
que detecta si el cambio tocó `backend/**`/`frontend/**`, y los 3 jobs
existentes ahora sólo corren si su área cambió (`.github/workflows/ci.yml`
cuenta como cambio de ambas, a propósito: un cambio al workflow se valida
completo). De paso, se agrupa el resto del backlog de la auditoría de
producto/UI en menos PRs (2-3 en vez de 7) para bajar también la cantidad de
corridas de CI — ver más abajo.

Antes, mismo día: **Auditoría de producto/UI completa +
arranque del backlog (en curso).** Julieta pidió una auditoría sistemática
de calidad de producto (UI/UX, funcional, responsive, accesibilidad,
estados) para llevar la app "de un 40% a un 90%". Se hizo con 3 agentes de
investigación en paralelo + una pasada propia con Playwright (build de
producción real, 8 anchos de viewport × 3 roles, detector de overflow
automatizado) — reporte completo publicado como artifact, backlog P0-P4 con
plan de PRs chicos. Dos hallazgos de paso: `CLAUDE.md`/`TECH_DEBT.md` tenían
dos líneas desactualizadas (reputación del comercio y no-show automático ya
estaban implementados, no pendientes — corregido más abajo). Arrancando el
backlog en el orden de impacto de la auditoría:

- **PR1 — guard de sesión (hallazgo P1 más serio de la auditoría):** 13
  páginas protegidas (`/my-shifts`, `/shifts`, `/shifts/[id]/candidates`,
  `/chats`, `/chats/[shiftId]`, `/search`, `/map`, `/subscription`,
  `/workers/[id]`, `/companies/[id]`, `/shifts/new`, `/shifts/new-event`,
  `/feed`) leían sólo `token` de `useAuth()` (nunca `user`/`loading`
  global) y su `load()` hacía `if (!token) return;` sin apagar su propio
  `loading` local — con sesión vencida o entrando por URL directa sin login
  previo, quedaban con el skeleton girando para siempre, sin ningún camino
  de salida. Fix: hook compartido `lib/use-require-auth.ts` (mismo patrón
  que ya usaban `/profile`/`/admin`/`/bienvenida`, sólo que ninguna de las
  13 lo tenía) que redirige a `/login` en cuanto se resuelve que no hay
  sesión. Cambio mínimo por archivo (una línea de import + una de uso,
  mismos nombres desestructurados). Verificado: `tsc`/`build`/lint limpios,
  Playwright 27/27, Vitest 48/48.
- **PR2 — limpiar `screen-cache` en logout (hallazgo P1, fuga de datos
  entre cuentas):** `lib/screen-cache.ts` cachea el feed/perfil a nivel de
  módulo (vive lo que vive la pestaña) y ya exponía `clearCached(key)` para
  invalidar una entrada puntual, pero nada lo llamaba en `logout()` — en
  una computadora compartida, una segunda cuenta logueada en la misma
  pestaña veía por un instante (o indefinidamente, si el refetch de fondo
  fallaba) los datos cacheados de la cuenta anterior. Fix: nuevo
  `clearAllCached()` (vacía todo el `Map`), llamado en `logout()` junto a
  `clearSession()`. Test unitario nuevo (`lib/screen-cache.test.ts`, 4
  casos). Verificado: `tsc`/`build`/lint limpios, Playwright 27/27, Vitest
  52/52.
- **PR3 — idempotencia en creación de turno/evento (hallazgo P2,
  duplicados por reintento de red):** `POST /shifts` y `POST /shifts/events`
  eran las únicas dos mutaciones críticas del repo sin protección de
  `Idempotency-Key` — a diferencia de postularse, asignar, publicar,
  cancelar, no-show y suscribirse, que sí la tenían. Un comercio publicando
  un evento completo (varios turnos a la vez, uno por rol) que sufre un
  timeout/corte de red justo después de que el backend ya creó los turnos,
  y reintenta al ver el error, terminaba con el set entero duplicado. Fix:
  `RecorderDep` en ambos endpoints
  (`backend/app/modules/shift/api/routes.py`) + key de idempotencia en el
  frontend (`keyFor("create-shift")`/`keyFor("create-event")`,
  `app/shifts/new/page.tsx`/`app/shifts/new-event/page.tsx`), mismo patrón
  que ya usaba el resto del repo. 2 tests backend nuevos
  (`test_idempotency.py`). Verificado: pytest 301/301, `tsc`/`build`/lint
  limpios, Playwright 27/27.

Ver el artifact de la auditoría para el resto del backlog P0-P4.

Antes, mismo día: **El mapa embebido del alta de local
atrapaba el scroll de la página.** Julieta reportó que al
scrollear la pantalla del comercio donde está el mapa con el pin, el mapa se
movía en vez de la página — "no te permite navegar con naturalidad". Causa:
`MapAddressPicker` (el mapa embebido en `CompanyProfileForm` para elegir la
ubicación del local, ADR-0006) capturaba todo gesto de un dedo como paneo
del mapa, igual que un mapa de pantalla completa — pero acá vive adentro de
un formulario largo con scroll, así que arrastrar un dedo para seguir
bajando la página lo paneaba a él en cambio. Fix: `cooperativeGestures` de
MapLibre (feature nativa pensada justo para este caso) en `MapView.tsx`
(prop nuevo, default `false` para no tocar los mapas de pantalla completa
`/map`/`/search`, donde el paneo de un dedo SÍ es el gesto esperado) —
activado sólo en `MapAddressPicker`. Con esto, un dedo sobre el mapa
scrollea la página; se necesitan dos dedos para panear el mapa (aparece un
cartel nativo avisando). El pin sigue siendo arrastrable con un dedo sin
problema — el drag del marker es un gesto propio de MapLibre, independiente
del paneo del mapa que `cooperativeGestures` regula. Verificado: `tsc`/
`build`/`lint` limpios, Playwright 27/27 (incluye
`company-map-address.spec.ts`, que ejercita el drag del pin).

Antes, mismo día: **CV en PDF sube pero no abre: causa
identificada, pendiente de Julieta (no es bug de código).** Julieta subió un
CV de prueba en PDF y no lo podía ver ni desde el propio perfil del
trabajador ni desde `/workers/[id]` (`ERR_INVALID_RESPONSE` al abrir la
URL). El código está bien — el dato se guarda, el link se arma correcto —
pero Cloudinary bloquea por default la entrega de PDF/ZIP subidos sin firma
(`upload_preset` unsigned, nuestro caso) desde 2023, como medida
anti-abuso. Se arregla en el dashboard: Settings → Security → "Allow
delivery of PDF and ZIP files". Documentado en `CLAUDE.md` → "Pendiente de
la operadora" para que Julieta lo active cuando pueda. Una foto (JPG/PNG)
no debería pisar esta restricción, pero no está confirmado todavía.

Antes, mismo día: **TECH_DEBT.md T2 resuelto: tests
unitarios de frontend con Vitest/Testing Library (#174, mergeado).** Tercer
ítem de la deuda técnica por prioridad tras S1 y F4 (ver más abajo). El
frontend tenía E2E (Playwright, flujos completos con API mockeada) pero cero
tests de lógica/componentes aislados. Se agregó Vitest + Testing Library
(`vitest.config.mts`, `vitest.setup.ts`, script `npm run test:unit`, ahora
parte del job `frontend` en CI junto a `tsc`/`build`) — sin buscar cobertura
por número, apuntando a lógica con valor real de romperse en silencio: 48
tests en 6 archivos — `lib/datetime.ts` (conversión de zona horaria
Argentina cruzando medianoche, formato de rango mismo-día vs cruza-día,
duración con singular/plural), `lib/errors.ts`, `lib/shift-next-step.ts` (la
tabla completa de "única acción por estado" del panel del comercio),
`lib/map/geo.ts`/`lib/map/travel-time.ts` (Haversine y tiempos de viaje
estimados), y un componente con estado real, `components/EditableName.tsx`
(editar/guardar/cancelar, no reenvía si no cambió nada, mantiene el input si
falla el guardado). De paso: `@testing-library/react` en esta versión no
trae auto-cleanup para Vitest (sí para Jest) — sin `afterEach(cleanup)` en
`vitest.setup.ts` el DOM de un test de componente quedaba montado para el
siguiente y rompía los `getByRole` del test de después con duplicados;
quedó documentado en el propio setup para no volver a perder tiempo con eso.
Verificado: `npm run test:unit` → 48/48, `tsc`/`lint`/`build` limpios,
Playwright 27/27.

Antes, mismo día: **TECH_DEBT.md F4 resuelto: accesibilidad
sistematizada con `jsx-a11y/recommended` en el lint (#173, mergeado).**
Segundo ítem de la deuda técnica por prioridad tras S1 (ver más abajo). `eslint-
config-next` ya traía `jsx-a11y` como dependencia transitiva, pero sólo
activaba 6 de sus ~30 reglas — ninguna cubría lo que de verdad importaba
(labels de formulario sin asociar a su control, controles clickeables sin
soporte de teclado). Se agregó como dependencia directa y se activó el set
`recommended` completo (`eslint.config.mjs`, sólo las reglas — el plugin ya
lo registra `eslint-config-next` bajo el mismo nombre, y ESLint flat config
no permite redefinir un plugin). Salieron 16 errores reales, corregidos con
el mismo criterio que T5 (arreglar lo genuino, documentar y silenciar
puntual lo que se descarta con motivo, nada de blanket-disable): 7 labels
sin asociar (`CompanyProfileForm`, `WorkerProfileForm`, `CvUpload`,
`LocationPicker` — 3 eran labels reales de un input/textarea/select, se
arreglan con `htmlFor`/`id`; los otros 4 eran un `<label>` usado como
encabezado de sección sobre un widget compuesto, se bajan a `<p>` porque no
son labels de verdad), 4 tarjetas de turno en `/map` sin soporte de teclado
(`role="button"`+`tabIndex`+`onKeyDown`, no pueden ser `<button>` porque ya
contienen un botón real adentro), y un `autoFocus` intencional en
`EditableName` (foco esperado tras una acción explícita del usuario, no el
antipatrón que la regla previene — silenciado puntual con motivo, no
sacado). Aparte, una auditoría separada de "íconos sin `aria-label`"
(agente de exploración, 57 archivos/64 botones/142 `onClick`) no encontró
ningún caso — ya estaba resuelto de sesiones anteriores. Verificado: `npm
run lint` → 0 errores/6 warnings (los `<img>` de F5, sin cambios), `tsc`/
`build` limpios, **Playwright 27/27**.

Antes, mismo día: **TECH_DEBT.md S1 resuelto: refresh token
como cookie httpOnly (#172, mergeado).** Con el frente de QA de Julieta al día,
se retomó la deuda técnica por prioridad — arrancando por S1 (🔴 Crítica,
seguridad), el único ítem crítico de `TECH_DEBT.md` que seguía realmente
abierto (P1/I1/T1 ya estaban resueltos, sólo desactualizado el resumen).
Hasta ahora el refresh token (30 días de vigencia) viajaba en el body de
`/auth/login`/`/auth/refresh`/etc. y se guardaba en `localStorage` — un XSS
podía leerlo y usarlo hasta agotar sus 30 días, incluso después de un
"logout" (que sólo limpiaba el `localStorage` local; la revocación
server-side ya existía desde ADR-0002/R1.2 pero nunca protegía contra un
token ya filtrado). Ahora viaja **exclusivamente** como cookie `HttpOnly`
(`identity/api/routes.py::_set_refresh_cookie`, `Secure`+`SameSite=None` en
producción — Vercel/Render son sitios distintos —, `SameSite=Lax` sin
`Secure` en dev porque `localhost:3000`/`:8000` son el mismo *site*): se
sacó el campo `refresh_token` de `TokenResponse` (no sólo dejó de usarlo el
frontend — si siguiera en el body, un XSS que hookeara `fetch`/`XHR` podría
leerlo igual, sin importar dónde lo guardara el cliente) y `/auth/refresh`+
`/auth/logout` lo leen de `request.cookies`, no de un body `RefreshRequest`
(eliminado). El frontend (`lib/api.ts`) manda `credentials: "include"` en
cada request; `auth-context.tsx` sólo guarda el access token (15 min, ya
tenía poca exposición) más una marca sin secreto (`staffya_has_session`) para
saber si vale la pena intentar `/auth/refresh` al abrir la app — la cookie
httpOnly no se puede leer desde JS para decidirlo de otra forma. Tests
backend reescritos para el nuevo contrato: la mayoría de los flujos
(login→refresh→refresh de nuevo) no necesitaron tocarse porque el jar de
cookies de httpx ya se comporta como un navegador real; los que necesitan
replay de un token puntual (rotación, detección de reuso/robo, sesiones
concurrentes) usan dos helpers nuevos en `conftest.py`
(`new_client`/`refresh_with_cookie`, clientes independientes con jar propio
— httpx no sobreescribe una cookie ya presente en el jar con un `cookies=`
puntual por request, agrega un segundo header en vez de reemplazarla, así
que un jar fresco es la única forma confiable de controlar el valor exacto
enviado). E2E (`e2e/auth.spec.ts`, `mocks.ts`) actualizados al mismo
contrato. **pytest 299/299**, `tsc --noEmit`/`npm run build` limpios,
**Playwright 27/27**. **Importante para producción:** esto depende de que
`ENVIRONMENT=production` esté seteado en Render — si no lo está, la cookie
sale sin `Secure`+`SameSite=None` y el navegador la descarta en la request
cross-site real, el login sigue andando pero el refresh/logout fallan en
silencio (re-login cada 15 min); ver `CLAUDE.md` → "Pendiente de la
operadora".

Antes, mismo día: **Cuentas invitado filtradas de
`/search`/`/map` (#170, mergeado).** Julieta reportó ver las cuentas invitado
compartidas (`invitado.trabajador@oido.beta`, "Explorar sin cuenta") mezcladas
con trabajadores reales al buscar en `/search` o mirar `/map`. Como ambas
pantallas terminan pegándole al mismo endpoint (`GET /matching/search`), el
fix es de una sola línea con alcance acotado: `SqlAlchemyCandidateRepository
.list_available` (backend/app/modules/matching/infrastructure/repositories.py)
ahora excluye por email los `WorkerProfile` cuyo `User` sea una de las cuentas
invitado (`GUEST_ACCOUNT_EMAILS`, exportado desde
`IdentityService`/`app/modules/identity/application/services.py` junto al
diccionario privado `_GUEST_ACCOUNTS` que ya existía) — cubre tanto
`get_top_candidates` (postulantes recomendados de un turno) como
`search_workers` (usado por `/search` del comercio y por el `/map`/`/search`
de sólo lectura del admin, PR #168). La exploración del propio invitado no se
toca: un trabajador invitado no llama a `/matching/search` (es un endpoint de
comercio/admin), así que no hay caso en el que el filtro le esconda algo a sí
mismo. Test nuevo: `test_guest_worker_excluded_from_search_results`
(`backend/tests/test_matching.py`).

Antes, mismo día: **Causa raíz real de la X del Sheet que no
cerraba + mapa que se movía con el pin + subida de CV (#169, mergeado).**
Julieta volvió a reportar la X del `Sheet` sin cerrar en su teléfono real,
después de que el fix anterior (PR #166, drag de Framer Motion restringido a
la manija) pareciera correcto en el código. La causa real nunca fue el drag:
`Sheet`/`Modal` no portaban a `document.body`, así que al abrirse desde
DENTRO de un `Card` (`whileTap` activo), ese ancestro le rompía el
*containing block* al `position: fixed` — el overlay quedaba confinado a la
caja del `Card` en vez de cubrir el viewport, y el click no coincidía con el
botón aunque se viera bien. Reproducido de punta a punta con Playwright
`.tap()` (touch real, no mouse, dispositivo emulado) — afectaba también a
"Cancelar turno" (contenido del sheet, no sólo la X) y explicaba un fallo
"misterioso" preexistente en `employer-wizard.spec.ts` que veníamos
atribuyendo al entorno de esta sandbox. Fix real: `createPortal` a
`document.body` en ambos componentes (la solución estándar para cualquier
overlay `fixed`), drag-to-dismiss reescrito con Pointer Events nativos en
vez del prop `drag` de Framer Motion, y `Modal` con `z-[60]` explícito por
encima del `z-50` de `Sheet` (pueden coexistir de verdad: "¡Turno
publicado!" + el sheet de activar push, disparados por la misma acción).
Quedan 2 tests E2E nuevos con touch real (`e2e/sheet-touch.spec.ts`).
También en el mismo PR: el mapa panéaba entero al arrastrar el pin de
ubicación del comercio (se deshabilita `dragPan` durante el arrastre del
marker — bug clásico de MapLibre/Mapbox GL) y el CV del trabajador ahora
acepta arrastrar/subir un archivo (PDF/Word/foto, vía Cloudinary) además de
pegar un link.

**Nota de proceso para la próxima sesión:** si un bug de UI "ya arreglado"
vuelve a aparecer en el teléfono real después de un fix que localmente
parecía andar, sospechá primero de la causa raíz (¿el fix anterior resolvía
el síntoma o el mecanismo?) antes de asumir un problema de caché/entorno —
acá se perdieron horas re-verificando el mismo fix incorrecto (drag) con
métodos cada vez más rigurosos, cuando el mecanismo real (containing block
roto por falta de portal) era otro completamente distinto.

Antes, mismo día: **Mapa/Búsqueda de sólo lectura para admin
+ fotos en el panel de admin + wordmark del footer (#168).**
Julieta pidió poder "ver la plataforma entera" desde su cuenta admin, sin
tener que impersonar a alguien puntual primero (más allá de "Ver como", #165,
para debug de un usuario específico). Se relajó `/matching/search` (backend)
para aceptar también rol `admin` (antes sólo `employer`) — `/shifts/feed` ya
no tenía restricción de rol. El admin ahora tiene `/map` y `/search` en su
nav (`BottomNav`/`Navbar`), viendo TODOS los trabajadores/turnos activos
reales, sin acotar a un perfil propio (no tiene uno). "Postularme" en `/map`
se corta con un mensaje claro si el rol no es `worker` (el backend lo hubiera
rechazado de todos modos, no tiene perfil de trabajador). De paso: el panel
de admin (`/admin` → "Usuarios") no mostraba fotos de perfil —
`AdminUserResponse` nunca incluía `photo_url` (vive en
`WorkerProfile`/`CompanyProfile`, no en `User`); se resuelve ahora por
puerto en batch (mismo patrón que `VerificationService.verified_user_ids`:
`photo_urls_by_user_ids` nuevo en ambos repos). Y el footer de la landing
(`/`) decía literalmente **"staffya"** (nombre interno pre-rebrand) en vez
del wordmark real "oído" — corregido. Backend: **pytest 296/296 passed** +
1 test nuevo (`test_admin_can_search_map_read_only`).

Antes, mismo día: **"Ver como" (#165) + batch de bugs de QA en vivo (#166) +
fix de perfil admin, los tres mergeados.** Julieta probó la app real
(comercio, trabajador y admin, mobile) y reportó varios bugs de
golpe; quedaron resueltos en `claude/staffya-guest-bugfixes` (PR #166):
1. **Explorar sin cuenta pedía el PIN antes que el rol** — invertido: primero
   "Soy comercio"/"Soy trabajador", después el PIN (`frontend/app/login/page.tsx`).
2. **"Cancelar turno" sin confirmación** — causa real de "publico un turno,
   toco más, y se cancela el turno asignado": el menú "Más acciones" cancelaba
   sin preguntar (a diferencia de "No se presentó", que sí confirma). Ahora
   confirma, con aviso distinto si hay trabajador asignado.
3. **La X del `Sheet` (bottom sheet del DS) no cerraba, sólo deslizando** — la
   causa real (un fix anterior, PR #159, sólo había agregado el botón sin
   arreglar esto): `drag="y"` de Framer Motion estaba en todo el panel, así que
   un click en la X (o cualquier botón/link de adentro) podía leerse como el
   arranque de un arrastre y perderse. Ahora el arrastre sólo arranca desde el
   handle/header (`dragListener` + `dragControls`), nunca compite con los
   controles de adentro. Verificado con click directo en la X (ver nota de QA
   más abajo sobre por qué el E2E automatizado de esto no se pudo agregar).
4. **"Recomendados" se perdía al volver del perfil de un candidato** — el tab
   ahora vive en la URL (`?tab=recomendados`), no sólo en estado local.
5. **Geolocalización imprecisa al dar de alta un local** (reporte real:
   Julieta cargó su propia dirección y la distancia no daba) — el geocoder
   (Nominatim) puede errar la ubicación exacta y la única pista de que el pin
   es ajustable era un texto chico. Ahora hay un cartel explícito tras elegir
   un resultado de búsqueda, invitando a arrastrar el pin o usar el GPS.

**Nota de QA importante (para la próxima sesión):** el `webServer` de
Playwright (`npm run start`) sirve el build de `.next/` tal cual está — **no
rebuildea solo**. Si corrés E2E localmente después de tocar código, corré
`npm run build` primero o vas a estar testeando código viejo (esto costó horas
en esta sesión: el fix del Sheet parecía no funcionar y en realidad el server
de pruebas estaba sirviendo un build de 50 minutos antes). Aparte, este
entorno de desarrollo tiene un Chromium con mismatch de versión respecto al
`@playwright/test` del repo (no pasa en CI) que hace que la verificación de
"qué elemento intercepta un click" (`elementFromPoint`/actionability) dé falsos
positivos en componentes con animación (`Modal`/`Sheet`) — confirmado
reproduciendo el mismo síntoma en un test pre-existente sin tocar
(`employer-wizard.spec.ts`, que usa `Modal`, no `Sheet`). Por eso no se agregó
un test E2E nuevo para el cierre del Sheet: hubiera sido flaky en este entorno
sin ser un bug real. La corrección en sí se verificó manualmente (DOM
`.click()` + inspección del árbol de elementos).

**Resuelto en la misma sesión, después del batch #166:**
- ✅ **Perfil admin mostraba badge "Comercio" y "Mi comercio" tiraba "Permisos
  insuficientes"** (`frontend/app/profile/page.tsx`) — la pantalla sólo
  ramificaba worker vs. "todo lo demás" (employer); un admin caía en la rama
  de comercio por defecto y `CompanyProfileForm` pegaba a `/companies/me`
  (403, sin comercio propio). Ahora el admin tiene su propia rama: badge
  "Administrador", sin secciones de comercio/trabajador/reseñas.
- ✅ **"Ver como" (#165) SÍ está donde debía** — verificado en el código
  (`app/admin/page.tsx`): hay una sección "Usuarios" con el botón, debajo de
  "Identidades por verificar". Julieta no había scrolleado lo suficiente en
  la captura, no era un bug.
- ✅ **El ícono del estado vacío "No hay identidades por revisar" no está mal
  dimensionado** — es el patrón estándar de `EmptyState` (caja de 96px con
  ícono chico centrado), igual que en el resto de la app. Confirmado con el
  cálculo de escala de la captura; se retira de la lista de pendientes.

**Reportado por Julieta en la misma sesión, todavía SIN resolver** (materia
para la próxima sesión, por prioridad):
- 🟠 **Cuentas invitado apareciendo en resultados reales de búsqueda/mapa**
  ("Invitado · Trabajador", 0.0 ★, con el logo de la app como foto) — mezclan
  con trabajadores reales que ve un comercio buscando personal; evaluar
  filtrarlas de `/search` y `/map`.
- 🟡 Pedido explícito de Julieta: **auditoría de QA/performance/UX/UI/diseño
  más sistemática** ("hoy la app está a un 40%, llevarla a 90%") — no es una
  tarea puntual, es una línea de trabajo continua. Sin arrancar todavía más
  allá de lo de arriba.

Antes, mismo día: **"Ver como" (PR #165, mergeado)** — desde `/admin` un admin
impersona una cuenta real de comercio o trabajador para testear/dar soporte,
con auditoría, banner "Viendo como X" y vuelta con un click, sin dejar sesión
persistente en la otra cuenta (`POST /admin/users/{id}/impersonate`, sólo
access token de 15min, sin refresh token). Backend: 296 tests. Antes:
**Decisión de producto — identidad opcional
en la beta**: post-F1, Julieta planteó que pedir DNI + prueba de vida con
revisión manual es demasiada fricción para un marketplace en beta (Oído no es un
banco). Decisión: la verificación de identidad **queda opcional y sin
protagonismo** (ya no bloquea nada); la confianza de la beta se apoya en
**verificación de teléfono (L1, liviana/gratis — a construir)** + **reputación
(ya construida)**; la **verificación automática de DNI se difiere a F5/M4**
(proveedor KYC con free tier tipo Didit o RENAPER), a activar sólo si un comercio
lo pide o aparece fraude — encaja en el puerto `IdentityVerifier` sin redominar.
No cambia la arquitectura. Detalle y **lista de pendientes** en
[`TRUST_SYSTEM.md`](./TRUST_SYSTEM.md) §"Decisión de producto — postura de
identidad en la beta". Antes, mismo día: **EPIC-001 · Trust & Identity Platform —
F1 IMPLEMENTADA** (PR #157): tras aprobar el rediseño conceptual (#156,
mergeado), se construyó la Fase 1 del dominio de verificación de identidad.
Módulo backend nuevo **`verification`** (bounded context "Identity"; se llama
`verification` porque `identity` sigue ocupado por auth/cuenta — el renombre a
`account` es F2): entidades **`Claim` + `Evidence`** con máquina de estados
(NO_PRESENTADA→PENDIENTE→VERIFICADA/RECHAZADA, reenvío), **purga de la evidencia
sensible al decidir** (retención Ley 25.326: queda el claim + auditoría, no el
DNI), agregación pura claim→**nivel de garantía L0–L4**, método `admin_manual`
como estrategia (KYC/Renaper a futuro sin redominar). Tablas `identity_claims`/
`identity_evidences` (migración **0025**). API: `/identity/me` (mi estado, sin
PII), `/identity/me/document` (subir DNI+selfie), `/identity/claims/pending` +
`approve`/`reject` (admin). Frontend: tarjeta de verificación del trabajador en
`/profile` (subir DNI+selfie, ver estado, reenviar), cola de revisión en
`/admin`, y chip **"Identidad verificada"** (`IdentityVerifiedBadge`) en el
perfil público del trabajador y en la tarjeta de candidato — el comercio lo ve
enriquecido **por puerto** (`VerificationService.verified_user_ids`, batch,
capa API, sin acoplar el matching al dominio Identity). Se **sacó
`perfil_verificado` del catálogo de reputación** (`lib/reputation.tsx`,
`WorkerBadge`): la identidad ya no es una insignia de desempeño. Verificado:
**pytest 287 passed**, `tsc` limpio, `npm run build` OK. Falta (F2+): extraer
`professional_profile`/`reputation` de `worker`, renombre `identity`→`account`,
KYC automático, claims del comercio (`negocio_verificado`). Antes, mismo hilo:
**rediseño conceptual, sólo documentación**: el 4º punto del inversor
(verificación de identidad DNI+selfie) se replanteó como la base de un sistema
de confianza que evolucione por años, en vez de un badge aislado. Se detuvo la
implementación (una v1 backend quedó **stasheada, sin mergear**, como
referencia técnica) y se rediseñó el dominio: **cuatro contextos separados**
(Account / Identity / Professional Profile / Reputation), **Identidad modelada
como `Claim` + `Evidence`** (afirmación auditable respaldada por pruebas con
método/verificador/fecha/expiración, no un booleano), niveles de garantía
L0–L4, método de verificación como estrategia (admin manual → KYC futuro) y
retención de PII fundamentada en la **Ley 25.326**. Entregables:
[`docs/TRUST_SYSTEM.md`](./TRUST_SYSTEM.md),
[`ADR-0010`](./adr/ADR-0010-modelo-de-confianza-cuatro-dominios.md),
[`docs/reference/IDENTITY_DATA_RETENTION.md`](./reference/IDENTITY_DATA_RETENTION.md).
**Refinamiento del mismo día — Visión Trust Platform (Parte II de
`TRUST_SYSTEM.md`):** se elevó el techo de "verificación de identidad" a
**infraestructura de confianza bidireccional** (comercio y trabajador ambos
sujetos de confianza e identidad — el modelo Claim/Evidence también aplica al
negocio: `negocio_verificado`/`cuit_verificado`), con **Trust Score** resuelto
como **compuesto interno para ranking + indicadores independientes visibles**
(se descarta el número social público), **Career Graph** como vista derivada
(el moat: historial atestiguado, no auto-reportado), **benchmark** vs
LinkedIn/Uber/Airbnb/MercadoLibre/Upwork/Indeed/Instawork, **principios de
arquitectura permanentes** (violarlos = ADR nuevo) y **roadmap de madurez
M1–M8**. Hallazgo accionable: la reputación del **comercio**
(`on_time_payment_rate`/tasa de confirmación) debe poblarse y mostrarse al
trabajador (cierra deuda de `TECH_DEBT.md`). Sigue sin escribirse código.
**Segundo refinamiento — lente de empresa/activo (Parte III de
`TRUST_SYSTEM.md`, §17–§19):** se evaluó a Oído como empresa cuyo activo durable
sería una **red de identidad profesional verificable para gastronomía**. Se
incorporaron, con veredicto explícito: **Career History** (ledger append-only de
turnos atestiguados = fuente de verdad, activo de primera clase), **Professional
Identity Graph** (unión emergente de los 4 dominios anclada a persona verificada
— no un módulo nuevo) y **efectos de red** analizados con honestidad (liquidez
local, datos con escala, activo propietario durable, portabilidad aspiracional).
**Career Graph** ya estaba (§13); **"Product Assets" como sección genérica se
descartó** (buzzword sin retorno en doc técnica). Regla nueva §15.13: el
historial atestiguado es activo de primera clase, portable, no fragmentado.
Cero código, cero infra nueva (el "grafo" es conceptual; Postgres alcanza).
Pendiente: aprobación de los docs antes de implementar la F1. Antes, mismo día,
**feedback de un inversor**: claridad del
wizard de publicar turno — un turno es una sola jornada (fecha en formato AR
dd/mm/aaaa, duración en vivo, puntero a "evento" sólo si el rango supera 24 h);
el pago se aclara como pago por la jornada completa + equivalente por hora;
campo nuevo "comida/perso" (como las propinas); y **precio de la plataforma visible
sin cuenta** — endpoint público de planes + sección de precios en la landing
(#155, mergeado). Ver la sección del mismo día más abajo. Antes,
2026-08-05 — **TECH_DEBT F1 + T5 resueltas**: F1
migró `/recuperar`, `/restablecer` y `/verificar-email` de `<input>` crudo a
`TextField` — el resto de los `<input>` del repo se revisaron y se dejaron
igual con motivo documentado, no aportaban mejora real; T5 dejó `npm run
lint` en 0 errores (era 25) desactivando una regla que marcaba como error
el idiom de fetch-on-mount de toda la app, más 2 fixes genuinos
(`react-hooks/refs` en `lib/useWebSocket.ts`, `exhaustive-deps` en
`app/shifts/page.tsx`) y 2 warnings menores resueltos (constante duplicada
sin usar, ternario-como-statement) — ver TECH_DEBT.md para el detalle
completo; antes, auditoría responsive/desktop cerrada: `/admin` resuelto —
última de las 13 pantallas, grilla 2-3 columnas igual que `/shifts`; el
mismo día también `/subscription`, `/companies/[id]`, `/workers/[id]` y
`/shifts/[id]/candidates` — ver sección de la auditoría más abajo para el
detalle completo; antes, endurecimiento de producción — seguridad,
performance e infraestructura, más verificación de email; antes, auditoría
real de dependencias con CVEs conocidas — `pip-audit`/`npm audit`,
TECH_DEBT.md S3; y el mismo día, cerrar sesión revoca el refresh token en
el backend, escalada automática de urgencia ADR-0009, métrica de tiempo
real de cobertura en el panel admin, `/profile`/`/chats`/`/my-shifts`
responsive, y asistencia del trabajador en 2 pasos + no-show automático) ·
todos los PRs se mergean con squash apenas quedan verdes (pedido de
Julieta) · **loop autónomo activo** (con auto-merge, confirmado
explícitamente por Julieta) para retomar el backlog no bloqueado sin
esperar "seguí" en cada paso.*

## Feedback de un inversor: claridad del wizard + precio público (2026-08-06)

Julieta probó la app y pasó feedback de un posible inversor sobre la pantalla
de publicar turno y sobre el modelo. Cuatro puntos; este PR cierra tres (el
cuarto, verificación de identidad, va en un PR aparte con ADR):

1. **"¿Es 1 día o más de 1 día?"** — el paso "¿Cuándo?" del wizard
   (`app/shifts/new`) eran dos `datetime-local` sueltos sin explicación. Un
   turno es **una sola jornada de X horas** (no hay turnos de varios días; que
   una jornada nocturna termine al otro día es normal, pero eso es contexto de
   dominio, no copy de la app). Ahora: subtítulo simple ("Inicio y fin de la
   jornada"), un **read-back de la fecha en formato argentino** (dd/mm/aaaa,
   `formatShiftRange`) para que no se malinterprete sin importar el locale del
   dispositivo, **duración en vivo** ("Jornada de 8 h"), y — sólo si el rango
   supera 24 h (error real) — un cartel que manda a **"publicar un evento"**
   (`/shifts/new-event`, el flujo real para varias jornadas).
2. **"El pago ¿es por hora, por turno o por día?"** — `pay_amount` es el pago
   de la jornada completa, por persona. El copy decía sólo "Por persona, en
   pesos". Ahora: **"Pago por la jornada completa, por persona (no por hora)"**
   + el **equivalente por hora** calculado de la duración ("≈ $6.000 por hora ·
   jornada de 8 h", con el placeholder de ejemplo en $48.000), para que no se
   malinterprete ni el comercio ni el trabajador.
2b. **Beneficio "comida/perso"** — común en jornadas full-time gastronómicas,
   igual que las propinas. Campo nuevo `meal` en el turno (dominio → migración
   `0024` → schemas → repo, patrón idéntico a `tips`; **no** se expone en la
   vista pública, misma decisión que `tips`), toggle "Incluye comida (perso)"
   en ambos wizards (turno y evento), y se muestra "+ comida" al trabajador
   en el feed (`OpportunityCard`), el panel (`ShiftCard`) y el mapa.
3. **"¿Qué costo tiene la plataforma en la versión sin cuenta?"** — el
   precio (mensualidad al comercio, ADR-0005) no se veía sin estar logueado.
   Nuevo endpoint público `GET /subscription/plans/public` (sin auth, mismo
   catálogo de `plans.py`, una sola fuente de verdad) + **sección de precios
   en la landing** (`components/landing/PricingPlans.tsx`, ancla `#precios`,
   link en el footer) con los 3 planes reales y "sin comisión por turno".
4. **"¿Cómo se validan los perfiles? ¿Quién los recomendó?"** (el punto más
   fuerte, riesgo del "chanta") — Julieta eligió **verificación de identidad**
   (DNI + selfie, badge "Verificado"). Va en un PR aparte con ADR nuevo:
   entidad de dominio, migración, subida de documento, badge en candidatos/
   perfil. Pendiente al cierre de este PR.

Helpers nuevos: `shiftDurationMinutes` + `formatDuration` en `lib/datetime.ts`.
Verificado real: `pytest tests/test_subscription.py` (12, incluye el público),
`tsc --noEmit` limpio, `npm run build` OK, `npm run lint` 0 errores, y
verificación visual con Playwright de los 3 cambios.

## TECH_DEBT F1 + T5 — TextField en auth + `npm run lint` en 0 errores (2026-08-05)

- **F1** (`docs/TECH_DEBT.md`): la nota original decía que migrar los
  `<input>` crudos restantes a `TextField` era "reemplazo directo, bajo
  esfuerzo". Al revisar el estado real del código eso ya no era cierto para
  la mayoría de los casos (checkbox estructuralmente incompatible, campos de
  wizard y controles inline con estilo intencionalmente distinto). Se migró
  sólo donde había una mejora genuina y no sólo cosmética: `/recuperar`,
  `/restablecer` y `/verificar-email` ganaron el toggle mostrar/ocultar
  contraseña de `TextField` gratis, que no tenían. El resto (checkbox de
  `/register`, inputs inline de `/chats`/`/search`, campos de
  `/shifts/new`/`/shifts/new-event`) se dejó como está — motivo detallado
  por caso en `TECH_DEBT.md`. `lib/cn.ts` perdió el export
  `AUTH_INPUT_CLASS`, que quedó sin uso. PR #154.
- **T5**: `npm run lint` pasó de 34 problemas (25 errores, 9 warnings) a 0
  errores/6 warnings (los 6 son `@next/next/no-img-element`, ya catalogados
  y fuera de alcance). La regla `react-hooks/set-state-in-effect` marcaba
  como error el patrón `useCallback` + `useEffect(() => { load(); },
  [load])` que usan ~15 archivos de toda la app para "traer datos al
  montar" — no es un bug (no hay cascada de renders, el `setState` ocurre
  una sola vez tras la respuesta async), así que se desactivó la regla en
  vez de reescribir esos archivos sin necesidad. Sí eran genuinos y se
  arreglaron: 2 errores de `react-hooks/refs` en `lib/useWebSocket.ts`
  (mutación de ref en el cuerpo del render → `useLayoutEffect`) y 1 warning
  de `exhaustive-deps` en `app/shifts/page.tsx` (`load` no seguía el patrón
  `useCallback` del resto de la app). De paso surgieron y se resolvieron 2
  warnings menores: una constante duplicada y nunca usada
  (`NO_SHOW_ELIGIBLE_STATUSES`, el gating real ya lo hace
  `ShiftActions.tsx`) y un ternario usado sólo por su efecto en
  `CompanyProfileForm.tsx` (reescrito como `if`/`else`).
  Verificado real: `npm run lint` (0 errores), `npx tsc --noEmit` (limpio),
  `npm run build` (25 rutas, sin errores). E2E: los specs que tocan los
  archivos modificados pasan igual que antes de este cambio; el único fallo
  de la corrida (`employer-wizard.spec.ts`) se confirmó preexistente
  (reproducido también en el commit anterior a este, sin los cambios de
  T5). `npm run lint` sigue sin estar en `ci.yml` — decisión de plataforma
  aparte, ahora sin el bloqueo de archivos preexistentes en rojo.

## Endurecimiento de producción: seguridad, performance e infraestructura (2026-08-04)

Encargado por Julieta como cierre de la auditoría técnica de 13 fases:
preparar el repo para producción sin tocar comportamiento funcional,
arquitectura ni contratos de API salvo una feature de cuenta pedida
explícitamente. Reporte completo con motivo/impacto/riesgo de cada cambio en
`SECURITY_CHANGES.md`, `PERFORMANCE_REPORT.md`, `INFRASTRUCTURE_REPORT.md` y
el resumen ejecutivo en `PRODUCTION_HARDENING.md` (los cuatro en la raíz del
repo).

**Seguridad:** `/docs`/`/redoc`/`/openapi.json` cerrados en producción; rate
limiting nuevo en `/auth/refresh`, envío de mensajes de chat (por usuario, no
por IP) y reenvío de verificación; tope de 8 conexiones WebSocket
concurrentes por turno/usuario; logging de eventos de seguridad (login
fallido, reuso de refresh token, 403 por permisos, acciones de admin, 429).
**Verificación de email** (feature nueva, no sólo hardening): al registrarse
con email+contraseña se manda un link de confirmación de un solo uso (48h),
`POST /auth/verify-email` + `POST /auth/resend-verification`
(anti-enumeración, mismo patrón que `forgot-password`), pantalla nueva
`/verificar-email`. No bloquea el login — sin gating funcional en este PR.

**Performance:** `/admin/stats` pasó de contar en Python sobre toda la tabla
`users` a una query SQL agregada (`UserRepository.count_stats`); dos índices
compuestos nuevos (notificaciones no leídas, postulaciones pendientes por
turno); tres CHECK constraints de integridad en `shifts` (red de seguridad a
nivel de base de datos, el dominio ya las garantizaba); compresión GZip de
respuestas >1KB. El análisis de `<img>`→`next/image` (10 usos, clasificados
en 3 buckets con plan de migración priorizado) quedó documentado en
`NEXT_IMAGE_ANALYSIS.md`, **sin migrar ningún componente todavía** — encargo
explícito de análisis primero.

**Infraestructura:** `redis` y `postgis/postgis` sacados de
`docker-compose.yml` (cero uso real confirmado en el código — matching es
Haversine en Python, no hay cliente Redis en ningún lado); `backend/README.md`
corregido donde documentaba esa arquitectura fantasma; advertencia de
`SEED_DEMO_DATA=true` en logs cuando `ENVIRONMENT=production` (sin apagarlo:
sigue siendo decisión operativa de Julieta).

**Diferido con motivo explícito** (no es deuda olvidada): cookie `httpOnly`
para el refresh token (cambio de arquitectura de auth, requiere ajustar CORS
`allow_credentials` + sumar CSRF), nonces de CSP, `allow_credentials` de
CORS vestigial, Unit of Work en `ShiftService.assign_worker`, adopción de
SWR/React Query — todos ya documentados como deuda consciente en
`TECH_DEBT.md`/los audits, no se reabrieron sin necesidad nueva.

**Regresión detectada y corregida en el camino:** al quedar la verificación
de email siempre activa, el registro de cualquier usuario en tests dispara
también un envío de email — rompió 6 tests preexistentes que asumían un solo
email capturado (`test_password_reset.py` ×5, `test_shift.py` ×1). Corregidos
antes de dar la fase por cerrada.

`pytest -q` → 270 passed. `npx tsc --noEmit` limpio. `npm run build` exitoso
(26 rutas, incluida `/verificar-email`). Migraciones `0022`/`0023` con head
único, `upgrade`/`downgrade` simétricos.

## Auditoría de dependencias con CVEs conocidas (2026-08-02)

Julieta preguntó directamente por el estado de seguridad del código. Más
allá de lo ya documentado en `TECH_DEBT.md` (headers, rate limiting, JWT
secret, revocación de refresh token — cerrada el mismo día), se corrió por
primera vez en este repo una auditoría real de dependencias de terceros:
`pip-audit` (backend) y `npm audit` (frontend). Detalle completo en
`TECH_DEBT.md` S3.

**Resuelto ahora (bajo riesgo, sin cambios de comportamiento):**
- Frontend: `next` 16.2.9→16.2.12 (parche) + `overrides` en `package.json`
  para forzar `sharp`/`postcss` (dependencias internas de `next`, no
  declaradas por nosotros) a versiones sin CVE. `npm audit` → 0
  vulnerabilidades (antes: 5 altas).
- Backend: `pyjwt` 2.10.1→2.13.0, `python-multipart` 0.0.20→0.0.32 (sin
  cambios de API que nos afecten).

**Deliberadamente diferido** (documentado con detalle en TECH_DEBT.md S3,
no resuelto en este PR): Starlette 0.41→1.x (exige subir FastAPI también,
~26 versiones menores de diferencia) y pytest 8→9 — ambos son saltos de
versión mayor que necesitan su propio ciclo de pruebas, no un bump a ciegas
junto con el resto.

`pytest -q`/`tsc`/`build`/Playwright verdes con los cambios ya aplicados.

## Cerrar sesión revoca el refresh token en el backend (2026-08-02)

`TECH_DEBT.md` S1 (🔴 Crítica) tenía un hueco documentado desde R1.2/ADR-0002:
el endpoint `POST /auth/logout` que revoca el refresh token ya existía en el
backend, pero el frontend nunca lo llamaba — "cerrar sesión" sólo borraba el
`localStorage` local, así que un refresh token filtrado (XSS, dispositivo
compartido) seguía siendo válido por sus 30 días completos aunque el
usuario "cerrara sesión".

`auth-context.tsx::logout()` ahora manda el refresh token guardado a
`POST /auth/logout` antes de limpiar el `localStorage` — best-effort: si el
request falla (sin red, backend caído), el logout local sigue funcionando
igual, el token sólo queda sin revocar hasta que expire solo. Sin cambios de
producto visibles (mismo botón, mismo flujo). Test e2e nuevo en
`frontend/e2e/auth.spec.ts` (verifica que el `refresh_token` correcto llega
al backend al tocar "Salir"/"Cerrar sesión"). `tsc`/`build`/Playwright
(25/25) verdes; sin cambios de backend (el endpoint ya existía).

**Sigue pendiente, sin cambios** (documentado en TECH_DEBT.md S1): migrar el
almacenamiento del refresh token de `localStorage` a cookie `httpOnly` —
cambio de contrato más grande, no resuelto en este PR.

## Escalada automática de urgencia (2026-08-02, ADR-0009)

Segundo paso de la misma reflexión de negocio que llevó a la métrica de
cobertura (ver sección de abajo): medir no alcanza, hacía falta que el
sistema **reaccione solo** cuando un turno tarda en cubrirse, en vez de
depender de que los primeros candidatos avisados se postulen.

`ShiftService.escalate_urgency` (nuevo): si un turno publicado no se cubre
en 8 minutos (`ESCALATION_DELAY`, valor semilla — un poco antes de los 10
minutos de la promesa), lo marca `urgent` (sube al principio del feed) y
manda un segundo aviso a un círculo más amplio de candidatos (radio 1.6× y
tope de 20 en vez de 10 — `_notify_nearby_workers` pasó de privado/de un
solo uso a parametrizado, reutilizado por `publish_shift` y por esta
escalada). Nueva notificación `urgent_shift_nearby`. Campo nuevo
`Shift.escalated_at` (migración `0021`) para que ocurra una sola vez por
turno.

Mismo scheduler in-process de ADR-0008 (renombrado de
`attendance_scheduler.py` a `scheduler.py`: ahora corre dos chequeos por
tick — asistencia y escalada — en vez de uno). `pytest -q`: 255 passed
(+4: escalada de urgencia, contra la baseline de 251 tras la métrica de
cobertura). `tsc`/`build`/Playwright verdes.

## Métrica de la promesa central: tiempo real de cobertura (2026-08-02)

Sesión de reflexión de negocio con Julieta (sobre quién es el cliente, cómo
escala un marketplace hiperlocal, y por qué la densidad de oferta en un
barrio importa más que la cobertura geográfica amplia): la conclusión fue
que antes de invertir en crecimiento hace falta poder **medir** si la
promesa central ("cubrir un puesto en menos de 10 minutos", `PRODUCT.md`) se
cumple de verdad — hoy nadie tenía ese número.

`Shift.published_at` (se marca en `publish()`) y `Shift.first_assigned_at`
(se marca la PRIMERA vez que `assign()` encuentra un candidato — no se pisa
en reasignaciones posteriores a un rechazo/no-show, para no mezclar
"cuánto tardó el matching" con "cuántos reintentos hicieron falta") son
columnas nuevas (migración `0020`, sin backfill: sólo mide desde acá en
adelante). `AdminService.get_stats` calcula, sobre los turnos ya cubiertos
(`ShiftRepository.list_recently_filled`, hasta 500 más recientes): el
tiempo promedio de cobertura y el % cubierto en menos de 10 minutos —
ambos `null` si todavía no hay muestra, para no mostrar un promedio
engañoso con pocos datos. El panel `/admin` suma dos tarjetas nuevas
("Tiempo prom. de cobertura", "Cubiertos en <10 min") con el tamaño de la
muestra debajo. `pytest -q`: 251 passed (+2: el dominio no pisa
`first_assigned_at` en una reasignación, y el cálculo del panel admin).
`tsc`/`build`/Playwright verdes.

## Asistencia del trabajador en 2 pasos + no-show automático (2026-08-02)

Pedido de Julieta a partir de una pregunta sobre por qué no detectar el
no-show por geolocalización: se explicó la limitación real (PWA, sin
tracking en segundo plano en navegadores — requeriría app nativa) y se
acordó en cambio bajar la fricción del flujo manual + avisar proactivamente.
Detalle completo en
[ADR-0008](./adr/ADR-0008-asistencia-simplificada-y-no-show-automatico.md).

**Asistencia en 2 pasos:** el flujo del trabajador en `/my-shifts` baja de 4
botones ("Salir hacia el turno" → "Llegué" → "Empezar a trabajar" → "Me
fui") a 2 ("Llegué"/"Me fui"): `Shift.check_in()` ahora acepta directo desde
`CONFIRMADO` (antes exigía pasar por `EN_CAMINO`) y `Shift.check_out()`
directo desde `CHECK_IN` (antes exigía `TRABAJANDO`). Los pasos intermedios
(`depart`/`start_working`) se conservan por compatibilidad con turnos ya en
vuelo, la UI nueva no los ofrece.

**Scheduler de asistencia in-process:** sin Cron Job nuevo de Render (el plan
free sólo tiene un web service) — un loop `asyncio` arrancado en el
`lifespan` de FastAPI (`app/modules/shift/application/attendance_scheduler.py`),
gateado a `settings.is_production`. Recorre cada 5 min los turnos
`CONFIRMADO`/`EN_CAMINO` sin check-in: a los 20 min de `start_at` manda un
push "¿ya llegaste?" (una sola vez, `shifts.checkin_reminder_sent_at`,
migración `0019`); a las 2hs marca no-show automático reutilizando
`ShiftService.mark_no_show` (ADR-0007). Cierra el ítem que `TECH_DEBT.md`
tenía documentado como abierto desde ADR-0007 (detección automática de
no-show). `pytest -q`: 249 passed (+6 del scheduler). `tsc`/`build`/Playwright
verdes.

## Publicación masiva para un evento (2026-08-01)

Pedido de Julieta: un comercio que necesita cubrir un evento completo (boda,
catering — varios roles a la vez) no tenía forma de publicarlo sin repetir el
wizard N veces. `POST /shifts/events` (nuevo) recibe un formulario único
(datos compartidos: nombre, horario, ubicación, dress code) + una lista de
roles ("3 mozos a $50000", "2 bartenders a $60000") y publica cada rol como
un **turno individual** (`quantity=1` intacto, **ADR-0003 no se toca**),
todos compartiendo un `event_id` nuevo (columnas nullable en `shifts`,
migración `0017`, sin tabla ni FK propia) para poder verse agrupados/con
progreso de cobertura después.

Cada turno consume su propio cupo del plan del comercio, igual que si se
publicara uno por uno (decisión de producto: el costo de conseguir 6
trabajadores es el mismo venga en una tanda o de a uno — si el bulk fuera
gratis del cupo, cualquiera lo usaría para esquivar el gating). Si el plan se
queda sin cupo a mitad de la publicación, queda **parcial**: se devuelven los
turnos que sí se pudieron publicar más `requested` para que el frontend
muestre "se publicaron X de Y" con CTA a mejorar el plan.

Frontend: `/shifts/new-event` (formulario con filas dinámicas de rol,
agregar/sacar) + pantalla de resultado; `/shifts` (panel) suma una tira de
progreso por evento ("Boda Martínez — 4/6 cubiertos", cruza todas las
familias de estado) y cada `ShiftCard` de un turno de evento muestra un chip
con el nombre del evento. `pytest -q`: 239 passed (+2: happy path con roles
mixtos, parcial por tope de plan). `tsc`/`build`/Playwright (24/24) verdes.

## Auditoría de responsive/desktop, pantalla por pantalla (2026-07-29, EN CURSO)

Julieta usó la app en escritorio (no sólo mobile) y encontró que, más allá de
lo visual, **la web se sentía "precaria"** comparada con la competencia
(Pasito): pantallas enteras diseñadas mobile-first sin adaptar a pantallas
anchas, quedando una tarjeta angosta centrada con toda la pantalla vacía
alrededor. Pedido explícito: repasar **todas** las pantallas, de más a menos
valor/tráfico, una PR por pantalla.

**Patrón del problema** (se repite en varias pantallas): un contenedor con
`max-w-md` fijo o un componente pensado para gesto táctil (swipe, bottom
sheet) que en `md+` no gana ningún layout alternativo — sólo se estira o
queda flotando en el medio de la pantalla.

**Pantallas ya resueltas:**

1. **`/map`** (#124, sobre el fix de #122/#123 — ver abajo): panel lateral fijo
   en `md+` con la lista completa de turnos (patrón Uber/Airbnb: lista + mapa),
   reusando el mismo sheet de detalle/postulación. Mobile sin cambios.
2. **`/feed`** (#125): el mazo de swipe (`SwipeDeck`) no tiene sentido con
   mouse. En `md+` pasa a una **grilla** de `OpportunityCard` (2-3 columnas)
   con "Postularme"/"No gracias" como botones directos por tarjeta — mismo
   `onDecide` de siempre. `OpportunityCard` ganó props opcionales
   `onApply`/`onPass`/`applying` (sin ellos, sin cambios: SwipeDeck mobile y
   la landing siguen igual). Header/buscador de ubicación pasan a
   `max-w-5xl` en desktop.

3. **`/shifts`** (#126, panel del comercio, home del rol employer): mismo
   problema — `max-w-2xl` con una sola columna de tarjetas grandes, ~380px
   vacíos a cada lado en desktop. Contenedor a `md:max-w-6xl` y la lista a
   `grid gap-4 md:grid-cols-2 xl:grid-cols-3` (sin alto fijo por tarjeta:
   a diferencia de `OpportunityCard` en el feed, `ShiftCard` tiene contenido
   más variable — mini-mapa, stepper, ReviewBox condicional — forzar una
   altura hubiera recortado contenido real). Mobile sin cambios.

4. **`/search`** (#128, buscador de trabajadores del comercio): tenía el mismo
   patrón mapa+BottomSheet que el viejo `/map` — el sheet mobile se estiraba
   en desktop dejando media pantalla vacía. Mismo fix que `/map`: panel
   lateral fijo (`md:flex`, filtros + lista de trabajadores) + mapa al lado;
   en mobile no cambia (filtros flotantes + BottomSheet). El conteo aparece
   ahora dos veces en el DOM (panel + sheet, cada uno visible en su
   breakpoint) — `search-sheet-overscroll.spec.ts` ajustado con
   `.filter({ visible: true })`.

5. **`/my-shifts`** (2026-08-02, matches del trabajador): mismo fix que
   `/shifts` (#126) — es el mismo `ShiftCard`, mismo problema (`max-w-2xl`
   con una sola columna). Contenedor a `md:max-w-6xl`, ambas pestañas
   (Asignados/Postulaciones) a `grid gap-4 md:grid-cols-2 xl:grid-cols-3`
   (el `EmptyState` queda afuera de la grilla, no como un ítem más — mismo
   criterio que `/shifts`, si no un solo estado vacío ocupa una sola columna
   y se ve raro). Mobile sin cambios. Verificado visualmente (screenshot en
   1440px: 3 columnas, botones "Llegué"/"Me fui" completos, sin desborde).

6. **`/chats`** (2026-08-02): a diferencia de las anteriores, no era un
   simple ajuste de grilla — son dos rutas separadas (`/chats` lista,
   `/chats/[shiftId]` conversación) que en mobile navegan como páginas
   completas. Se resuelve con un **layout compartido**
   (`app/chats/layout.tsx`, nuevo) al estilo inbox (Gmail/WhatsApp
   Web/Slack, justo la comparación de Julieta con Pasito): en `md+` la
   lista de conversaciones queda **fija a la izquierda** (con la
   conversación activa resaltada) y `children` (la conversación abierta, o
   un placeholder "Elegí una conversación" si estás en `/chats`) ocupa el
   resto a la derecha — sin duplicar el fetch de la lista al navegar entre
   conversaciones, porque el layout no se remonta (persiste entre rutas
   hijas de Next.js App Router). En mobile el comportamiento no cambia:
   `/chats` sigue mostrando sólo la lista y `/chats/[shiftId]` sólo la
   conversación a pantalla completa (controlado con clases `hidden`/`flex`
   según el pathname, mismo criterio que el resto de los fixes). El link
   "Volver a mensajes" de la conversación se oculta en `md+` (ya no hace
   falta, la lista está siempre visible al lado). Verificado visualmente
   con screenshots en 1440px (lista+conversación lado a lado, y el
   placeholder de índice) y 390px (ambas pantallas sin cambios).
7. **`/profile`** (2026-08-02): a diferencia de las pantallas de listas de
   turnos, esto es un formulario de cuenta (no tiene sentido una grilla de
   tarjetas — ensanchar inputs de texto a todo el ancho se ve mal, mismo
   criterio de no forzar layouts artificiales que ya guió el fix de
   `/my-shifts`). En `lg+` pasa a **dos columnas** (`lg:grid-cols-3`,
   patrón dashboard tipo GitHub/Stripe settings): la tarjeta de
   perfil/negocio + el formulario principal quedan en una columna angosta
   y legible a la izquierda (2/3), mientras Suscripción (sólo comercio) +
   Reseñas recibidas + Otros pasan a una columna secundaria a la derecha
   (1/3), en vez de apilarse debajo dejando media pantalla vacía a los
   costados. Mobile/tablet sin cambios (sigue siendo un único stack en el
   mismo orden). Verificado visualmente con screenshots en 1440px (worker y
   employer) y 390px.
8. **`/shifts/new`** (2026-08-04, wizard de publicar turno): a diferencia de
   las pantallas de listas, acá no hay contenido para gridear — es un wizard
   paso a paso, y ensanchar sus inputs/botones táctiles a todo el ancho se ve
   mal (mismo criterio que guió el fix de `/profile`, no forzar layouts
   artificiales). En `lg+` se suma un panel de **vista previa** fijo al lado
   (`WizardPreview`, patrón "resumen de compra" tipo Stripe checkout) con lo
   mismo que ya se mostraba en el resumen del último paso (puesto, cuándo,
   pago, dónde) — visible desde el primer paso y completándose en vivo a
   medida que el comercio avanza, en vez de dejar la tarjeta angosta del
   wizard flotando sola en el medio de la pantalla. El wizard en sí no
   cambia de ancho ni de comportamiento; sólo se agrega contenido nuevo al
   costado. Mobile sin cambios (el panel usa `hidden lg:block`). Verificado
   visualmente con screenshots en 1440px (wizard + vista previa lado a lado,
   actualizándose en los pasos "Puesto" y "Pago") y 390px (sin cambios).
9. **`/shifts/[id]/candidates`** (2026-08-05, elegir a quién asignar el
   turno): mismo problema que `/shifts`/`/my-shifts` — es una lista de
   tarjetas de persona (postulantes/recomendados), así que el mismo
   criterio aplica directo: contenedor a `md:max-w-6xl` y ambas pestañas a
   `grid gap-3 md:grid-cols-2 xl:grid-cols-3` (postulantes) /
   `grid gap-4 md:grid-cols-2 xl:grid-cols-3` (recomendados). La tarjeta
   `GuaranteeCard` ("Garantía Oído") queda **afuera** de la grilla, arriba,
   a todo lo ancho — no como un ítem más (mismo criterio que el
   `EmptyState` en `/shifts`): si no, se aplasta en una sola celda junto a
   las tarjetas de candidato. Mobile sin cambios. Verificado visualmente
   con Playwright en 1440px (ambas pestañas, grilla de 3 columnas) y 390px
   (idéntico a antes).
10. **`/workers/[id]`** (2026-08-05, perfil público del trabajador): a
    diferencia de las pantallas de listas, esto es una sola tarjeta de
    contenido — mismo caso que `/profile`, no una lista para gridear. En
    `lg+` pasa a dos columnas (`lg:grid-cols-3`, mismo patrón dashboard que
    `/profile`): la tarjeta principal (foto hero, bio, skills, métricas,
    idiomas, certificaciones, insignias) en 2/3 a la izquierda, y
    **Reseñas** (antes apilada debajo, largo variable) pasa a una columna
    fija de 1/3 a la derecha. Mobile/tablet sin cambios (mismo stack de
    siempre). Verificado visualmente con Playwright en 1440px (perfil +
    reseñas lado a lado) y 390px (idéntico a antes).
11. **`/companies/[id]`** (2026-08-05, perfil público del comercio):
    mismo tipo de pantalla que `/workers/[id]` (una sola tarjeta, no una
    lista), pero **sin** una sección tipo Reseñas que mover — el único
    contenido secundario real es la ubicación, y sólo si el comercio cargó
    coordenadas. Con coordenadas, `lg+` pasa a dos columnas: tarjeta
    principal en 2/3 y una columna "Ubicación" (mapa `MiniMap` + dirección +
    botón "Cómo llegar", que antes quedaba apilado como un simple botón
    debajo de la tarjeta) en 1/3. **Sin coordenadas**, no se fuerza la
    grilla (no hay nada real para la segunda columna) — el contenedor sólo
    se ensancha un poco (`lg:max-w-4xl`) para no quedar tan angosto.
    `MiniMap` es el mismo componente ya usado en el detalle de turno, no un
    componente nuevo. Mobile sin cambios. Verificado visualmente con
    Playwright en 1440px (con y sin coordenadas) y 390px.
12. **`/subscription`** (2026-08-05, "Mi plan"): a diferencia del resto de
    la auditoría, acá la grilla de planes (`PlanCard`) **ya tenía**
    `sm:grid-cols-2 lg:grid-cols-3` desde antes — el bug era que el
    contenedor se quedaba en `max-w-2xl` (672px), así que en `lg+` las 3
    columnas se apretaban en ese ancho fijo en vez de aprovechar la
    pantalla. Fix mínimo: `lg:max-w-5xl` en el contenedor, sin tocar la
    grilla que ya estaba bien. `SubscriptionStatusCard` (estado del plan
    actual) sigue de banner a todo el ancho arriba, sin gridear — mismo
    criterio que `GuaranteeCard` en `/shifts/[id]/candidates`. Mobile sin
    cambios. Verificado visualmente con Playwright en 1440px (3 columnas
    con aire) y 390px.
13. **`/admin`** (2026-08-05, panel de administración) — **última pantalla,
    auditoría cerrada**: mismo caso que `/shifts`/`/my-shifts`/
    `/shifts/[id]/candidates`, una lista de tarjetas de usuario en una sola
    columna (`max-w-3xl`). Contenedor a `md:max-w-6xl` y la lista a
    `grid gap-3 md:grid-cols-2 xl:grid-cols-3`. Las tarjetas de stats
    arriba (`sm:grid-cols-4` y el segundo bloque de 2) ya escalaban solas
    con más ancho de contenedor, sin necesitar ningún cambio de clase.
    Mobile sin cambios. Verificado visualmente con Playwright en 1440px
    (grilla de 3 columnas, 6 usuarios de prueba) y 390px.

**Auditoría completa (2026-08-05):** las 13 pantallas quedaron resueltas.
No hay ningún frente puntual abierto de esta iniciativa — para la próxima
sesión sin instrucción explícita, el punto de partida es `docs/TECH_DEBT.md`
por prioridad, no este listado.

**Invariante de negocio a proteger (anti-avivada, decisión de Julieta
2026-07-29):** TODO contacto entre comercio y trabajador nace de un turno
publicado — el chat siempre es `/chats/{shift_id}`, nunca hay un botón de
"escribile"/"contactar" suelto en el perfil del trabajador (`/workers/[id]`).
Ese es el candado que hace defendible el cobro por publicación (el comercio no
puede contactar sin haber publicado = gastado plan). Postularse es gratis para
el trabajador (buena liquidez de oferta) y publicar es exclusivo del comercio.
No introducir nunca un atajo de chat desde el perfil sin turno. Agotar el plan
sólo bloquea publicar turnos NUEVOS; los ya publicados siguen recibiendo
postulantes y permitiendo chat (por ese turno ya se pagó).

**Bug de UX real encontrado y corregido en el camino (#124):** el primer fix
de `/map` (#122) hizo que **toda la tarjeta** dispare la postulación al
tocarla — mal-interpretación de un pedido de Julieta sobre falta de
sensibilidad al toque. Se revirtió: tocar la tarjeta ahora abre un sheet de
detalle para revisar sin comprometerse; postularse sigue siendo un botón
explícito. Ver el commit de #124 para el detalle completo del malentendido —
**relevante para no repetir el mismo error de interpretación** en las
pantallas que faltan: "poder entrar a revisar" ≠ "que cualquier toque
decida".

**Otro bug reportado y YA resuelto (sin PR nueva, sólo verificado):**
Julieta reportó ver un botón verde "Compartir por WhatsApp" superpuesto/
cortado en el panel del comercio (`/shifts`). Reproducido en el código
actual: **no existe** — es el diseño VIEJO, de antes del refactor "una
acción por turno" (2026-07-28), donde ese botón vivía suelto en vez de
adentro de "Más". Pantalla vista con contenido cacheado (mismo patrón que el
favicon de Vercel de antes). Si reaparece después de un refresh/reinstalo
real, es un bug nuevo — pedirle una captura fresca.

## Estética editorial: paleta cálida + tipografía del diseñador (2026-07-29)

Julieta preguntó si, más allá del isotipo nuevo, la app tenía "la nueva
estética" del diseñador. Auditoría de código vs style-guide: **no la tenía**.
El naranja estaba cerca, pero el resto no: fondo **gris frío** `#F8F9FA` (el
diseñador quiere **crema** `#FFF8F0`), verde **semáforo** `#22C55E` (quiere
**bosque** `#2E8B57`), tinta **negro puro** `#111` (quiere **carbón** cálido
`#1F1F1C`) y tipografía **Geist** (quiere **Inter** + serif).

Alineado todo a la paleta editorial **manteniendo contraste AA** (tokens en
`globals.css`; como no hay grises hardcodeados, el cambio de tokens propaga la
calidez a toda la app). Tipografía: **Inter** (UI, reemplaza a Geist) +
**Fraunces** (`font-display`, serif de títulos, alternativa libre a Recoleta —
que es de pago) aplicada a landing/splash/wordmark/títulos de auth. Detalle y
contrastes medidos: `docs/design/COLOR_SYSTEM.md` v2.0. Verificado con capturas reales
(landing, login, feed) + `pytest`/`tsc`/`build`/Playwright (24 e2e) en verde.

Segundo pase (2026-07-29, mismo día): fidelidad total al style-guide — se migró
`--color-primary` al `#F97316` exacto del mockup (con theme-color, sombras-glow,
usos de mapa y los 7 íconos PWA + og-image regenerados al naranja nuevo) y se
rodó la serif `font-display` a **todos** los títulos de pantalla (feed, panel,
matches, mi plan, mensajes, admin, wizard de publicación, perfiles de
trabajador/comercio, página pública de turno). Único pendiente de tipografía:
**Recoleta** real cuando se consiga la licencia (cambiar una variable de fuente).

## Panel del comercio: una acción por turno (2026-07-28)

Queja de Julieta usando la app: *"los paneles siento que está un poco
engorroso para el comercio"*. Causa real encontrada en el código: cada
tarjeta de `/shifts` apilaba **hasta 7 botones al mismo nivel** (chat, ver
trabajador, ver candidatos, compartir, duplicar, no se presentó, cancelar,
cerrar turno, marcar pagado) y el comercio tenía que deducir cuál
correspondía a su altura del ciclo de 8 estados.

Ahora cada tarjeta muestra **qué está pasando** en una línea y **la única
acción que depende del comercio** en ese momento (`lib/shift-next-step.ts`,
mapa estado → `{hint, action}`). Cuando la pelota la tiene el trabajador
(confirmar, viajar, check-in) no se ofrece ninguna acción: sólo se explica en
qué anda. El resto pasa a un menú "Más" (`components/ShiftActions.tsx`); el
chat queda a mano por ser lo más usado con un turno asignado.

Decisión de producto de Julieta: el comercio ve **3 momentos**
(buscando → en marcha → terminado/pagado), no los 8 estados internos.

## Notificaciones: badge monocromo + destino exacto (2026-07-28)

Dos bugs reportados en producción:
- **Se veía un cuadrado blanco**: el service worker usaba `icon-192.png`
  también como `badge`, y Android dibuja el badge **usando sólo el canal
  alfa** — ese tile es opaco de punta a punta, así que salía un bloque
  blanco. Nuevo `public/badge-96.png` (fondo transparente, sólo la cloche).
- **Tocar un aviso no llevaba a ningún lado**: `NotificationBell` sólo lo
  marcaba leído, nunca navegaba. Ahora navega, y cada aviso lleva un `link`
  propio a la entidad exacta (migración `0016`): postulante nuevo / turno
  rechazado / cancelación del trabajador → `/shifts/<id>/candidates`;
  mensaje → `/chats/<id>`. Los avisos previos (sin `link`) caen al destino
  genérico por tipo, espejado en `lib/notification-link.ts`.

También: el WebSocket de notificaciones mantenía abierta una sesión de DB
durante toda la conexión; con Neon cortando conexiones ociosas, al
desconectarse el WS el cierre intentaba hacer rollback sobre una conexión ya
muerta (`InterfaceError` en Sentry). Ahora la libera apenas autentica.

Auditoría E2E de encuadre en 390px sobre 12 pantallas con textos largos:
**cero desbordes** (queda como test de regresión, `e2e/overflow-audit.spec.ts`).

## Reseñas del trabajador en su perfil público (2026-07-23, inspiración Clickie)

Segundo paso de la línea de confianza: el perfil público del trabajador
(`/workers/[id]`) mostraba rating/insignias/métricas pero **no las reseñas**
—lo que más ayuda al comercio a vetear antes de asignar (el "Reseñas
recientes" de Clickie)—. Nuevo `GET /reviews/workers/{worker_profile_id}`
(`ReviewService.list_for_worker`: resuelve perfil→usuario y devuelve las
recibidas, más nuevas primero, tope 20; perfil inexistente → lista vacía) +
componente `WorkerReviews` en el perfil. 2 tests nuevos.

## Candidatos con "por qué te lo recomendamos" (2026-07-23, inspiración Clickie)

A pedido de Julieta tras comparar con Clickie (app de oficios, se siente más
"cara"/robusta). El motor de matching ya calculaba todo pero al comercio le
mostraba un **"Score 0.87" opaco**. Ahora la pantalla de candidatos
(`/shifts/[id]/candidates`) **ayuda a decidir**:
- **Recomendado destacado**: el #1 del ranking va con acento de marca y un
  "por qué te lo recomendamos" (cercanía, puntualidad, turnos, calificación,
  oficio) en vez del score.
- **Chips de confianza** en cada candidato y postulante (rating, turnos,
  % puntual, años, distancia) — datos que ya venían del matching y del JOIN de
  postulantes, expuestos sin ninguna consulta extra (`MatchResult`/
  `CandidateMatchResponse` + `EnrichedApplicant`/`ApplicantResponse`
  enriquecidos; lógica de chips en `components/candidate/CandidateSignals.tsx`).
- **"Garantía Staffya"** (`GuaranteeCard`): copy de confianza que le pone
  palabras a mecanismos que ya existen (no-show reabre el turno, reputación
  real, chat previo). Sin lógica nueva.
- Diseño más "caro" en esa pantalla como parte del pulido.

## C3 — estados de error unificados (2026-07-23, post-#99)

Primer paso de C3 (confianza/conversión), el de más valor para la beta: que un
error nunca "parezca que la app se rompió".
- **Color de error inline unificado al token del DS** (`text-danger`): 12 usos
  sueltos de `text-red-600` en 10 archivos (forms de perfil/reseña, subida de
  imagen, chat, notificaciones, reset de contraseña, pickers de ubicación)
  pasan al mismo token que ya usaban login/register. Un solo rojo de error en
  toda la app.
- **Mapa**: cuando fallaba la carga mostraba el error como título pero con el
  subtítulo de "no hay turnos" ("aparecen en tiempo real, volvé en un rato") y
  botón "Actualizar". Ahora distingue error (subtítulo de reconexión + botón
  "Reintentar") de vacío real. El resto de las pantallas de carga ya usaban
  `ErrorBanner`/`EmptyState` + reintento de forma consistente (relevado).
- Falta de C3: skeletons coherentes (#1) y a11y AA (#3), en ese orden.

## 🐌 Causa raíz de "la app está lenta" (2026-07-27): regiones cruzadas

**Diagnóstico confirmado con evidencia, no inferido:** el servicio de Render
está en **Oregon (US West)** (verificado por Julieta en el dashboard) y la base
de Neon en **São Paulo** (`aws-sa-east-1`, verificado vía API). Cada consulta
cruza el continente: **~180 ms de ida y vuelta por consulta**, más el `SELECT 1`
de `pool_pre_ping` (#97) antes de cada request. Con varias consultas por
pantalla eso son 1-2 s de espera pura de red — con UNA sola usuaria y el
servidor despierto. No es cold start ni código.

**Fix:**
1. ✅ **Base nueva ya creada**: proyecto Neon `staffya-us-east`
   (`spring-voice-94360534`) en **`aws-us-east-2` (Ohio)**. No necesita
   PostGIS: ninguna migración lo usa (el matching calcula distancias con
   Haversine en Python, ver `matching/domain/scoring.py`). Las migraciones y
   el seed corren solos en el primer arranque.
2. ⬜ **Pendiente de Julieta** (Render no expone API en esta sesión): borrar el
   servicio de Render y recrearlo con el **mismo nombre** (`staffya-backend`,
   así conserva la URL que el frontend usa por default) en región **Ohio**.
   Render no permite cambiar la región de un servicio ya creado; por eso
   `render.yaml` ahora fija `region: ohio`.
3. ⬜ `DATABASE_URL` = connection string **directa** del proyecto nuevo (sin
   `-pooler`), copiada del dashboard de Neon.

Resultado esperado: latencia backend↔base de ~180 ms → **~2 ms**.

## Post-merge #98 (2026-07-23, rama reiniciada desde main)

- **Compartir en el feed del trabajador, ahora visible**: el botón que había
  quedado como ícono chico en el hero de `OpportunityCard` pasa a ser un botón
  etiquetado "Compartir por WhatsApp" en el cuerpo de la tarjeta (pedido de
  Julieta: que un trabajador le pase un turno a un amigo que busca laburo).
- **Velocidad — imágenes de Cloudinary optimizadas** (`lib/cloudinary.ts::
  cldThumb`): el feed/avatares/perfiles servían la foto original (1–4 MB)
  encogida por CSS. Ahora se piden con `f_auto,q_auto,c_limit,dpr_auto,w_<n>`
  (formato moderno + ancho tope al render). Aplicado en `Avatar` (todas las
  listas), hero del feed y heros de perfil. Detalle en `docs/BUGS.md`.

## ✅ Incidente 2026-07-23 (backend caído): RESUELTO

El backend de Render nunca se había conectado a Neon (esquema en `0011`,
cómputo suspendido desde el 18/7); Julieta cargó la connection string
**directa** de Neon (sin `-pooler`) en `DATABASE_URL` y redeployó. Verificado
en vivo: migraciones aplicadas hasta `0015`, backend sirviendo. Diagnóstico
completo y runbook (por si se repite):
[INCIDENTE_2026-07-23_BACKEND_CAIDO.md](./INCIDENTE_2026-07-23_BACKEND_CAIDO.md).

## Backlog corto acordado con Julieta (2026-07-23)

Pedidos de Julieta probando la app en vivo, para retomar si la sesión no
llega a todo. Los dos primeros salen en el PR #98 junto con esta nota:

1. ✅ **Fix swipe "gris"** (`SwipeDeck`): al dar like, la carta siguiente
   quedaba gris/inactiva hasta que respondía el backend. Ahora el mazo avanza
   de forma optimista (la red viaja en segundo plano; si falla, la carta
   vuelve al tope y se reintenta con la misma Idempotency-Key).
2. ✅ **Compartir turno por WhatsApp desde el lado del trabajador**
   (`OpportunityCard`): botón de compartir en la tarjeta del feed, reusa
   `lib/shift-share.ts` y la página pública `/turno/[id]`. Motivación de
   Julieta: un trabajador que ve un turno que no es para él se lo pasa a un
   amigo → más registros orgánicos.
3. ✅ **Compartir también desde Matches y la página pública** (`/my-shifts`
   pestaña Postulaciones + `/turno/[id]`, este último crea el loop de difusión:
   quien recibe el link lo re-comparte). Reusa `ShareShiftButton`.
4. ✅ **Postulaciones de los no elegidos → RECHAZADA** automática al asignar
   (TECH_DEBT P5): rechazo silencioso de los no elegidos al asignar/cancelar y
   restauración a PENDIENTE al reabrir (rechazo/cancelación/no-show del
   asignado). 3 tests nuevos. Detalle en TECH_DEBT P5 (marcada resuelta).
5. 🔶 **C3 del pulido** (confianza/conversión): **SEO base hecho** —
   `app/robots.ts` (allow público, disallow rutas con sesión + reset de
   contraseña) + `app/sitemap.ts` (páginas públicas) + CTA del turno público
   preselecciona `?rol=trabajador` (fuga del loop de difusión). **Falta** de
   C3: skeletons coherentes, estados de error unificados, a11y AA. Luego
   **C4 onboarding** (necesita el spec de Julieta primero —
   `docs/planning/PULIDO_ROADMAP.md`).
6. ⬜ Operadora (sin código, cuando pueda): apagar `SEED_DEMO_DATA` antes de
   comercios reales, cargar `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` (para que
   la próxima caída avise sola), ensayo de restore de Neon, borrar el
   Postgres viejo de Render si sigue existiendo.

## Estado en una línea

**Todo el backlog R0–R3 implementable sin credenciales/decisiones de Julieta
está cerrado** (R0.3, R1.1–R1.6, R2.1–R2.4, R3.1, R3.2 ✅), más **ADR-0005
Fase 1** (mensualidad al comercio, backend+frontend), **ADR-0006** (alta de
local desde el mapa), **ADR-0007** (no-show/cancelación tardía) y el
**launch-gate** (#88: reseñas→ranking verificado end-to-end, primera
experiencia del comercio nuevo). Sobre esa base ya se sumó **acceso moderno**
(Google + push, #87) y un batch grande de **pulido post-rebrand**
(`docs/planning/PULIDO_ROADMAP.md`: rebrand #79, legales #81, bugs de la operadora
C0+C1 #83–84, landing inmersiva #85, panel por familias #86); **quedan C3
(confianza/conversión: SEO, skeletons, a11y) y C4 (onboarding) del mismo
roadmap sin arrancar**. Lo único que falta del backlog original: 🔶 confirmar
en Render que el deploy quedó verde contra Neon (código ya en `main`), cargar
los DSN de Sentry cuando quiera, subir fotos reales al seed (R2.5), y la
API de WhatsApp Business (distinto del botón "Compartir por WhatsApp" ya
enviado en #77, que sólo abre `wa.me` con el link del turno). **R4 se deja
afuera a propósito** hasta que haya señal real de carga (regla del propio
roadmap).

## Hecho y mergeado (cronológico, con PR)

| Bloque | PRs | Qué quedó |
|--------|-----|-----------|
| Rediseño UX/UI mobile-first ("app nativa") | #33–#40 | DS propio (`components/ui/`), worker swipe/mapa/matches, employer panel+wizard+postulantes, splash/landing, performance |
| Seed demo en producción | #36 | `startup_seed` idempotente (`SEED_DEMO_DATA=true` en Render): cuentas/turnos demo para probar sin registrarse |
| Design System v2 (dirección creativa) | #41–#43 | Identidad monocromática (#FF6B00/#111/blanco), Lucide, foto-first + acento sobrio por rubro (`SKILL_ACCENT`), navbar opaca (fix scroll), tiles CARTO |
| Documentación Fase 0–1 | #43 | Auditoría v1 + fundación (`PRODUCT/DOMAIN/ARCHITECTURE/PRINCIPLES`) + `CLAUDE.md` operativo |
| Documentación Fase 2 (dominio) | #44 | 10 docs de dominio (`WORKER…AVAILABILITY`), inconsistencias marcadas |
| Documentación Fase 3 (técnica) | #45 | 8 docs (`MODULES/API/DATABASE/EVENTS/SECURITY/TESTING/DEPLOY/OBSERVABILITY`) |
| Seguridad quick wins | #46 | JWT default bloqueado en prod, security headers, rate limit login/register (429) |
| Refactor quick wins | #47 | `PageState` y `SKILL_STYLES` eliminados (DS único), botones inline→`Button`, helpers de test compartidos, seed limpio |
| Diseño de mapas | #48 | `docs/reference/MAPS_REDESIGN.md` (10 entregables) + mockup HTML. **Diseño aprobado por Julieta** |
| Auditoría integral v2 | #49 | 9 reportes con puntajes (`PRODUCTION_READINESS` ~65/100) + `ROADMAP_IMPLEMENTATION.md` (R0–R4) + `RECOMMENDATIONS` v2 |
| CI | #50 | GitHub Actions: `pytest` + `tsc` + `build` en cada PR/push a main (R0.3 ✅) |

| Mapas F1+F2 (MapLibre) | #51 | Módulo `components/map/` (`maplibre-gl` + `@vis.gl/react-maplibre` + `supercluster`), ADR-0001, `/map` premium: sheet 40/60 de 3 alturas, marcadores por rubro con stagger/halo, clustering, sync mapa↔tarjetas. Verificado con Playwright (smoke con mocks). Leaflet convive hasta F3 |
| Mapas F3 (adiós Leaflet) | #52 | `WorkerSearchMap` (marcador avatar+rating, tarjeta DS en vez de popup) y `MiniMap` sobre MapLibre; tiempos por modo "aprox." (`lib/map/travel-time.ts`) en el carrusel; botón "Cómo llegar" (deep-link Google Maps) en `ShiftCard`; **leaflet/react-leaflet desinstalados**, `map-tiles.ts` eliminado, cero referencias |
| R1.2 + R1.4 (sesiones revocables + capar `quantity`) | #53 | Tabla `refresh_sessions` (migración `0010`) con rotación de refresh token y detección de reuso (revoca todas las sesiones), `POST /auth/logout`, `ADR-0002`; `quantity` capado a 1 en `ShiftInput` (API) y en el wizard (`shifts/new/page.tsx`). `pytest -q` verde (87 tests), `tsc --noEmit` limpio |
| R2.1–R2.3 (rendimiento backend: paginación + fix N+1 + matching en SQL) | #54 | Inbox de chat (P1) reescrito a 3 queries agregadas (JOIN + batch de último mensaje + batch de no leídos) en vez de ~6 por conversación; postulantes de un turno (P2) enriquecidos con un JOIN en el repo en vez de 2N+1; matching (P4 del reporte) filtra `is_available`+`skill` en SQL (antes full scan + filtro en Python) y sólo scorea en Python el subconjunto ya acotado; `limit`/`offset` agregados a `/shifts/feed`, `/shifts/mine`, `/shifts/me`, `/applications/mine`, `/notifications`, `/admin/users` y `/matching/search` (default 50, tope 100, sin cambiar el shape de la respuesta). Sin cambios de comportamiento visible. `pytest -q` verde (91 tests, +4 de paginación/inbox) |
| Hotfix Neon (R0.1) | #56 | `Settings._force_asyncpg_driver` traduce los parámetros libpq del connection string de Neon (`sslmode`/`channel_binding`, que asyncpg no acepta y rompían el deploy) a `ssl=require`; 4 unit tests. Desbloquea la migración de DB a Neon |
| R2.4 (reputación real) | #57 | `events_completed` y `punctuality_rate` se derivan del ciclo real del turno al finalizarlo (check-in dentro de ±15 min del inicio pactado = puntual; promedio móvil atómico en el repo de worker). `cancellations` NO se deriva: el dominio no distingue quién cancela ni tiene no-show — documentado como decisión de producto pendiente (ADR) en REPUTATION/TECH_DEBT. R2.5 (imágenes Cloudinary en seed) queda manual: requiere subir un set de fotos a la cuenta del proyecto (TECH_DEBT I2) |
| R1.5b (E2E Playwright en CI) | #58 | 3 specs (`auth`, `worker-apply`, `employer-wizard`) con API 100% mockeada (sin backend ni red externa), viewport móvil 390×844; job `e2e` nuevo en el workflow (build + `playwright test`, artifact del reporte si falla). Corrida local: 3 passed |
| R1.1 + R1.6 + R0.2 (observabilidad + runbooks) | #59 | Sentry opcional en backend (`SENTRY_DSN`) y frontend (`NEXT_PUBLIC_SENTRY_DSN`) — no-op sin DSN, se enciende al cargar las env vars; logging estructurado JSON (`LOG_JSON=true`) con `request_id` por request (header `X-Request-ID`); CSP permite el ingest de Sentry. DEPLOY.md: runbook de lanzamiento (apagar seed demo + purga) y backups/restore de Neon |
| R1.3 + R1.5a (CSP + unit tests del scoring) | #55 | CSP en `next.config.ts` (sólo producción; permite backend propio, WS, tiles CARTO y Cloudinary); 25 unit tests puros de `matching/domain/scoring.py` (pesos, casos límite, orden con trade-offs — un test traía una expectativa incorrecta, corregida: el orden real `equilibrada > lejos_pero_excelente > cerca_pero_nueva` es el comportamiento correcto de los pesos documentados, no un bug). `pytest -q` verde (116 tests) |
| R3.2 (DS v2 en Employer/Admin) | #60, #61 | `/admin` migrado a `Card`/`Badge`/`Button`/`Avatar`/`EmptyState`/`ErrorBanner`/`Spinner` (verificado por mí, no solo por el reporte del agente); color fuera de paleta (`bg-blue-600`) corregido en el botón "Publicar" de `/shifts`. Sin deuda visual restante en pantallas employer/admin |
| Coherencia doc↔código del roadmap | *(commit directo)* | R0.2, R0.3, R1.1, R1.6 y R3.2 estaban implementados (mergeados en #50/#56/#59/#60/#61) pero sin tildar en `ROADMAP_IMPLEMENTATION.md`; corregido. R0.1 actualizado a 🔶 (código listo, falta confirmación de Julieta en Render) |
| Decisiones de producto con ADR | #63 | Las 3 decisiones que Fable tomó como orquestador: **ADR-0003** (`quantity`=1 permanente, no se construye multi-asignación); **ADR-0004** (cancelación del trabajador `CONFIRMADO`→`BUSCANDO_PERSONAL` que reabre el turno y deriva `cancellations`, `POST /shifts/{id}/worker-cancel`, notificación `shift_reopened`; e insignias/niveles con otorgamiento automático por umbral en `worker/domain/rules.py`, recalculados al finalizar y al cancelar). `pytest -q` verde (150 tests, +28). Cierra P1/P2/P3 de TECH_DEBT |
| Re-baseline de lanzamiento (Fable) | #64 | `docs/planning/LAUNCH_PLAN.md`: re-evaluación de production-readiness (~65→**~78/100** tras mergear R0–R3) + plan secuenciado de beta cerrada en Palermo (B0 pre-lanzamiento → B1 reclutamiento → B2 operación asistida → B3 decisión). Veredicto: **lista para beta con usuarios reales**, sólo faltan 2 pasos operativos de Julieta |
| Reputación visible en el frontend | #65 | `lib/reputation.tsx` como única fuente de labels (insignias, niveles, puntualidad, rating); insignias/nivel en perfil worker, búsqueda del employer y postulantes. Cierra el lado visible de ADR-0004 |
| UX: landing + selección de texto | #66 | La landing es sólo para visitantes sin sesión (logueados van a la home de su rol: `/feed`, `/shifts`, `/admin`); copy ofensivo ("delivery de personas") reemplazado; `user-select:none` en botones/tabs/labels (inputs siguen seleccionables). Fix del E2E `auth.spec.ts` por el redirect nuevo |
| Auditoría de performance frontend | #67 | `docs/audits/PERFORMANCE_AUDIT_FRONTEND.md` con hallazgos archivo:línea (Sentry estático 138 KB gzip 🔴, motion 🟠, marcadores de mapa 🟡, reduced-motion 🟠) + quick wins seguros |
| Performance frontend (fixes) | #68 | Sentry con `import()` dinámico gateado por DSN (sin DSN el SDK no viaja en ninguna ruta — verificado por grep de chunks en `.next/server/app/` y manifests); `memo` + handlers estables en marcadores de mapa (Cluster/Shift/Worker); `useReducedMotion` en landing, splash, swipe, modales, sheets, toasts y mapa |
| Robustez percibida — lote 1 (errores de red) | #69 | Auditoría previa: 39 hallazgos en 16 rutas. `lib/errors.ts` (`getErrorMessage` — nunca más "Failed to fetch" en inglés; `isNotFound`); `ErrorBanner` con `onRetry` cableado en shifts/my-shifts/admin/candidatos/search/perfiles públicos (estos últimos con "Volver": ya no hay pantalla muerta); `useWebSocket` expone `status`+`onOpen` → chat con "Reconectando..." y re-sync de mensajes por HTTP al reconectar |
| Robustez percibida — lote 2 (acciones silenciosas) | #70 | Panel del comercio: Publicar/Cancelar/Cerrar/Pagar tenían POSTs sin try/catch ni loading — ahora busy por acción + toast; Matches: busy en los 7 botones (incluye espera de GPS); swipe del feed: la carta vuelve al mazo si la postulación falla (`onDecide` → `Promise<boolean>`); forms de perfil: sólo 404 = "no existe" (antes un fallo de red mostraba el form vacío con riesgo de pisar el perfil), `submitting` + skeleton; reseñas y campana ya no disfrazan errores de vacío |
| Robustez percibida — lote 3 (skeletons) | #71 | Skeletons con forma real en: lista de chats, conversación (burbujas), perfiles públicos, ReceivedReviews, carrusel del mapa, sheet de búsqueda ("Buscando..." en vez de "0 trabajadores" durante la carga, con fix del flash inicial), admin (KPIs + usuarios, sólo carga inicial) y dropdown de notificaciones; en el chat, si falla el envío el texto no se pierde y hay "Reintentar" pegado al form |
| Mejoras UX comercios (5 fixes) | *(PR pendiente)* | **Cancelar postulación**: `ShiftApplication.withdraw()` (dominio) + `POST /applications/{id}/withdraw` (sólo dueño, sólo desde PENDIENTE) + botón "Cancelar postulación" con confirmación (`Modal`) en `/my-shifts`. **Regla de doble turno**: `Shift.confirm()` rechaza (400) si el trabajador ya tiene otro turno propio en `COMMITTED_STATUSES` (CONFIRMADO/EN_CAMINO/CHECK_IN/TRABAJANDO/CHECK_OUT) que se solapa en horario; al confirmar con éxito se retiran solas (RETIRADA) las postulaciones PENDIENTE propias que se solapan (`ShiftService` recibe `ShiftApplicationRepository` por constructor, mismo patrón cross-módulo que Company/Worker/Notification). **Login persistente**: `auth-context.tsx` ahora intenta restaurar la sesión con el refresh token aunque el access token esté vencido o ausente — antes sólo lo intentaba si había un access token guardado; sólo sin refresh token (o si el refresh falla de verdad) manda a `/login`. **Postulantes "disponibles"**: `EnrichedApplicant`/`Applicant` suman `is_available`; `/shifts/[id]/candidates` muestra un badge "Disponible" y cambia `ring-zinc-100`/`text-zinc-900` (grises crudos) por los tokens del DS (`ring-line`/`text-ink`). **Splash sin trabarse**: `SplashScreen` ahora se queda visible mientras dura la coreografía de entrada Y la sesión se verifica (`useAuth().loading`), con un tope duro de 6s para que un backend frío nunca la deje pegada, y pasa a un estado "Verificando tu sesión…" con spinner en vez de dejar el logo grande congelado. `pytest -q`: 156 passed (antes 150, +6). `tsc`/`build`/e2e (4 specs) verdes. Ver `docs/TECH_DEBT.md` P5/T5 (hallazgos, no bugs de esta sesión) |
| ADR-0005 Fase 1 (mensualidad al comercio) — completa | *(commits directos, sin PR — previo a #74/#75)* | Módulo `subscription` (dominio/aplicación/infraestructura/api): `Subscription` 1–1 con `Company` (`plan_code`, `status`, período, `turnos_usados_mes`); planes `gratis`/`básico`/`pro` (`domain/plans.py`); puerto `BillingGateway` + `MercadoPagoSuscripcionAdapter` (preapproval, sin split) detrás de `MERCADOPAGO_ACCESS_TOKEN`; migración `0011`. Gating en `ShiftService.publish_shift` (402 si se agotó el tope), pero real sólo si `subscriptions_enforced=true` (**default OFF**: en la beta los comercios publican libre, el uso se cuenta igual para tener el dato cuando se encienda la mensualidad). Frontend: pantalla "Mi plan" (3 tarjetas, plan actual, uso del mes con barra de progreso, manejo de 402/403 con CTA "Mejorá tu plan"). Cierra lo que la entrada anterior de esta bitácora describía como "en vuelo" |
| ADR-0005 (doc) | #74 | `docs/adr/ADR-0005-pagos-y-antidesintermediacion.md`: mensualidad escalonada como modelo primario de monetización (mata el incentivo a desintermediar), comisión/split de MP diferido a Fase 2. Aprobado por la operadora |
| ADR-0006 — alta de local desde el mapa | #75 | Onboarding de ubicación del comercio: buscar dirección con Nominatim/OSM (gratis, sin Google Places, rate-limit propio) + pin arrastrable como fuente de verdad de lat/lng, fallback al `LocationPicker`; fix de `address` que se perdía al guardar el perfil; CSP habilita Nominatim. E2E 9/9 |
| Fix: pantalla en blanco si el backend no responde | #76 | Timeout de 12s (`AbortController`) en el chequeo de sesión + `NetworkError` distinguible de `ApiError`: backend dormido/caído degrada a deslogueado en vez de colgar la app en blanco |
| Growth: página pública de turno + compartir WhatsApp + duplicar | #77 | `GET /shifts/{id}/public` sin auth (sólo turnos PUBLICADO, campos seguros, sin contacto del comercio ni postulantes); `/turno/[id]` con meta OG para compartir; botón "Compartir por WhatsApp" (Web Share API + fallback `wa.me`) y "Duplicar" (prellena el wizard con los datos del turno original, fechas +7 días) en el panel del comercio |
| Recuperación de contraseña + email transaccional | #78 | Puerto `EmailSender` (`ResendEmailSender`/`NullEmailSender`/`FakeEmailSender`, flag por ausencia de `RESEND_API_KEY`, mismo patrón que Mercado Pago/Sentry); tabla `password_reset_tokens` (migración `0012`); `POST /auth/forgot-password` (202 genérico siempre, anti-enumeración, rate-limit silencioso de reenvío) y `POST /auth/reset-password` (error genérico, invalida tokens previos, **revoca todas las sesiones de refresh activas** — hallazgo de auditoría G3: sin esto una sesión robada sobrevivía a un reset); páginas `/recuperar` y `/restablecer`; de paso, email al trabajador cuando el comercio lo asigna (`assign_worker`, best-effort). Suite completa: 177 passed |
| Rebrand — la cloche | #79 | Marca nueva (campana de servicio en trazo blanco sobre tile naranja, wordmark "staffya" con "ya" en naranja), assets regenerados (favicon/PWA/OG) con el naranja de marca real (`#ff6b00`/`#e85f00`); landing reescrita con disciplina premium (un solo acento, product shot con `OpportunityCard` real, bento asimétrico); tagline oficial "Personal gastronómico, ya." |
| Esquema T1 de pulido post-rebrand (doc) | #80 | Crea `docs/planning/PULIDO_ROADMAP.md`: spec T1 cerrado (Julieta define, Sonnet ejecuta sin re-decidir dirección) con la Ley de marca (un acento naranja, sin gradientes multicolor, radios/tipografía) y los batches C0 (bugs operadora) → C1 (coherencia interna) → C2 (legales) → C3 (confianza/conversión) → C4 (onboarding) |
| Legales + consentimiento de registro | #81 | `/terminos` y `/privacidad` (estáticas, estética de la landing), footer con autoría, checkbox obligatorio de aceptación en `/register` (botón deshabilitado sin marcar). Cierra el **batch C2** de `PULIDO_ROADMAP.md`. Solo UI, backend sin cambios |
| Batch C0 al roadmap (doc) | #82 | Suma a `docs/planning/PULIDO_ROADMAP.md` el detalle de los bugs reportados por la operadora (modo oscuro forzado, selección de texto, mapa que no responde) a resolver en el siguiente PR |
| C0+C1 — bugs de la operadora + coherencia interna | #83 | **C0** (bugs reales reportados, batch documentado en #82): fix de `reuseMaps` en `MapView` (el mapa quedaba con gestos deshabilitados al navegar sin refresh, causa raíz de "el mapa no responde"), `color-scheme: light` forzado (Chrome Android invertía a oscuro), `.no-select` en `Card.tsx`, ítem "Verificación" muerto ocultado. **C1** (coherencia con la Ley de marca de `PULIDO_ROADMAP.md`): gradientes off-brand (naranja→rojo/ámbar) reemplazados por el tile de marca en 8 componentes; `?rol=` desde la landing + `/register`/`/login` migrados a tokens del DS; `min-h` en `OpportunityCard`, fechas vía `formatShiftDate`, `EmptyState` en chats vacíos |
| Panel: estados diferenciados + fin de selección + fix pull-to-refresh | #84 | `ShiftCard` consolida su paleta a los 4 colores de la Ley de marca (antes azul/ámbar fuera de marca) y atenúa+reordena los estados terminales al final; `.no-select` en `ShiftCard`/`CandidateCard`/postulantes/popup del mapa (el fix de C0 no los cubría, no usan `Card` compartido); fix de pull-to-refresh nativo de Chrome Android en `/search` (`overscroll-behavior-y: contain` en `html`, no sólo `body` — el root scroller real) |
| Landing inmersiva | #85 | 5 capas de scroll sobre la landing existente: hero con stack de turnos que rota según el progreso, stats que cuentan al entrar al viewport (valores honestos, sin tracción inventada), marquee de puestos/barrios, riel vertical de "Cómo funciona", micro-parallax por tarjeta del bento; reduced-motion con fallback estático completo. `tsc`/`build`/lint verdes (30 problemas preexistentes, 0 nuevos); Playwright 15/15 |
| Panel por familias de estado | #86 | `/shifts` reorganizado por familias (Todos/Buscando/En marcha/Terminados/Cancelados) con conteo por pestaña siempre igual a las tarjetas mostradas (bug reportado: contador desconectado de la lista); elimina el único azul fuera de marca (KPI "Buscando"); cierra el `.no-select` que había quedado a medio aplicar en la landing de #85. Playwright 17/17, lint sin regresiones |
| Acceso moderno: Google + push | #87 | `POST /auth/google` (ID token verificado server-side vía `tokeninfo`, sin client secret; alta nueva pasa por "¿buscás trabajo o personal?"); botón "Continuar con Google" en `/login`/`/register`, no-op sin `GOOGLE_CLIENT_ID`. Notificaciones push (Web Push/VAPID): tabla `push_subscriptions` (migración `0013`), hook best-effort en el mismo punto donde se crean todas las notificaciones in-app, service worker mínimo (`public/sw.js`), opt-in tras la primera acción significativa. Fricción documentada: `pywebpush`/`http-ece` no instalable en el sandbox de esta sesión (sólo sdist) — Render debe verificar el build antes del primer deploy |
| **Launch-gate** — cierre de 3 lazos construidos-pero-nunca-validados (`PRIMER_TURNO_REAL_SPEC`) | #88 | **Parte A (verificado, no roto):** test de integración de punta a punta (`tests/test_full_shift_lifecycle.py`) recorre publicar→postular→asignar→check-in→check-out→finalizar→ambos califican→reputación actualizada→**la reputación real SÍ entra al ranking de matching** de un turno nuevo (dos trabajadores con historial idéntico salvo la reseña — 5★ vs. 1★ — quedan ordenados por esa diferencia). Nada estaba roto en ese lazo: ya andaba. **Parte B (frontend):** panel del comercio nuevo (0 turnos) con CTA "Publicá tu primer turno" + 3 pasos (`app/shifts/page.tsx`), y cartel una-sola-vez tras el primer turno publicado ("Ya estás buscando personal..."), persistido en `localStorage` (mismo criterio que el opt-in de push). **Parte C (backend + frontend, `ADR-0007`):** no-show manual del comercio (`POST /shifts/{id}/no-show`, sólo desde CONFIRMADO/EN_CAMINO — reabre el turno, `WorkerProfile.no_shows` nuevo y separado de `cancellations`, pesa el doble en el score de desempeño del matching, rompe `nunca_falto`) + cancelación tardía del comercio (`ShiftService.cancel_shift` detecta `COMMITTED_STATUSES`; **hallazgo:** antes no avisaba nada al trabajador — ahora `shift_cancelled_late` in-app+push y `CompanyProfile.late_cancellations` nuevo, simétrico). Migración `0014`. `pytest -q`: 205 passed (antes 194, +11: 2 unit + 9 integración). `tsc`/`build`/lint sin errores nuevos (lint baseline pre-existente sin cambios: 20 errores/10 warnings, verificado contra `origin/main`); e2e (17 specs) verdes. |
| Deuda chica post launch-gate: postulación aceptada + STATUS al día | `claude/estado-postulacion` *(PR draft pendiente)* | **Fix 1:** `ShiftService.assign_worker` dejaba la `ShiftApplication` PENDIENTE del trabajador elegido sin transicionar — quedaba "pendiente" para siempre aunque el comercio ya lo hubiera asignado (`docs/TECH_DEBT.md` P5). Ahora, de mínima invasión: `ShiftApplication.accept()` nuevo (dominio, mismo patrón que `withdraw()`) + `ShiftService._accept_application` busca la postulación por turno+trabajador (`ShiftApplicationRepository.get_by_shift_and_worker`, puerto ya inyectado desde la regla de doble turno) y la acepta si está PENDIENTE; si la asignación fue directa (búsqueda/mapa, sin postulación previa) no hace nada y no falla. **No** se tocan las postulaciones de los demás candidatos (RECHAZADA de los no elegidos sigue abierto, ver TECH_DEBT P5 actualizado). **Fix 2:** esta misma bitácora, puesta al día (faltaban #74–#87). `pytest -q`: 207 passed (antes 205, +2); `tsc`/`build`/lint sin errores nuevos (lint: mismo baseline 20/10); e2e 17/17 |
| Stepper del ciclo de vida + pantalla "esto es lo que sigue" al publicar (inspiración Clickie) | `claude/stepper-ciclo` *(PR draft pendiente)* | **Fix 1:** `ShiftLifecycleStepper` nuevo (numeritos en círculo + línea, paso actual sólido, completados con check tenue, futuros en gris — un solo acento naranja) integrado en `ShiftCard` con dos mapeos de los 12 `ShiftStatus` reales a 4 hitos: comercio (`/shifts`, default) Publicado→Asignado→En curso→Finalizado; trabajador (`/my-shifts`, prop `perspective="worker"`) Postulado→Aceptado→En curso→Finalizado. **Corrección documentada:** el spec original agrupaba `confirmado` con `finalizado/pagado`; se corrigió a agruparlo con `asignado` porque el orden real del dominio (`asignado→confirmado→en_camino→…→finalizado`) haría que el stepper retrocediera de "Finalizado" a "En curso". Cancelado: no agrega un 5º paso — corta la línea (punteada) y reemplaza el hito donde murió por un marcador rojo "Cancelado", inferido de las marcas que sobreviven (`worker_profile_id`/`check_in_at`/`check_out_at`, el dominio no guarda el estado previo a cancelar). **Fix 2:** `ShiftPublishedNextSteps` (pantalla "¡Turno publicado!" con timeline vertical de 4 pasos del comercio) reemplaza el cartel de una sola vez del launch-gate (#88); decisión documentada: se muestra **cada vez** que se publica un turno (no sólo la primera vez), tanto desde el wizard (`/shifts/new`) como desde "Publicar" de un borrador en el panel (`/shifts`) — es informativa, no una interrupción. `Modal` del DS ganó `max-h-[85vh] overflow-y-auto` (cambio genérico y no disruptivo) para que el timeline no se corte en pantallas bajas. `tsc`/`build` verdes; lint sin errores nuevos (mismo baseline 20/10); Playwright 19/19 (2 specs nuevos del stepper + `employer-wizard.spec.ts` actualizado para el nuevo flujo de publicación, resto sin tocar) |

## En vuelo ahora

- **`docs/planning/PULIDO_ROADMAP.md` — C3 arrancado, C4 sin arrancar**: el orden fijado
  por el propio roadmap es C2 (hecho, #81) → C0+C1 (hecho, #83) → C3 → C4.
  **C3** (confianza y conversión): **SEO base hecho** (`app/robots.ts` +
  `app/sitemap.ts` + CTA del turno público con `?rol=trabajador`, PR #98);
  **falta** OG por página (la landing y `/turno/[id]` ya tienen, revisar el
  resto), skeletons coherentes, estados de error unificados, a11y AA. **C4**
  (primera experiencia post-registro: onboarding por rol — el flujo exacto lo
  tiene que cerrar T1 antes de ejecutar, no arrancar sin ese spec) sin
  arrancar.
- **Feature de enganche #1: ping en tiempo real de turnos urgentes**
  (ADR-0005) — al publicar un turno urgente, avisar por notificación+WS a los
  N trabajadores disponibles más cercanos con la skill. Materializa la promesa
  "<10 minutos". Sin código todavía.
- En cola (aprobadas por delegación): #3 progreso de gamificación, #4 panel de
  ganancias, #5 onboarding (probablemente se resuelve como parte de C4). #2
  **WhatsApp Business API** sigue bloqueado en cuenta/API de Julieta — distinto
  del botón "Compartir por WhatsApp" (deep-link `wa.me`, sin API, ya resuelto
  en #77).

> El **ciclo de robustez percibida** (auditoría de 39 hallazgos + 3 lotes de
> fixes #69/#70/#71) quedó cerrado: no quedan cargas sin skeleton, errores de
> red sin mensaje/reintento ni acciones que fallen en silencio en las 16 rutas.

## Bloqueado en Julieta (único trabajo pendiente)

1. 🔶 **Confirmar Render/Neon**: el hotfix (#56) y el `DATABASE_URL` ya están
   cargados; falta chequear en el dashboard de Render que el deploy quedó
   verde y `alembic upgrade head` corrió contra Neon. Sin acceso a Render
   desde acá para verificarlo.
2. **Encender Sentry**: cargar `SENTRY_DSN` (Render) y `NEXT_PUBLIC_SENTRY_DSN`
   (Vercel) cuando quiera — el código ya está y es no-op sin esos valores.
3. **R2.5** — imágenes propias en el seed: subir un set de fotos a la cuenta
   Cloudinary del proyecto (TECH_DEBT I2), manual, sin credenciales no se
   puede automatizar.
4. ~~**Elegir logo**~~ — resuelto en el rebrand (#79): "la cloche" (campana de
   servicio) reemplazó al rayo genérico, con todos los assets (favicon,
   íconos PWA, OG) regenerados desde esa geometría.
5. ~~**Tarjetas "grises" de empleados**~~ — Julieta indicó la pantalla
   exacta (postulantes en `/shifts/[id]/candidates`, panel del comercio):
   resuelto en este changeset (badge "Disponible" + tokens del DS en vez de
   grises crudos). Sigue pendiente subir fotos reales al seed (R2.5, punto 3
   de esta misma lista) para que dejen de verse todos con iniciales.
6. **WhatsApp Business API** (feature de enganche #2): requiere cuenta/API
   del lado de Julieta.

> Las decisiones de producto que estaban pendientes (multi-asignación,
> cancelación por actor, insignias/niveles) ya se **resolvieron** en #63
> (ADR-0003/0004) — ver bloque "Hecho y mergeado". No queda decisión de
> producto abierta salvo que el negocio pida algo nuevo (con su propio ADR).
7. **R4** — deliberadamente en espera hasta que haya señal real de tráfico
   (Redis, bbox multi-ciudad, rutas OSRM, pagos MercadoPago).
8. Estrategia de mercado: beta cerrada en Palermo post R0+R1 (ver
   [RECOMMENDATIONS.md](./planning/RECOMMENDATIONS.md)) — decisión de negocio, no de
   código.

## Decisiones clave vigentes

- **Squash merge, PR draft primero, mergear apenas verde** (pedido explícito).
- **Orquestación de modelos**: Fable solo orquesta/sintetiza/revisa; agentes
  Sonnet implementan y auditan; Haiku para lo trivial (pedido explícito para
  no gastar de más).
- **ADR obligatorio** para infra nueva (Redis, sesiones, multi-asignación,
  pagos). ADR-0001 (MapLibre), ADR-0002 (sesiones revocables), ADR-0003
  (`quantity`=1), ADR-0004 (cancelación del trabajador + insignias), ADR-0005
  (mensualidad-primero), ADR-0006 (alta de local desde el mapa), ADR-0007
  (no-show/cancelación tardía manual, no cron).
- **Ley de marca post-rebrand** (`docs/planning/PULIDO_ROADMAP.md`, desde #79): un solo
  acento naranja por pantalla, cero gradientes multicolor decorativos, la
  cloche como único logo. Los batches de pulido (C0–C4) son un spec T1
  cerrado: los ejecutores T2 no re-deciden la dirección, sólo implementan.
- `quantity>1` era un bug de producto conocido: **ya se capó a 1** (API +
  wizard, R1.4). Multi-asignación real queda pendiente, sólo si el negocio la
  pide (nuevo ADR).
- Cuentas demo con contraseña pública: **correcto para la etapa demo**, apagar
  y purgar antes de usuarios reales (checklist en PRODUCTION_READINESS).

## Dónde está cada cosa

- Veredicto y puntajes: [PRODUCTION_READINESS.md](./planning/PRODUCTION_READINESS.md)
- Plan por fases: [ROADMAP_IMPLEMENTATION.md](./planning/ROADMAP_IMPLEMENTATION.md)
- Diseño de mapas: [MAPS_REDESIGN.md](./reference/MAPS_REDESIGN.md) + `docs/mockups/`
- Pulido post-rebrand (Ley de marca, batches C0–C4): [PULIDO_ROADMAP.md](./planning/PULIDO_ROADMAP.md)
- ADRs: `docs/adr/` (0001 MapLibre, 0002 sesiones revocables, 0003 `quantity`,
  0004 cancelación/insignias, 0005 mensualidad, 0006 alta desde el mapa, 0007
  no-show/cancelación tardía)
- Acceso moderno (Google + push): [ACCESO_MODERNO.md](./reference/ACCESO_MODERNO.md)
- Deuda vigente: [TECH_DEBT.md](./TECH_DEBT.md)
- Cómo trabajar en el repo: [../CLAUDE.md](../CLAUDE.md)
