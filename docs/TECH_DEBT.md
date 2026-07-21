# TECH_DEBT.md — Deuda técnica de Staffya (v2, post-quick-wins)

> Catálogo de deuda **vigente**, verificado contra el código real en esta
> auditoría (no contra la doc anterior). Deriva de
> [AUDIT_REPORT.md](./AUDIT_REPORT.md). Prioridad: 🔴 Crítica · 🟠 Alta ·
> 🟡 Media · 🟢 Baja.

## Qué se cerró desde la v1 (verificado en código, no sólo en doc)

| Ítem v1 | Verificación |
|---|---|
| `jwt_secret_key` con default inseguro | `backend/app/core/config.py:15,77` — `_reject_insecure_defaults` rechaza el default si `environment == "production"`. `render.yaml` usa `generateValue: true`. |
| Sin rate limiting en login/registro | `backend/app/modules/identity/api/routes.py:36-47` — `RateLimiter` real (10/min login, 5/min registro), `app/core/rate_limit.py`. |
| Sin security headers | `backend/app/core/middleware.py:15-34` + `backend/app/main.py:50` — `SecurityHeadersMiddleware` (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS en prod). |
| Dos sistemas de EmptyState/PageState | `find frontend -iname "PageState*"` → sin resultados. Sólo `components/ui/EmptyState`, `ErrorBanner`, `CardSkeletons`. |
| `SKILL_STYLES` (gradientes por rubro) | `grep -rn "SKILL_STYLES" frontend` → sin resultados. Sólo `SKILL_ACCENT` (`lib/skill-style.tsx`), usado en 6 archivos. |
| Botones inline en login/register/perfiles | Confirmado: `Button` del DS en `register/page.tsx:97`, `login`, formularios de perfil. (Persisten inputs de texto crudos — ver **F1** abajo, es un ítem nuevo, no el mismo.) |
| Helper `_auth_headers` duplicado en ~18 tests | `backend/tests/conftest.py:72-100` — fixtures `register_user`/`login`/`auth_headers`; `grep -rl "_auth_headers" backend/tests` fuera de `conftest.py` → sin resultados. |
| Seed con `logo_url` muerto | No reintroducido; no se re-auditó a fondo (bajo impacto, no se re-verificó). |

Estos ítems **salen del catálogo**. Lo que sigue es deuda real y vigente a
fecha de esta auditoría (2026-07-02).

---

## Producto / negocio incompleto

### P1 — `quantity` del turno no soporta asignación múltiple ✅ Resuelto (decisión permanente)

> **Actualización 2026-07-02 ([ADR-0003](./adr/ADR-0003-quantity-single-assignment.md)):**
> cerrado como **decisión de producto permanente**, no como mitigación
> temporal. Un turno = una persona; un comercio con varios puestos publica
> varios turnos (el feed/matching/postulación ya lo soportan sin cambios).
> `quantity` capado a 1 en `ShiftInput` (`le=1`) y en el wizard desde R1.4; la
> multi-asignación real (tabla N—N) **no se va a construir** salvo demanda de
> negocio explícita con su propio ADR nuevo.

- **Descripción (histórica, previa a R1.4):** el wizard de creación de turno
  permitía pedir de 1 a 100
  personas (`frontend/app/shifts/new/page.tsx:151-171`,
  `backend/app/modules/shift/api/schemas.py:17`,
  `Field(default=1, ge=1, le=100)`), y el campo `quantity` se persiste
  (`backend/app/modules/shift/infrastructure/models.py:36`). Pero
  `Shift.assign()` sólo admite **un** `worker_profile_id`
  (`backend/app/modules/shift/domain/entities.py:92-99`) y al asignar el
  turno pasa a `ASIGNADO`, saliendo de `OPEN_STATUSES` y por lo tanto del feed
  (`backend/app/modules/application/application/services.py:16`). No existe
  ningún concepto de "posiciones cubiertas / posiciones totales".
- **Impacto:** un comercio que publica "necesito 5 mozos" ve su turno
  marcado como cubierto (fuera del feed, no aparece más como buscando
  personal) apenas se asigna al **primer** postulante. Las otras 4 posiciones
  nunca se cubren y no hay ninguna señal en la UI de que falten. Rompe
  directamente la promesa de "cubrir una posición eventual" para el caso más
  común de eventos (múltiples puestos).
- **Riesgo:** alto — es un bug de producto silencioso, no un error visible;
  el comercio puede descubrirlo el día del evento, cuando ya es tarde (va
  contra la misión de "<10 minutos").
- **Prioridad:** 🔴 Crítica.
- **Esfuerzo:** medio-alto — requiere modelar N asignaciones por turno
  (tabla `shift_assignments` o reutilizar `ShiftApplication` con estado
  `aceptada` múltiple), redefinir cuándo un turno sale del feed
  (`posiciones_cubiertas == quantity`), y ajustar `candidates/page.tsx` para
  mostrar cupos restantes.
- **Dependencias:** toca `shift.domain.entities.Shift`, `shift.application.
  services.ShiftService.assign_worker`, el feed de `application` module, y
  attendance (check-in/out y reviews hoy asumen "el" trabajador asignado,
  singular — `review/application/services.py:109-116`).
- **Solución sugerida:** ADR + rediseño de la relación turno↔trabajadores como
  1-a-N; en el corto plazo, si no se aborda ya, **al menos** limitar
  `quantity` a 1 en el wizard y comunicarlo, para no prometer algo que el
  sistema no cumple.

### P2 — Insignias y niveles sin lógica de otorgamiento ✅ Resuelto

> **Actualización 2026-07-02 ([ADR-0004](./adr/ADR-0004-cancelacion-trabajador-e-insignias.md)):**
> resuelto. `compute_badges`/`compute_level` (`worker/domain/rules.py`, funciones
> puras sin DB) definen reglas por umbral sobre `events_completed`,
> `rating` y `cancellations` (ya reales desde R2.4 + este ADR).
> Se recalculan sin histéresis en `WorkerProfileRepository
> .record_completed_shift` (al finalizar un turno) y en el nuevo
> `record_cancellation` (al cancelar una asignación confirmada, ver P3
> abajo). `perfil_verificado` queda **sin otorgamiento automático**
> (decisión explícita: `is_verified` vive en `User`/`identity`, no en
> `WorkerProfile`; cruzarlo violaría capas — ver ADR-0004). Tests:
> `backend/tests/test_worker_rules.py` (unitarios, casos límite de cada
> regla) y `backend/tests/test_attendance.py`
> (`test_badges_and_level_recompute_after_finish_and_worker_cancel`,
> integración).

- **Descripción (histórica):** `WorkerBadge` (`worker/domain/value_objects.py:21`) y
  `GamificationLevel` (`worker/domain/value_objects.py:31`) son catálogos
  completos, se serializan en la API
  (`worker/api/schemas.py:56-57`) y se muestran en el perfil, pero **ningún**
  caso de uso los escribe: `worker/domain/entities.py:43-44` los fija en
  `[]`/`BRONCE` sólo al crear el perfil. Verificado con `grep` en todo
  `backend/app/modules` — cero escrituras posteriores.
- **Impacto:** producto — el trabajador ve un nivel "Bronce" fijo para
  siempre y ninguna insignia, sin importar cuántos turnos complete. Resta
  incentivo de reputación, que `DOMAIN.md` describe como "moneda" central del
  marketplace.
- **Riesgo:** medio — no rompe nada técnicamente, pero es una promesa de
  producto sin cumplir (gamificación visible pero inerte).
- **Prioridad:** 🟠 Alta.
- **Esfuerzo:** medio — definir reglas (ej. `nunca_falto` tras N turnos sin
  cancelación, subir de nivel por `events_completed`) y ejecutarlas como
  efecto de `ReviewService`/`ShiftService` al cerrar un turno.
- **Dependencias:** depende de que **P3** (métricas derivadas) esté resuelto
  primero, porque las reglas de otorgamiento se basan en esos contadores.
- **Solución sugerida:** documentar las reglas en `REPUTATION.md` (ya tiene
  la nota de la inconsistencia) y implementarlas como parte del mismo cambio
  que resuelva P3. Mientras tanto, considerar ocultar la sección de
  insignias/nivel en la UI si no aporta información real (ver
  `QUICK_WINS.md` #9 de la v1, todavía no ejecutado).

### P3 — Métricas de reputación derivadas nunca se actualizan 🟠 Alta (parcial — `cancellations` ✅ resuelto en ADR-0004)

> **Actualización 2026-07-02 (R2.4):** resuelto para el trabajador
> `punctuality_rate` y `events_completed` — `ShiftService.finish()`
> (`backend/app/modules/shift/application/services.py`) ahora llama a
> `WorkerProfileRepository.record_completed_shift(profile_id, punctual=...)`
> (nuevo puerto + adaptador en `worker/infrastructure/repositories.py`) al
> cerrar con éxito un turno (siempre pasó por check-in/check-out). Puntual =
> check-in dentro de ±15 min de `start_at` (promedio móvil simple). Tests en
> `backend/tests/test_attendance.py`
> (`test_finish_with_punctual_checkin_updates_worker_metrics`,
> `test_finish_with_late_checkin_does_not_count_as_punctual`).
>
> **Actualización 2026-07-02 ([ADR-0004](./adr/ADR-0004-cancelacion-trabajador-e-insignias.md)):**
> resuelto `cancellations` (worker). Decisión de producto: nueva transición
> `Shift.worker_cancel()` (sólo desde `confirmado`, reabre el turno a
> `buscando_personal` — distinta de `Shift.cancel()` del comercio, que sigue
> siendo terminal), endpoint `POST /shifts/{id}/worker-cancel`,
> `WorkerProfileRepository.record_cancellation` incrementa
> `cancellations`. Tests en `backend/tests/test_shift.py`
> (`test_worker_cancel_confirmed_shift_reopens_search`,
> `test_worker_cannot_cancel_before_confirming`,
> `test_other_worker_cannot_cancel_someone_elses_confirmed_shift`).
> **Sigue pendiente:** `on_time_payment_rate`/`events_published` (company) —
> ver detalle y motivo en `REPUTATION.md` ("Inconsistencias a resolver").
>
> **Actualización 2026-07-21 ([ADR-0007](./adr/ADR-0007-no-show-y-cancelacion-tardia.md),
> batch `PRIMER_TURNO_REAL_SPEC.md`):** resuelta la versión **manual** del
> no-show — el comercio marca "no se presentó" desde el turno en marcha
> (`POST /shifts/{id}/no-show`, sólo desde `CONFIRMADO`/`EN_CAMINO`), lo que
> reabre el turno, incrementa `WorkerProfile.no_shows` (nuevo, separado de
> `cancellations`) y notifica al trabajador. Tests en
> `backend/tests/test_no_show_and_late_cancellation.py`. De paso se cerró
> también la cancelación tardía del comercio (con el trabajador ya
> confirmado): antes no avisaba nada al trabajador y no tenía efecto de
> reputación sobre el comercio — ahora sí (`late_cancellations`,
> notificación `shift_cancelled_late`).
>
> **Sigue pendiente (no resuelto por ADR-0007):** detección **automática**
> de no-show (el trabajador no cancela ni hace check-in y el turno queda
> colgado en `confirmado`/`en_camino` pasado el horario, sin que el comercio
> lo marque a mano). Requeriría un job en background/cron para barrer turnos
> vencidos sin check-in — infraestructura nueva (el repo hoy no tiene ningún
> scheduler) sin necesidad demostrada todavía. Si se prioriza, entra como
> ítem propio de este catálogo con su propio ADR.

- **Descripción:** `punctuality_rate`, `events_completed`, `cancellations`
  (worker) y `on_time_payment_rate`, `events_published` (company) se leen en
  el scoring de matching (`matching/domain/scoring.py:39-51`) y se muestran
  en perfiles, pero **sólo `rating`** se recalcula al recibir una reseña
  (`review/application/services.py:118-126`,
  `_update_aggregate_rating`). El resto queda en su valor de creación
  (0.0/0) para siempre — confirmado por `grep` de `update_` sobre esos
  campos en todo el backend: sin resultados fuera de `rating`.
- **Impacto:** el motor de matching (`MATCHING.md`) pondera puntualidad y
  desempeño con datos que nunca cambian — en la práctica esos dos factores
  son ruido constante (siempre 0), no señal real. Afecta la calidad del
  ranking de candidatos, que es un diferencial de producto declarado en
  `PRODUCT.md`. Con R2.4, `punctuality_rate`/`events_completed` del
  trabajador ya son señal real; `cancellations` y las métricas de comercio
  siguen siendo ruido constante.
- **Riesgo:** medio-alto — degrada silenciosamente la calidad del matching
  sin que nadie lo note (no hay alerta, sólo scoring subóptimo).
- **Prioridad:** 🟠 Alta.
- **Esfuerzo:** medio — enganchar actualizaciones a las transiciones ya
  existentes del ciclo de turno: `check_in` a tiempo → `punctuality_rate`
  ✅ hecho (R2.4); `finish` → `events_completed` ✅ hecho (R2.4);
  `mark_paid` → `events_published` (company, pendiente); `cancel`/no-show
  sobre un turno asignado → `cancellations` (pendiente — **requiere primero**
  que el dominio distinga quién cancela o agregar un estado `no_show`; no se
  puede derivar honestamente de `Shift.cancel()` tal como existe hoy, que es
  siempre disparado por el comercio).
- **Dependencias:** ninguna externa para lo ya resuelto; lo pendiente de
  `cancellations` depende de una decisión de producto/ADR sobre el modelo de
  cancelación (actor + posible `no_show`).

> **Actualización 2026-07-21 (ADR-0007):** el no-show manual ya está resuelto
> (ver arriba) con un contador **separado** (`no_shows`), no mezclado en
> `cancellations` como este párrafo original sugería como única vía. Sigue
> pendiente, sin cambios: `mark_paid` → `events_published` (company) y
> `on_time_payment_rate` (company) sin cálculo automático.
- **Solución sugerida:** agregar estos efectos dentro de
  `ShiftService`/`ReviewService` (mismo patrón que ya usan para crear
  `Notification`), documentado en `REPUTATION.md`.

### P4 — Pagos: placeholder sin cobro real 🟠 Alta

- **Descripción:** `mark_paid` sólo transiciona `FINALIZADO → PAGADO`
  (`shift/domain/entities.py:148-151`); no hay integración con ninguna
  pasarela. No existe módulo `payment` (confirmado: `find backend/app/
  modules -iname "*payment*"` → sin resultados). Documentado y esperado —
  `PRODUCT.md` lo marca explícitamente "fuera de alcance hoy".
- **Impacto:** alto valor de negocio si se resuelve (es la vía de
  monetización), pero hoy el comercio paga "por fuera" y sólo declara que
  pagó — sin garantías ni trazabilidad real de dinero.
- **Riesgo:** bajo en el corto plazo (es una decisión de producto conocida,
  no un bug), alto si el negocio necesita facturar pronto.
- **Prioridad:** 🟠 Alta (no crítica porque es roadmap explícito, no deuda
  oculta).
- **Esfuerzo:** alto — integración con MercadoPago, estados de pago,
  conciliación, posibles retenciones/comisiones.
- **Dependencias:** decisión de negocio sobre modelo de comisión; ADR.
- **Solución sugerida:** ya tiene documento propio, `PAYMENTS.md`; ejecutar
  cuando el negocio lo priorice (Fase 12 del master plan, según
  `RECOMMENDATIONS.md`).

---

### P5 — `ApplicationStatus.RECHAZADA` nunca se setea en los no elegidos (doc↔código) 🟡 Media — ACEPTADA ya resuelta

- **Descripción (estado actualizado, fix de deuda #88):** `ShiftService.
  assign_worker` (`shift/application/services.py`) ahora sí marca ACEPTADA
  la `ShiftApplication` PENDIENTE del trabajador elegido (`_accept_application`,
  vía `ShiftApplicationRepository.get_by_shift_and_worker` + `ShiftApplication.
  accept()` en el dominio) — antes quedaba PENDIENTE para siempre aunque el
  comercio ya lo hubiera asignado. Cubierto por
  `tests/test_application.py::test_assigning_applicant_accepts_their_application`
  (y el caso de asignación directa sin postulación previa, que no falla, en
  `test_assigning_worker_without_prior_application_does_not_fail`).
  **Sigue sin resolver** (alcance explícitamente fuera de este fix, de
  mínima invasión): los demás postulantes PENDIENTE del mismo turno no se
  marcan RECHAZADA cuando el comercio elige a otro — no hay rechazo masivo
  automático.
- **Impacto:** el trabajador elegido ya ve "¡Te eligieron!" en `/my-shifts`
  (tab Postulaciones, `APPLICATION_LABELS`). Los postulantes NO elegidos de
  un turno ya asignado siguen viendo "Postulado · esperando respuesta"
  indefinidamente (nunca pasan a "No quedaste esta vez").
- **Riesgo:** bajo — desprolijidad de UX/consistencia de datos para los no
  elegidos, no un bug de seguridad ni de integridad (el turno en sí
  transiciona bien y el ganador ya queda consistente).
- **Prioridad:** 🟡 Media.
- **Esfuerzo:** bajo — mismo patrón ya cableado (`ShiftApplicationRepository`
  en `ShiftService`): en `assign_worker`, listar `list_by_shift(shift_id)` y
  rechazar (nuevo método `reject()` en el dominio, mismo estilo que
  `accept()`/`withdraw()`) las PENDIENTE de otros `worker_profile_id`.
- **Solución sugerida:** resolver en un próximo PR acotado (decisión de
  producto simple: ¿se avisa/notifica al rechazado o es silencioso?).

---

## Frontend — presentación (deuda nueva, no capturada en la v1)

### F1 — Formularios con `<input>` crudo en vez de `TextField` del DS 🟡 Media

- **Descripción:** `components/ui/TextField.tsx` existe, pero sólo se usa en
  `frontend/app/shifts/new/page.tsx` (1 pantalla). `register/page.tsx`,
  `login/page.tsx`, `search/page.tsx` y `chats/[shiftId]/page.tsx` usan
  `<input>` con clases ad-hoc (`register/page.tsx:11-12`,
  `inputClass` hardcodeado). Verificado: `grep -rln "<input" frontend/app`
  → 5 archivos; `grep -rln "TextField" frontend/app` → 1 archivo.
- **Impacto:** inconsistencia visual sutil (focus ring, padding, radios
  pueden divergir con el tiempo) y mayor costo de mantenimiento — un cambio
  de estilo de input hoy requiere tocar 5 lugares.
- **Riesgo:** bajo.
- **Prioridad:** 🟡 Media.
- **Esfuerzo:** bajo — migrar los 4 usos restantes a `TextField`.
- **Dependencias:** ninguna.
- **Solución sugerida:** PR chico de reemplazo directo, mismo patrón que ya
  se usó para EmptyState/Button en la v1.

### F2 — Landing sin migrar al DS v2 monocromático 🟡 Media

- **Descripción:** `frontend/app/page.tsx` usa gradientes naranja→rojo en
  el hero, los CTAs y las tarjetas de features (líneas 99-100, 114, 120,
  133, 187, 217, 231), mientras que `components/ui/Button.tsx` (el
  componente canónico) ya es monocromático (`bg-primary` plano,
  `Button.tsx:11-12`) y los CTAs de la landing son `<Link>` con clases
  propias, no el componente `Button`.
- **Impacto:** la landing es la primera pantalla que ve cualquier
  visitante no autenticado — es donde más pesa la identidad de marca que
  define `CLAUDE.md` ("monocromática + acento único #FF6B00, nada de
  gradientes arcoíris"), y es justamente la que no la aplica.
- **Riesgo:** bajo (no funcional), pero alto en consistencia de marca.
- **Prioridad:** 🟡 Media.
- **Esfuerzo:** medio — rediseñar la landing con `Button`/tokens del DS.
- **Dependencias:** ninguna.
- **Solución sugerida:** encaja en una futura fase de DS (ver
  `RECOMMENDATIONS.md`, "terminar la propagación").

### F3 — Admin sin migrar al Design System 🟡 Media

- **Descripción:** `frontend/app/admin/page.tsx:19-23` usa colores Tailwind
  crudos (`bg-green-100 text-green-700`, `bg-red-100 text-red-700`,
  `bg-zinc-200 text-zinc-600`) en vez de los tokens `secondary`/`danger` del
  DS, y una `StatCard` local (línea 25-32) en vez de `components/ui/Card`.
- **Impacto:** inconsistencia visual en la única pantalla de uso interno;
  bajo impacto en usuarios finales (worker/employer) pero afecta a quien
  opera la plataforma.
- **Riesgo:** bajo.
- **Prioridad:** 🟡 Media.
- **Esfuerzo:** bajo-medio.
- **Dependencias:** ninguna.
- **Solución sugerida:** mismo patrón de migración que Worker/Employer ya
  recibieron.

### F4 — Accesibilidad no sistematizada 🟡 Media

- **Descripción:** `aria-*` presente en sólo 13 de 56 archivos `.tsx`;
  `focus-visible`/`focus:ring` explícito en sólo 7 de 56. El foco de teclado
  funciona por herencia en los componentes del DS (`Button.tsx:65`), pero no
  hay checklist ni lint que lo garantice en pantallas con controles ad-hoc
  (toggles de `feed/page.tsx`, botones del wizard).
- **Impacto:** riesgo de regresiones de accesibilidad en pantallas nuevas
  que no reutilicen el DS.
- **Riesgo:** medio (cumplimiento + experiencia para usuarios con lector de
  pantalla o navegación por teclado).
- **Prioridad:** 🟡 Media.
- **Esfuerzo:** medio — auditoría puntual + regla de lint
  (`eslint-plugin-jsx-a11y`, no confirmado si está instalado).
- **Solución sugerida:** agregar `jsx-a11y` al lint si no está, y una pasada
  de `aria-label` en controles icon-only restantes.

### F5 — `<img>` sin `next/image` (persiste desde v1) 🟢 Baja

- **Descripción:** 7 usos de `<img>`, 0 de `next/image` — sin cambios desde
  la v1 (`companies/[id]/page.tsx:46`, `chats/page.tsx:60`,
  `search/page.tsx:129`, `workers/[id]/page.tsx:40`, `ui/Avatar.tsx:41`,
  `worker/OpportunityCard.tsx:32`, `ImageUpload.tsx:49`).
- **Impacto:** sin optimización automática de imágenes (tamaño/formato) de
  Next.js; ya mitigado parcialmente con `loading="lazy"`.
- **Riesgo:** bajo.
- **Prioridad:** 🟢 Baja.
- **Esfuerzo:** bajo-medio (requiere configurar dominios remotos —
  Cloudinary, loremflickr — en `next.config`).
- **Solución sugerida:** evaluar cuando se trabaje performance/Lighthouse.

---

## Seguridad e identidad (nuevo, no capturado en v1)

### S1 — Tokens en `localStorage` sin revocación de refresh 🔴 Crítica

> **Actualización 2026-07-02 (R1.2, ADR-0002):** el backend ya implementa
> tabla `refresh_sessions` con rotación (cada `/auth/refresh` invalida el
> token usado y emite uno nuevo), detección de reuso (revoca todas las
> sesiones del usuario) y `POST /auth/logout` server-side. Queda **pendiente**
> lo de almacenamiento: el refresh token sigue viajando y guardándose igual
> que antes (`localStorage`, sin cookie `httpOnly`) — el frontend tampoco
> llama todavía a `/auth/logout` en el botón de cerrar sesión. Ver ADR-0002
> para el detalle de diseño.

- **Descripción (histórica, previa a R1.2):** access y refresh token se guardan en `localStorage`
  (`frontend/lib/auth-context.tsx:29-30,44,60`) — vulnerable a robo por XSS
  (cualquier script inyectado puede leerlos, a diferencia de cookies
  `httpOnly`). Del lado del backend, `IdentityService.refresh()`
  (`backend/app/modules/identity/application/services.py:64-79`) valida el
  refresh token y **emite un par nuevo sin invalidar el anterior** — no hay
  rotación, blacklist ni tabla de sesiones; un refresh token robado sigue
  siendo válido durante sus 30 días completos aunque el usuario haga
  "logout" en el cliente (el logout sólo borra el `localStorage` local,
  `auth-context.tsx:34-35`, no revoca nada en el servidor). No existe
  endpoint de logout en el backend (`grep -n "def logout"` sobre
  `identity/api/routes.py` y `identity/application/services.py` → sin
  resultados).
- **Impacto:** si un token se filtra (XSS, dispositivo compartido, log
  accidental), el atacante tiene acceso completo por hasta 30 días sin forma
  de revocarlo remotamente.
- **Riesgo:** alto — es el vector de seguridad más serio detectado en esta
  auditoría, con la agravante de que no hay forma de mitigar un incidente ya
  ocurrido (no hay "cerrar sesión en todos los dispositivos").
- **Prioridad:** 🔴 Crítica.
- **Esfuerzo:** medio-alto — requiere: (a) tabla de refresh tokens
  (whitelist con rotación: cada `refresh()` invalida el token usado y emite
  uno nuevo) o al menos una blacklist con TTL; (b) endpoint `POST
  /auth/logout` que revoque; (c) idealmente migrar el almacenamiento del
  refresh token a cookie `httpOnly` + `Secure` + `SameSite`, dejando el
  access token corto en memoria/`localStorage` (menor ventana de exposición).
- **Dependencias:** cambio de contrato entre frontend/backend (cookies
  cross-origin requieren ajustar CORS `allow_credentials` — ya está en
  `true`, `main.py:44`, buena base).
- **Solución sugerida:** ADR de sesión (rotación de refresh + revocación);
  ejecutar antes de escalar el número de usuarios reales.

### S2 — Límites de conexión/mensajes por WebSocket ausentes 🟡 Media

- **Descripción:** sin cambios desde la v1 — no se encontró rate limiting ni
  cuota por usuario/turno sobre los WS de chat/notificaciones.
- **Impacto:** un cliente malicioso o con bug podría abrir conexiones o
  enviar mensajes sin límite.
- **Riesgo:** medio.
- **Prioridad:** 🟡 Media.
- **Esfuerzo:** bajo-medio — reusar `app/core/rate_limit.py` (ya existe para
  HTTP) adaptado a mensajes WS.
- **Solución sugerida:** cuota simple (N mensajes/minuto por conexión).

---

## Infraestructura / datos

### I1 — Postgres de Render expira a los 90 días (persiste desde v1) 🔴 Crítica

- **Descripción:** sigue sin migrar — `render.yaml` sigue declarando la DB
  como `plan: free` de Render; el plan de migración a Neon está documentado
  y listo (`backend/README.md:169-189`) pero no ejecutado.
- **Impacto:** pérdida total de datos de producción si se cumple el plazo
  sin migrar.
- **Riesgo:** crítico y con fecha — es el único ítem de este catálogo con
  un reloj corriendo de causa externa.
- **Prioridad:** 🔴 Crítica.
- **Esfuerzo:** bajo (la guía ya existe, son ~4 pasos documentados).
- **Solución sugerida:** ejecutar la migración ya, según los pasos de
  `backend/README.md`.

### I2 — `SEED_DEMO_DATA=true` activo en producción con imágenes externas 🟠 Alta

> **Nota 2026-07-02 (R2.5, intentado y no ejecutado):** se evaluó reemplazar
> `loremflickr`/`pravatar` en `backend/scripts/seed_demo_data.py` por un set
> fijo de imágenes ya subidas a Cloudinary (hardcodeadas, subidas una sola
> vez), reusando el helper existente (`frontend/lib/cloudinary.ts`,
> `uploadImage`, que sube vía `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` +
> `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` sin signing). **No se ejecutó**:
> este entorno no tiene esas credenciales configuradas (no hay
> `.env`/`.env.local` de frontend ni backend con valores de Cloudinary, sólo
> `.env.example`/`.env.production` sin esas claves) ni acceso de red para
> confirmarlas contra la cuenta real del proyecto, así que no hay forma de
> subir archivos reales a Cloudinary desde acá sin improvisar credenciales.
> **Queda pendiente como tarea manual**: alguien con acceso a la cuenta de
> Cloudinary del proyecto debe (1) subir un set fijo de fotos placeholder
> (perfiles de trabajador/comercio usados por el seed), (2) pegar las URLs
> `secure_url` resultantes como constantes en
> `backend/scripts/seed_demo_data.py` en reemplazo de las URLs de
> `loremflickr.com`/`pravatar.cc`, y (3) correr `pytest -q` de nuevo para
> confirmar que el seed sigue siendo válido.

- **Descripción:** `render.yaml` fija `SEED_DEMO_DATA: "true"` para el
  servicio de producción; el seed usa `loremflickr.com` como fuente de fotos
  de perfil demo (`backend/scripts/seed_demo_data.py:61`,
  `f"https://loremflickr.com/600/400/{keyword}?lock={lock+10}"`). Cada
  arranque en frío re-siembra datos demo (idempotente, según el comentario
  del propio `render.yaml`) directamente sobre la base de datos productiva,
  mezclados con usuarios reales, dependiendo de un servicio de imágenes
  externo gratuito sin SLA.
- **Impacto:** (a) si `loremflickr.com` cae o cambia su API, el seed puede
  fallar o mostrar imágenes rotas en cuentas demo visibles a usuarios reales;
  (b) no hay bandera para "desactivar seed una vez que hay usuarios reales" —
  hoy es todo o nada vía una env var manual.
- **Riesgo:** medio-alto — mezcla de datos ficticios y reales sin
  aislamiento, dependencia externa no controlada en el camino crítico de
  arranque de producción.
- **Prioridad:** 🟠 Alta.
- **Esfuerzo:** bajo — apagar `SEED_DEMO_DATA` en producción una vez que
  haya suficientes usuarios reales, o mover las imágenes demo a Cloudinary
  (que ya es la infraestructura de imágenes del producto,
  `frontend/lib/cloudinary.ts`) en vez de un servicio placeholder externo.
- **Solución sugerida:** decisión de producto: ¿se sigue necesitando "probar
  sin registrarse" en el `render.yaml` de producción, o ya cumplió su
  propósito de demo inicial?

### I3 — Haversine duplicado cliente/servidor 🟡 Media

- **Descripción:** `backend/app/core/geo.py` (usado por matching) y
  `frontend/app/map/page.tsx` (`haversineKm`) implementan el mismo cálculo
  de forma independiente, en dos lenguajes. Ya diagnosticado en
  [MAPS_REDESIGN.md](./MAPS_REDESIGN.md) §1 ("`haversineKm` duplicado en el
  cliente, deuda menor, se resuelve de paso") y con solución prevista ahí
  mismo (`lib/map/geo.ts` como único helper cliente, §4.3).
  **No se resuelve independientemente**: es parte del alcance de la
  migración de mapas.
- **Impacto:** bajo (fórmula estable, poco propensa a bugs), pero es
  duplicación de lógica de dominio geográfico sin necesidad.
- **Riesgo:** bajo.
- **Prioridad:** 🟡 Media.
- **Esfuerzo:** bajo, pero **depende de F1-F3 de MAPS_REDESIGN.md** (no
  conviene resolverlo aislado si la migración a MapLibre está aprobada,
  para no duplicar trabajo).
- **Dependencias:** `MAPS_REDESIGN.md` (mismo documento ya lo captura).
- **Solución sugerida:** dejarlo enganchado a la ejecución de
  `MAPS_REDESIGN.md`; no requiere entrada nueva de trabajo si esa migración
  avanza.

### I4 — PostGIS/Redis "previstos" pero no usados (persiste desde v1) 🟢 Baja

- **Descripción:** sin cambios — Haversine en Python sigue siendo suficiente
  al volumen actual.
- **Riesgo:** bajo.
- **Prioridad:** 🟢 Baja.
- **Solución sugerida:** mantener simple; requiere ADR si se introduce.

### I5 — Sin bus de eventos/outbox (persiste desde v1) 🟢 Baja

- **Descripción:** sin cambios — los efectos (notificaciones) siguen
  ocurriendo dentro del caso de uso, sin async/outbox.
- **Riesgo:** bajo al volumen actual.
- **Prioridad:** 🟢 Baja.
- **Solución sugerida:** ADR si se necesita consistencia eventual real.

---

## Calidad / observabilidad

### T1 — Sin CI 🔴 Crítica

- **Descripción:** `find . -path "*/.github/workflows/*"` → sin resultados.
  No hay pipeline que corra `pytest -q` / `tsc --noEmit` / `npm run build`
  antes de mergear a `main`, que **auto-despliega** a Render y Vercel. Hoy la
  única red de seguridad es que la persona que commitea corra los gates a
  mano (como se hizo en esta auditoría: 82 tests, tsc limpio, build exitoso —
  pero eso fue manual, no automático).
- **Impacto:** un PR con tests rotos o un `tsc` fallido puede llegar a
  producción si nadie corre los gates localmente antes del merge.
- **Riesgo:** alto — es la ausencia de control más barata de resolver con
  más impacto de este catálogo.
- **Prioridad:** 🔴 Crítica.
- **Esfuerzo:** bajo — GitHub Actions con dos jobs (`backend: pytest -q`,
  `frontend: tsc --noEmit && npm run build`), sin infraestructura nueva.
- **Dependencias:** ninguna.
- **Solución sugerida:** workflow mínimo en `.github/workflows/ci.yml`
  activado en PR contra `main`; bloquear merge si falla.

### T2 — Sin tests de frontend ni E2E (persiste desde v1) 🟠 Alta

- **Descripción:** confirmado — `frontend/package.json` no tiene script de
  test; `find frontend -iname "*.test.ts*" -o -iname "*.spec.ts*"` → sin
  resultados. Sólo hay `tsc --noEmit` + `npm run build` como red de
  seguridad (tipos + que compile, no comportamiento).
- **Impacto:** cambios en lógica de UI (wizard, swipe, WS) pueden romperse
  sin que ningún test lo detecte; sólo `tsc`/`build` como red.
- **Riesgo:** medio-alto, creciente con el tamaño de la app.
- **Prioridad:** 🟠 Alta.
- **Esfuerzo:** medio — Vitest/RTL para lógica de componentes críticos
  (`SwipeDeck`, `useWebSocket`, `auth-context`); Playwright para 1-2 flujos
  E2E (postulación completa, creación de turno).
- **Solución sugerida:** Fase 8 del master plan (ya identificada en
  `RECOMMENDATIONS.md`); no requiere replanificación, sólo ejecución.

### T3 — Sin observabilidad (logging estructurado, tracing, alertas) 🟠 Alta

- **Descripción:** confirmado por ausencia — no hay `structlog`, `sentry`,
  ni configuración de logging estructurado en
  `backend/app/core/*.py`/`requirements.txt`. `docs/OBSERVABILITY.md` existe
  como documento de intención (40 líneas) pero no hay implementación.
- **Impacto:** si algo falla en producción (p. ej. el seed de I2, un error
  de WS, un 500 en un endpoint), no hay forma de enterarse salvo que un
  usuario lo reporte — sin logs estructurados ni alertas.
- **Riesgo:** alto operativamente (tiempo de detección de incidentes = 0 →
  depende de reportes manuales).
- **Prioridad:** 🟠 Alta.
- **Esfuerzo:** medio — `structlog` o logging estándar con contexto
  (request id, user id) + un servicio de error tracking (Sentry free tier es
  suficiente a este volumen).
- **Solución sugerida:** ejecutar junto con T1 (CI) como base de "producción
  real" antes de escalar usuarios.

### T4 — Warning de test cosmético 🟢 Baja

- **Descripción:** `backend/tests/test_chat.py:150` —
  `test_chat_websocket_pushes_new_messages` está marcada
  `@pytest.mark.asyncio` pero no es una función `async def`; genera un
  `PytestWarning` en cada corrida (visto en la ejecución real de esta
  auditoría, 82 passed con este warning entre los no bloqueantes).
- **Impacto:** ninguno funcional; ruido en la salida de test.
- **Riesgo:** ninguno.
- **Prioridad:** 🟢 Baja.
- **Esfuerzo:** trivial — quitar el marcador o hacer la función `async`.
- **Solución sugerida:** limpiar en el próximo PR que toque ese archivo.

### T5 — `npm run lint` falla en ~15 archivos, pero `ci.yml` no lo corre 🟡 Media

- **Descripción:** el frontend usa `eslint-config-next` con una regla
  (`react-hooks/set-state-in-effect`, del plugin del React Compiler) que
  marca como error el patrón extendido en toda la app "`useEffect(() => {
  load(); }, [load])`" con un `load` (`useCallback`) que hace `setX(...)`
  antes del primer `await`. Está en ~15 archivos (`app/feed`, `app/
  my-shifts`, `app/shifts`, `app/admin`, `app/chats*`, `app/companies/
  [id]`, `app/search`, `app/workers/[id]`, `components/
  CompanyProfileForm.tsx`, `WorkerProfileForm.tsx`, `ReviewBox.tsx`,
  `ReceivedReviews.tsx`, `NotificationBell.tsx`, más 3 errores no
  relacionados en `lib/useWebSocket.ts`, `react-hooks/refs`). Verificado
  real: `npm run lint` en esta rama, **antes de cualquier cambio de esta
  sesión**, ya daba 31 problemas (21 errores). `.github/workflows/ci.yml`
  (job `frontend`) sólo corre `tsc --noEmit` + `next build` — nunca `npm
  run lint` — así que esto nunca bloqueó un merge, pese a que `CLAUDE.md`/
  los checklists de sesión mencionan "eslint" como gate.
- **Impacto:** ninguno en producción (el patrón es el idiomático de fetch-
  on-mount de toda la app, no bugs reales); pero es señal falsa/ruido si
  algún día se agrega lint a CI sin antes decidir qué hacer con la regla.
- **Riesgo:** bajo hoy; medio si se agrega el gate sin auditar antes (CI se
  pondría rojo de golpe en ~15 archivos preexistentes).
- **Prioridad:** 🟡 Media.
- **Esfuerzo:** medio — o se relaja/desactiva esa regla específica en
  `eslint.config.*` (es la lectura más barata, dado que el patrón es
  intencional y establecido), o se reescribe el patrón fetch-on-mount en
  los ~15 archivos.
- **Nota de esta sesión:** el fix de login persistente (`lib/
  auth-context.tsx`) e `SplashScreen.tsx` usan a propósito una función
  `async` anidada e invocada dentro del propio `useEffect` (en vez de un
  `useCallback` externo) — ese patrón puntual no dispara la regla, y de
  paso esta sesión dejó `npm run lint` en 29 problemas (19 errores) en vez
  de los 31 (21 errores) de base, sin tocar los ~15 archivos preexistentes.
- **Solución sugerida:** decisión de producto/plataforma (no de esta
  sesión): revisar la regla en un PR dedicado antes de considerar agregar
  `npm run lint` a `ci.yml`.

---

## Deuda "no repo" (entorno)

- El servidor de dev de Next puede dejar procesos huérfanos ocupando el
  puerto 3000 en el entorno de trabajo local (no afecta producción). Sin
  cambios desde la v1.

---

## Resumen por prioridad

| Prioridad | Ítems |
|---|---|
| 🔴 Crítica | P1 (quantity, mitigado R1.4), S1 (tokens/revocación, mitigado R1.2/ADR-0002 — falta cookie httpOnly), I1 (DB 90 días), T1 (sin CI) |
| 🟠 Alta | P2 (badges, resuelto ADR-0004), P3 (métricas reputación, `cancellations` resuelto ADR-0004 — pendiente `on_time_payment_rate`/`events_published`), P4 (pagos placeholder), I2 (seed en prod), T2 (sin tests frontend), T3 (sin observabilidad) |
| 🟡 Media | F1 (TextField subutilizado), F2 (landing sin DS), F3 (admin sin DS), F4 (accesibilidad), S2 (cuotas WS), I3 (Haversine duplicado), P5 (RECHAZADA de los no elegidos nunca se setea — ACEPTADA ya resuelta), T5 (lint fuera de CI) |
| 🟢 Baja | F5 (`<img>`), I4 (PostGIS/Redis), I5 (sin bus de eventos), T4 (warning cosmético) |
