# 03 — Seguridad

> Fase 3 de la auditoría OÍDO. Cubre: secrets, API keys, JWT, cookies, CORS,
> CSRF, XSS, SQL injection, rate limiting, uploads, validaciones, permisos,
> auth, RBAC, logs sensibles, headers. Con severidad (Crítico/Alto/Medio/
> Bajo). Metodología: verificación línea por línea contra
> `docs/SECURITY.md` (diseño vigente, mantenido) y `docs/SECURITY_REPORT.md`
> (foto de auditoría fechada **2026-07-02**, hoy con más de un mes de
> desfasaje) — cada hallazgo de ese reporte se re-verificó contra el código
> actual (commit base `812c114`, 2026-08-04) en vez de darlo por vigente. Se
> suma la auditoría de dependencias con CVEs ya hecha el 2026-08-02
> (`docs/TECH_DEBT.md` S3, `01_INVENTORY.md`/`02_ARCHITECTURE.md` no la
> repiten). Sin cambios de código en esta fase.

## Resumen ejecutivo

`docs/SECURITY_REPORT.md` (2026-07-02) calificó el área en **62/100**, con
un hallazgo crítico (credenciales demo sembradas en producción) y una tabla
de 11 pendientes. Un mes de trabajo después, **3 de esos 11 pendientes ya
están resueltos** (revocación de refresh tokens, CSP, y — parcialmente —
observabilidad/logging), verificado con evidencia de código, no de memoria.
El hallazgo crítico original (§2 abajo) **sigue exactamente igual de
abierto** — es, hoy, el problema de seguridad más grave y accionable de
todo el repositorio.

## 1. Severidad — tabla consolidada (fase 3, estado real a 2026-08-04)

| # | Hallazgo | Severidad | Estado |
|---|---|:---:|---|
| 1 | Credenciales demo hardcodeadas, sembradas en la DB de **producción** | 🔴 **Crítico** | **Abierto**, sin cambios (§2) |
| 2 | Refresh token sin revocación server-side | 🔴 Alto (era) | **Resuelto** — ADR-0002 + logout wired end-to-end (§3) |
| 3 | Sin `Content-Security-Policy` | 🟠 Alto (era) | **Resuelto** — `next.config.ts`, sólo producción (§4) |
| 4 | Refresh token sigue en `localStorage` (no cookie `httpOnly`) | 🟠 Alto | **Abierto**, documentado como deuda consciente (§3) |
| 5 | `pyjwt`/`python-multipart`/Next.js con CVEs de bajo riesgo | 🟠 Alto (era) | **Resuelto** (PR #149, 2026-08-02) — ver `docs/TECH_DEBT.md` S3 |
| 6 | Starlette 0.41→1.x / pytest 8→9 con CVEs, salto de versión mayor | 🟠 Alto | **Diferido a propósito** (documentado, no silencioso) — ver §7 |
| 7 | Sin rate limiting en `/auth/refresh` | 🟡 Medio | **Abierto**, sin cambios (§5) |
| 8 | Sin cuota/rate limit en WebSockets (chat + notificaciones) | 🟡 Medio | **Abierto** (`TECH_DEBT.md` S2), sin cambios (§8) |
| 9 | Sin verificación de email al registrarse | 🟡 Medio | **Abierto**, sin cambios (§9) |
| 10 | Sin logging de eventos de seguridad (login fallido, 403, 429, acciones admin) | 🟡 Medio (era 🟠) | **Parcialmente resuelto** — existe la plomería (request_id, JSON logs, Sentry), falta instrumentar eventos puntuales (§10) |
| 11 | Password sin requisito de complejidad (sólo `min_length=8`) | 🟢 Bajo | **Abierto**, sin cambios (§9) |
| 12 | Token WS en query string (`?token=`) | 🟢 Bajo | **Abierto**, sin cambios (§8) |
| 13 | Subida de imágenes 100% client-side con preset *unsigned* de Cloudinary | 🟡 Medio (hallazgo nuevo, no estaba en `SECURITY_REPORT.md`) | **Abierto** — ver §11 |
| 14 | `allow_credentials=True` en CORS sin usar cookies | 🟢 Bajo | **Abierto**, sin cambios (§6) |

## 2. 🔴 Crítico — credenciales demo activas en producción

**Sin cambios desde `SECURITY_REPORT.md`, verificado de nuevo línea por
línea.** `backend/scripts/seed_demo_data.py:64` define
`DEMO_PASSWORD = "staffyaDemo123"` en texto plano, commiteada. Crea ~24
cuentas demo (comercios y trabajadores, `demo.palermo@staffya.com` y
similares) con esa contraseña. `backend/scripts/startup_seed.py` corre ese
script en cada arranque del contenedor si `SEED_DEMO_DATA=true`, y
**`render.yaml:44-45` fija ese valor en `"true"` en el servicio de
producción real** (`staffya-backend`, verificado en esta misma auditoría,
`01_INVENTORY.md §5`).

**Impacto sin cambios:** cualquiera con el repo (o con la contraseña, que
está en el historial de git y en texto plano en el código) puede
autenticarse hoy mismo como esas ~24 cuentas contra `staffya-backend.onrender.com`
y operar turnos, chats y postulaciones reales. `CLAUDE.md` ya lo tiene
listado como ítem 2 de "Pendiente de la operadora" ("Apagar
`SEED_DEMO_DATA`... antes de onboardear comercios reales") — **es trabajo
de Julieta (fuera del código), no bloqueado por nada técnico**, y sigue
pendiente. Se reitera acá como el hallazgo #1 de esta fase porque es el
único de severidad crítica y porque su solución (cambiar un valor en el
dashboard de Render) es de minutos, no de días.

## 3. Sesión — revocación de refresh: resuelto; almacenamiento: pendiente

Contradice el hallazgo #2 de `SECURITY_REPORT.md` ("Revocación: NO EXISTE")
— **hoy sí existe**, verificado en código:

- Tabla `refresh_sessions` (`identity/infrastructure/models.py:38-46`) con
  `jti` único por sesión.
- Rotación: cada `/auth/refresh` invalida el `jti` usado y emite uno nuevo
  (`identity/application/services.py:142-161`).
- **Detección de reuso = robo:** reusar un `jti` ya revocado revoca **todas**
  las sesiones del usuario (mismo método, comentario explícito en el código
  — no-disclosure aplicado también acá, línea 165 de
  `identity/api/routes.py`: "un jti revocado/reusado responde igual que uno
  inválido").
- `POST /auth/logout` (`identity/api/routes.py:178-186`) revoca
  server-side, y **el frontend ya lo llama** (`docs/TECH_DEBT.md` S1,
  actualización 2026-08-02: `auth-context.tsx::logout()` llama a
  `/auth/logout` antes de limpiar `localStorage`, con test E2E en
  `frontend/e2e/auth.spec.ts`).

**Lo que sigue abierto, sin cambios:** el refresh token de 30 días **sigue
guardándose en `localStorage`**, no en cookie `httpOnly`. Es deuda
consciente y documentada (`docs/TECH_DEBT.md` S1, "sigue pendiente, sin
cambios"), no un olvido — migrar a cookie `httpOnly` es un cambio de
arquitectura de auth (afecta CORS/`credentials` cross-origin Vercel↔Render),
no un ajuste menor. Severidad 🟠 Alto: mientras no haya XSS, el riesgo es
bajo; si apareciera uno, el radio de impacto sigue siendo "sesión completa
de 30 días legible por JS" — mitigado en parte por la CSP nueva (§4).

## 4. Content-Security-Policy — resuelto

Contradice el hallazgo #6/#7 de `SECURITY_REPORT.md` ("No existe ningún
header CSP") — **hoy sí existe**, sólo en producción:
`frontend/next.config.ts:47` agrega `Content-Security-Policy` a
`securityHeaders`, aplicado condicionalmente
(`if (process.env.NODE_ENV !== "production") return [];`, línea 59) junto
con `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y
`Permissions-Policy`. El propio archivo documenta sus trade-offs en
comentarios: `script-src` acepta `'unsafe-inline'` (Next.js inyecta
bootstrap inline; nonces requerirían middleware propio) y `blob:` (worker
de MapLibre). Es una CSP real pero no la más estricta posible — razonable
para el stack actual, documentado como decisión consciente, no como
descuido. `docs/SECURITY.md §Endurecimiento ya aplicado` ya lo registra;
`SECURITY_REPORT.md` simplemente es anterior a este cambio.

## 5. Rate limiting — parcial, sin cambios en la brecha conocida

Confirmado sin cambios respecto a `SECURITY_REPORT.md §3`: `login` (10/min)
y `register` (5/min) tienen `RateLimiter` (`identity/api/routes.py:52-59`).
Se sumaron además `_forgot_password_rate_limit` y `_google_auth_rate_limit`
(no estaban en el reporte anterior — mejora no documentada ahí, hallazgo
positivo de esta fase). **`/auth/refresh` (línea 160) sigue sin
`RateLimiter`** — verificado con lectura directa del handler, no tiene
dependencia de rate limit en su firma. Sigue siendo una asimetría de bajo
impacto (no es vector de fuerza bruta de contraseña) pero real. Es en
memoria y por proceso (`rate_limit.py`) — efectivo hoy (1 worker Uvicorn,
confirmado en `01_INVENTORY.md §5`), no escala horizontalmente sin Redis +
ADR, ya documentado como tal en `docs/SECURITY.md`.

## 6. CORS — sin cambios

`backend/app/main.py:58-63`: `allow_origins` desde `CORS_ORIGINS` (en
producción, un único origen `https://staffing-gastro.vercel.app`, sin
`localhost`), `allow_credentials=True`, `allow_methods=["*"]`,
`allow_headers=["*"]`. Sigue sin usarse ninguna cookie (auth 100% por header
`Authorization: Bearer`, confirmado en `frontend/lib/api.ts`), así que
`allow_credentials=True` sigue siendo vestigial — 🟢 Bajo, no explotable
(el origen ya es explícito, nunca `"*"`), pero reduce superficie sin costo
si se baja a `False` cuando se decida tocar ese archivo por otro motivo.

## 7. CSRF — no aplica, por diseño

No hay ningún endpoint que dependa de cookies de sesión para autenticar
(confirmado: auth 100% `Authorization: Bearer` en header, nunca cookie).
**CSRF no es un vector viable contra esta API** tal como está construida
hoy — un formulario/script de un origen ajeno no puede adjuntar el header
`Authorization` de la víctima. Esto cambiaría si se migrara el refresh
token a cookie `httpOnly` (§3): ese día habría que sumar protección CSRF
(`SameSite=Strict` + token CSRF de doble envío), y ya está anotado como
tal en `docs/SECURITY_REPORT.md` hallazgo #3 (fila de la tabla). Se
documenta acá explícitamente porque OÍDO lo pide como ítem de checklist y
no había una sección dedicada.

## 8. WebSockets — sin cambios

Confirmado sin cambios respecto a `SECURITY_REPORT.md §10`:

- Auth + validación de participación correctas en ambos canales (chat:
  `assert_participant` antes de `accept()`; notificaciones: canal atado al
  `user.id` del token, sin parámetro falsificable).
- Token sigue viajando por query string (`?token=...`) — 🟢 Bajo, limitación
  del protocolo WS en browsers, riesgo acotado a logs de infraestructura
  con vida de 15 min (access token).
- **Sin cuota de conexiones/mensajes** (`app/core/ws_manager.py` sin rate
  limiting) — confirmado, cero coincidencias de `rate`/`limit`/`quota` en
  ese archivo. Es exactamente `docs/TECH_DEBT.md` S2, sigue 🟡 Media, sin
  movimiento desde que se catalogó.

## 9. Validaciones de identidad — sin cambios

- Password: `min_length=8, max_length=128` (`identity/api/schemas.py:29,69`
  — el segundo es `new_password` de "restablecer contraseña", mismo
  criterio). Sin requisito de complejidad ni verificación contra
  contraseñas filtradas. 🟢 Bajo, decisión de producto válida pero no
  explicitada en `docs/SECURITY.md`.
- Verificación de email: `grep` de `verify_email`/`EmailVerif` en todo
  `identity/` **sin resultados** — sigue sin existir un flujo de
  verificación (sólo un admin puede marcar `is_verified=True` a mano). 🟡
  Medio, brecha de confianza (no de acceso) en un marketplace donde ambas
  partes confían en la identidad de la otra.

## 10. Auditoría/logging — mejora real, todavía incompleta

`SECURITY_REPORT.md §12` decía *"única línea de `logging` en todo
`backend/app`: `admin/bootstrap.py`"*. **Ya no es así**: existe
`backend/app/core/observability.py` (no citado en ese reporte, código
posterior), con:

- `RequestIdMiddleware` — correlaciona cada request con un `request_id`
  (propio o `X-Request-ID` entrante), vía `ContextVar`.
- `setup_logging()` — JSON estructurado (`LOG_JSON=true`, pensado para
  Render) o texto legible en dev, siempre con `request_id`.
- `setup_sentry()` — captura de errores, no-op sin `SENTRY_DSN` (mismo
  patrón "flag por ausencia" del resto del repo).

Las tres piezas están cableadas en `main.py:34-35,69`. **Lo que sigue sin
existir:** ningún módulo llama a `logger.warning`/`logger.error` en un
evento de seguridad específico — se verificó con `grep` de
`logger\.(warning|error|info)` en `identity/`+`admin/`: sólo aparece en
`google_token_verifier.py` (fallo de red al validar con Google) y en
`admin/bootstrap.py` (promoción de admins al arrancar, ya conocido). **No
se loguea** ningún intento de login fallido, ningún 403 por rol
insuficiente, ningún 429 de rate limit, ninguna acción de moderación de
admin (suspender/activar/promover). La plomería para hacerlo bien ya existe
(request_id + JSON + Sentry) — falta el paso de instrumentar los eventos,
que es desde acá un esfuerzo bajo (agregar `logger.warning(...)` en los
`except` ya existentes de `identity/api/routes.py` y en las acciones de
`admin/api/routes.py`), no una reconstrucción.

## 11. Uploads — hallazgo nuevo, no estaba en `SECURITY_REPORT.md`

`frontend/lib/cloudinary.ts:26-46` (`uploadImage`): el navegador sube el
archivo **directo a la API de Cloudinary** (`api.cloudinary.com`) con un
`upload_preset` **unsigned** (`NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`,
confirmado como *unsigned* por requerimiento explícito de `CLAUDE.md`: "El
preset tiene que ser unsigned"). El backend **nunca ve el archivo**: no hay
validación de tipo/tamaño/contenido en `backend/app` para este flujo (no
aplica — el backend sólo recibe la URL final `secure_url` para guardarla en
el perfil).

- **Lo que esto implica:** toda la superficie de control (tipos de archivo
  permitidos, tamaño máximo, límite de subidas) vive **en la configuración
  del preset dentro del dashboard de Cloudinary**, fuera del repo — no es
  auditable desde el código. Si el preset no restringe tamaño/formato, un
  cliente (con las credenciales públicas `cloud_name`+`upload_preset`, que
  por diseño de Cloudinary son públicas y van en el bundle del frontend)
  podría subir archivos grandes o de tipo arbitrario contra la cuenta de
  Cloudinary del proyecto — impacto de **costo/cuota**, no de intrusión al
  backend/DB propios.
- **Severidad:** 🟡 Medio — es un patrón estándar y aceptado de Cloudinary
  (no es una vulnerabilidad de código), pero merece quedar registrado
  porque hoy nadie puede confirmar desde este repo si el preset tiene
  límites de tamaño/formato configurados. Verificarlo es trabajo de
  Julieta (acceso al dashboard de Cloudinary), no de código — se agrega a
  `13_ROADMAP.md` como ítem operativo, en la misma familia que el pendiente
  ya existente de Cloudinary en `CLAUDE.md` (ítem 7, "bloquea la foto de
  perfil").

## 12. SQL injection y XSS — sin cambios, riesgo bajo confirmado de nuevo

Re-verificado con los mismos comandos que `SECURITY_REPORT.md`:
`grep -rn "dangerouslySetInnerHTML" frontend/` → 0 resultados;
`grep -rn "text(\|\.execute(\"" backend/app` → sólo falsos positivos
(`websocket.receive_text()`, `CryptContext`). Todo acceso a datos vía
SQLAlchemy 2.0 `select()` parametrizado; todo render dinámico vía JSX
(escape por defecto). Sin hallazgos nuevos en ninguna de las dos
categorías.

## 13. Secretos y `.env` — sin cambios

`.gitignore` excluye `.env`; `git ls-files | grep -i "\.env"` sigue
devolviendo únicamente los dos placeholders esperados
(`backend/.env.example`, `frontend/.env.production` — este último con un
único valor no sensible, `NEXT_PUBLIC_API_URL`). `JWT_SECRET_KEY` se
autogenera en Render (`render.yaml`). El único secreto real hardcodeado en
el repo sigue siendo el de §2 (`DEMO_PASSWORD`), que es *by design*, no una
fuga accidental.

## 14. Dependencias con CVEs — remite a `docs/TECH_DEBT.md` S3

No se repite el detalle acá (ya está documentado con evidencia real de
`pip-audit`/`npm audit`, fechas y versiones exactas). Resumen para esta
tabla de severidad: **28 hallazgos backend + 5 frontend** detectados
2026-08-02; los de **bajo riesgo ya se resolvieron** (PyJWT 2.10.1→2.13.0,
`python-multipart`→0.0.32, Next.js patch, `sharp`/`postcss` vía
`overrides`), verificado en `frontend/package.json`/`backend/requirements.txt`
en esta misma auditoría (`01_INVENTORY.md`). Los de **alto esfuerzo/alto
riesgo de romper cosas** (Starlette 0.41→1.x, arrastra upgrade de FastAPI;
pytest 8→9) quedaron **deliberadamente diferidos**, documentados como tal
(no es deuda silenciosa) — decisión correcta: un salto de versión mayor sin
ciclo de test dedicado es más riesgoso que el CVE que resuelve, dado el
perfil de exposición actual (sin evidencia de explotación activa contra
este código específico).

## 15. Veredicto de esta fase

**No hay ninguna vulnerabilidad de inyección (SQL/XSS) explotable
encontrada.** La autorización por rol y el no-disclosure siguen sólidos y
verificados por tests, sin regresiones. El único hallazgo de severidad
**crítica** es operativo, no de código, y ya estaba identificado antes de
esta auditoría (`SECURITY_REPORT.md` + `CLAUDE.md`): las credenciales demo
en producción. De los 11 pendientes que dejó la auditoría anterior, **3 se
cerraron con trabajo real** (revocación de sesión, CSP, dependencias de
bajo riesgo) y **ninguno retrocedió**. La superficie nueva desde entonces
(Google Sign-In, WebPush, Mercado Pago, Cloudinary) se revisó y no
introdujo vulnerabilidades de las categorías típicas (inyección, bypass de
auth) — sí sumó un hallazgo nuevo de severidad media (§11, uploads
delegados a un preset no auditable desde el código). No se recalcula acá
una puntuación 0-100 nueva (el `62/100` de `SECURITY_REPORT.md` quedó
desactualizado por las mejoras reales); la priorización ejecutable para
cerrar lo que queda vive en `13_ROADMAP.md`.
