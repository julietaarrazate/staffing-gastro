# INVENTARIO DE MÓDULOS DEL SISTEMA
## Oído — Detalle funcional de los 17 módulos de dominio

**Autora:** Julieta Arrazate
**Fecha:** Septiembre 2026

---

## TABLA MAESTRA DE MÓDULOS

| N° | Módulo | Rol | Entidad principal |
|---|---|---|---|
| 1 | Identity | Autenticación, sesiones, roles | `User` |
| 2 | Worker | Perfil y reputación del trabajador | `WorkerProfile` |
| 3 | Company | Perfil y reputación del comercio | `CompanyProfile` |
| 4 | Shift | Publicación y ciclo de vida del turno | `Shift` |
| 5 | Application | Postulación del trabajador a un turno | `ShiftApplication` |
| 6 | Matching | Ranking de candidatos por turno + búsqueda por mapa | (sin persistencia propia) |
| 7 | Notification | Avisos in-app en tiempo real | `Notification` |
| 8 | Chat | Mensajería trabajador↔comercio por turno | `ChatMessage` |
| 9 | Review | Reseñas bidireccionales al cerrar un turno | `Review` |
| 10 | Admin | Métricas y moderación | (multi-modelo, lectura) |
| 11 | Subscription | Mensualidad del comercio | `Subscription` |
| 12 | Verification | Verificación de identidad | `VerificationClaim` |
| 13 | Favorite | Comercios/trabajadores favoritos | `Favorite` |
| 14 | Saved shift | Turnos guardados por el trabajador | `SavedShift` |
| 15 | Upload | Subida firmada de archivos a Cloudinary | (sin persistencia propia) |
| 16 | Assistant | Asistente de IA para publicar turnos | `AssistantQueryLog` |
| 17 | Support | Canal de soporte/contacto | `SupportTicket` |

---

## DETALLE AMPLIADO POR MÓDULO

### MÓDULO 1 — IDENTITY (identidad y sesión)

**Objetivo:** autenticación y autorización de todo el sistema.

**Funcionalidades:**
- Registro con email + contraseña, con checkbox de consentimiento legal obligatorio.
- Login con emisión de JWT de acceso (15 min) + refresh token (30 días) en cookie `httpOnly` con rotación y detección de reuso.
- Login con Google (Google Identity Services, ID token sin client secret).
- Recuperación de contraseña por email transaccional (Resend), con link de un solo uso.
- Verificación de email.
- Logout server-side (revoca la sesión en base de datos).
- Acceso de invitado (cuentas demo `invitado.trabajador@oido.beta` / `invitado.comercio@oido.beta`, filtradas de las búsquedas reales de un comercio).
- Un `User` tiene rol (`worker` | `employer` | `admin`); el primer admin se promueve exclusivamente vía `ADMIN_EMAILS` al arrancar — no existe auto-registro como admin.

**Dependencias:** Resend (email), Google Identity Services.

---

### MÓDULO 2 — WORKER (perfil de trabajador)

**Objetivo:** perfil del trabajador eventual y su reputación.

**Funcionalidades:**
- Datos de perfil: foto, ciudad, biografía, geolocalización, habilidades (mozo, bartender, barista, runner, cocinero, cajero, recepcionista, personal de eventos, ayudante de cocina, personal de salón), años de experiencia, idiomas, certificaciones, CV (subida de archivo o link).
- Reputación derivada del ciclo real del turno: `rating`, `events_completed`, `punctuality_rate`, `cancellations`, `no_shows`.
- Motor de insignias (`nunca_falto`, `top_mozo`, `top_bartender`, `eventos_premium`) y niveles de gamificación (bronce/plata/oro/platino), recalculados sin histéresis ante cada evento relevante.
- Disponibilidad (`is_available`) para aparecer en búsquedas y matching.

**Dependencias:** Cloudinary (foto/CV).

---

### MÓDULO 3 — COMPANY (perfil de comercio)

**Objetivo:** perfil del comercio que publica turnos.

**Funcionalidades:**
- Datos: nombre, logo, categoría (restaurante, bar, cafetería, salón de eventos, catering, empresa gastronómica), descripción, dirección, ciudad, geolocalización, capacidad, horarios.
- Alta de local desde el mapa: geocoder Nominatim/OpenStreetMap gratuito + pin arrastrable como fuente de verdad de latitud/longitud (ADR-0006).
- Reputación derivada: `rating`, `events_published`, `on_time_payment_rate`.
- Onboarding post-registro (`/bienvenida`) para completar nombre, logo y ubicación antes de operar.

**Dependencias:** Cloudinary (logo), Nominatim/OSM.

---

### MÓDULO 4 — SHIFT (turno)

**Objetivo:** representar la oferta de trabajo puntual y su ciclo de vida completo.

**Funcionalidades:**
- Publicación: puesto, cantidad, horario, pago, propinas, código de vestimenta, urgencia, dirección/ciudad/geolocalización, título, descripción.
- Ciclo de vida con 11 estados: `borrador → publicado → buscando_personal → asignado → confirmado → en_camino → check_in → trabajando → check_out → finalizado → pagado`, más `cancelado` como estado terminal alternativo.
- Feed: sólo aparecen turnos en estados abiertos (`publicado`/`buscando_personal`).
- Asistencia geolocalizada real en check-in y check-out.
- No-show automático (el comercio marca "no se presentó": reabre el turno y penaliza al trabajador) y cancelación tardía con penalización al comercio si el trabajador ya estaba confirmado (ADR-0007).
- Escalada automática de urgencia para turnos abiertos que no se cubren rápido (ADR-0009).
- Compartir turno por WhatsApp (deep-link `wa.me`, Web Share API con fallback) y duplicar turno, desde el panel del comercio y desde la tarjeta del feed del trabajador.
- Página pública del turno, sin autenticación, para compartir.
- Idempotencia (`Idempotency-Key`) en las mutaciones críticas del ciclo.
- Scheduler propio (asistencia + escalada) por deadline dinámico, sin sondeo fijo.

**Dependencias:** matching, company, worker, notification.

---

### MÓDULO 5 — APPLICATION (postulación)

**Objetivo:** modelar el lado "trabajador" del match (postulación estilo swipe).

**Funcionalidades:**
- El trabajador se postula a un turno abierto; único por (turno, trabajador).
- Estados: `pendiente`, `aceptada`, `rechazada`, `retirada`.
- Al asignar (o cancelar) un turno, los postulantes no elegidos pasan a `rechazada` de forma silenciosa; si el turno se reabre (rechazo/cancelación/no-show del asignado), vuelven a `pendiente`.
- Búsqueda de un postulante por nombre (usada por el asistente de IA).

**Dependencias:** shift.

---

### MÓDULO 6 — MATCHING (motor de recomendación)

**Objetivo:** rankear candidatos para un turno; no persiste entidades propias.

**Funcionalidades:**
- Scoring multi-factor: distancia (Haversine), experiencia, reputación, puntualidad, historial de desempeño.
- Filtro de elegibilidad previo: disponibilidad + habilidad requerida.
- Búsqueda de trabajadores por mapa (rol + radio) para el comercio.
- Devuelve nombre, foto, rating y desglose del score del candidato.

**Dependencias:** worker, shift (vía puertos, sin acoplar dominios).

---

### MÓDULO 7 — NOTIFICATION (notificaciones)

**Objetivo:** avisar en tiempo real de los eventos relevantes del ciclo del turno.

**Funcionalidades:**
- Notificación in-app ante asignación, confirmación, rechazo, check-out y pago de un turno, y ante una reseña nueva.
- Entrega en tiempo real por WebSocket (`WS /api/v1/notifications/ws`) además de push (Web Push/VAPID).
- No hay bus de eventos formal: cada notificación es un efecto de dominio dentro del propio caso de uso que la origina.

**Dependencias:** Web Push/VAPID.

---

### MÓDULO 8 — CHAT (mensajería)

**Objetivo:** mensajería trabajador↔comercio por turno.

**Funcionalidades:**
- Conversación exclusiva entre el comercio y el trabajador asignado a ese turno.
- Entrega en tiempo real por WebSocket (`WS /api/v1/chats/{shift_id}/ws`).
- Marca de lectura y aviso al destinatario vía notificación.

**Dependencias:** shift, notification.

---

### MÓDULO 9 — REVIEW (reseñas)

**Objetivo:** calificación bidireccional al cerrar un turno.

**Funcionalidades:**
- Sólo sobre turnos cerrados (`finalizado` o `pagado`).
- Una sola reseña por usuario por turno.
- Cada reseña recalcula el rating promedio del calificado, que alimenta directamente el matching.

**Dependencias:** shift, worker/company (reputación), notification.

---

### MÓDULO 10 — ADMIN (administración)

**Objetivo:** métricas y moderación, exclusivo del rol `admin`.

**Funcionalidades:**
- Cola de revisión manual de verificación de identidad.
- Moderación de usuarios (habilitar/deshabilitar).
- Métricas del panel: uso general, suscripciones/MRR (con distinción explícita entre ingreso real y potencial cuando el cobro está apagado), exclusión de cuentas sintéticas/demo de las métricas.
- Gestión de cuentas de prueba (trabajador/comercio) para demostración.
- Bootstrap del primer administrador desde `ADMIN_EMAILS`.

**Dependencias:** verification, subscription, identity.

---

### MÓDULO 11 — SUBSCRIPTION (suscripción del comercio)

**Objetivo:** mensualidad al comercio (ADR-0005, Fase 1).

**Funcionalidades:**
- Planes: gratis / básico / pro.
- Pantalla "Mi plan" con estado de uso frente al tope mensual.
- Gating de capacidad de publicación de turnos por plan — construido completo, con el enforcement **apagado por decisión de producto** durante la beta (`subscriptions_enforced=false`: se cuenta el uso, no se bloquea a nadie).
- Integración con Mercado Pago para pagos reales, detrás de feature-flag.

**Dependencias:** Mercado Pago (opcional), shift (gating).

---

### MÓDULO 12 — VERIFICATION (verificación de identidad)

**Objetivo:** acreditar la identidad de un trabajador o comercio ante el resto del sistema.

**Funcionalidades:**
- Carga de DNI y selfie.
- Nivel de garantía agregado (L0–L4) a partir de los claims verificados — no un booleano.
- Cola de revisión manual para el admin.
- Resultado visible simplificado ("Identidad verificada") a partir de L2 o superior; nunca se exponen las evidencias subyacentes a terceros.

**Dependencias:** Cloudinary (DNI/selfie), admin (cola de revisión).

---

### MÓDULO 13 — FAVORITE (favoritos)

**Objetivo:** permitir marcar comercios o trabajadores como favoritos para acceso rápido.

**Funcionalidades:** alta/baja de favorito, listado propio por usuario.

---

### MÓDULO 14 — SAVED SHIFT (turnos guardados)

**Objetivo:** permitir al trabajador guardar turnos de interés sin postularse todavía.

**Funcionalidades:** alta/baja de turno guardado, listado propio del trabajador.

---

### MÓDULO 15 — UPLOAD (subida de archivos)

**Objetivo:** centralizar la subida firmada de archivos a Cloudinary desde el backend.

**Funcionalidades:** firma de subida de CV (`POST /uploads/sign-cv`) — evita que cualquiera suba archivos a la cuenta de Cloudinary sin pasar por el backend.

**Dependencias:** Cloudinary.

---

### MÓDULO 16 — ASSISTANT (asistente de inteligencia artificial)

**Objetivo:** interpretar lenguaje natural para agilizar la publicación de turnos y responder consultas del comercio sobre sus propios turnos.

**Funcionalidades:**
- "Describí el turno": el comercio escribe una descripción libre y el asistente prellena puesto/horario/pago — nunca publica sin confirmación explícita.
- Consultas conversacionales: turnos de hoy, turnos urgentes sin cubrir, buscar el turno relevante para ver sus postulantes, buscar un postulante por nombre.
- Resumen de "lo habitual" de cada comercio (puesto más pedido, horario típico, pago típico, si suele incluir propinas o comida), calculado en cada consulta a partir de sus propios turnos publicados, sin memoria persistente añadida.
- Registro de cada consulta (`AssistantQueryLog`) como señal de uso, sin fines de entrenamiento de modelo.
- Sin `GEMINI_API_KEY`, responde `503` explícito.

**Dependencias:** Google Gemini, shift, application (vía puertos).

---

### MÓDULO 17 — SUPPORT (soporte)

**Objetivo:** canal de contacto/soporte para usuarios del sistema.

**Funcionalidades:** alta de ticket de soporte, listado para revisión.

---

*Documento generado para expediente de registro de obra de software — Julieta Arrazate — Septiembre 2026*
