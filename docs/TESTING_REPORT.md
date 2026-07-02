# TESTING_REPORT.md — Auditoría de testing (Staffya)

> Auditoría puntual del estado real de la suite de pruebas, basada en lectura
> directa del código y ejecución de `pytest --collect-only` a fecha
> 2026-07-02. Complementa [TESTING.md](./TESTING.md) (que describe la
> estrategia vigente) y [TECH_DEBT.md](./TECH_DEBT.md) (`T1`-`T3`).

## 1. Inventario real — backend

- **11 archivos de test**, **82 tests** confirmados por
  `pytest --collect-only -q` en `backend/tests/`:

  | Archivo | Tests | Módulo cubierto |
  |---|---|---|
  | `test_identity.py` | 11 | registro, login, refresh, `/me`, rate limit |
  | `test_worker.py` | 6 | perfil de trabajador |
  | `test_company.py` | 5 | perfil de comercio |
  | `test_shift.py` | 14 | ciclo de vida del turno |
  | `test_attendance.py` | 4 | asistencia (depart/check-in/check-out/finish) |
  | `test_application.py` | 8 | postulación a turnos |
  | `test_matching.py` | 7 | candidatos/búsqueda por mapa |
  | `test_notification.py` | 6 | notificaciones |
  | `test_chat.py` | 6 | chat (incluye 1 test de WebSocket) |
  | `test_review.py` | 9 | reseñas |
  | `test_admin.py` | 6 | moderación admin |
  | **Total** | **82** | — |

- **DB de test:** SQLite en memoria (`sqlite+aiosqlite:///:memory:`,
  `backend/tests/conftest.py:31`), tablas creadas con
  `Base.metadata.create_all` (`conftest.py:37`). Fixture `session_factory`
  (`conftest.py:34-42`) + fixture `client` con `httpx.AsyncClient` sobre la
  app ASGI y `get_session` sobreescrito (`conftest.py:45-58`).
- **Helpers compartidos:** `register_user`, `login`, `auth_headers` definidos
  en `conftest.py` (a partir de la línea 61) — no son fixtures de pytest, son
  funciones async importadas explícitamente en cada `test_*.py`
  (`conftest.py:64-67`).
- **Nivel de los tests: 100% integración por endpoint** (uno o varios
  módulos por archivo, vía `httpx.AsyncClient` contra la app ASGI real,
  ejercitando API → aplicación → dominio → infraestructura → SQLite). **No
  hay ningún test unitario puro** (sin cliente HTTP, sólo función↔función) en
  todo el repo — confirmado: `grep -rn "^def test_\|^async def test_"
  backend/tests/*.py` no arroja ningún test que importe directamente, por
  ejemplo, `app.modules.matching.domain.scoring` o
  `app.core.security` sin pasar por el endpoint. Esto es una decisión
  válida para tests de caso de uso (documentada en `TESTING.md:15-18`), pero
  dificulta:
  - Testear combinaciones de parámetros puros (pesos de matching, casos
    límite de `haversine_km`) sin montar HTTP + DB para cada caso.
  - Testear utilidades de `app/core/` (`security.py`, `geo.py`,
    `rate_limit.py`) de forma aislada — hoy sólo se validan indirectamente
    a través de comportamiento observable en la API.

## 2. Cobertura estimada por módulo (backend)

No hay medición real de cobertura (`pytest-cov` **no está** en
`backend/requirements.txt` ni en `pyproject.toml` — sólo figuran `pytest` y
`pytest-asyncio`, `backend/requirements.txt:20-21`). Lo siguiente es una
estimación cualitativa basada en lectura de rutas vs. tests existentes:

| Módulo | Cobertura estimada | Qué está cubierto | Qué NO está cubierto |
|---|---|---|---|
| `identity` | Media-alta | Registro, login, refresh feliz, tipo de token cruzado (401), rate limit de login | **Expiración real de tokens** (no hay ningún test que fuerce `exp` vencido — ni con `freezegun` ni manipulando `iat`/`exp` manualmente); JWT malformado/con firma alterada; `/auth/refresh` con token ya usado (no aplica, no hay revocación, pero tampoco hay test que documente ese comportamiento); rate limit de `/auth/register` (sólo se testea el de `/auth/login`, `test_identity.py:105-121`); usuario inactivo/suspendido intentando refresh (existe el código en `services.py:77-78` pero no hay test que lo dispare vía HTTP) |
| `worker` | Media | Alta de perfil, duplicado, edición, métricas no editables, 404 | Filtros de búsqueda avanzados si existieran, actualización parcial vs. total |
| `company` | Media | Alta, nombre requerido, duplicado, get/update | — |
| `shift` | Alta | Creación, borrador→publicado, transición inválida, feed filtrado, asignación, no-disclosure entre comercios | Combinaciones de filtros del feed (`city`+`position`+`urgent` simultáneos), paginación (si existe), condiciones de carrera de asignación concurrente |
| `attendance` | Media | Flujo feliz completo, orden incorrecto de pasos, ajenidad | Geolocalización de check-in/check-out **fuera de rango razonable del turno** (hoy sólo se valida rango global `-90..90`/`-180..180` a nivel Pydantic, `shift/api/schemas.py:76-77`; no hay lógica ni test de "chequear que el check-in esté cerca del turno") |
| `application` | Alta | Postular, doble postulación, turno en borrador, enriquecido para el comercio, ajenidad | — |
| `matching` | **Media-baja para el motor de scoring en sí** | Ranking end-to-end (cercano gana), filtro por elegibilidad/skill/radio, 403 por rol | **Las funciones puras de `app/modules/matching/domain/scoring.py` no tienen ningún test unitario dedicado**: `_distance_score` en el borde exacto `distance_km == max_radius_km` (debe dar 0.0), candidato sin lat/long (`distance_km is None` → score neutral 0.5, `scoring.py:24-25`), `_experience_score` con `years_experience` por encima del cap, `_reputation_score`/`_punctuality_score` con valores fuera de `[0,1]` o negativos (clamps en `scoring.py:36,40`), `_performance_score` con `total == 0` (caso `0.5` de suavizado, `scoring.py:49-50`). Todo eso sólo se ejercita de forma indirecta si el escenario de integración lo dispara por casualidad — hoy no lo hace |
| `notification` | Media-alta | Listado, marcar leída, notificación por asignar/confirmar/rechazar, ajenidad (404) | Notificación por WebSocket en sí (el WS de notificaciones no tiene test, sólo el de chat) |
| `chat` | Media-alta | Envío/lectura, notificación al destinatario, inbox con contador de no leídos, ajenidad, **1 test de WebSocket** (`test_chat_websocket_pushes_new_messages`) | Reconexión del WS, múltiples conexiones simultáneas al mismo `shift_id`, mensajes mientras el otro participante está desconectado, límites de tamaño/flood de mensajes |
| `review` | Alta | Reseña mutua, agregado de rating, doble reseña, turno no cerrado, rating inválido, ajenidad | — |
| `admin` | Media-alta | 403 no-admin, listar, suspender/activar, auto-suspensión bloqueada, promover/verificar, 404 en usuario inexistente | Ninguna acción de admin queda logueada/auditada (no aplica a test, es brecha de producto — ver `SECURITY_REPORT.md`) |

**Endpoints/ramas explícitamente no ejercitados por ningún test:**

1. **WebSocket de notificaciones** (`notification/api/routes.py:48-62`) — cero
   tests; el único WS testeado es el de chat.
2. **Expiración de tokens** — ningún test crea un token con `exp` en el
   pasado ni usa `freezegun`/mocking de tiempo; toda la suite corre en
   segundos, así que nunca se alcanza naturalmente el vencimiento de 15 min.
3. **`/auth/register` rate limit** (5/min) — sólo se testea el de login
   (10/min); el código existe (`identity/api/routes.py:37-39`) pero no hay
   test análogo a `test_login_rate_limited`.
4. **Matching — scoring puro** (`matching/domain/scoring.py`) en sus casos
   límite, según el detalle de la tabla de arriba.
5. **Geolocalización real en check-in/check-out** más allá de la validación
   de rango Pydantic — no hay test (ni lógica) que valide que el trabajador
   esté cerca de la dirección del turno.
6. **Usuario inactivo/suspendido** intentando operar (login, refresh,
   endpoints protegidos) — el código lo contempla (`InactiveUserError` en
   varios puntos de `identity/application/services.py`) pero no hay ningún
   test que suspenda un usuario (vía admin) y luego intente loguearse/usar
   sus tokens existentes.
7. **CORS real** (headers en `OPTIONS`/preflight) — no se testea a nivel HTTP
   (razonable, es configuración de infraestructura, pero significa que un
   `CORS_ORIGINS` mal seteado no lo detectaría la suite).
8. **Security headers / rate limiting en conjunto con otros middlewares** —
   no hay test que verifique que `SecurityHeadersMiddleware` efectivamente
   agrega los headers a una respuesta real (se puede inferir del código, pero
   no está verificado por test).

## 3. Frontend

- **Cero tests automatizados.** Confirmado: no existe ningún `*.test.ts(x)`
  ni `*.spec.ts(x)` en `frontend/` (excluyendo `node_modules`). No hay
  Vitest, Jest, ni React Testing Library en `frontend/package.json`.
- **Gates actuales** (`frontend/package.json:5-10`): `dev`, `build`, `start`,
  `lint` (`eslint`). No hay script `test` ni `test:e2e`.
- **E2E: no existe.** No hay configuración de Playwright ni Cypress en el
  repo (`find . -iname "playwright*"` sin resultados fuera de
  `node_modules`). `TESTING.md:39-41` y `TECH_DEBT.md:48` (`T2`) ya
  reconocen esta brecha como abierta.
- Esto significa que **toda validación de flujos de usuario end-to-end
  (login, publicar turno, postularse, chat, asignar, check-in geolocalizado)
  es manual**, y que un cambio de UI que rompa un flujo crítico sólo se
  detecta si alguien lo prueba a mano antes de deployar (Vercel hace
  autodeploy desde `main`, según `CLAUDE.md`).

## 4. CI

- **No existe ningún workflow de GitHub Actions.** Confirmado:
  `.github/workflows` no existe en el repo (`ls .github/workflows` falla —
  el propio directorio `.github` no existe). `TESTING.md:44` ya señala esto
  como brecha pendiente de verificar.
- **Consecuencia directa:** los gates de calidad descritos en
  `CLAUDE.md` (`pytest -q`, `npx tsc --noEmit`, `npm run build`) **corren
  únicamente a mano**, a discreción de quien esté trabajando en una sesión.
  No hay ningún control automático que bloquee un PR o un push a `main` si
  los tests fallan, si `tsc` encuentra errores de tipos, o si el build de
  Next.js se rompe.
- Dado que **el deploy es automático desde `main`** tanto en Render
  (backend) como en Vercel (frontend) — confirmado en `render.yaml:32`
  (`autoDeploy: true`) y documentado en `CLAUDE.md` —, un commit a `main` con
  tests rotos, tipos inválidos, o un build fallido **puede llegar a
  producción sin ningún gate automático que lo frene**. Vercel sí corre su
  propio `next build` como parte del deploy (fallaría el deploy si el build
  rompe), pero eso no cubre `tsc --noEmit` por separado ni, sobre todo,
  **no cubre el backend en absoluto**: Render con Docker (`render.yaml:10-11`)
  puede levantar el contenedor igual aunque `pytest` esté en rojo, porque el
  build de Docker no corre la suite de tests.

## 5. Componentes críticos sin protección de tests

Lista explícita, de mayor a menor criticidad para el negocio (misión:
"cubrir una posición eventual en menos de 10 minutos"):

1. **Expiración y revocación de sesión** (backend) — sin tests de tiempo
   vencido; y la revocación ni siquiera existe como funcionalidad (ver
   `SECURITY_REPORT.md` #2).
2. **CI/CD gate** — no hay ningún test "sobre el proceso": nada impide que
   código roto llegue a producción vía `main`.
3. **Frontend en su totalidad** — cero tests automatizados sobre flujos de
   negocio críticos (login, publicar turno, postularse, asignar, chat en
   vivo, check-in geolocalizado). Un refactor de `auth-context.tsx` o de
   cualquier página bajo `frontend/app/` no tiene red de contención.
4. **WebSocket de notificaciones** — sin test; si se rompe la asociación
   `user_id` → conexión (`ws_manager.py:35-41`), nadie se entera hasta que un
   usuario reporte que no le llegan notificaciones.
5. **Motor de matching (scoring puro)** — es el corazón de la propuesta de
   valor ("cubrir en <10 min" depende de rankear bien a los candidatos) y sus
   funciones puras no tienen tests unitarios dedicados a casos límite.
6. **Rate limiting de `/auth/register`** — código sin test, a diferencia de
   su par en `/auth/login`.
7. **Manejo de usuarios suspendidos con sesión activa** — la lógica de
   dominio existe pero nunca se ejercita en un test que primero suspenda y
   luego intente usar la sesión.

## 6. Estrategia recomendada

1. **Cerrar la brecha de CI primero** (bloquea todo lo demás en términos de
   impacto/esfuerzo): un workflow de GitHub Actions mínimo que corra
   `pytest -q` (backend) y `npx tsc --noEmit && npm run build` (frontend) en
   cada PR contra `main`, como *required check*. Sin esto, cualquier otra
   inversión en tests no tiene garantía de ejecutarse antes de llegar a
   producción.
2. **Agregar tests unitarios puros para `matching/domain/scoring.py`** —
   son funciones sin efectos secundarios, ideales para tests rápidos que no
   necesitan HTTP ni DB; cubrir los bordes descritos en la sección 2.
3. **Agregar tests de expiración/revocación de tokens** usando
   `freezegun` (o construyendo el JWT manualmente con `exp` en el pasado vía
   `app.core.security._create_token` con un `timedelta` negativo) para
   verificar que un token vencido es rechazado con 401.
4. **Test de WebSocket de notificaciones**, siguiendo el patrón ya existente
   de `test_chat.py::test_chat_websocket_pushes_new_messages`.
5. **Introducir medición de cobertura** (`pytest-cov` + `--cov-report=term`)
   para reemplazar esta estimación cualitativa por números reales y detectar
   regresiones de cobertura en CI.
6. **Frontend:** arrancar con Vitest + React Testing Library para
   componentes del Design System (`frontend/components/ui/`) y lógica de
   `lib/` (`auth-context.tsx`, `api.ts`), y Playwright para 3-4 flujos E2E
   críticos (login, publicar turno → postularse → asignar, chat). No hace
   falta cobertura exhaustiva de entrada: priorizar los flujos que si se
   rompen, rompen la promesa central del producto.
7. **Correr la suite backend ocasionalmente contra Postgres real** (no sólo
   SQLite), tal como ya recomienda `TESTING.md:46-48`, para detectar
   divergencias de tipos/constraints antes de que aparezcan en producción.

---

## 7. Brechas — tabla de priorización

| # | Problema | Descripción | Impacto | Riesgo | Prioridad | Esfuerzo | Dependencias | Propuesta de solución |
|---|----------|--------------|---------|--------|-----------|----------|---------------|------------------------|
| 1 | Sin CI que corra los gates | No hay `.github/workflows`; `pytest`/`tsc`/`build` sólo corren a mano | Código roto (tests en rojo, tipos inválidos) puede llegar a `main` y deployar automáticamente | Alto — afecta disponibilidad/calidad de producción sin aviso | **Crítica** | Baja (horas: workflow YAML estándar) | Ninguna | GitHub Actions con 2 jobs (`backend`: `pytest -q`; `frontend`: `tsc --noEmit` + `build`), marcados como *required status checks* en la rama `main` |
| 2 | Frontend sin ningún test automatizado | Cero unit/integration/E2E; sólo `tsc`+`build`+`lint` | Cambios en flujos críticos (login, publicar turno, chat) sin red de contención; regresiones sólo se detectan manualmente o por reporte de usuario | Alto (producto con UX crítica: "cubrir en <10 min") | **Alta** | Alta (1-2 semanas para setup + primeros tests de flujos críticos) | Elegir stack (Vitest+RTL, Playwright); no depende de nada del backend | Setup de Vitest/RTL para componentes de `components/ui/` y `lib/`; Playwright para 3-4 flujos E2E críticos; incorporar a CI (depende de #1) |
| 3 | Sin tests de WebSocket de notificaciones | Sólo el WS de chat tiene test (`test_chat.py:150`) | Regresión silenciosa en push de notificaciones en tiempo real | Medio | **Media** | Baja (medio día, mismo patrón que el test de chat existente) | Ninguna | Test análogo a `test_chat_websocket_pushes_new_messages` para `notification/api/routes.py:48-62` |
| 4 | Sin tests de expiración/revocación de tokens | Ningún test fuerza `exp` vencido ni ejercita revocación (que tampoco existe como feature) | No hay evidencia automatizada de que un token vencido sea rechazado; si se rompe `decode_token`, no se detecta en CI | Medio-alto (seguridad + confiabilidad) | **Alta** | Baja-Media (medio día con `freezegun` o construyendo el JWT a mano) | Ninguna para el test de expiración; la revocación depende de implementar la feature (ver `SECURITY_REPORT.md` #2) | Agregar `freezegun` como dep de test; casos: access token vencido → 401, refresh vencido → 401 |
| 5 | Motor de matching sin tests unitarios de casos límite | `scoring.py` sólo se ejercita indirectamente vía tests de integración felices | Un cambio en los pesos/fórmulas puede romper silenciosamente el ranking sin que ningún test lo detecte, salvo casualidad | Medio-alto (es el corazón del producto) | **Alta** | Baja (1 día: son funciones puras, tests rápidos sin DB/HTTP) | Ninguna | Suite `test_scoring.py` (o similar) que importe `app.modules.matching.domain.scoring` directamente y cubra: `distance_km == max_radius_km`, `distance_km is None`, experiencia por encima del cap, rating/puntualidad fuera de `[0,1]`, `events_completed=cancellations=0` |
| 6 | Usuario suspendido con sesión activa, sin test | Lógica existe (`InactiveUserError`) pero nunca se dispara en un test end-to-end (suspender → intentar usar token) | Un cambio que rompa ese chequeo no se detecta | Medio (seguridad: usuario baneado que sigue operando) | **Media** | Baja (medio día, reusa `test_admin.py` + `auth_headers`) | Ninguna | Test: admin suspende a un worker con sesión activa → sus siguientes requests (o refresh) devuelven 403 |
| 7 | Rate limit de `/auth/register` sin test | Sólo `login` tiene test de rate limit (`test_identity.py:105-121`) | Regresión no detectada si se rompe el límite de registro (vector de abuso de alta de cuentas) | Bajo-medio | **Media** | Baja (copiar patrón existente) | Ninguna | Test análogo a `test_login_rate_limited` para `/auth/register` (5/min) |
| 8 | Sin medición de cobertura | No hay `pytest-cov`; las estimaciones de esta auditoría son cualitativas | No se detectan módulos con cobertura decreciente a lo largo del tiempo | Bajo | **Baja** | Baja (agregar dependencia + flag en CI) | Depende de #1 para que tenga efecto continuo | `pytest --cov=app --cov-report=term-missing` en el job de CI |
| 9 | Sin corrida periódica contra Postgres real | Suite corre 100% en SQLite; posibles divergencias de tipos/constraints no detectadas | Bajo-medio (bug que sólo aparece en producción) | **Baja** | Media (requiere levantar Postgres en CI, ej. servicio de GH Actions) | Depende de #1 (se agregaría como job adicional) | Job de CI opcional/nocturno con Postgres real vía `services:` de GitHub Actions |
| 10 | Geolocalización de check-in/check-out sin validación de cercanía al turno | Sólo se valida rango global de lat/long (Pydantic); no hay lógica ni test de "cerca del turno" | Un trabajador podría marcar check-in desde cualquier lugar del mundo dentro del rango válido de coordenadas | Medio (integridad del dato de asistencia, no es bug de seguridad de acceso) | **Media** | Media (requiere decisión de producto: radio tolerado, y luego lógica + test) | Decisión de producto sobre el radio tolerado | Agregar validación de distancia Haversine entre check-in y ubicación del turno en el caso de uso, con test que cubra dentro/fuera del radio |

## 8. Puntuación del área: **48/100**

**Justificación.** El backend tiene una suite de tests genuinamente útil:
82 tests de integración, verdes, que cubren el camino feliz y las reglas de
autorización/no-disclosure de prácticamente todos los módulos de negocio, con
una infraestructura de test bien pensada (SQLite en memoria, fixtures claras,
helpers reutilizables). Eso por sí solo sostiene la nota por encima de la
mitad de la escala.

Pero el puntaje baja de forma significativa por tres razones estructurales,
no de detalle:

1. **No hay CI.** Una suite de 82 tests que sólo corre "si a alguien se le
   ocurre correrla" no protege producción — protege la intención de
   protegerla. Con `autoDeploy: true` en Render y Vercel, el camino de "commit
   a `main` → producción" no tiene ningún gate automático de calidad. Esta es
   la brecha más grave y estructural encontrada, por encima de cualquier test
   faltante puntual.
2. **El frontend, donde vive toda la experiencia de usuario de un producto
   con una misión de UX de alta exigencia ("cubrir un turno en <10 minutos"),
   tiene cero tests automatizados.** Ni unitarios, ni E2E. Toda regresión de
   producto se detecta manualmente o por reporte de usuario en producción.
3. **El componente más estratégico del backend (el motor de matching/scoring,
   la razón de ser técnica del producto) no tiene un solo test unitario
   dedicado** — está cubierto sólo de forma incidental por tests de
   integración que no ejercitan sus casos límite.

No es una nota más baja porque lo que existe (backend) está bien construido y
es genuinamente verde, con buena cobertura de reglas de negocio y acceso; y
porque las brechas identificadas son todas cerrables con esfuerzo bajo-medio
(el ítem de mayor apalancamiento, CI, es cuestión de horas). No llega a 70+
porque testing sin CI que lo haga cumplir, y sin ninguna cobertura del
frontend, deja la mayor parte de la superficie de riesgo real (deploy
automático + UX crítica) sin red de contención.
