# STATUS.md — Bitácora de avance del proyecto

> **Leer esto primero al arrancar una sesión.** Resume dónde estamos, qué está
> en vuelo y qué sigue, para no tener que releer todo el historial.
> **Regla de mantenimiento:** actualizar esta bitácora en el mismo PR cada vez
> que se mergea un cambio relevante (o inmediatamente después).

*Última actualización: 2026-07-22 · rama de trabajo:
`claude/stepper-ciclo` (stepper del ciclo de vida + pantalla "esto es lo que
sigue" al publicar, worktree aislado) · todos los PRs se mergean con squash
apenas quedan verdes (pedido de Julieta) · **loop autónomo activo** (con
auto-merge, confirmado explícitamente por Julieta) para retomar el backlog no
bloqueado sin esperar "seguí" en cada paso.*

## Estado en una línea

**Todo el backlog R0–R3 implementable sin credenciales/decisiones de Julieta
está cerrado** (R0.3, R1.1–R1.6, R2.1–R2.4, R3.1, R3.2 ✅), más **ADR-0005
Fase 1** (mensualidad al comercio, backend+frontend), **ADR-0006** (alta de
local desde el mapa), **ADR-0007** (no-show/cancelación tardía) y el
**launch-gate** (#88: reseñas→ranking verificado end-to-end, primera
experiencia del comercio nuevo). Sobre esa base ya se sumó **acceso moderno**
(Google + push, #87) y un batch grande de **pulido post-rebrand**
(`docs/PULIDO_ROADMAP.md`: rebrand #79, legales #81, bugs de la operadora
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
| Diseño de mapas | #48 | `docs/MAPS_REDESIGN.md` (10 entregables) + mockup HTML. **Diseño aprobado por Julieta** |
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
| Re-baseline de lanzamiento (Fable) | #64 | `docs/LAUNCH_PLAN.md`: re-evaluación de production-readiness (~65→**~78/100** tras mergear R0–R3) + plan secuenciado de beta cerrada en Palermo (B0 pre-lanzamiento → B1 reclutamiento → B2 operación asistida → B3 decisión). Veredicto: **lista para beta con usuarios reales**, sólo faltan 2 pasos operativos de Julieta |
| Reputación visible en el frontend | #65 | `lib/reputation.tsx` como única fuente de labels (insignias, niveles, puntualidad, rating); insignias/nivel en perfil worker, búsqueda del employer y postulantes. Cierra el lado visible de ADR-0004 |
| UX: landing + selección de texto | #66 | La landing es sólo para visitantes sin sesión (logueados van a la home de su rol: `/feed`, `/shifts`, `/admin`); copy ofensivo ("delivery de personas") reemplazado; `user-select:none` en botones/tabs/labels (inputs siguen seleccionables). Fix del E2E `auth.spec.ts` por el redirect nuevo |
| Auditoría de performance frontend | #67 | `docs/PERFORMANCE_AUDIT_FRONTEND.md` con hallazgos archivo:línea (Sentry estático 138 KB gzip 🔴, motion 🟠, marcadores de mapa 🟡, reduced-motion 🟠) + quick wins seguros |
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
| Esquema T1 de pulido post-rebrand (doc) | #80 | Crea `docs/PULIDO_ROADMAP.md`: spec T1 cerrado (Julieta define, Sonnet ejecuta sin re-decidir dirección) con la Ley de marca (un acento naranja, sin gradientes multicolor, radios/tipografía) y los batches C0 (bugs operadora) → C1 (coherencia interna) → C2 (legales) → C3 (confianza/conversión) → C4 (onboarding) |
| Legales + consentimiento de registro | #81 | `/terminos` y `/privacidad` (estáticas, estética de la landing), footer con autoría, checkbox obligatorio de aceptación en `/register` (botón deshabilitado sin marcar). Cierra el **batch C2** de `PULIDO_ROADMAP.md`. Solo UI, backend sin cambios |
| Batch C0 al roadmap (doc) | #82 | Suma a `docs/PULIDO_ROADMAP.md` el detalle de los bugs reportados por la operadora (modo oscuro forzado, selección de texto, mapa que no responde) a resolver en el siguiente PR |
| C0+C1 — bugs de la operadora + coherencia interna | #83 | **C0** (bugs reales reportados, batch documentado en #82): fix de `reuseMaps` en `MapView` (el mapa quedaba con gestos deshabilitados al navegar sin refresh, causa raíz de "el mapa no responde"), `color-scheme: light` forzado (Chrome Android invertía a oscuro), `.no-select` en `Card.tsx`, ítem "Verificación" muerto ocultado. **C1** (coherencia con la Ley de marca de `PULIDO_ROADMAP.md`): gradientes off-brand (naranja→rojo/ámbar) reemplazados por el tile de marca en 8 componentes; `?rol=` desde la landing + `/register`/`/login` migrados a tokens del DS; `min-h` en `OpportunityCard`, fechas vía `formatShiftDate`, `EmptyState` en chats vacíos |
| Panel: estados diferenciados + fin de selección + fix pull-to-refresh | #84 | `ShiftCard` consolida su paleta a los 4 colores de la Ley de marca (antes azul/ámbar fuera de marca) y atenúa+reordena los estados terminales al final; `.no-select` en `ShiftCard`/`CandidateCard`/postulantes/popup del mapa (el fix de C0 no los cubría, no usan `Card` compartido); fix de pull-to-refresh nativo de Chrome Android en `/search` (`overscroll-behavior-y: contain` en `html`, no sólo `body` — el root scroller real) |
| Landing inmersiva | #85 | 5 capas de scroll sobre la landing existente: hero con stack de turnos que rota según el progreso, stats que cuentan al entrar al viewport (valores honestos, sin tracción inventada), marquee de puestos/barrios, riel vertical de "Cómo funciona", micro-parallax por tarjeta del bento; reduced-motion con fallback estático completo. `tsc`/`build`/lint verdes (30 problemas preexistentes, 0 nuevos); Playwright 15/15 |
| Panel por familias de estado | #86 | `/shifts` reorganizado por familias (Todos/Buscando/En marcha/Terminados/Cancelados) con conteo por pestaña siempre igual a las tarjetas mostradas (bug reportado: contador desconectado de la lista); elimina el único azul fuera de marca (KPI "Buscando"); cierra el `.no-select` que había quedado a medio aplicar en la landing de #85. Playwright 17/17, lint sin regresiones |
| Acceso moderno: Google + push | #87 | `POST /auth/google` (ID token verificado server-side vía `tokeninfo`, sin client secret; alta nueva pasa por "¿buscás trabajo o personal?"); botón "Continuar con Google" en `/login`/`/register`, no-op sin `GOOGLE_CLIENT_ID`. Notificaciones push (Web Push/VAPID): tabla `push_subscriptions` (migración `0013`), hook best-effort en el mismo punto donde se crean todas las notificaciones in-app, service worker mínimo (`public/sw.js`), opt-in tras la primera acción significativa. Fricción documentada: `pywebpush`/`http-ece` no instalable en el sandbox de esta sesión (sólo sdist) — Render debe verificar el build antes del primer deploy |
| **Launch-gate** — cierre de 3 lazos construidos-pero-nunca-validados (`PRIMER_TURNO_REAL_SPEC`) | #88 | **Parte A (verificado, no roto):** test de integración de punta a punta (`tests/test_full_shift_lifecycle.py`) recorre publicar→postular→asignar→check-in→check-out→finalizar→ambos califican→reputación actualizada→**la reputación real SÍ entra al ranking de matching** de un turno nuevo (dos trabajadores con historial idéntico salvo la reseña — 5★ vs. 1★ — quedan ordenados por esa diferencia). Nada estaba roto en ese lazo: ya andaba. **Parte B (frontend):** panel del comercio nuevo (0 turnos) con CTA "Publicá tu primer turno" + 3 pasos (`app/shifts/page.tsx`), y cartel una-sola-vez tras el primer turno publicado ("Ya estás buscando personal..."), persistido en `localStorage` (mismo criterio que el opt-in de push). **Parte C (backend + frontend, `ADR-0007`):** no-show manual del comercio (`POST /shifts/{id}/no-show`, sólo desde CONFIRMADO/EN_CAMINO — reabre el turno, `WorkerProfile.no_shows` nuevo y separado de `cancellations`, pesa el doble en el score de desempeño del matching, rompe `nunca_falto`) + cancelación tardía del comercio (`ShiftService.cancel_shift` detecta `COMMITTED_STATUSES`; **hallazgo:** antes no avisaba nada al trabajador — ahora `shift_cancelled_late` in-app+push y `CompanyProfile.late_cancellations` nuevo, simétrico). Migración `0014`. `pytest -q`: 205 passed (antes 194, +11: 2 unit + 9 integración). `tsc`/`build`/lint sin errores nuevos (lint baseline pre-existente sin cambios: 20 errores/10 warnings, verificado contra `origin/main`); e2e (17 specs) verdes. |
| Deuda chica post launch-gate: postulación aceptada + STATUS al día | `claude/estado-postulacion` *(PR draft pendiente)* | **Fix 1:** `ShiftService.assign_worker` dejaba la `ShiftApplication` PENDIENTE del trabajador elegido sin transicionar — quedaba "pendiente" para siempre aunque el comercio ya lo hubiera asignado (`docs/TECH_DEBT.md` P5). Ahora, de mínima invasión: `ShiftApplication.accept()` nuevo (dominio, mismo patrón que `withdraw()`) + `ShiftService._accept_application` busca la postulación por turno+trabajador (`ShiftApplicationRepository.get_by_shift_and_worker`, puerto ya inyectado desde la regla de doble turno) y la acepta si está PENDIENTE; si la asignación fue directa (búsqueda/mapa, sin postulación previa) no hace nada y no falla. **No** se tocan las postulaciones de los demás candidatos (RECHAZADA de los no elegidos sigue abierto, ver TECH_DEBT P5 actualizado). **Fix 2:** esta misma bitácora, puesta al día (faltaban #74–#87). `pytest -q`: 207 passed (antes 205, +2); `tsc`/`build`/lint sin errores nuevos (lint: mismo baseline 20/10); e2e 17/17 |
| Stepper del ciclo de vida + pantalla "esto es lo que sigue" al publicar (inspiración Clickie) | `claude/stepper-ciclo` *(PR draft pendiente)* | **Fix 1:** `ShiftLifecycleStepper` nuevo (numeritos en círculo + línea, paso actual sólido, completados con check tenue, futuros en gris — un solo acento naranja) integrado en `ShiftCard` con dos mapeos de los 12 `ShiftStatus` reales a 4 hitos: comercio (`/shifts`, default) Publicado→Asignado→En curso→Finalizado; trabajador (`/my-shifts`, prop `perspective="worker"`) Postulado→Aceptado→En curso→Finalizado. **Corrección documentada:** el spec original agrupaba `confirmado` con `finalizado/pagado`; se corrigió a agruparlo con `asignado` porque el orden real del dominio (`asignado→confirmado→en_camino→…→finalizado`) haría que el stepper retrocediera de "Finalizado" a "En curso". Cancelado: no agrega un 5º paso — corta la línea (punteada) y reemplaza el hito donde murió por un marcador rojo "Cancelado", inferido de las marcas que sobreviven (`worker_profile_id`/`check_in_at`/`check_out_at`, el dominio no guarda el estado previo a cancelar). **Fix 2:** `ShiftPublishedNextSteps` (pantalla "¡Turno publicado!" con timeline vertical de 4 pasos del comercio) reemplaza el cartel de una sola vez del launch-gate (#88); decisión documentada: se muestra **cada vez** que se publica un turno (no sólo la primera vez), tanto desde el wizard (`/shifts/new`) como desde "Publicar" de un borrador en el panel (`/shifts`) — es informativa, no una interrupción. `Modal` del DS ganó `max-h-[85vh] overflow-y-auto` (cambio genérico y no disruptivo) para que el timeline no se corte en pantallas bajas. `tsc`/`build` verdes; lint sin errores nuevos (mismo baseline 20/10); Playwright 19/19 (2 specs nuevos del stepper + `employer-wizard.spec.ts` actualizado para el nuevo flujo de publicación, resto sin tocar) |

| Hotfix: pool_pre_ping restaurado | #97 | El PR #95 había sacado `pool_pre_ping` a favor de `pool_recycle=280` solo, asumiendo que reciclar por edad alcanzaba. En la práctica, en una beta de bajo tráfico el pooler de Neon corta conexiones **ociosas** bastante antes de esos ~4.5 min — el próximo checkout agarraba una conexión ya muerta y el request colgaba/fallaba. Julieta lo reportó como "la app está lenta" horas después del deploy. Se restauró `pool_pre_ping=True` **junto con** `pool_recycle` (combinación estándar de SQLAlchemy para bases remotas, no un reemplazo del uno por el otro). `pytest -q`: 222 passed |

## En vuelo ahora

- **`docs/PULIDO_ROADMAP.md` — batches C3 y C4 sin arrancar**: el orden fijado
  por el propio roadmap es C2 (hecho, #81) → C0+C1 (hecho, #83) → C3 → C4.
  **C3** (confianza y conversión: `sitemap.ts`/`robots.ts` + OG por página,
  skeletons coherentes, estados de error unificados, a11y AA) y **C4**
  (primera experiencia post-registro: onboarding por rol — el flujo exacto lo
  tiene que cerrar T1 antes de ejecutar, no arrancar sin ese spec) quedan
  pendientes.
- **Feature de enganche #1: ping en tiempo real de turnos urgentes**
  (ADR-0005) — al publicar un turno `urgent` con coordenadas, los 10
  candidatos disponibles más cercanos con la skill reciben `nearby_urgent_shift`
  (persistida + push WS al instante). Cruce shift→matching por puerto
  (`NearbyCandidatesPort`) con adapter en infraestructura; fan-out sincrónico
  sin broker que jamás rompe la publicación (try/except + log). **Código
  listo, PR #72 en reconciliación** tras el avance grande de `main` (rebase
  sobre idempotencia/stepper/etc., ver más abajo).
- **Feature de enganche #3: progreso de gamificación** — mostrar en el perfil
  del worker cuánto le falta para la próxima insignia/nivel ("te faltan 2
  turnos para Oro"), sobre `compute_badges`/`compute_level` ya existentes. Se
  había implementado y verificado (166 tests) pero el cambio se perdió sin
  commitear al resetearse el entorno de esa sesión — **a rehacer desde cero**.
- En cola (aprobadas por delegación): #4 panel de ganancias, #5 onboarding
  (probablemente se resuelve como parte de C4). #2 **WhatsApp Business API**
  sigue bloqueado en cuenta/API de Julieta — distinto del botón "Compartir por
  WhatsApp" (deep-link `wa.me`, sin API, ya resuelto en #77).

> **Nota de coordinación:** hubo más de una sesión de Claude Code trabajando
> en este repo en paralelo (ramas `claude/stepper-ciclo`, `claude/idempotencia`,
> `claude/robustez-tz-v2`, `claude/staffya-platform-spec-40hf7l`, etc., cada
> una en worktree aislado). Si en algún momento el `main` local de una sesión
> queda muy atrás, hacer `git fetch origin main` y comparar antes de asumir
> que el `git log` local es la verdad — esta bitácora puede quedar desfasada
> entre sesiones concurrentes; confiar en el `git log` real de `origin/main`
> por sobre el texto de esta sección si difieren.

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
   [RECOMMENDATIONS.md](./RECOMMENDATIONS.md)) — decisión de negocio, no de
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
- **Ley de marca post-rebrand** (`docs/PULIDO_ROADMAP.md`, desde #79): un solo
  acento naranja por pantalla, cero gradientes multicolor decorativos, la
  cloche como único logo. Los batches de pulido (C0–C4) son un spec T1
  cerrado: los ejecutores T2 no re-deciden la dirección, sólo implementan.
- `quantity>1` era un bug de producto conocido: **ya se capó a 1** (API +
  wizard, R1.4). Multi-asignación real queda pendiente, sólo si el negocio la
  pide (nuevo ADR).
- Cuentas demo con contraseña pública: **correcto para la etapa demo**, apagar
  y purgar antes de usuarios reales (checklist en PRODUCTION_READINESS).

## Dónde está cada cosa

- Veredicto y puntajes: [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md)
- Plan por fases: [ROADMAP_IMPLEMENTATION.md](./ROADMAP_IMPLEMENTATION.md)
- Diseño de mapas: [MAPS_REDESIGN.md](./MAPS_REDESIGN.md) + `docs/mockups/`
- Pulido post-rebrand (Ley de marca, batches C0–C4): [PULIDO_ROADMAP.md](./PULIDO_ROADMAP.md)
- ADRs: `docs/adr/` (0001 MapLibre, 0002 sesiones revocables, 0003 `quantity`,
  0004 cancelación/insignias, 0005 mensualidad, 0006 alta desde el mapa, 0007
  no-show/cancelación tardía)
- Acceso moderno (Google + push): [ACCESO_MODERNO.md](./ACCESO_MODERNO.md)
- Deuda vigente: [TECH_DEBT.md](./TECH_DEBT.md)
- Cómo trabajar en el repo: [../CLAUDE.md](../CLAUDE.md)
