# ACCESO_MODERNO.md — Entrar con Google, notificaciones push y passkeys

> Spec del batch "Acceso moderno". Referencia de la operadora: *"Cuadra ya
> tiene Google, push y huella; Staffya no."* Entrega incremental en orden de
> prioridad. Este documento es la fuente de verdad de **qué se decidió y por
> qué** — no repite lo que ya está en el código, lo explica.

## Estado de la entrega

| Feature | Estado | PR |
|---|---|---|
| 1. Entrar con Google | ✅ Completo (backend + frontend + tests) | este PR |
| 2. Notificaciones push (Web Push) | ✅ Completo (backend + frontend + tests) | este PR |
| 3. Reingreso con huella/PIN (passkeys WebAuthn) | ⛔ No implementado — diseño abajo, fase siguiente | — |

No se llegó a Feature 3 con la calidad que requiere una superficie de
autenticación (ceremonias WebAuthn completas, almacenamiento de challenge,
tests con autenticador virtual). En vez de una implementación apurada, queda
diseñada en detalle más abajo para que la retome cualquier sesión — humana o
IA — sin tener que releer todo el código de Google/push primero.

## Feature 1 — Entrar con Google

### Qué se construyó

`POST /auth/google` recibe un **ID token** de Google Identity Services (GIS)
y:
1. Lo verifica contra el endpoint `tokeninfo` de Google (audience = nuestro
   `GOOGLE_CLIENT_ID`, `email_verified=true`).
2. Si el email ya tiene cuenta → sesión normal (mismos tokens JWT propios que
   `/auth/login`, mismo contrato de respuesta).
3. Si el email es nuevo y no se mandó `role` → responde
   `{"requires_role": true, "email", "full_name"}` (200): el frontend muestra
   "¿Buscás trabajo o buscás personal?" y reintenta el mismo `POST
   /auth/google` con el `id_token` (todavía vigente) + el rol elegido.
4. Si el email es nuevo y se mandó `role` → da de alta la cuenta
   (`is_verified=true`, Google ya certificó el email) y devuelve tokens.

Archivos clave: `backend/app/modules/identity/domain/google_verifier.py`
(puerto), `infrastructure/google_token_verifier.py` (adaptador real),
`application/services.py::IdentityService.authenticate_google`,
`api/routes.py::google_auth`. Frontend: `components/GoogleAuthButton.tsx`
(reutilizado en `/login` y `/register`), `lib/auth-context.tsx::loginWithGoogle`.

### Derivación de las decisiones

**ID token (GIS) en vez de authorization-code, a diferencia de Cuadra.**
Cuadra (`conciliacion-bancaria/backend/app/routers/google_auth.py`) usa el
flujo de redirect con `code` + intercambio server-side, que necesita
`GOOGLE_CLIENT_SECRET`. Google Identity Services (el botón moderno, `<script
src="https://accounts.google.com/gsi/client">`) entrega directamente un ID
token firmado al frontend, que el backend sólo tiene que **verificar**, no
canjear. Resultado: **no hace falta `GOOGLE_CLIENT_SECRET`** — un secreto
menos para cargar en Render, y el mismo flujo sirve para login y alta sin
diferenciar redirect vs. popup. Trade-off aceptado: GIS no funciona en
navegadores muy viejos sin JS de terceros habilitado — aceptable para una app
2026 con targeting mobile-first.

**Verificación vía `httpx` + endpoint `tokeninfo`, no la librería
`google-auth`.** El spec sugería "`google-auth` o validación JWT contra las
claves públicas — mirá qué usa Cuadra". Cuadra tampoco usa `google-auth`: usa
`requests` contra `tokeninfo`. Se siguió el mismo criterio que
`ResendEmailSender` ya documenta en este repo ("sin SDK nuevo por un único
endpoint simple"): `google-auth` suma ~5 paquetes transitivos (cachetools,
pyasn1, rsa, google-auth-httplib2...) para ganar, en la práctica, evitar un
round-trip HTTP por login — no se justifica al volumen de Staffya. Con
`httpx` (ya en el proyecto) alcanza. Si el volumen de logins crece mucho
(cientos/seg) y el round-trip a Google se vuelve un cuello de botella real,
ahí sí migrar a validación local de firma JWK cacheada — no antes (ADR
pendiente si llega ese día).

**Cuentas Google sin contraseña local: hash bcrypt de un secreto aleatorio,
no una columna nullable.** `UserModel.hashed_password` es `NOT NULL` y la
comparten `authenticate`/`reset_password`/`SqlAlchemyUserRepository.update`.
Volverla nullable implicaba ramificar esos tres flujos ("¿tiene contraseña o
no?") y una migración de esquema. En cambio,
`IdentityService._google_local_password()` genera
`hash_password(secrets.token_urlsafe(32))`: un hash bcrypt **válido**
(pasa `verify_password` sin excepciones) de un secreto que nadie conoce ni se
persiste en claro. Efecto observable idéntico a "sin contraseña" (nadie puede
loguearse con `/auth/login` para esa cuenta — cubierto por test), cero
cambios de esquema, y el usuario puede pedir "Olvidé mi contraseña" más
adelante para setear una propia sin tocar nada más. Documentado inline en
`_google_local_password()`.

**Selección de rol post-login, no un tercer valor en el registro.** El
`RegisterRequest`/`GoogleAuthRequest.role` ya excluye `admin`
(`RegisterableRole`, sin tocar). Un email nuevo sin rol no crea usuario
todavía — se devuelve `GoogleRoleRequired` (dataclass en `application/dtos.py`,
no una excepción: es un resultado válido del caso de uso, no un error) y el
alta ocurre recién en el segundo `POST /auth/google`. Se evita así un estado
intermedio de "usuario a medio crear" en la base.

### Tests

`backend/tests/test_google_auth.py` (7 casos): usuario nuevo sin rol (pide
rol, no crea cuenta), usuario nuevo con rol (crea cuenta verificada), usuario
existente (login normal, ignora `role` si se manda), token inválido (401),
email no verificado (401), `GOOGLE_CLIENT_ID` no configurado (503), y que una
cuenta Google no tiene contraseña local utilizable (login por contraseña con
cualquier valor → 401 limpio, no 500). No llaman a Google real: sobreescriben
la dependencia `get_google_verifier` con un `_FakeGoogleVerifier`.

### Variable de entorno nueva

| Var | Dónde | Nota |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Backend (Render) | Client ID tipo "Web application" de console.cloud.google.com → APIs & Services → Credentials. **Sin client secret.** |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Frontend (Vercel) | Mismo Client ID, público (se inlinea en el bundle — normal en OAuth de browser). |

Sin ninguna de las dos: el botón "Continuar con Google" no se renderiza
(`GoogleAuthButton` devuelve `null`) y `POST /auth/google` responde 503 — no
rompe nada (mismo patrón "flag por ausencia" que `RESEND_API_KEY`/
`MERCADOPAGO_ACCESS_TOKEN` en este repo).

CSP (`frontend/next.config.ts`) se amplió con `accounts.google.com` en
`script-src`, `frame-src` y `connect-src` — sin esto el botón carga pero el
iframe de Google queda bloqueado por `default-src 'self'`.

## Feature 2 — Notificaciones push (Web Push)

### Qué se construyó

Tabla `push_subscriptions` (migración `0013`, verificada up/down contra
Postgres real — ver más abajo) con las suscripciones Web Push por
dispositivo/navegador de cada usuario. `POST /push/subscribe` (idempotente
por `endpoint`) / `DELETE /push/subscribe` gestionan el ciclo de vida;
`GET /push/public-key` expone la clave pública VAPID (o `null` si no está
configurada, sin autenticar — el frontend la necesita antes de decidir si
mostrar el toggle).

El envío en sí **no es un endpoint que alguien llame**: es un hook dentro de
`SqlAlchemyNotificationRepository.add()` — el único punto donde HOY se
crean **todas** las notificaciones in-app (shift, chat, review, application:
5 módulos distintos llaman a este mismo repositorio, ver
`grep -rn SqlAlchemyNotificationRepository app/modules/*/api/dependencies.py`).
Cada `Notification` que se persiste dispara, best-effort, un intento de push
a cada suscripción del usuario. Si el usuario no tiene ninguna, es un no-op
inmediato. Si el envío falla, se loguea y sigue; si el proveedor devuelve
404/410 (endpoint dado de baja — el usuario desinstaló la PWA, revocó el
permiso), la suscripción se purga sola.

Archivos clave: `domain/entities.py::PushSubscription`,
`domain/push_sender.py` (puerto), `infrastructure/webpush_sender.py`
(adaptador real, `pywebpush`), `infrastructure/null_push_sender.py` (flag por
ausencia), `infrastructure/repositories.py::_send_push_best_effort` (el
hook). Frontend: `public/sw.js` (service worker mínimo), `lib/push.ts`
(helpers), `lib/push-prompt-context.tsx` (prompt de opt-in),
`components/PushToggle.tsx` (toggle en `/profile`).

### Derivación de las decisiones

**Hook en el repositorio, no un `PushService` que cada módulo tenga que
llamar.** La alternativa — agregar `await push_service.notify(...)` en cada
uno de los ~10 call-sites de `notifications.add(Notification(...))`
distribuidos en `shift`, `chat`, `review`, `application` — significaba tocar
4 módulos y arriesgarse a que alguien agregue un caso nuevo sin acordarse del
push. El repositorio ya hace un side-effect equivalente ahí mismo
(`ws_manager.broadcast_notification`, notificación en vivo por WebSocket):
agregar el push al lado es **el mismo patrón que el código ya elegía**, no
uno nuevo, y garantiza que cualquier notificación in-app futura — sin tocar
nada — también intente push.

**El repositorio de infraestructura arma su propio sender (no inyectado por
constructor).** Cambiar la firma de `SqlAlchemyNotificationRepository(session)`
a `(session, push_sender)` rompía los 5 call-sites que la construyen
directamente (`shift`, `chat`, `review`, `application`,
`notification/api/dependencies.py`). En cambio, `_get_push_sender()` es una
función privada del módulo que lee `settings` (mismo criterio que
`get_email_sender`). Para tests, se pisa con
`monkeypatch.setattr("...repositories._get_push_sender", lambda: fake)` —
patrón explícito de pytest, sin ensuciar el código de producción con un seam
de test.

**`WebPushSender` envuelve `pywebpush` (síncrona) con `asyncio.to_thread`.**
`pywebpush.webpush()` usa `requests` por debajo — bloquear el loop async del
proceso en cada push sería peor que el envío en sí. Mismo criterio que
cualquier librería síncrona en un proyecto async.

**Sin caching en el service worker.** El repo no tenía service worker.
Agregar uno con estrategia de cache (aunque fuera "sólo para que la PWA
instale") es una superficie nueva de bugs post-deploy (assets viejos
atrapados en cache — es explícitamente el problema que el comentario de
`conciliacion-bancaria/frontend/public/sw.js` describe y por el que Cuadra
tiene un CACHE_NAME versionado + purga de caches viejos en `activate`). Acá
se evitó el problema entero: `public/sw.js` sólo escucha `push` y
`notificationclick`, no intercepta `fetch`, no cachea nada. Si más adelante
se quiere PWA instalable con offline real, es un cambio aparte y explícito.

**Prompt de opt-in disparado por código de negocio, no por un timer o al
aterrizar.** `usePushPrompt().requestOptIn()` se llama explícitamente después
de: primera postulación exitosa del trabajador (`app/feed/page.tsx` y
`app/map/page.tsx`, los dos flujos de "postularme") y primer turno publicado
del comercio (`app/shifts/new/page.tsx`). `alreadyDecided()` en
`push-prompt-context.tsx` evita mostrarlo de nuevo si ya se decidió a nivel
navegador (`Notification.permission !== "default"`) o si ya se mostró antes
en este dispositivo (`localStorage`).

### Tests

`backend/tests/test_push.py` (6 casos): clave pública sin VAPID configurado,
suscripción requiere auth, suscribir/desuscribir (con idempotencia), crear
una notificación dispara push a las suscripciones del usuario, crear una
notificación **sobrevive** si el envío de push explota (no propaga la
excepción), y crear una notificación sin ninguna suscripción no rompe nada.

### Migración

`backend/alembic/versions/0013_create_push_subscriptions_table.py` — probada
contra un Postgres real de este entorno (`upgrade head` → tabla con FK+índices
correctos → `downgrade -1` → tabla desaparece limpio → `upgrade head` de
nuevo, sin errores). No se pudo usar SQLite para esto (la migración usa
`postgresql.UUID` explícito, como todas las anteriores del proyecto) — se
necesita Postgres real, que este entorno sí tenía disponible
(`pg_ctlcluster 16 main start`, DB `staffya` preexistente).

### Variables de entorno nuevas

| Var | Dónde | Nota |
|---|---|---|
| `VAPID_PUBLIC_KEY` | Backend (Render) **y** Frontend (Vercel, vía `GET /push/public-key` — no hace falta duplicarla como env var de Vercel) | Par de claves VAPID, formato base64url sin padding. |
| `VAPID_PRIVATE_KEY` | Backend (Render) | **Nunca** en el frontend. |
| `VAPID_CONTACT_EMAIL` | Backend (Render), opcional | Default `soporte@staffya.com`. Contacto del claim `sub` de VAPID (lo puede pedir el proveedor push si una suscripción abusa del canal). |

**Cómo generar el par de claves** (una sola vez, no hay endpoint para esto a
propósito — a diferencia de Cuadra, que expone `POST /push/setup` para
generarlas desde el panel; acá se prefirió no dejar un endpoint que genere
secretos criptográficos en producción):
```bash
python3 -c "
from py_vapid import Vapid
import base64
v = Vapid(); v.generate_keys()
priv = v.private_key.private_numbers().private_value.to_bytes(32, 'big')
print('VAPID_PRIVATE_KEY=' + base64.urlsafe_b64encode(priv).rstrip(b'=').decode())
nums = v.public_key.public_numbers()
pub = b'\x04' + nums.x.to_bytes(32, 'big') + nums.y.to_bytes(32, 'big')
print('VAPID_PUBLIC_KEY=' + base64.urlsafe_b64encode(pub).rstrip(b'=').decode())
"
```
(Requiere `py-vapid`, que ya se instala como dependencia transitiva de
`pywebpush`.)

Sin ambas claves: `NullPushSender` — el toggle de `/profile` no aparece (
`GET /push/public-key` devuelve `null`), nada se rompe.

### Fricción de esta sesión (para quien retome)

`pywebpush` depende de `http-ece`, que sólo publica sdist en PyPI (sin
wheel). El entorno de desarrollo de esta sesión no pudo construirlo — un bug
de `distutils`/Debian del sandbox (`AttributeError: install_layout`,
reproducible con cualquier paquete legacy basado en `setup.py`, no específico
de `http-ece`), ajeno al código de este PR. `WebPushSender` importa
`pywebpush` de forma perezosa (recién dentro de `_send_sync`, no a nivel de
módulo), así que esto **no bloqueó** collection de tests ni el arranque de la
app — pero **Render debería verificar que el build instala `pywebpush`
correctamente** en el primer deploy de esta feature (ambiente limpio con
imagen oficial de Python, sin el parche de Debian — debería instalar sin
problema, pero no se pudo confirmar end-to-end en esta sesión).

## Feature 3 — Reingreso con huella/PIN (passkeys WebAuthn)

**No implementado.** Diseño para la próxima sesión que lo retome.

### Alcance

- **Registro de passkey** desde `/profile` (usuario ya logueado): botón
  "Activá el ingreso con huella" → `navigator.credentials.create()` con las
  `options` que da el backend → el backend verifica la attestation y guarda
  el credential.
- **Login con passkey** desde `/login`: botón "Entrar con huella" →
  `navigator.credentials.get()` → el backend verifica la assertion y emite
  los mismos tokens JWT que `/auth/login`.
- Discoverable credentials (resident keys) para no pedir email antes de
  tocar el sensor — UX equivalente a "Entrar con Google": un botón, sin
  formulario previo.

### Backend — diseño de módulo (`identity`, mismo módulo que Google)

Librería: `py_webauthn` (`webauthn` en PyPI) — implementa las ceremonias
WebAuthn/FIDO2 server-side (generación de `options`, verificación de
attestation/assertion) sin reinventar la criptografía.

**Entidad nueva** `WebAuthnCredential` (`domain/entities.py`):
```python
@dataclass
class WebAuthnCredential:
    user_id: UUID
    credential_id: bytes      # id opaco del authenticator, base64url en la wire
    public_key: bytes         # clave pública COSE, para verificar el próximo login
    sign_count: int           # contador anti-clonado (debe crecer en cada uso)
    transports: list[str]     # ["internal"], ["usb","nfc"], etc. (hint de UI)
    id: UUID
    created_at: datetime | None
    last_used_at: datetime | None
```

**Challenge efímero**, NO una tabla — usar el mismo mecanismo que ya existe
para el rate limiting (`core/rate_limit.py`, en memoria) o, si hace falta
sobrevivir un restart del proceso, una tabla `webauthn_challenges` (id,
challenge, user_id nullable, expires_at ~5 min, ver patrón de
`password_reset_tokens` para el TTL). Empezar en memoria; sólo migrar a tabla
si en producción con múltiples workers el challenge de un worker no lo ve
otro (Render hoy corre 1 worker — ver comentario de `rate_limit.py`, mismo
trade-off aceptado ahí).

**Endpoints** (`api/routes.py`, mismo router `/auth`):
| Método | Ruta | Requiere sesión | Qué hace |
|---|---|---|---|
| POST | `/webauthn/register/options` | Sí | Genera las `PublicKeyCredentialCreationOptions` (challenge + info del usuario) |
| POST | `/webauthn/register/verify` | Sí | Verifica la attestation, guarda el `WebAuthnCredential` |
| POST | `/webauthn/login/options` | No | Genera `PublicKeyCredentialRequestOptions` (discoverable, sin `allowCredentials` fijo) |
| POST | `/webauthn/login/verify` | No | Verifica la assertion, busca el credential por `credential_id`, valida `sign_count`, emite tokens JWT (mismo `_issue_tokens` que Google/password) |

**Migración**: tabla `webauthn_credentials` (número siguiente tras esta
entrega, verificar el real corriendo `ls backend/alembic/versions` al
retomar — quedó en `0013` con esta entrega).

**Config nueva**: `webauthn_rp_id` (Relying Party ID = dominio, ej.
`staffya.com.ar` en prod / `localhost` en dev — **debe coincidir con el
dominio real**, WebAuthn lo exige) y `webauthn_rp_name` ("Staffya").

### Frontend — diseño

- `lib/webauthn.ts`: wrappers de `navigator.credentials.create/get` +
  conversión base64url ↔ `ArrayBuffer` de los campos binarios (`challenge`,
  `credential_id`, etc. — la Credential Management API trabaja en binario, la
  wire HTTP en base64url; hay que convertir en ambas direcciones, con
  cuidado de no reusar ciegamente `urlBase64ToUint8Array` de `lib/push.ts`
  sin revisar el padding de cada caso).
- Botón "Activá el ingreso con huella" en `/profile` (junto a `PushToggle`,
  mismo patrón de sección).
- Botón "Entrar con huella" en `/login`, junto al de Google — mostrar sólo si
  `window.PublicKeyCredential` existe (feature-detect, mismo criterio que
  `isPushSupported()`).

### Tests — cómo verificarlo sin un dedo real

Playwright soporta **Virtual Authenticators** vía CDP
(`page.context().newCDPSession()` + `WebAuthn.enable` +
`WebAuthn.addVirtualAuthenticator`) — permite simular un sensor de huella
real en Chromium sin hardware, para e2e de registro + login. Para tests de
backend (pytest), `py_webauthn` trae utilidades para generar
attestation/assertion sintéticas en sus propios tests — revisar
`tests/` del paquete como referencia antes de escribir los propios.

### Por qué se dejó afuera de esta entrega

Tiempo: ya se habían completado e integrado Google (feature de mayor
prioridad explícita) y push (con hook cruzando 5 módulos + migración
verificada) con la profundidad de testing que un cambio de superficie de auth
requiere. WebAuthn agrega una tercera ceremonia criptográfica completa
(challenge/attestation/assertion) que, apurada, es exactamente el tipo de
feature donde un bug no se nota en review pero sí en producción (alguien
queda sin poder loguearse, o peor). Se prefirió dejarla bien diseñada en vez
de a medias.
