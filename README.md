# Staffya (marca de cara al usuario: "Oído")

**Staffya** — de cara al usuario, marca **"Oído"** — es una plataforma estilo
**Uber + Tinder** que conecta comercios gastronómicos y organizadores de
eventos con trabajadores eventuales en tiempo real. El repositorio, la base
de datos y la infraestructura siguen con el nombre técnico `staffya`
(intencional — ver [`CLAUDE.md`](./CLAUDE.md)); el producto que ve el
usuario se llama **Oído** desde el rebrand.

> Misión: **cubrir una posición eventual en menos de 10 minutos.**

No es una bolsa de empleo: es un sistema operativo de staffing en tiempo real,
enfocado en velocidad, confianza, reputación y resolución inmediata de necesidades
operativas. La visión completa del producto está en [`CLAUDE.md`](./CLAUDE.md).

## Estructura del repositorio

```
.
├── backend/          # API FastAPI (monolito modular, DDD / hexagonal)
├── frontend/         # App web Next.js (login, perfiles, turnos, candidatos)
├── docker-compose.yml
└── CLAUDE.md         # Especificación del producto
```

> La app mobile (React Native) se incorporará en una fase posterior del roadmap.

## Estado actual

**Fase 1 — Completa** ✅:
- ✅ `identity`: registro, login, JWT + refresh tokens, roles.
- ✅ `worker` / `company`: Perfiles de Trabajador y Comercio.
- ✅ `shift`: Publicación de turnos (estados del "Modo Uber" + feed).

**Fase 2 — En progreso** 🚧:
- ✅ `matching`: motor de scoring (distancia, experiencia, reputación, puntualidad,
  historial de desempeño) y top de candidatos recomendados por turno.
- ✅ Asignación de turnos: el comercio asigna un candidato, el trabajador confirma
  o rechaza (`asignado` → `confirmado` / vuelve a `buscando_personal`).
- ✅ Frontend web (Next.js): login/registro, perfiles, feed de turnos con tarjetas,
  publicación de turnos, vista de candidatos y asignación, panel del trabajador
  para confirmar/rechazar turnos asignados.
- ✅ Notificaciones in-app: asignación, confirmación, rechazo, check-out y pago de turnos.
- ✅ Asistencia geolocalizada: en_camino → check-in (con ubicación) → trabajando →
  check-out (con ubicación) → finalizado → pagado.
- ✅ Chat trabajador↔comercio por turno (inbox + conversación con burbujas).
- ✅ Suscripción mensual del comercio (planes, gating de publicación).
- ✅ PWA instalable + notificaciones push (Web Push/VAPID).
- ✅ Acceso con Google (Google Identity Services) además de email+contraseña.
- ✅ Fotos de perfil/logo vía Cloudinary.
- ✅ Observabilidad: logging estructurado + Sentry (ambos opcionales por env var).
- ⬜ Pagos reales del turno comercio→trabajador (hoy `mark-paid` sólo registra
  que el comercio pagó, no procesa el cobro; existe integración con Mercado
  Pago para la suscripción mensual, Fase 1 de ADR-0005).
- ✅ Despliegue (Render + Vercel + Neon), con CI en GitHub Actions.

Ver el roadmap completo en [`CLAUDE.md`](./CLAUDE.md).

## Arranque rápido

```bash
docker compose up --build
```

Backend disponible en `http://localhost:8000` · docs en `http://localhost:8000/docs`.

Para desarrollo local del backend ver [`backend/README.md`](./backend/README.md).
Para desarrollo local del frontend ver [`frontend/README.md`](./frontend/README.md)
(requiere el backend corriendo en `http://localhost:8000`).

## Stack tecnológico

- **Backend:** FastAPI · Python · SQLAlchemy (async) · Alembic
- **Base de datos:** PostgreSQL — **Neon** (serverless) en producción
- **Frontend:** Next.js · React · TypeScript · TailwindCSS · PWA · MapLibre GL (mapas)
- **Integraciones opcionales** (no-op sin su credencial): Sentry (observabilidad),
  Cloudinary (imágenes), Mercado Pago (suscripción), Google Identity Services
  (login), Web Push/VAPID (notificaciones), Resend (email transaccional)
- **Mobile (futuro):** React Native
- **Infra:** Docker · Render · Vercel · Neon · GitHub Actions (CI) · Cloudflare (dominio propio, futuro)

> `docker-compose.yml` incluye imágenes de Redis y PostGIS para desarrollo
> local, pero **el código no las usa hoy** (rate limiting en memoria, sin
> geoconsultas espaciales) — quedan como infraestructura prevista, no
> adoptada; ver `docs/audits/2026-08-oido/01_INVENTORY.md` para el detalle.
