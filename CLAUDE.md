# CLAUDE.md — Cómo trabajar en Staffya

Guía operativa para cualquier sesión (humana o IA) que modifique este repo. La
**fuente de verdad del producto, el dominio y la arquitectura** vive en `docs/`.
Este archivo dice **cómo** trabajar acá; los `docs/` dicen **qué** es Staffya.

## Este repo dentro de EKP (leer antes de cerrar la sesión)

Existe un segundo repo, **[`julietaarrazate/ekp`](https://github.com/julietaarrazate/ekp)**
— *Engineering Knowledge Platform* —, que es el andamio de conocimiento de
todos los proyectos de la operadora. **Este repo es su capa L5**: la instancia
donde el conocimiento se aplica. La relación era de una sola dirección (EKP
sabía de Staffya, Staffya no sabía de EKP), así que quien abría la sesión acá
no tenía forma de enterarse. Este bloque cierra ese lazo.

**Qué implica en la práctica, y sólo esto:**

1. **Durante el trabajo, EKP es de lectura.** No hace falta clonarlo para
   codear. Consultalo cuando la decisión sea grande y no puntual:
   `engines/decision-engine.md` antes de una decisión técnica de fondo,
   `domains/design/` o `domains/ux/` antes de un cambio sistémico de diseño,
   `engines/review-engine.md` para una auditoría. Para un bug o una feature
   normal, `docs/` de acá alcanza y sobra.
2. **La bitácora de este repo es `docs/STATUS.md`.** Ése es el registro que
   EKP espera de acá — no hace falta un `BACKLOG.md` ni un `INTAKE.md`
   propios. Se actualiza **en el mismo PR** del cambio, como ya dice su regla
   de mantenimiento.
3. **Antes de cerrar la sesión, registrar la fricción en EKP.** Si algo salió
   mal por una razón que se va a repetir —una regla que no estaba escrita, una
   trampa de un endpoint, una interpretación equivocada de un pedido—, eso va
   como un *cycle* nuevo al final de `evolution/INTAKE.md` de EKP (append,
   nunca editar lo anterior), más la línea correspondiente en su
   `tasks/BACKLOG.md`. Una observación sin archivar es conocimiento perdido.
   Un bug arreglado y ya no es fricción: lo que se archiva es **por qué fue
   posible**, no que pasó.

**Cómo escribir en EKP desde una sesión abierta acá:** agregar el repo a la
sesión (`add_repo` con `julietaarrazate/ekp`), clonarlo, commitear el registro
y abrir su propio PR. Es un PR aparte del de código: no se mezclan.

**Cuándo conviene abrir la sesión en EKP y no acá:** cuando el trabajo *es*
EKP (tocar sus `engines/`, `domains/` o `blueprint/`), o cuando toca procesar
el INTAKE acumulado y promover lecciones a reglas. Para trabajar en el
producto, la sesión va acá: es el repo cuyo `CLAUDE.md` se carga solo, donde
corren los tests y el CI, y donde vive el git.

## Protocolo de sesión (obligatorio, no es una sugerencia)

Estos cinco pasos no dependen de que Julieta los pida en el prompt. Estaban
escritos más abajo, pero **adentro de un prompt de ejemplo** ("Para continuar
en un chat nuevo"), así que sólo aplicaban si ella se acordaba de pegarlo. El
2026-09-16 se comprobó el costo: una sesión trabajó sobre el directorio
principal sin worktree, y otra abrió un PR que estuvo horas sin ninguna señal
de CI sin que nadie lo notara. Una regla que depende de que el usuario la
repita no es una regla.

1. **Aislarse en worktree, siempre.**
   `git worktree add ../staffya-<tema> -b claude/<tema> origin/main`.
   Nunca trabajar sobre el directorio principal: si la sesión se corta a la
   mitad, el checkout de Julieta queda en una rama ajena y con cambios sin
   commitear. Verificable en un comando: `git worktree list` tiene que mostrar
   más de una entrada antes del primer `git commit`.

2. **Abrir el trabajo leyendo el estado, no el código.**
   `docs/STATUS.md` → "Qué sigue (estado vigente)". Después `TECH_DEBT.md` y
   `BUGS.md` si el tema los toca.

3. **Buscar los bugs, no esperar a que los muestren.**
   Julieta no es la suite de QA. Todo cambio de UI se **mira renderizado**
   antes de darlo por hecho —levantar la app, sacar la captura, abrirla— y en
   **los dos temas** (`data-theme="light"` y `"dark"`), porque la mitad de los
   defectos de superficie sólo existen en uno. Leer el diff no alcanza: los
   tres bugs de contraste de septiembre (el módulo de foco a 1.00:1, las
   tarjetas del color del lienzo, el subtítulo del nivel invisible) pasaron
   `tsc`, `build`, Vitest y Playwright en verde. Y cuando se mide algo de
   diseño, **la medición declara su marco** (qué elemento, a qué viewport):
   un ratio sin marco ya hizo escribir dos documentos mal.

4. **Dejar el estado escrito antes de cerrar.**
   `docs/STATUS.md` en el MISMO PR del cambio — más los `docs/` del área si el
   cambio los contradice. La próxima sesión arranca sin memoria de ésta: lo
   que no quedó escrito, no existe. Si hubo fricción que se va a repetir, va
   como *cycle* al `evolution/INTAKE.md` de EKP (ver arriba).

5. **Cerrar con CI verde, no con "me anduvo localmente".**
   Empujar a `claude/**` dispara `CI` y `Security` solos (desde el
   2026-09-16 escuchan `push`, no sólo el PR — un PR abierto con el token de
   una GitHub App no dispara workflows). Una vez que el PR existe, la corrida
   de `push` se saltea sola para no duplicar a la del PR, que es la que vale
   porque prueba el merge contra `main` y no la rama aislada (ver
   `.github/actions/corrida-duplicada`). Antes de decir que algo está listo,
   mirar la corrida real. Una corrida local no queda registrada en ningún
   lado; el check verde queda pegado al commit para siempre.

## Dónde está el estado del proyecto

> Última actualización: **2026-09-07**.
>
> **Estado al día de hoy: `docs/STATUS.md`, no este bloque.** Y dentro de ese
> archivo, la sección **"Qué sigue (estado vigente)"** es la única lista que se
> edita en el lugar: ahí está, en orden, qué agarrar si arrancás sin otra
> instrucción.
>
> En una línea: el frente vigente fue el rediseño profundo pedido por brief
> (rebrand al ámbar, refinamiento del design system, mapa con el pago en el
> pin, "va en camino") sobre los PRs #315–#324. Lo único abierto que destraba
> algo es **conectar `oido.com.ar`** — ver "Pendiente de la operadora" abajo.
>
> Todo lo que sigue en este bloque es **histórico** (hasta 2026-08-09, PRs
> #166–#170): sirve para entender cómo se llegó acá, no para saber qué está
> pasando. Un estado vigente escrito en el medio de un archivo que sólo crece
> se vuelve mentira sin que nadie lo note; por eso el estado vive en
> `docs/STATUS.md` y acá queda el rastro.
>
> **Frente abierto (histórico, 2026-08-09): QA en vivo de Julieta probando la app real** (comercio,
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
  **sistema vigente (v5.0): [`docs/design-system/`](./docs/design-system/)**
  (`color-system.md`, `typography.md`, `elevation.md`…) ·
  [COLOR_SYSTEM.md](./docs/design/COLOR_SYSTEM.md) (histórico v1–v4 + el
  método de medición de contraste, que sigue vigente) ·
  [TYPOGRAPHY_SYSTEM.md](./docs/design/TYPOGRAPHY_SYSTEM.md) (histórico: su
  recomendación Archivo/Geist nunca se aplicó) ·
  [ICONOGRAPHY_SYSTEM.md](./docs/design/ICONOGRAPHY_SYSTEM.md) ·
  [DESIGN_TOKENS.md](./docs/design/DESIGN_TOKENS.md) (radios, sombras, espaciados) ·
  [BRIEF_IDENTIDAD_VISUAL.md](./docs/design/BRIEF_IDENTIDAD_VISUAL.md) (spec técnica
  para el diseñador externo). No hay doc de performance todavía.
- **ADRs vigentes** (`docs/adr/`): 0001 MapLibre · 0002 sesiones revocables ·
  0003 `quantity`=1 permanente · 0004 cancelación del trabajador + insignias ·
  0005 mensualidad al comercio (pagos, Fase 1) · 0006 alta de local desde el
  mapa · 0007 no-show/cancelación tardía manual · 0008 asistencia
  simplificada y no-show automático · 0009 escalada automática de urgencia ·
  0010 modelo de confianza en cuatro dominios · 0011 segunda y tercera tinta ·
  0012 pago de referencia
  (el "match" del mapa y el aviso de pago fuera de mercado al comercio) ·
  0013 verificación del comercio (constancia de AFIP; por qué NO es
  `cuit_verificado` y por qué no se guarda el número) · 0014 "Disponible
  ahora" (el trabajador prende su posición real por 4h para que el comercio
  mida la distancia desde ahí y no desde su domicilio; el pin en el mapa
  siempre va desplazado — `fuzz_point`, TECH_DEBT.md S4) ·
  0015 turno "no cubierto" (estado nuevo para un turno asignado que nadie
  confirma, o publicado que nadie toma, cuyo horario ya pasó — sin impacto
  de reputación, ventana de gracia según `urgent`).
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
  propósito. Ver el patrón completo en [docs/BUGS.md](./docs/BUGS.md).
- **Legales**: `/terminos` y `/privacidad`, checkbox de consentimiento
  obligatorio en `/register`.
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
  (`#17130f`), no sólo las tarjetas. (Hasta el 2026-09-24 esta línea decía
  "el lienzo crema nunca" — era del sistema anterior.)

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

Lo mismo que corre CI (`.github/workflows/ci.yml`), y en verde:

- Backend: `pytest -q`.
- Frontend: `npx tsc --noEmit`, `npm run lint`, `npm run test:unit` (Vitest)
  y `npm run build`.
- E2E: `npm run test:e2e` (Playwright, API mockeada, sin backend real,
  `frontend/e2e/`).
- Si vas a citar cuántos tests hay, contalos en el momento
  (`pytest -q --collect-only`, `npx playwright test --list`): el número
  cambia con cada feature.
- Reportá el resultado **real**, no el esperado. Si algo falla, se dice.

## Deuda conocida viva (no reabrir sin necesidad)

Catálogo completo y priorizado en [docs/TECH_DEBT.md](./docs/TECH_DEBT.md);
patrones de bugs ya resueltos (para no reintroducirlos) en
[docs/BUGS.md](./docs/BUGS.md). Lo más relevante para no sorprenderse:

- **Passkeys (WebAuthn) diseñado, no construido** — ver arriba y
  `docs/reference/ACCESO_MODERNO.md` Feature 3 para el diseño completo antes de
  arrancar (entidad, endpoints, migración, tests con Virtual Authenticator).
- **Pagos reales (TECH_DEBT P4)**: la mensualidad al comercio sigue siendo un
  placeholder sin cobro real, con el enforcement apagado para la beta.

## Pendiente de la operadora (Julieta — no es trabajo de código)

### Estado de env vars (verificado con Julieta el 2026-09-08)

> **Lo único abierto hoy es el dominio propio.** Todo lo de más abajo está
> resuelto salvo donde diga lo contrario; los ítems tachados se dejan para que
> nadie los vuelva a pedir.

#### 🔴 Conectar `oido.com.ar` (lo único que destraba algo hoy)

Julieta compró el dominio y quiere migrar de la URL de Vercel a la propia. Son
cuatro pasos, tres de ellos con su login:

1. **Vercel → Settings → Domains**: agregar `oido.com.ar` y `www.oido.com.ar`,
   y cargar los registros DNS en el registrador. *(Necesita su login.)*
2. **Google Cloud Console → Credenciales → orígenes autorizados de JavaScript**:
   sumar `https://oido.com.ar` y `https://www.oido.com.ar`, o **el login con
   Google deja de funcionar en el dominio nuevo**. *(Necesita su login.)*
3. **`CORS_ORIGINS` (Render)**: ✅ **ya hecho** — los dos dominios se
   pre-agregaron en el PR #316, antes de que existiera el DNS, justamente para
   que este paso no sea un bloqueante después.
4. **`FRONTEND_URL=https://oido.com.ar` (Render)**: **sólo después de que el
   DNS resuelva.** Si se setea antes, los links de los mails transaccionales
   (confirmación, recuperación de contraseña) apuntan a un dominio muerto y el
   registro se rompe en silencio. Éste es de código/config, no de Julieta —
   pero depende del paso 1.

Los **íconos** están todos en ámbar (2026-09-23): los PNG y el `favicon.ico`
se regeneran desde los SVG con `node scripts/build-icons.mjs` (en
`frontend/`), y la vista previa al compartir un link ya no es un PNG
commiteado sino `app/opengraph-image.tsx`, generada desde el código. **Las
URLs absolutas salen de `frontend/lib/site.ts`** (`oido.com.ar`): antes
estaban escritas a mano como `staffya.com.ar`, un dominio que no existe, y
toda vista previa y el sitemap apuntaban ahí.

**Ya configuradas — NO volver a pedirlas:**
- **Vercel (frontend):** `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`,
  `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`,
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_SENTRY_DSN`.
- **Render (backend):** `CORS_ORIGINS`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`,
  `JWT_SECRET_KEY`, `RESEND_API_KEY`, `SEED_DEMO_DATA`, `SENTRY_DSN`,
  `VAPID_CONTACT_EMAIL`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`.
- Efecto: **Cloudinary** (foto de perfil + subida de DNI/selfie), **Google
  login**, **push (VAPID)**, **Sentry**, **emails (Resend)** quedan operativos.

**Faltan / a confirmar:**
1. ✅ ~~**`ADMIN_EMAILS`** (Render)~~ — **resuelto** (confirmado por Julieta,
   2026-09-07: su mail ya está cargado y entra a `/admin`). Este ítem estuvo
   marcado en rojo como "el más importante y el que falta" durante semanas
   después de estar resuelto; si lo leés en rojo en algún lado, es una copia
   vieja. La verificación de identidad F1 quedó operativa de punta a punta.
2. 🟠 **`SEED_DEMO_DATA` = `true` a propósito, por ahora** (Render, decisión
   de Julieta 2026-09-22): sin usuarios reales, la app se ve poblada con los
   comercios/trabajadores demo, y cada arranque repone sus turnos vigentes.
   Queda fijado también en `render.yaml`, para que el archivo y el panel no
   se contradigan. (El 2026-09-23 se culpó a `render.yaml` de pisar el panel;
   la causa real de que no se sembrara nada era un bug de event loop en
   `scripts/startup_seed.py` — ver `docs/BUGS.md`.)
   **Antes de abrir la beta con gente real** va a `false` y se purgan las
   cuentas demo (runbook en `docs/reference/DEPLOY.md`): tienen contraseña
   pública y sus turnos entran en la referencia de pago.
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
- **Dominio propio `oido.com.ar`** (comprado en NIC.ar, 2026-09-02, aún sin
  conectar): 3 pasos, ninguno de código.
  1. En Vercel → proyecto `staffing-gastro` → Settings → Domains → agregar
     `oido.com.ar` y `www.oido.com.ar`. Vercel da los registros DNS exactos
     (normalmente A `oido.com.ar` → `76.76.21.21`, CNAME `www` →
     `cname.vercel-dns.com`); cargarlos en el panel de DNS de NIC.ar. SSL lo
     emite Vercel solo una vez que el DNS propaga.
  2. En Render (backend) agregar el dominio nuevo a `CORS_ORIGINS` (sin sacar
     el `.vercel.app` todavía) y setear `FRONTEND_URL=https://oido.com.ar`
     (arma los links de los mails transaccionales, hoy cae al default de
     `core/config.py`).
  3. En Google Cloud Console, agregar `https://oido.com.ar` y
     `https://www.oido.com.ar` a "Authorized JavaScript origins" del Client
     ID de Google Sign-In — si no, el botón de Google deja de andar en el
     dominio nuevo.
  El **dominio de envío propio en Resend ya está**: verificado contra su API
  el 2026-09-09 — `oido.com.ar` en estado `verified` (región `sa-east-1`) y
  los mails salen de `Oído <hola@oido.com.ar>`, no del sandbox `resend.dev`.
  Si leés en algún lado que falta confirmarlo, es una copia vieja.
  Opcional y sin bloquear nada: dominio propio para el backend
  (`api.oido.com.ar` en vez de `staffya-backend.onrender.com`).
- ✅ ~~**Expediente de registro de obra ante la DNDA**~~ — **presentado por
  Julieta el 2026-09-23** (arancel, tasa y constancia de CUIL ya cargados en
  el trámite). Versión depositada: commit `e1c44b6`, marcada con la etiqueta
  `dnda-oido-2026-v1` (release de GitHub creado por ella). El ZIP entregado
  tiene el código fuente, el frontend compilado y 9 PDFs (los 8 documentos +
  capturas de pantalla). Lo que queda es esperar la respuesta de la DNDA. La
  rama `registro-obra-software-dnda` (PR #310) **sigue en draft y no se
  mergea**: es el registro del expediente y lleva el DNI de Julieta. Si la
  DNDA pide algo, partir de `REGISTRO_OBRA_SOFTWARE/DNDA_VERSION_REGISTRADA.md`
  en esa rama; la obra se describe siempre como de **autoría exclusiva de
  Julieta**, y el expediente no nombra otras apps.
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

### Cómo se cierra un PR (acordado con Julieta el 2026-09-16)

La secuencia es **verde → captura → sí de Julieta → merge**, y no hay que
volver a preguntársela en cada PR: ya está decidida.

1. **CI y Security en verde**, mirando la corrida real en GitHub (no una
   corrida local). Si algo sale rojo, se para y se dice — nunca se mergea en
   rojo ni se toca el pipeline para que dé verde.
2. **Captura de lo que cambia visualmente**, en claro y en oscuro, antes de
   pedir nada. Si el PR no toca UI, este paso no aplica y se pasa al 3.
3. **Julieta dice que sí.** Ése es el único permiso que hace falta; con eso se
   mergea con squash y se le avisa qué quedó en producción.

El paso 2 existe porque el verde y lo que se ve son cosas distintas: los tres
bugs de contraste de septiembre pasaron `tsc`, `build`, Vitest y Playwright sin
una sola falla. Un check verde dice que nada se rompió, no que la pantalla se
vea bien.

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
- Identidad **Design System v5.0** (#345, 2026-09-22): lienzo **off-white
  cálido** `#FBFAF6` / relleno recesado `#F3EFE6`, tarjetas blancas, tinta
  `#111111`, acento **ámbar** `#D97706` (texto sobre claro `#B45309`) y **verde
  bosque** `#1B3A31` como superficie destacada (pago, "Recomendado", "Turnos
  activos"). Tipografía **Fraunces** (títulos de pantalla y de contenido) +
  **Inter** (texto y encabezados de sección) + **DM Mono** (eyebrows y datos).
  Iconografía **Lucide**, sensación de app nativa. Un solo acento ámbar por
  pantalla. Todos los fondos pasan por tokens de `globals.css` (no hay grises
  hardcodeados). **Fuente de verdad: `docs/design-system/color-system.md` y
  `typography.md`**; `docs/design/COLOR_SYSTEM.md` es el registro histórico
  (hasta el 2026-09-24 este párrafo describía el crema `#FFF8F0` de v3.0). El
  isotipo es la **mano ahuecada sobre la oreja**, SVG vectorial final del
  diseñador (ver `frontend/components/Logo.tsx`).
- **Adentro de una tarjeta negra la proporción se invierte.** La regla del "un
  solo acento" se mide sobre el lienzo, que es el 95% de la app; en un
  módulo `bg-night` el contenido va con color (ícono en chip ámbar, moneda
  ámbar, dato en blanco, dato secundario en crema `#F1E7A0`) porque una tarjeta
  negra llena de blancos y grises se apaga. Receta y contrastes medidos:
  `docs/design/COLOR_SYSTEM.md` §3.2.

## Para continuar en un chat nuevo

Si arrancás una sesión sin más contexto que este archivo, copiá/adaptá este
prompt de arranque:

> Estás en el repo de **Staffya** (marketplace de staffing gastronómico en
> tiempo real). Leé `CLAUDE.md` —empezando por **"Protocolo de sesión"**, que
> es obligatorio— y después `docs/STATUS.md` (bitácora viva, qué está en vuelo
> y qué sigue) antes de tocar nada. Si tu tarea toca deuda conocida, revisá
> también `docs/TECH_DEBT.md` y `docs/BUGS.md`. Reportá el resultado real de
> `pytest -q` / `tsc --noEmit` / `npm run build` (y Playwright si tocaste
> frontend) — no el esperado.

No hay trabajo de producto bloqueado salvo lo listado en "Pendiente de la
operadora" arriba. La auditoría de responsive/desktop pantalla por pantalla
(ver arriba) ya se cerró — no hay un frente puntual abierto ahora mismo; si
no hay otra instrucción, mirá `docs/TECH_DEBT.md` por prioridad antes de
arrancar algo nuevo.
