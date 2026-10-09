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
| `/buscar` | Buscar turnos con filtros | `worker/OpportunityCard` | `/shifts/feed`, `/applications/mine` |
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
| `/shifts` (Panel) | ¿Cómo van mis turnos? Familias Buscando / En marcha / Terminados / Cancelados | `ShiftCard` (incluye `employer/EnRouteMap`), `ShiftActions`, `ShiftPublishedNextSteps`, `subscription/PlanLimitModal` | `/shifts/me` |
| `/shifts/new` | Publicar un turno (wizard; "Describí el turno" con IA) | `LocationPicker`, `ShiftDayHint` | `POST /shifts`, `/shifts/parse-text` |
| `/shifts/new-event` | Publicar varios turnos para un evento | `LocationPicker` | `/shifts/events` |
| `/shifts/[id]/candidates` | ¿A quién elijo? Se **asigna a una persona puntual**, que después confirma o rechaza. El recomendado va en tarjeta oscura | `CandidateCard`, `candidate/GuaranteeCard`, `candidate/CandidateSignals` | `/shifts/{id}/candidates`, `/shifts/{id}/assign` |
| `/search` | Buscar trabajadores cerca (lista y mapa) y abrir su perfil | `WorkerSearchMap`, `BottomSheet` | `/matching/search` |
| `/favorites` | Mis trabajadores favoritos (reciben siempre el primer aviso, #399) | — | `/favorites` |
| `/workers/[id]` | Perfil público de un trabajador | `WorkerReviews`, `IdentityVerifiedBadge` | `/workers/{id}` |
| `/subscription` | Mi plan (cobro apagado en la beta, ADR-0005) | `subscription/PlanCard` | `/subscription` |

### Compartidas, públicas y admin

| Ruta | Qué es |
|---|---|
| `/` | Landing sin sesión: la historia de un turno, escena por escena (`landing/story/`, orden en `LandingStory.tsx`, motor en `useStage.ts`). Con sesión redirige a la home del rol |
| `/login`, `/register`, `/recuperar`, `/restablecer`, `/verificar-email` | Acceso. Google en `GoogleAuthButton`; consentimiento legal obligatorio en `/register` |
| `/bienvenida` | Primer arranque por rol (perfil, ubicación, foto) |
| `/profile` | Cómo te ven: vista, no formulario (#396) |
| `/profile/edit` | Editar datos (`WorkerProfileForm` / `CompanyProfileForm`) |
| `/profile/settings` | Apariencia, notificaciones push, soporte, cerrar sesión |
| `/chats`, `/chats/[shiftId]` | Chat por turno (WebSocket, `lib/useWebSocket.ts`) |
| `/support`, `/support/[id]` | Tickets de soporte |
| `/turno/[id]` **SSR** | Página pública de un turno, para compartir (`ShiftDetail`) |
| `/terminos`, `/privacidad` **SSR** | Legales. Si cambia el texto, se sube la versión (ver abajo) |
| `/admin`, `/admin/support` | Métricas, cola de verificación (DNI y constancia AFIP), cuentas de prueba |

## Dónde vive cada cosa que se busca seguido

| Busco… | Está en |
|---|---|
| Color de cada rubro (mozo, bartender, cocina…) | `frontend/lib/skill-style.tsx` |
| Tokens de color, sombras, anchos (`.app-container`, `.app-container-reading`) | `frontend/app/globals.css` |
| Paleta celeste y naranja en prueba (propuesta v6) y la superficie de marca `bg-brand` | `frontend/app/globals.css`, bloque `[data-palette="celeste"]` y `@utility bg-brand`; se prende en `LandingStory.tsx` |
| Escala tipográfica y su guardia | `frontend/lib/type-scale.test.ts` |
| Tema claro/oscuro (clave `oido-theme`) | `frontend/lib/theme.tsx` |
| Componentes base (Button, Card, Sheet, Modal, IconChip…) | `frontend/components/ui/` |
| Íconos (Lucide, envueltos) | `frontend/components/icons.tsx` |
| Logo | `frontend/components/Logo.tsx` |
| Claves de `localStorage`/`sessionStorage` (`staffya_*`) y mocks E2E | `frontend/e2e/mocks.ts` |
| Cliente de la API (por defecto apunta a **producción**) | `frontend/lib/api.ts` |
| URL pública del sitio (`www.oido.com.ar`) | `frontend/lib/site.ts` |
| Imagen de vista previa al compartir un link (WhatsApp, X) | `frontend/lib/og-brand.tsx` (la usan `app/og/oido.jpg/route.ts` y `app/twitter-image.tsx`) |
| Versión de términos y privacidad (**las dos juntas**) | `backend/app/modules/identity/domain/value_objects.py` y `frontend/lib/legal.ts` |
| Ciclo de vida del turno (estados y guards) | `backend/app/modules/shift/domain/entities.py` |
| Casos de uso del turno (publicar, asignar, check-in…) | `backend/app/modules/shift/application/services.py` |
| A quién se avisa al publicar (top 10 + favoritos) | `ShiftService._notify_nearby_workers`, mismo archivo |
| Tareas periódicas (recordatorios, no-show, urgencia, "no cubierto") | `backend/app/modules/shift/application/scheduler.py` |
| Pago de referencia y "paga por debajo" (ADR-0012) | `backend/app/modules/shift/domain/pay_benchmark.py` |
| Ranking de candidatos | `backend/app/modules/matching/domain/scoring.py` |
| "Va en camino" | `Shift.report_en_route_location` (dominio), `frontend/lib/use-en-route-sharing.ts`, `components/employer/EnRouteMap.tsx` |
| "Disponible ahora" (4 h) | `AVAILABLE_NOW_TTL` en `backend/app/modules/worker/domain/entities.py`, `frontend/lib/use-available-now.ts` |
| Pin desplazado del trabajador | `fuzz_point` en `backend/app/core/geo.py` |
| Fechas de negocio en hora argentina | `backend/app/core/tz.py` |
| Idempotencia de mutaciones | `backend/app/core/idempotency.py` y `frontend/lib/idempotency.ts` |
| Mails (textos) y envío | `backend/app/modules/notification/domain/email_templates.py`, `infrastructure/resend_email_sender.py` |
| Push | `backend/app/modules/notification/infrastructure/webpush_sender.py`, `frontend/lib/push.ts` |
| Gemini (modelo fijado) | `backend/app/core/gemini.py` |
| PIN del acceso invitado | `GUEST_ACCESS_PIN` en `backend/app/modules/identity/application/services.py` |
| Datos demo | `backend/scripts/seed_demo_data.py` y `backend/scripts/startup_seed.py` |
| Videos promocionales (se renderizan desde HTML) | `marketing/videos/` |

## Endpoints por módulo (`/api/v1/…`)

Las rutas exactas están en `backend/app/modules/<módulo>/api/routes.py`.
Esto es para saber qué existe sin abrir cada archivo.

| Prefijo | Qué hay |
|---|---|
| `/auth` | register, login, guest, google, refresh, logout, me, forgot/reset-password, verify-email |
| `/shifts` | crear, `parse-text`, `feed`, `me`, `mine`, `events`, `{id}`, `{id}/public`; transiciones: `publish`, `cancel`, `assign`, `confirm`, `reject`, `worker-cancel`, `depart`, `en-route`, `check-in`, `start-working`, `check-out`, `no-show`, `finish`, `mark-paid`; `{id}/candidates` (matching) |
| `/applications` | postularse a un turno, retirarse, `mine` |
| `/matching` | búsqueda de trabajadores para el comercio |
| `/workers`, `/companies` | perfil propio (`me/profile`), perfil público; `workers/me/earnings`, `workers/me/available-now` |
| `/favorites`, `/saved-shifts` | favoritos del comercio, turnos guardados del trabajador |
| `/identity` | verificación: DNI y selfie, constancia AFIP, cola de admin |
| `/reviews`, `/chats`, `/notifications`, `/support` | reseñas, chat por turno, avisos, tickets |
| `/subscription` | plan, planes, suscribirse |
| `/uploads` | firma de subida de CV y de constancia |
| `/assistant` | IA del comercio (`query`) y del trabajador (`worker-query`) |
| `/admin` | stats, usuarios, cuentas de prueba, suscripciones |
