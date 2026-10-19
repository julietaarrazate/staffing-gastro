# Qué existe HOY en Staffya

Movido desde `CLAUDE.md` (2026-10-09) para que éste no se cargue en cada sesión. Leer solo si la tarea toca estas áreas.

## Contexto en 30 segundos

**Staffya** es un marketplace de **staffing gastronómico en tiempo real**:
conecta comercios con trabajadores eventuales para cubrir turnos. **Misión: cubrir una posición eventual en menos de 10 minutos.**
Roles: `worker`, `employer`, `admin`. Producto en **español (AR/LATAM)**, marca
"Oído" (mano ahuecada sobre la oreja, en trazo crema sobre tile ámbar `#D97706`,
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


## Qué existe HOY (funcionalidades vigentes, no históricas)

- Alta/login con email+contraseña, **recuperación de contraseña** por email
  transaccional (Resend, flag por ausencia de `RESEND_API_KEY`).
- **Acceso con Google** (ID token de Google Identity Services, sin client
  secret) y **notificaciones push** (Web Push/VAPID) — ambos no-op sin sus env
  vars (`GOOGLE_CLIENT_ID`/`NEXT_PUBLIC_GOOGLE_CLIENT_ID`,
  `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_CONTACT_EMAIL`). Detalle y
  derivación completa en [docs/reference/ACCESO_MODERNO.md](./ACCESO_MODERNO.md).
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
- **Turno "no cubierto"** (ADR-0015): un turno ASIGNADO cuyo trabajador nunca
  confirma ni rechaza, o uno PUBLICADO/BUSCANDO_PERSONAL que nadie tomó,
  cuyo `start_at` ya pasó, se resuelve solo — **sin** impacto de reputación
  (nunca llegó a comprometerse). La ventana de gracia depende de `urgent`
  (30 min si el turno era urgente, 2 h si no). El feed (`list_open`) además
  deja de ofrecer algo cuyo horario ya pasó, esté o no resuelto todavía.
- **Idempotencia** en mutaciones críticas vía header `Idempotency-Key`
  (`backend/app/core/idempotency.py`).
- **Helper de zona horaria Argentina** (`backend/app/core/tz.py`,
  `hoy_art()`/`now_art()`): usar para toda fecha de NEGOCIO (edad, "turnos de
  hoy", cortes de período); los timestamps de auditoría siguen en UTC a
  propósito. Ver el patrón completo en [docs/BUGS.md](../BUGS.md).
- **Legales**: `/terminos` y `/privacidad`, checkbox de consentimiento
  obligatorio en `/register` y en el alta con Google, exigido también por el
  backend, que guarda la constancia (versión, medio y fecha) en
  `terms_acceptances`. Si cambia el texto de cualquiera de las dos páginas, se
  sube `LEGAL_TERMS_VERSION` (backend) y `frontend/lib/legal.ts` en el mismo PR.
- Reputación real derivada del ciclo del turno (puntualidad, `events_completed`,
  insignias/niveles con otorgamiento automático), visible en perfil/búsqueda/
  postulantes — entra de verdad al ranking de matching (verificado
  end-to-end en el launch-gate, #88).
- **Asistente de IA para el trabajador** (`/assistant`, pantalla propia, no un
  sheet): busca turnos en lenguaje natural y responde por su estado de
  verificación. Igual que "Describí el turno" del comercio, depende de
  `GEMINI_API_KEY` y degrada con un mensaje claro si no está.
- **"Va en camino"** (#320 backend + #321 frontend): el trabajador avisa que
  está viajando a un turno confirmado y el comercio lo ve llegar en un mapa.
  **Lo prende y lo apaga él**, nunca arranca solo. Modelo de privacidad
  deliberado, no un detalle de implementación: se guarda **sólo la última
  posición, nunca el recorrido**, la ventana es de 2h antes del turno, se
  borra al marcar la llegada y en las cuatro transiciones que desasignan, y
  los guards viven en el DOMINIO (`Shift.report_en_route_location`), no en la
  UI. Está reflejado en `/privacidad` — si tocás esto, esa página se actualiza
  en el mismo PR.
- **"Disponible ahora"** (ADR-0014): el trabajador prende su posición real
  —una sola captura, no un seguimiento— para que el comercio (mapa y
  matching de un turno) mida la distancia desde ahí y no desde su domicilio.
  Dura 4h (`AVAILABLE_NOW_TTL`) o hasta apagarlo. El pin que ve el comercio
  **nunca** es la coordenada exacta, esté o no "Disponible ahora" prendido:
  `app/core/geo.py::fuzz_point` la desplaza siempre dentro de un anillo de
  150–350m (TECH_DEBT.md S4) — un desplazamiento determinístico (mismo
  trabajador, mismo punto en cada render), no aleatorio en cada carga.
- **Mapa con el pago en el pin** (#319) y **pago de referencia** (#332,
  ADR-0012): el marcador lleva el monto, el rubro es un punto de color, y el
  turno que **paga por encima de lo típico** para su puesto y ciudad se
  distingue — ése es el estado "match", ya cerrado. El mismo cálculo tiene una
  segunda cara: en el panel del comercio, un turno que paga por debajo de lo
  habitual se lo dice mientras todavía puede corregirlo (la causa más común de
  que un turno no se cubra). La referencia es la mediana del pago **por hora**
  (los turnos duran distinto) de los turnos publicados en los últimos 60 días;
  sin muestra suficiente no se muestra nada — nunca se inventa un número. Si
  tocás esto, leé el ADR antes: explica por qué NO se usa el motor de matching
  (el 70% de sus factores no varía entre turnos, así que ordenaría por
  distancia disfrazada de compatibilidad).
- **Verificación del comercio** (#334, ADR-0013): el comercio sube su
  **constancia de inscripción de AFIP** desde su perfil, un admin la revisa en
  la misma cola que los DNI de los trabajadores, y al aprobarla se enciende el
  sello "Comercio verificado" en el feed. Cierra la asimetría que había: el
  trabajador entregaba DNI y selfie, el comercio no entregaba nada — y el que
  viaja a la dirección de un desconocido y después tiene que cobrar es el
  trabajador. Tres cosas que **no** hay que cambiar sin leer el ADR: el claim
  es `negocio_verificado` y **no** `cuit_verificado` (ese nombre queda para la
  validación automática contra AFIP; acá mira una persona), **no se guarda el
  número de CUIT** (la constancia se purga al decidir, como el DNI), y un
  comercio verificado **no** sube el nivel de garantía personal de su dueño.
- **Panel de admin** con métricas del dashboard, estadísticas de suscripción/
  MRR y **cuentas de prueba** (trabajador/comercio) creables desde ahí. Las
  cuentas sintéticas se excluyen de las métricas a propósito.
- **Design system con tema explícito** (#317/#318): `lib/theme.tsx` es la
  única fuente de verdad y siempre escribe `data-theme="dark"|"light"`. **La
  app no se oscurece sola**: "Sistema" resuelve a claro, por decisión de
  identidad. El oscuro es una elección explícita del usuario, y desde v5.0
  (#345) es un **modo oscuro real**: el lienzo también se oscurece
  (`#17130f`), no sólo las tarjetas.


## Deuda conocida viva (no reabrir sin necesidad)

Catálogo completo y priorizado en [docs/TECH_DEBT.md](../TECH_DEBT.md);
patrones de bugs ya resueltos (para no reintroducirlos) en
[docs/BUGS.md](../BUGS.md). Lo más relevante para no sorprenderse:

- **Passkeys (WebAuthn) diseñado, no construido** — ver arriba y
  `docs/reference/ACCESO_MODERNO.md` Feature 3 para el diseño completo antes de
  arrancar (entidad, endpoints, migración, tests con Virtual Authenticator).
- **Pagos reales (TECH_DEBT P4)**: la mensualidad al comercio sigue siendo un
  placeholder sin cobro real, con el enforcement apagado para la beta.

