# CLAUDE.md — Cómo trabajar en Staffya

Guía operativa para cualquier sesión (humana o IA) que modifique este repo. La
**fuente de verdad del producto, el dominio y la arquitectura** vive en `docs/`.
Este archivo dice **cómo** trabajar acá; los `docs/` dicen **qué** es Staffya.

> Última actualización: **2026-08-09**. Si pasó mucho tiempo desde esta fecha,
> desconfiá de los números/estados de abajo y releé
> [docs/STATUS.md](./docs/STATUS.md) (la bitácora viva) antes de asumir nada.
>
> **Frente abierto: QA en vivo de Julieta probando la app real** (comercio,
> trabajador y admin, mobile). Mergeado hasta ahora: batch de bugs (PR #166),
> fix de perfil admin, mapa/búsqueda de sólo lectura para admin + fotos en
> `/admin` + wordmark del footer (PR #168), y la causa REAL de "la X del
> Sheet no cierra" (PR #169) — dos fixes previos al `drag` de Framer Motion
> no alcanzaban porque el problema nunca fue el drag: `Sheet`/`Modal` no
> portaban a `document.body`, así que un `Card` ancestro con `whileTap` les
> rompía el *containing block* al `position: fixed`. Fix real: `createPortal`
> en ambos — ver el detalle completo (incluida la nota de proceso sobre cómo
> se perdieron horas antes de encontrar la causa de fondo) en
> [docs/STATUS.md](./docs/STATUS.md). Mismo PR: el mapa panéaba entero al
> arrastrar el pin de ubicación (fix: deshabilitar `dragPan` durante el
> arrastre del marker) y el CV del trabajador ahora acepta subir un archivo
> (PDF/Word/foto) además de pegar un link. Y las cuentas invitado
> compartidas (`invitado.trabajador@oido.beta`/`invitado.comercio@oido.beta`)
> ya no aparecen en `/matching/search` (usado por `/search` y `/map` de un
> comercio/admin real) — se filtran por email en
> `SqlAlchemyCandidateRepository.list_available` (PR #170); la exploración
> propia de un invitado no se toca. Julieta también pidió explícitamente una
> auditoría de QA/performance/UX/UI/diseño más sistemática ("la app está a un
> 40%, llevarla a 90%") — es una línea de trabajo continua, no una tarea
> puntual; seguir por prioridad desde `docs/TECH_DEBT.md`.
>
> **Deuda técnica por prioridad (en curso, 2026-08-09):** con el frente de QA
> de Julieta al día, se retomó `docs/TECH_DEBT.md` por prioridad. **S1
> (tokens de sesión) resuelto**: el refresh token dejó de viajar por
> `localStorage`/body de respuesta — ahora es una cookie `httpOnly`
> (`identity/api/routes.py::_set_refresh_cookie`), así que un XSS ya no puede
> robarlo. Detalle completo y un punto operativo que ahora importa más
> (`ENVIRONMENT=production` en Render) en `docs/TECH_DEBT.md` S1 y
> "Pendiente de la operadora" más abajo. **F4 (accesibilidad) resuelto**:
> `eslint-config-next` ya traía `jsx-a11y` pero sólo con 6 de ~30 reglas
> activas; se prendió el set `recommended` completo en `eslint.config.mjs` y
> salieron 16 errores reales (labels de formulario sin asociar a su control,
> tarjetas de turno en `/map` sin soporte de teclado) — corregidos con el
> mismo criterio que T5 (arreglar lo genuino, documentar lo que se descarta
> con motivo). Detalle en `docs/TECH_DEBT.md` F4. **T2 (tests unitarios de
> frontend) resuelto**: Vitest + Testing Library (`npm run test:unit`, ahora
> en CI), 48 tests apuntando a lógica con valor real de romperse en silencio
> (zona horaria Argentina, tabla de "única acción" del panel del comercio,
> Haversine/tiempos de viaje) y un componente con estado real
> (`EditableName`). Detalle en `docs/TECH_DEBT.md` T2.
>
> **Cerrada (2026-08-05):** auditoría de responsive/desktop pantalla por
> pantalla (Julieta usa la app en la web, no sólo mobile, y varias pantallas
> quedaban "precarias" — mobile-first sin adaptar a pantallas anchas).
> Las 12 pantallas quedaron resueltas: `/map` y `/search` (panel lateral +
> mapa), `/feed`, `/shifts`, `/my-shifts`, `/shifts/[id]/candidates` y
> `/admin` (listas de tarjetas → grilla 2-3 columnas), `/chats` (layout de
> inbox), `/profile` y `/workers/[id]` (dos columnas tipo dashboard),
> `/shifts/new` (panel de vista previa fijo al lado del wizard),
> `/companies/[id]` (mapa + "cómo llegar" a un costado cuando hay
> coordenadas) y `/subscription` (la grilla ya estaba lista, sólo faltaba
> ensanchar el contenedor). Detalle completo y el patrón del problema en
> [docs/STATUS.md](./docs/STATUS.md).

## Contexto en 30 segundos

**Staffya** es un marketplace de **staffing gastronómico en tiempo real**
(estilo Uber + Tinder): conecta comercios con trabajadores eventuales para
cubrir turnos. **Misión: cubrir una posición eventual en menos de 10 minutos.**
Roles: `worker`, `employer`, `admin`. Producto en **español (AR/LATAM)**, marca
"Oído" (mano ahuecada sobre la oreja, en trazo crema sobre tile naranja `#F97316`,
wordmark "oído" en serif Fraunces; tagline "Personal gastronómico, ya.").

- **Backend:** FastAPI · SQLAlchemy async · monolito modular DDD/hexagonal ·
  deploy en **Render** (auto desde `main`).
- **Frontend:** Next.js · TypeScript · Tailwind · PWA · deploy en **Vercel**
  (auto desde `main`).
- **Base de datos: Neon** (Postgres serverless), **ya NO** el Postgres gestionado
  de Render (ese plan free vencía a los 90 días — ver `render.yaml`, donde
  `DATABASE_URL` está comentado explícitamente como "connection string de
  Neon, se setea manual en el dashboard, nunca sobrescrita por este archivo").
  Detalle de la migración: `backend/README.md` ("Base de datos en producción:
  Neon en vez del Postgres de Render"). El switch quedó **verificado en vivo
  el 2026-07-23** (migraciones en `0015`, backend sirviendo) tras un día
  entero de backend caído por `DATABASE_URL` sin cargar — diagnóstico y
  runbook en `docs/INCIDENTE_2026-07-23_BACKEND_CAIDO.md`. Ojo: usar la
  connection string **directa** de Neon (sin `-pooler`): el repo no configura
  `statement_cache_size=0`, que el pooling en modo transacción exige con
  asyncpg.

Según `docs/planning/LAUNCH_PLAN.md`, el veredicto vigente es **lista para beta cerrada
con usuarios reales** (Palermo) — sólo faltan los pasos operativos de Julieta
listados más abajo.

## Mapa de la documentación (`docs/`)

**Al arrancar una sesión, leé primero [docs/STATUS.md](./docs/STATUS.md)**: es la
bitácora viva (qué se hizo, qué está en vuelo, qué sigue). Actualizala en cada
merge relevante. También conviene mirar [docs/BUGS.md](./docs/BUGS.md) (bugs
recurrentes ya resueltos, para no reintroducirlos) y
[docs/TECH_DEBT.md](./docs/TECH_DEBT.md) (deuda vigente por prioridad).

Antes de tocar algo, leé lo relevante. No dupliques info: referenciá.

- **Fundación** — [PRODUCT.md](./docs/foundation/PRODUCT.md) · [DOMAIN.md](./docs/foundation/DOMAIN.md) ·
  [ARCHITECTURE.md](./docs/foundation/ARCHITECTURE.md) · [PRINCIPLES.md](./docs/foundation/PRINCIPLES.md)
- **Identidad visual / diseño** — [ART_DIRECTION.md](./docs/design/ART_DIRECTION.md)
  (dirección de marca, territorio, benchmark — punto de partida) ·
  [COLOR_SYSTEM.md](./docs/design/COLOR_SYSTEM.md) (paleta + contraste WCAG medido) ·
  [TYPOGRAPHY_SYSTEM.md](./docs/design/TYPOGRAPHY_SYSTEM.md) (Inter/Fraunces) ·
  [ICONOGRAPHY_SYSTEM.md](./docs/design/ICONOGRAPHY_SYSTEM.md) ·
  [DESIGN_TOKENS.md](./docs/design/DESIGN_TOKENS.md) (radios, sombras, espaciados) ·
  [BRIEF_IDENTIDAD_VISUAL.md](./docs/design/BRIEF_IDENTIDAD_VISUAL.md) (spec técnica
  para el diseñador externo). No hay doc de performance todavía.
- **ADRs vigentes** (`docs/adr/`): 0001 MapLibre · 0002 sesiones revocables ·
  0003 `quantity`=1 permanente · 0004 cancelación del trabajador + insignias ·
  0005 mensualidad al comercio (pagos, Fase 1) · 0006 alta de local desde el
  mapa · 0007 no-show/cancelación tardía manual.
- Fases siguientes (a construir): negocio por módulo, reglas operativas,
  arquitectura técnica, desarrollo, diseño, IA, integraciones, producto y ADRs.

Arranque técnico y pasos de DB: `backend/README.md` y `frontend/README.md`.

## Qué existe HOY (funcionalidades vigentes, no históricas)

- Alta/login con email+contraseña, **recuperación de contraseña** por email
  transaccional (Resend, flag por ausencia de `RESEND_API_KEY`).
- **Acceso con Google** (ID token de Google Identity Services, sin client
  secret) y **notificaciones push** (Web Push/VAPID) — ambos no-op sin sus env
  vars (`GOOGLE_CLIENT_ID`/`NEXT_PUBLIC_GOOGLE_CLIENT_ID`,
  `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_CONTACT_EMAIL`). Detalle y
  derivación completa en [docs/reference/ACCESO_MODERNO.md](./docs/reference/ACCESO_MODERNO.md).
  Passkeys (WebAuthn, "huella/PIN") queda **diseñado en detalle pero sin
  construir** (Feature 3 del mismo doc).
- **Alta de local desde el mapa** (ADR-0006): geocoder Nominatim/OSM gratis +
  pin arrastrable como fuente de verdad de lat/lng.
- **Suscripciones Fase 1** al comercio (ADR-0005): planes gratis/básico/pro,
  pantalla "Mi plan", gating de publicación por tope mensual — **enforcement
  OFF por default** (`subscriptions_enforced=false`: se cuenta el uso pero no
  se bloquea a nadie en la beta).
- **Compartir turno por WhatsApp** (deep-link `wa.me`, Web Share API con
  fallback) + **duplicar turno** desde el panel del comercio. Página pública
  de turno sin auth para compartir. Desde 2026-07-23 el **trabajador también
  comparte** desde la tarjeta del feed (`OpportunityCard`), para pasarle un
  turno a un colega. (Distinto de la API de WhatsApp Business, que sigue
  bloqueada por cuenta/credenciales de Julieta.)
- **Panel del comercio por familias de estado** (Todos/Buscando/En
  marcha/Terminados/Cancelados) con **stepper del ciclo de vida** del turno
  (`ShiftLifecycleStepper`, mapeos distintos para comercio y trabajador) y
  pantalla **"esto es lo que sigue"** al publicar un turno (timeline de los
  próximos pasos, se muestra cada vez que se publica).
- **No-show + cancelación tardía** (ADR-0007): el comercio puede marcar "no se
  presentó" (reabre el turno, penaliza al trabajador) y la cancelación con el
  trabajador ya comprometido avisa y penaliza al comercio
  (`late_cancellations`) — antes no hacía ninguna de las dos cosas.
- **Idempotencia** en mutaciones críticas vía header `Idempotency-Key`
  (`backend/app/core/idempotency.py`).
- **Helper de zona horaria Argentina** (`backend/app/core/tz.py`,
  `hoy_art()`/`now_art()`): usar para toda fecha de NEGOCIO (edad, "turnos de
  hoy", cortes de período); los timestamps de auditoría siguen en UTC a
  propósito. Ver el patrón completo en [docs/BUGS.md](./docs/BUGS.md).
- **Legales**: `/terminos` y `/privacidad`, checkbox de consentimiento
  obligatorio en `/register`.
- Reputación real derivada del ciclo del turno (puntualidad, `events_completed`,
  insignias/niveles con otorgamiento automático), visible en perfil/búsqueda/
  postulantes — entra de verdad al ranking de matching (verificado
  end-to-end en el launch-gate, #88).

## Antes de modificar código — checklist

1. **Entender el dominio afectado.** Leé el/los `docs/` del área (empezando por
   [DOMAIN.md](./docs/foundation/DOMAIN.md)) y el módulo real (`backend/app/modules/<x>/`).
2. **Buscar antes de crear.** ¿Ya existe el componente/servicio/utilidad?
   Reutilizá (Design System en `frontend/components/ui/`, servicios de dominio,
   helpers). No dupliques lógica ni entidades.
3. **Respetar las capas.** Ubicá el cambio en la capa correcta
   (`domain`/`application`/`infrastructure`/`api`). Las dependencias apuntan al
   dominio. Cruces entre módulos: por puerto/repositorio inyectado, nunca
   acoplando dominios. Ver [PRINCIPLES.md](./docs/foundation/PRINCIPLES.md).
4. **Chequear coherencia doc↔código.** Si el código contradice la doc, frená:
   identificá la inconsistencia y corregí (código o doc) antes de seguir.
5. **Definir el alcance.** Un cambio, un propósito. PR acotado y revisable.

## Implementar una funcionalidad nueva

1. Modelar en `domain/` (entidades, value objects, **puerto** de repo,
   excepciones) sin frameworks.
2. Caso de uso en `application/` sobre los puertos (repos por constructor).
3. Adaptadores en `infrastructure/` (modelo ORM + repo) y **migración Alembic**
   si hay tabla nueva; registrar el modelo en `tests/conftest.py`.
4. Exponer en `api/` (rutas, schemas Pydantic, dependencias) mapeando
   excepciones a HTTP; **no-disclosure** (ajeno/inexistente = 404).
5. Frontend con el **Design System** existente; sin `localhost` (usar
   `NEXT_PUBLIC_API_URL`).
6. **Tests** del caso de uso (SQLite en memoria).
7. Actualizar los `docs/` afectados (la doc es fuente de verdad).

## Calidad — antes de commitear

- Backend: `pytest -q` (verde). Suite de referencia: **270 tests**
  (verificado con `pytest -q --collect-only` el 2026-08-04, tras el
  endurecimiento de producción; cambia con cada feature — no memorizarlo
  como constante, reverificar antes de citarlo).
- Frontend: `npx tsc --noEmit` **y** `npm run build`.
- E2E: `npx playwright test` (Playwright, API mockeada, sin backend real).
  Suite de referencia: **25 tests** en 14 specs (`frontend/e2e/`, verificado
  con `npx playwright test --list` el 2026-08-04), corre en CI en cada
  PR/push a `main` junto con `pytest`/`tsc`/`build`
  (`.github/workflows/ci.yml`).
- `npm run lint` **no** corre en CI (deuda conocida, ver `docs/TECH_DEBT.md`
  T5) — no lo asumas como gate aunque el checklist de sesión lo mencione.
- Reportá el resultado **real**, no el esperado. Si algo falla, se dice.

## Deuda conocida viva (no reabrir sin necesidad)

Catálogo completo y priorizado en [docs/TECH_DEBT.md](./docs/TECH_DEBT.md);
patrones de bugs ya resueltos (para no reintroducirlos) en
[docs/BUGS.md](./docs/BUGS.md). Lo más relevante para no sorprenderse:

- ~~**Postulaciones de los no-elegidos quedan "pendiente" para siempre**~~
  (TECH_DEBT P5): **resuelto 2026-07-23** — al asignar (o cancelar el turno)
  los no elegidos pasan a RECHAZADA de forma silenciosa, y si el turno se
  reabre (rechazo/cancelación/no-show del asignado) vuelven a PENDIENTE. Ver
  `ShiftService._reject_pending_applicants`/`_restore_rejected_applicants`.
- **Passkeys (WebAuthn) diseñado, no construido** — ver arriba y
  `docs/reference/ACCESO_MODERNO.md` Feature 3 para el diseño completo antes de
  arrancar (entidad, endpoints, migración, tests con Virtual Authenticator).
- **`docs/planning/PULIDO_ROADMAP.md` batch C3 (confianza/conversión: SEO,
  skeletons, a11y) sin arrancar.** **C4 (onboarding post-registro) resuelto
  para el comercio 2026-08-10** (auditoría de producto, a partir de una
  referencia real que pasó Julieta de otra app del rubro): `/bienvenida`
  ahora también atiende al rol `employer` (antes sólo al `worker`) — 2
  pasos, nombre+logo (logo opcional, misma regla de fricción que la foto
  del trabajador) y ubicación (reusa `MapAddressPicker`, ADR-0006). Antes,
  el comercio caía directo en `/shifts` sin haber cargado nada — los
  candidatos veían "Un comercio cerca tuyo" en vez del nombre real. Ver
  `frontend/app/bienvenida/page.tsx`. **Corregido 2026-08-11** (Julieta,
  prueba en vivo con cuenta invitada): terminaba en `/shifts/new` directo
  ("Publicar mi primer turno"), empujando a publicar sin pensar si hacía
  falta, y "Volver" sólo daba vueltas entre los 2 pasos sin salida real a
  la app. Ahora termina en `/shifts` (el panel, con "+ Publicar"/
  "+ Evento" visibles) y el paso de ubicación suma "Cargar la ubicación
  después" (sólo `name` es obligatorio en el backend).
- Otros ítems 🔴/🟠 abiertos en `TECH_DEBT.md`: `npm run lint` fuera de CI
  (~20 errores/10 warnings baseline), formularios con `<input>` crudo en 4
  pantallas (F1). (Corregido 2026-08-09: las dos líneas que decían "no-show
  automático por cron, hoy sólo manual" y "`on_time_payment_rate`/
  `events_published` del comercio nunca se actualizan" estaban
  desactualizadas — ambas ya están implementadas, ver
  `backend/app/modules/shift/application/scheduler.py` [ADR-0008] y
  `backend/app/modules/company/infrastructure/repositories.py:121-139`
  respectivamente. Hallazgo de la auditoría de producto/UI 2026-08-09.)

## Pendiente de la operadora (Julieta — no es trabajo de código)

### Estado de env vars (verificado con Julieta el 2026-08-07)

**Ya configuradas — NO volver a pedirlas:**
- **Vercel (frontend):** `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`,
  `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`,
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_SENTRY_DSN`.
- **Render (backend):** `CORS_ORIGINS`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`,
  `JWT_SECRET_KEY`, `RESEND_API_KEY`, `SEED_DEMO_DATA`, `SENTRY_DSN`,
  `VAPID_CONTACT_EMAIL`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`.
- Efecto: **Cloudinary** (foto de perfil + subida de DNI/selfie), **Google
  login**, **push (VAPID)**, **Sentry**, **emails (Resend)** quedan operativos.

**Faltan / a confirmar (esto sí destraba cosas):**
1. 🔴 **`ADMIN_EMAILS`** (Render) — **el más importante y el que falta.** Sin
   él **no existe ningún admin**: no se puede revisar la cola de "Identidad
   verificada", ni moderar usuarios, ni entrar a `/admin`. Cargar el email de
   Julieta ahí. Con esto + Cloudinary, la **verificación de identidad F1 queda
   operativa de punta a punta**. (El bootstrap la promueve al arrancar — ver
   `app/modules/admin/bootstrap.py`.)
2. 🟠 **`SEED_DEMO_DATA` = `false`** (Render): la var existe; confirmar que el
   **valor** sea `false` (el dashboard pisa `render.yaml`, donde ya está en
   `false`). Si sigue en `true`, re-siembra datos demo en cada arranque.
3. 🟢 **`MERCADOPAGO_ACCESS_TOKEN`** (Render): sólo para pagos reales; el
   enforcement está apagado, así que **no urge** para la beta.
4. 🟠 **Confirmar** `ENVIRONMENT=production` (Render) y `NEXT_PUBLIC_API_URL`
   (Vercel, apuntando al backend de Render): si la app anda, casi seguro ya
   están; sólo verificar que existan. **Subió de prioridad (2026-08-08,
   TECH_DEBT.md S1):** ahora también controla si la cookie del refresh token
   sale con `Secure`+`SameSite=None` (`settings.is_production`) — sin esta
   var en `"production"`, el navegador descarta la cookie en la request
   cross-site real Vercel→Render, el login sigue andando pero el refresh/
   logout fallan en silencio y todos tendrían que volver a loguearse cada 15
   minutos.
5. ✅ **`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`** (Render, cargadas
   2026-08-10, C.2(b) auditoría de producto): habilitan la subida de CV
   **firmada** (`POST /uploads/sign-cv`) — evita que cualquiera suba
   archivos a la cuenta de Cloudinary sin pasar por el backend. **Ojo:**
   esto por sí solo NO resuelve "el PDF sube pero no abre" (ver el ítem de
   abajo, corregido tras probarlo en vivo) — hace falta además el toggle
   del dashboard.
6. 🟠 **`GEMINI_API_KEY`** (Render, nueva 2026-08-10, P2 auditoría de
   producto): habilita "Describí el turno" en `/shifts/new` — el comercio
   escribe algo como "necesito un mozo el sábado a la noche, se paga
   45000" y se precargan puesto/horario/pago (nunca publica nada solo, el
   comercio revisa y confirma cada paso). Se saca de
   [aistudio.google.com](https://aistudio.google.com) → "Get API key"
   (cuenta de Google, plan free — alcanza de sobra: 250 requests/día con
   `gemini-3.5-flash`, la versión GA estable fijada en `core/gemini.py`
   — `gemini-2.5-flash` dejó de estar disponible para cuentas nuevas, ver
   `docs/STATUS.md` 2026-08-11; **no** se usa el alias `-latest` a
   propósito, Google documenta que puede hot-swapear a un preview/
   experimental sin deploy propio). Sin esta var, `POST /shifts/parse-text`
   responde 503 (flag por ausencia) y el botón "Completar" muestra un
   error claro en vez de fallar en silencio.

> El **PIN de acceso invitado** ("Explorar sin cuenta") **no** es env var: se
> configura en el código (`IdentityService.GUEST_ACCESS_PIN`, hoy `3526`).

**Otros pendientes operativos (no env vars):**
- **Ensayo de restore de Neon**: confirmar que el backup/restore funciona de
  verdad antes de depender de él con usuarios reales.
- Confirmar en el dashboard de Render que el deploy quedó verde contra Neon
  (incluida la migración `0025` de identidad).
- **WhatsApp Business API** (feature de enganche): requiere cuenta/API de
  Julieta — distinto del botón "Compartir por WhatsApp" (`wa.me`, #77).
- Subir fotos reales al seed (R2.5): requiere la cuenta Cloudinary del proyecto.
- El preset de Cloudinary debe ser **unsigned** (Settings → Upload → Upload
  presets → Signing mode: Unsigned); las `NEXT_PUBLIC_*` se **hornean en el
  build** → marcar en *Production* y **redeployar sin caché**.
- ~~**Activar entrega de PDF/ZIP en Cloudinary**~~ (Settings → Security →
  "Allow delivery of PDF and ZIP files"): **resuelto — toggle activado por
  Julieta y confirmado en vivo el 2026-08-10.** Corrección importante sobre
  el diagnóstico anterior (que quedó escrito acá mismo y era incompleto): la
  subida **firmada** de CV (`POST /uploads/sign-cv`, C.2(b) auditoría de
  producto) **no** resuelve este bug por sí sola — el bloqueo de entrega de
  PDF/ZIP de Cloudinary es una restricción de **toda la cuenta**, no
  depende de si la subida fue firmada o no. Se probó en vivo: un CV recién
  subido con firma seguía dando `ERR_INVALID_RESPONSE` hasta activar este
  toggle del dashboard; con el toggle activado, abre sin volver a subirlo.
  La subida firmada sigue teniendo valor (evita que cualquiera suba
  archivos a la cuenta sin pasar por el backend), pero el toggle es lo que
  de verdad destraba la entrega de PDF — no un fallback, es **el** fix.

## Convenciones de git

- Desarrollar en **rama de feature**; commits descriptivos.
- Abrir PR en **draft**; mergear con **squash**.
- **No `git add -A`**: stagear archivos puntuales.
- Cambios de presentación no tocan la lógica de backend salvo necesidad.

## No hacer

- Duplicar componentes/lógica/entidades.
- Acoplar módulos por dentro (importar entrañas de otro dominio).
- Poner credenciales en el código o en el chat (van como env vars en
  Render/Vercel; si se filtran, revocar).
- Usar `localhost` en configuración de producto.
- Introducir infraestructura pesada (colas, brokers, microservicios) sin
  necesidad real y sin ADR.
- Cambiar una decisión arquitectónica sin crear un **ADR nuevo**.

## Convenciones de producto/diseño

- Todo en **español**, incluido el texto de cara al usuario.
- Identidad **editorial cálida** ("cafetería de especialidad", style-guide del
  diseñador, desde 2026-07-29): fondo **crema** `#FFF8F0` / superficies **arena**
  `#F5ECDD`, tinta **carbón** cálida `#1F1F1C` (no negro puro), acento naranja
  `#F97316` y verde éxito **bosque** `#2E8B57` (no el semáforo brillante). Tipografía
  **Inter** (UI) + **Fraunces** (`font-display`, serif de títulos, alternativa
  libre a Recoleta). Iconografía **Lucide**, sensación de app nativa. Un solo
  acento naranja por pantalla, cero gradientes multicolor decorativos. Todos los
  fondos pasan por tokens de `globals.css` (no hay grises hardcodeados). Contrastes
  verificados WCAG AA — **fuente de verdad: `docs/design/COLOR_SYSTEM.md` (v2.0)**. El
  isotipo es la **mano ahuecada sobre la oreja** (placeholder rasterizado del
  mockup, ver `frontend/components/Logo.tsx`, pendiente el SVG vectorial del
  diseñador).

## Para continuar en un chat nuevo

Si arrancás una sesión sin más contexto que este archivo, copiá/adaptá este
prompt de arranque:

> Estás en el repo de **Staffya** (marketplace de staffing gastronómico en
> tiempo real). Leé `CLAUDE.md` y después `docs/STATUS.md` (bitácora viva,
> qué está en vuelo y qué sigue) antes de tocar nada. Si tu tarea toca deuda
> conocida, revisá también `docs/TECH_DEBT.md` y `docs/BUGS.md`. Aislate en
> worktree (`git worktree add ...` desde `origin/main`), trabajá en rama de
> feature, PR en draft, y reportá el resultado real de `pytest -q` / `tsc
> --noEmit` / `npm run build` (y Playwright si tocaste frontend) — no el
> esperado. Actualizá `docs/STATUS.md` en el mismo PR de cualquier cambio
> relevante.

No hay trabajo de producto bloqueado salvo lo listado en "Pendiente de la
operadora" arriba. La auditoría de responsive/desktop pantalla por pantalla
(ver arriba) ya se cerró — no hay un frente puntual abierto ahora mismo; si
no hay otra instrucción, mirá `docs/TECH_DEBT.md` por prioridad antes de
arrancar algo nuevo.
