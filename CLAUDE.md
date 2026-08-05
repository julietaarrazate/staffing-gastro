# CLAUDE.md — Cómo trabajar en Staffya

Guía operativa para cualquier sesión (humana o IA) que modifique este repo. La
**fuente de verdad del producto, el dominio y la arquitectura** vive en `docs/`.
Este archivo dice **cómo** trabajar acá; los `docs/` dicen **qué** es Staffya.

> Última actualización: **2026-08-04**. Si pasó mucho tiempo desde esta fecha,
> desconfiá de los números/estados de abajo y releé
> [docs/STATUS.md](./docs/STATUS.md) (la bitácora viva) antes de asumir nada.
>
> **En curso ahora mismo:** auditoría de responsive/desktop pantalla por
> pantalla (Julieta usa la app en la web, no sólo mobile, y varias pantallas
> quedan "precarias" — mobile-first sin adaptar a pantallas anchas). Ya
> resueltas: `/map` (panel lateral + mapa), `/feed` (grilla en vez del mazo
> de swipe), `/shifts` (grilla 2-3 columnas), `/search` (panel lateral +
> mapa, igual que `/map`), `/my-shifts` (misma grilla que `/shifts`),
> `/chats` (layout de inbox, lista fija + conversación al lado), `/profile`
> (dos columnas tipo dashboard), `/shifts/new` (panel de vista previa fijo
> al lado del wizard, tipo resumen de checkout) y
> `/shifts/[id]/candidates` (grilla 2-3 columnas, mismo criterio que
> `/shifts`), `/workers/[id]` (perfil público del trabajador: dos columnas,
> reseñas fijas al lado, mismo criterio que `/profile`) y `/companies/[id]`
> (perfil público del comercio: mapa + "cómo llegar" a un costado cuando hay
> coordenadas, sin forzar una columna vacía cuando no las hay). Siguen, en
> orden de valor: `/subscription`, `/admin`. Detalle completo y el patrón
> del problema en
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
- **`docs/planning/PULIDO_ROADMAP.md` batches C3 (confianza/conversión: SEO,
  skeletons, a11y) y C4 (onboarding post-registro) sin arrancar** — el orden
  del propio roadmap es C2→C0+C1→C3→C4; C4 necesita que T1 (Julieta) cierre
  el spec del flujo exacto antes de ejecutar.
- Otros ítems 🔴/🟠 abiertos en `TECH_DEBT.md`: no-show automático por cron
  (hoy sólo manual, ADR-0007), `on_time_payment_rate`/`events_published` del
  comercio nunca se actualizan, `npm run lint` fuera de CI (~20 errores/10
  warnings baseline), formularios con `<input>` crudo en 4 pantallas (F1).

## Pendiente de la operadora (Julieta — no es trabajo de código)

1. **Env vars en Render/Vercel** para lo ya construido y no probado
   end-to-end por falta de credenciales en el entorno de desarrollo:
   `GOOGLE_CLIENT_ID`/`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `VAPID_PUBLIC_KEY`/
   `VAPID_PRIVATE_KEY`/`VAPID_CONTACT_EMAIL`, `SENTRY_DSN`/
   `NEXT_PUBLIC_SENTRY_DSN`, `RESEND_API_KEY`, `MERCADOPAGO_ACCESS_TOKEN`.
   Todo el código ya es no-op sin sus variables (mismo patrón "flag por
   ausencia" en todo el repo).
2. **Apagar `SEED_DEMO_DATA`** en `render.yaml`/Render **antes** de
   onboardear comercios reales (hoy sigue en `"true"`, re-siembra datos demo
   idempotentes sobre la base de Neon en cada arranque en frío).
3. **Ensayo de restore de Neon**: confirmar que el backup/restore de Neon
   funciona de verdad (no sólo que existe) antes de depender de él para
   producción con usuarios reales.
4. Confirmar en el dashboard de Render que el deploy quedó verde contra Neon
   (código y `DATABASE_URL` ya están, falta la verificación visual — sin
   acceso a Render desde una sesión de agente).
5. **WhatsApp Business API** (feature de enganche): requiere cuenta/API del
   lado de Julieta — distinto del botón "Compartir por WhatsApp" (`wa.me`),
   ya resuelto en #77.
6. Subir fotos reales al seed (R2.5): requiere credenciales de la cuenta
   Cloudinary del proyecto, no automatizable sin ellas.
7. **Cloudinary en Vercel — bloquea la foto de perfil** (verificado en
   producción 2026-07-28: "no me deja poner foto"). Sin
   `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` + `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`,
   `uploadImage` corta con "La subida de imágenes no está configurada
   todavía". El preset tiene que ser **unsigned** (Cloudinary → Settings →
   Upload → Upload presets → Signing mode: Unsigned). Ojo: son
   `NEXT_PUBLIC_*`, o sea que se **hornean en el build** — hay que marcarlas
   en el environment *Production* y **redeployar sin caché**, si no el bundle
   sigue sin el valor (mismo error que pasó con el Client ID de Google).

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
operadora" arriba. Sí hay un frente **abierto y priorizado** ahora mismo: la
auditoría de responsive/desktop pantalla por pantalla (ver arriba y
`docs/STATUS.md`) — arrancar por ahí si no hay otra instrucción puntual.
