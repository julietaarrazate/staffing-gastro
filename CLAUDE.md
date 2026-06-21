# Staffya — Especificación del producto

> Este documento es la fuente de verdad de la **visión, el modelo de dominio y el
> roadmap** de Staffya. Los README de `backend/` y `frontend/` describen el *cómo*
> (arquitectura y puesta en marcha); este describe el *qué* y el *por qué*.

## 1. Visión

**Staffya** es una plataforma estilo **Uber + Tinder** que conecta comercios
gastronómicos y organizadores de eventos con trabajadores eventuales **en tiempo
real**.

> Misión: **cubrir una posición eventual en menos de 10 minutos.**

No es una bolsa de empleo ni un clasificado: es un **sistema operativo de staffing
en tiempo real**, enfocado en velocidad, confianza, reputación y resolución
inmediata de necesidades operativas.

### Principios de producto
1. **Velocidad sobre todo.** Cada pantalla y cada decisión se optimizan para cubrir
   un turno lo más rápido posible.
2. **Confianza y reputación.** El historial (rating, puntualidad, eventos
   completados, cancelaciones) es el activo central de cada trabajador y comercio.
3. **Modo Uber.** Un turno tiene un ciclo de vida en vivo y rastreable, no es un
   simple aviso publicado.
4. **Móvil primero.** La web es la base; la app nativa llega en una fase posterior.
5. **Todo en español** (público de Argentina/LATAM).

## 2. Actores y roles

| Rol           | Quién es                              | Qué hace |
|---------------|---------------------------------------|----------|
| **Trabajador** (`worker`)   | Mozo, bartender, cocinero, etc. | Crea su perfil, aparece como candidato, confirma turnos, hace check-in/out. |
| **Comercio** (`employer`)   | Bar, restaurante, organizador de eventos | Publica turnos, ve candidatos rankeados, asigna, cierra y paga. |
| **Administrador** (`admin`) | Equipo de Staffya               | Moderación, verificación y soporte (panel pendiente). |

## 3. Modelo de dominio

### Entidades principales
- **Usuario** — identidad, credenciales, rol, verificación.
- **PerfilTrabajador** — foto, ciudad, habilidades, idiomas, experiencia,
  geolocalización, métricas (rating, puntualidad, eventos completados,
  cancelaciones), insignias y nivel.
- **PerfilComercio** — logo, rubro, ubicación, capacidad, horarios y métricas
  (rating, eventos publicados, puntualidad de pago).
- **Turno** (`Shift`) — la pieza central. Posición, cantidad, horario, paga,
  ubicación y un **ciclo de vida tipo Uber**.

### Ciclo de vida del Turno ("Modo Uber")

```
BORRADOR
   │ publish
PUBLICADO ──► BUSCANDO_PERSONAL
   │ assign (el comercio elige un candidato del ranking)
ASIGNADO
   │ confirm (worker) ──► CONFIRMADO        │ reject (worker) ──► vuelve a BUSCANDO_PERSONAL
   │ depart (worker)
EN_CAMINO
   │ check-in (worker, con geolocalización)
CHECK_IN
   │ start-working (worker)
TRABAJANDO
   │ check-out (worker, con geolocalización)
CHECK_OUT
   │ finish (employer)
FINALIZADO
   │ mark-paid (employer)
PAGADO

CANCELADO ◄── (alcanzable desde cualquier estado no terminal)
```

Estados terminales: `FINALIZADO`, `PAGADO`, `CANCELADO`.

### Motor de matching
Para un turno publicado, el sistema rankea a los trabajadores elegibles
(disponibles + con la habilidad pedida) combinando:
- **Distancia** (Haversine entre trabajador y turno).
- **Experiencia** (años, con tope).
- **Reputación** (rating).
- **Puntualidad**.
- **Historial de desempeño** (eventos completados vs. cancelaciones).

La **afinidad con el local** (historial previo trabajador↔comercio) queda fuera
hasta que exista suficiente historial de asignaciones (Fase 3+).

## 4. Estado de los módulos

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| `identity`     | ✅ | Registro, login, JWT + refresh tokens, roles. No se permite auto-registrarse como admin. |
| `worker`       | ✅ | Perfil de trabajador completo + métricas. |
| `company`      | ✅ | Perfil de comercio completo + métricas. |
| `shift`        | ✅ | Publicación, feed con filtros y ciclo de vida completo (incluida la **asistencia geolocalizada** check-in/check-out). |
| `matching`     | ✅ | Scoring y top de candidatos por turno, con nombre, foto y rating del candidato. |
| `notification` | ✅ | Notificaciones in-app (asignación, confirmación, rechazo, check-out, pago). |
| `payment`      | ⬜ | Procesar el cobro real. Hoy `mark-paid` sólo registra que el comercio pagó. |
| `chat`         | ⬜ | Mensajería trabajador↔comercio. |
| `ai`           | ⬜ | Asistencia inteligente (recomendaciones, pricing dinámico, antifraude). |

## 5. Roadmap

### Fase 1 — Núcleo ✅ (completa)
- Identidad y roles.
- Perfiles de trabajador y comercio.
- Publicación de turnos y feed.

### Fase 2 — Marketplace en vivo 🚧 (en progreso)
- ✅ Motor de matching y ranking de candidatos.
- ✅ Asignación + confirmación/rechazo.
- ✅ Frontend web (Next.js) con tarjetas, muy visual.
- ✅ Notificaciones in-app.
- ✅ Asistencia geolocalizada (check-in / check-out con ubicación).
- ✅ Despliegue (Render + Vercel) como PWA instalable.
- ⬜ **Chat** trabajador↔comercio.
- ⬜ **Pagos reales** (probable MercadoPago por el contexto Argentina).
- ⬜ **Panel de administración** (moderación, verificación, soporte).

### Fase 3 — Confianza y escala 🔮 (futuro)
- Afinidad con el local en el matching (historial de asignaciones).
- Reputación bidireccional con reseñas.
- Push notifications en tiempo real.
- App móvil nativa (React Native).
- Pricing dinámico y recomendaciones con IA.
- Verificación de identidad y antifraude.

## 6. Stack tecnológico
- **Backend:** FastAPI · Python · SQLAlchemy (async) · Alembic · monolito modular (DDD / hexagonal).
- **Base de datos:** PostgreSQL · PostGIS · Redis.
- **Frontend:** Next.js · React · TypeScript · TailwindCSS (PWA instalable).
- **Mobile (futuro):** React Native.
- **Infra:** Docker · Render (backend) · Vercel (frontend) · Neon · Cloudflare.

## 7. Deuda técnica conocida
- `payment` es un placeholder: `mark-paid` no procesa cobros reales.
- Sin chat ni notificaciones push (sólo in-app con polling).
- Sin panel de administración pese a existir el rol `admin`.
- Algunas advertencias de lint pre-existentes en el frontend (`setState`
  síncrono dentro de `useEffect` en un par de componentes).
