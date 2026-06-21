# Staffya

**Staffya** es una plataforma estilo **Uber + Tinder** que conecta comercios
gastronómicos y organizadores de eventos con trabajadores eventuales en tiempo real.

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
- ⬜ Chat.
- ⬜ Pagos reales (hoy `mark-paid` sólo registra que el comercio pagó, no procesa el cobro).
- ✅ Despliegue (Render + Vercel).

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
- **Base de datos:** PostgreSQL · PostGIS · Redis
- **Frontend:** Next.js · React · TypeScript · TailwindCSS
- **Mobile (futuro):** React Native
- **Infra:** Docker · Render · Neon · Cloudflare
