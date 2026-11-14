# MAPA_DEL_CODIGO.md — Qué pantalla hace qué, y dónde vive cada cosa

Para no reconstruir el producto a fuerza de `grep`. La retro del 2026-10-03
encontró sesiones que gastaron de 6 a 15 llamadas en ubicar una pantalla o
un dato, y una que **propuso como nuevas dos funciones que Oído ya tenía**
(asignar a una persona puntual y marcar la llegada, que se pensó resolver
con QR) porque nada decía que existían. **Antes de proponer o construir algo, fijate acá si ya está.**

Si agregás una pantalla, un endpoint o una pieza de las que se buscan
seguido, sumá su fila en el mismo PR. Backend por capas:
[`../foundation/MODULES.md`](../foundation/MODULES.md).

## Pantallas (`frontend/app/`)

Todas son `"use client"` salvo las marcadas **SSR**, que se arman en el
servidor y no se pueden mockear con `page.route` (ver
[`SESION_CLOUD.md`](./SESION_CLOUD.md) §4).

### Trabajador

| Ruta | Qué responde | Piezas clave | API |
|---|---|---|---|
| `/feed` (Inicio) | ¿Qué turno tomo ahora? | `worker/FeedHero`, `worker/DiscoverDeck` + `worker/SwipeDeck` ("Descubrir rápido": deslizar recorre, postularse es botón), `worker/OpportunityCard`, `worker/NearbyRow`, `AIAssistantBar` | `/shifts/feed`, `/applications/mine` |
| `/buscar` | Buscar turnos con filtros, de cualquier zona | `worker/OpportunityCard` | `/shifts/feed?scope=all`, `/applications/mine` |
| `/map` | Turnos en el mapa, con el pago en el pin | `worker/MapSheet`, `lib/map/` | `/shifts/feed` |
| `/my-shifts` | Mis turnos y en qué paso están | `ShiftCard`, `ShiftLifecycleStepper`, `worker/EnRouteToggle` ("Va en camino"), `worker/CompareShiftsModal`, `ReviewBox` | `/shifts/mine`, `/applications/mine`, `/saved-shifts` |
| `/assistant` | Asistente de IA (lenguaje natural) | `lib/use-worker-ai-assistant.ts` | `/assistant/worker-query` |
| `/companies/[id]` | Perfil público de un comercio | `MiniMap`, `RateMeter` | `/companies/{id}` |

Llegada al turno: el trabajador marca "salí", "llegué" (check-in con
ubicación, desde 30 min antes) y "terminé" desde `/my-shifts`. Si no llega,
el no-show es automático (ADR-0008). **No hace falta QR.**

### Comercio

| Ruta | Qué responde | Piezas clave | API |
|---|---|---|---|
| `/shifts` (Panel) | ¿Cómo van mis turnos? Familias Buscando / En marcha / Terminados / Cancelados. «Marcar como pagado», «Cancelar turno» y «No se presentó» piden confirmación | `ShiftCard` (incluye `employer/EnRouteMap`), `ShiftActions`, `ShiftPublishedNextSteps`, `subscription/PlanLimitModal`, `lib/use-tap-guard.ts` | `/shifts/me` |
| `/shifts/new` | Publicar un turno (wizard; "Describí el turno" con IA). Un intento crea un solo borrador: reintentar lo retoma (y lo edita si cambió el formulario) en vez de crear otro | `LocationPicker`, `ShiftDayHint` | `POST /shifts`, `PUT /shifts/{id}`, `POST /shifts/{id}/publish`, `/shifts/parse-text` |
| `/shifts/new-event` | Publicar varios turnos para un evento. Arranca en la zona del local (con «Cambiar») y sin zona no se publica: botón deshabilitado y una línea que dice qué falta | `LocationPicker`, `lib/company-place.ts` (`useCompanyPlace`, compartido con `/shifts/new`) | `/shifts/events` |
| `/shifts/[id]/candidates` | ¿A quién elijo? Se **asigna a una persona puntual**, que después confirma o rechaza. El recomendado va en tarjeta oscura | `CandidateCard`, `candidate/GuaranteeCard`, `candidate/CandidateSignals` | `/shifts/{id}/candidates`, `/shifts/{id}/assign` |
| `/search` | Buscar trabajadores cerca (lista y mapa) y abrir su perfil | `WorkerSearchMap`, `BottomSheet` | `/matching/search` |
| `/favorites` | Mis trabajadores favoritos (reciben siempre el primer aviso, #399) | — | `/favorites` |
| `/workers/[id]` | Perfil público de un trabajador | `WorkerReviews`, `IdentityVerifiedBadge` | `/workers/{id}` |
| `/subscription` | Mi plan: pagar el mes con Mercado Pago, vuelta `?pago=`, dar de baja, arrepentirme (ADR-0022; con el cobro apagado, como en la beta). Con `?plan=<code>` (el plan elegido en los precios de la landing) resalta esa tarjeta y muestra el aviso con la acción | `subscription/PlanCard`, `subscription/SubscriptionStatusCard`, `subscription/PlanElegidoAviso`, `lib/subscription.ts`, `lib/plan-elegido.ts` | `/subscription`, `/subscription/subscribe`, `/cancel-renewal`, `/withdraw` |

### Compartidas, públicas y admin

| Ruta | Qué es |
|---|---|
| `/` | Landing sin sesión, "cielo" desde el 2026-10-18 y en paneles de tres superficies desde el 2026-11-13 (`components/landing/`, orden en `LandingCorta.tsx`: `HeroRueda` (con el cielo y las nubes, `Nubes`), `Comanda` con `lib/pedido-natural.ts`, `MapaCamino` (imagen real de Palermo en `public/landing/mapa-palermo.webp`, onda, relojito y la ficha de quien va en el pie), `Precios`, `ParaTrabajar`, `Preguntas`, `Cierre`, `LandingFooter`; el filete de "oído" en `Filete.tsx` (Sancreek local en `app/fonts/sancreek-oido.woff2`; el final usa sus `Sol` y `Letras` en `LandingFooter.tsx`); estilos `.landing-*` en `globals.css`; fotos en `public/landing/`; la puerta con sesión en `LandingGate.tsx`; instalar en el celular: `InstalarPasos.tsx` + `lib/instalar.ts`). Con sesión redirige a la home del rol; sin sesión se ve también desde la app instalada, y "Cerrar sesión" vuelve acá |
| `/historia` | La landing anterior, "la historia de un turno" (`components/landing/story/`, orden en `LandingStory.tsx`, motor en `useStage.ts`). Guardada para grabar reels; sin indexar, sin Navbar ni BottomNav |
| `/login`, `/register`, `/recuperar`, `/restablecer`, `/verificar-email` | Acceso. Google en `GoogleAuthButton`; consentimiento legal obligatorio en `/register`; anti-robots en `TurnstileWidget` (`lib/turnstile.ts`, apagado sin clave); `/register?rol=comercio&plan=<code>` guarda el plan elegido en la landing hasta el final de `/bienvenida` (`lib/plan-elegido.ts`) |
| `/bienvenida` | Primer arranque por rol (perfil, ubicación, foto). Si el perfil del trabajador ya existe (POST 409) guarda sólo lo capturado con `saveProfilePart`; sólo la cuenta invitada (`invitado.trabajador@oido.beta`) lo reemplaza entero |
| `/profile` | Cómo te ven: vista, no formulario (#396) |
| `/profile/edit` | Editar datos (`WorkerProfileForm` / `CompanyProfileForm`) |
| `/profile/settings` | Apariencia, notificaciones push, soporte, cerrar sesión |
| `/chats`, `/chats/[shiftId]` | Chat por turno (WebSocket, `lib/useWebSocket.ts`) |
| `/support`, `/support/[id]` | Tickets de soporte |
| `/turno/[id]` **SSR** | Página pública de un turno, para compartir (`ShiftDetail`). Se ve mientras el turno esté abierto a postulaciones (`lib/turno-publico.ts` lee `GET /shifts/{id}/public`: 200, 410 o 404). Si ya se tomó, se canceló o pasó la hora: «Este turno ya no está disponible» (`components/TurnoNoDisponible.tsx`, con salida según la sesión; la muestra `app/turno/[id]/not-found.tsx`). Si no existe: la «no encontrada» global (lo corta `app/turno/[id]/layout.tsx`) |
| cualquier dirección que no existe | «No encontramos esa página», con «Volver al inicio» (`app/not-found.tsx`). También la usa todo `notFound()` sin una pantalla propia más cerca |
| `/terminos`, `/privacidad` **SSR** | Legales. Si cambia el texto, se sube la versión (ver abajo) |
| `/admin` ("Hoy") | Portada del admin: urgentes sin cubrir y ausencias del día, pendientes con contador y la promesa de los 10 min. Menú y control de acceso en `app/admin/layout.tsx`; contadores en `components/admin/AdminInbox.tsx` |
| `/admin/en-vivo` ("Turnos en vivo") | Turnos publicados sin nadie confirmado, lo más urgente primero, filtros urgentes/escalados (`?filtro=`), se actualiza cada 30 s. Cuentas en `components/admin/live.ts` |
| `/admin/personas`, `/admin/personas/[id]` | Buscador y filtros de usuarios · ficha con perfil, turnos, tickets y acciones de moderación (`components/admin/people.ts`) |
| `/admin/verificacion`, `/admin/support` | Cola de DNI y constancia AFIP · tickets |
| `/admin/metricas`, `/admin/herramientas` | Últimos 7/30 días contra el período anterior (`DeltaStatCard` en `components/admin/AdminStats.tsx`), conteos, promesa, métricas de producto y suscripciones · cuentas de prueba |
| `/admin/leads` ("Crecimiento") | Comercios a captar: lista por barrio desde OpenStreetMap, estado y notas (ADR-0019, `lib/leads.ts`) |
| `/admin/seguridad` ("Seguridad") | Verificación en dos pasos de la cuenta admin (ADR-0023): el alta (QR con `components/admin/TotpQr.tsx`, clave a mano, códigos de recuperación con `RecoveryCodesPanel`), estado, códigos nuevos y cambio de celular. Una admin sin activarla sólo ve esta pantalla (`twoFactorSetupPending` en `lib/auth-context.tsx`). El paso del código en `/login` es `components/TwoFactorLoginStep.tsx`; API en `lib/two-factor.ts` |

## Dónde vive cada cosa que se busca seguido

| Busco… | Está en |
|---|---|
| Color de cada rubro (mozo, bartender, cocina…) | `frontend/lib/skill-style.tsx` |
| Tokens de color, sombras, anchos (`.app-container`, `.app-container-reading`) | `frontend/app/globals.css` |
| Paleta celeste (v6) y la superficie de marca `bg-brand` | `frontend/app/globals.css`, bloque "PALETA CELESTE" (rige en `:root`) y `@utility bg-brand`; tinta sobre la marca: tokens `on-brand`, `heroInk()`/`heroTile()` en `lib/skill-style.tsx` |
| Escala tipográfica y su guardia | `frontend/lib/type-scale.test.ts` |
| Guardar una parte del perfil del trabajador (el `PUT /workers/me/profile` reemplaza el perfil entero) | `frontend/lib/worker-profile.ts` (`saveProfilePart`: lee el perfil del servidor y manda todo con el cambio encima); lo usan la foto, el interruptor «Disponible» del Inicio, el formulario y `/bienvenida`. No armar otro PUT a mano |
| Tema claro/oscuro (clave `oido-theme`) | `frontend/lib/theme.tsx` |
| Componentes base (Button, Card, Sheet, Modal, IconChip…) | `frontend/components/ui/` |
| Pila de capas abiertas: Escape cierra sólo la de más arriba (la usan Modal, Sheet, `DiscoverDeck` y `GuidedTour`, prioridad 70, donde Escape = «Saltar recorrido»; ignora la repetición de tecla; una capa nueva con su propio Escape tiene que usarla) | `frontend/lib/use-escape-layer.ts` |
| Pantalla entera de «acá no hay nada» (título, una línea y salidas que son links) | `frontend/components/PaginaAviso.tsx`; la usan `app/not-found.tsx` y `TurnoNoDisponible` |
| Íconos (Lucide, envueltos) | `frontend/components/icons.tsx` |
| Logo | `frontend/components/Logo.tsx` |
| Claves de `localStorage`/`sessionStorage` (`staffya_*`) y mocks E2E | `frontend/e2e/mocks.ts` |
| Cliente de la API (por defecto apunta a **producción**) | `frontend/lib/api.ts` |
| URL pública del sitio (`www.oido.com.ar`) | `frontend/lib/site.ts` |
| Imagen de vista previa al compartir un link (WhatsApp, X) | `frontend/lib/og-brand.tsx` (la usan `app/og/oido.jpg/route.ts` y `app/twitter-image.tsx`; el filete en `assets/og/filete-oido.png`) |
| Versión de términos y privacidad (**las dos juntas**) | `backend/app/modules/identity/domain/value_objects.py` y `frontend/lib/legal.ts` |
| Ciclo de vida del turno (estados y guards) | `backend/app/modules/shift/domain/entities.py` |
| Textos de lo que no se puede hacer con el turno (por acción y estado, castellano de persona) | `backend/app/modules/shift/domain/mensajes.py` (`no_se_puede`) |
| Casos de uso del turno (publicar, asignar, check-in…) | `backend/app/modules/shift/application/services.py` |
| A quién se avisa al publicar (top 10 + favoritos) | `ShiftService._notify_nearby_workers`, mismo archivo |
| A quién se avisa al cancelar un turno (asignado y postulaciones pendientes, un aviso por persona) | `ShiftService._notify_shift_cancelled`, mismo archivo; tabla por estado en [`NOTIFICATIONS.md`](./NOTIFICATIONS.md) |
| Texto de «¿Cancelar este turno?» y cuándo avisa la cancelación tardía | `frontend/lib/cancelar-turno.ts` (`cancelConfirmCopy`, `isLateCancellation`); el diálogo está en `app/shifts/page.tsx` y al abrirse relee el turno (`askCancel`), para decidir el texto con el estado de ahora |
| Cancelaciones tardías que ve el comercio en su `/profile` (sólo con al menos una) | `frontend/components/company/LateCancellations.tsx` |
| Tareas periódicas (recordatorios, no-show, urgencia, "no cubierto", retención de sesiones y avisos, reintento del borrado de documentos) | `backend/app/modules/shift/application/scheduler.py` (los chequeos de otros módulos entran por `extra_checks` desde `app/main.py`) |
| Pago de referencia y "paga por debajo" (ADR-0012) | `backend/app/modules/shift/domain/pay_benchmark.py` |
| Qué pasa con los turnos al suspender una cuenta (ocultar, cancelar, reabrir; vista previa para la admin) | Reglas en `backend/app/modules/shift/domain/suspension.py` (puerto `AccountSuspensionEffects`); caso de uso en `ShiftService.apply_account_suspension` y `preview_account_suspension`; lo llama `AdminService.suspend_user`. Lo oculto se filtra en `_from_active_company` (`shift/infrastructure/repositories.py`); el diálogo, en `app/admin/personas/[id]/page.tsx` con `suspensionImpactLines` (`components/admin/people.ts`) (ADR-0024) |
| Ranking de candidatos | `backend/app/modules/matching/domain/scoring.py` |
| Qué es «cerca»: radios (25 km aviso, 40 km escalada y feed) y la regla (distancia o, sin coordenadas, misma ciudad) | Radios en `backend/app/modules/matching/domain/value_objects.py`; regla en `backend/app/core/geo.py` (`is_near`, `same_city`, `bounding_box`); avisos y recomendados en `scoring.py` (`is_within_radius`); feed en `backend/app/modules/shift/domain/nearby.py` y `ShiftService.list_feed`; desde dónde se mide un turno sin zona (el local del comercio) en `nearby.py::zone_of` y `backend/app/modules/shift/application/zones.py`; corte de la pantalla (Inicio y Mapa) en `frontend/lib/current-location.ts` (`nearbyOnly`, `NEARBY_RADIUS_KM`) |
| Postulación: estados, retirar y volver a postularse | `backend/app/modules/application/domain/entities.py` (`ShiftApplication`, `reapply`) y `backend/app/modules/application/application/services.py` (`ApplicationService.apply`); en el frontend, qué cuenta como "ya me postulé": `frontend/lib/applications.ts` (`appliedShiftIds`, lo usan Inicio, Buscar, el Mapa y el detalle del turno) |
| "Va en camino" | `Shift.report_en_route_location` (dominio), `frontend/lib/use-en-route-sharing.ts`, `components/employer/EnRouteMap.tsx` |
| "Disponible ahora" (4 h) | `AVAILABLE_NOW_TTL` en `backend/app/modules/worker/domain/entities.py`, `frontend/lib/use-available-now.ts` |
| Pin desplazado del trabajador | `fuzz_point` en `backend/app/core/geo.py` |
| Fechas de negocio en hora argentina; fechas y duraciones para frases (`format_inicio_art`, `format_desde_art`, `format_duracion`) | `backend/app/core/tz.py` |
| Backend sólo por Cloudflare + IP real | `backend/app/core/edge.py` (`EDGE_SHARED_SECRET`, `client_ip`) |
| Entrada del Worker del frontend y caché de `/turno/[id]` | `frontend/cloudflare/worker.mjs`, `frontend/cloudflare/turno-cache.mjs` |
| Verificación en dos pasos del admin (TOTP, desafío del login, candado de las sesiones admin, plan B) | `backend/app/modules/identity/domain/two_factor.py`, `application/two_factor.py`, `api/dependencies.py` (`get_current_user` vs `get_current_user_allow_pending_2fa`), `backend/scripts/disable_two_factor.py`; frontend `lib/two-factor.ts` y el 403 con `code` en `lib/api.ts` (ADR-0023) |
| Turnstile (anti-robots en login y registro) | `backend/app/core/turnstile.py` y `frontend/lib/turnstile.ts` |
| Sesión: fin con motivo (`sessionEnded`), «Reconectando…» (`reconnecting`), cierre desde otra pestaña, y a dónde vuelve el ingreso, el alta y la bienvenida (`next`, sólo rutas internas; `loginHref`, `registerHref`, `bienvenidaHref`) | `frontend/lib/auth-context.tsx` (`endSession`, `restoreOnce`), `frontend/lib/safe-next.ts` (`safeNext`, `loginHref`, `registerHref`, `bienvenidaHref`, textos por motivo y avisos fijos del ingreso, `?aviso=`), `frontend/lib/use-require-auth.ts`; el 401 que no se pudo renovar en `frontend/lib/api.ts` |
| Idempotencia de mutaciones | `backend/app/core/idempotency.py` y `frontend/lib/idempotency.ts` |
| Guarda contra el toque de más (una acción terminó, la lista se redibujó y quedó otro botón bajo el dedo) | `frontend/lib/use-tap-guard.ts` (`useTapGuard`); la usan el panel del comercio (`app/shifts/page.tsx`, `components/ShiftActions.tsx`), el asistente de publicar (`app/shifts/new/page.tsx`), Mis turnos del trabajador (`app/my-shifts/page.tsx`), el mazo «Descubrir rápido» (`components/worker/SwipeDeck.tsx`) y la grilla del Inicio (`app/feed/page.tsx`) |
| Pantallas al día con los avisos (la campanita avisa y la pantalla abierta vuelve a pedir lo suyo, en silencio; sin consulta periódica) | `frontend/lib/live-refresh.ts` (`emitLiveRefresh`, `useLiveRefresh(load, { paused })`); emite `components/NotificationBell.tsx`; se suscriben `app/shifts/page.tsx`, `app/shifts/[id]/candidates/page.tsx`, `app/my-shifts/page.tsx`, `components/ShiftDetail.tsx` y `app/chats/layout.tsx` |
| Mails (textos) y envío | `backend/app/modules/notification/domain/email_templates.py`, `infrastructure/resend_email_sender.py` |
| Push | `backend/app/modules/notification/infrastructure/webpush_sender.py`, `backend/app/modules/notification/domain/push_policy.py` (vigencia y urgencia por tipo), `frontend/lib/push.ts`; el dispositivo se registra y se da de baja al abrir y cerrar la sesión en `frontend/lib/auth-context.tsx`, con pedidos que no avisan al candado de dos pasos (`backgroundApi` en `frontend/lib/api.ts`) |
| Gemini (modelo fijado) | `backend/app/core/gemini.py` |
| PIN del acceso invitado | env var `GUEST_ACCESS_PIN` (`settings.guest_access_pin`, `backend/app/core/config.py`); vacía = apagado |
| Recorte de datos del trabajador en un turno ajeno | `without_worker_data` en `backend/app/modules/shift/api/schemas.py` |
| Datos demo | `backend/scripts/seed_demo_data.py` y `backend/scripts/startup_seed.py` |
| Documentos de identidad privados (subida firmada `private`, link que vence, borrado al decidir con reintentos, migración de los viejos) | `backend/app/core/cloudinary.py`, `backend/app/modules/verification/infrastructure/evidence_link_signer.py`, `.../infrastructure/evidence_file_storage.py` y `file_cleanup_job.py` (borrado y reintento del scheduler), `backend/scripts/privatize_identity_evidence.py` (ADR-0021) |
| Videos promocionales (se renderizan desde HTML) | `marketing/videos/` |
| Probar la app de punta a punta en local: backend y base reales, terceros simulados, kit de Playwright para dos sesiones a la vez | `tools/e2e-local/` (`README.md`; receta en [`SESION_CLOUD.md`](./SESION_CLOUD.md) §7) |

## Endpoints por módulo (`/api/v1/…`)

Las rutas exactas están en `backend/app/modules/<módulo>/api/routes.py`.
Esto es para saber qué existe sin abrir cada archivo.

| Prefijo | Qué hay |
|---|---|
| `/auth` | register, login, guest, google, refresh, logout, me, forgot/reset-password, verify-email; verificación en dos pasos del admin: `2fa` (estado), `2fa/setup`, `2fa/confirm`, `2fa/verify` (paso del código del login), `2fa/recovery-codes` |
| `/shifts` | crear, `parse-text`, `feed`, `me`, `mine`, `events`, `{id}`, `{id}/public`; transiciones: `publish`, `cancel`, `assign`, `confirm`, `reject`, `worker-cancel`, `depart`, `en-route`, `check-in`, `start-working`, `check-out`, `no-show`, `finish`, `mark-paid`; `{id}/candidates` (matching) |
| `/applications` | postularse a un turno, retirarse, `mine` |
| `/matching` | búsqueda de trabajadores para el comercio |
| `/workers`, `/companies` | perfil propio (`me/profile`), perfil público; `workers/me/earnings`, `workers/me/available-now` |
| `/favorites`, `/saved-shifts` | favoritos del comercio, turnos guardados del trabajador |
| `/identity` | verificación: DNI y selfie, constancia AFIP, cola de admin, link que vence de cada evidencia (`/evidences/{id}/link`) |
| `/reviews`, `/chats`, `/notifications`, `/support` | reseñas, chat por turno, avisos, tickets |
| `/subscription` | plan, planes, suscribirse (Checkout Pro), baja, arrepentimiento, `webhooks/mercadopago` |
| `/uploads` | firma de subida de CV y de constancia |
| `/assistant` | IA del comercio (`query`) y del trabajador (`worker-query`) |
| `/admin` | stats, `today`, `live-shifts?urgent=&escalated=`, `period-metrics?period=7\|30` (cortes en días argentinos, `admin/application/periods.py`), usuarios (`users?q=&role=&status=&verified=`), ficha `users/{id}`, suspender y reactivar (`users/{id}/suspend`, `/activate`) con la vista previa de qué turnos toca (`users/{id}/suspension-preview`, ADR-0024), cuentas de prueba, suscripciones |
| `/admin/leads` | comercios a captar: listar, `summary`, `barrios`, `import` (OpenStreetMap), `PATCH {id}` (módulo `lead`) |
