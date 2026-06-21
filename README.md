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
├── docker-compose.yml
└── CLAUDE.md         # Especificación del producto
```

> El frontend (Next.js) y la app mobile (React Native) se incorporarán en fases
> posteriores del roadmap.

## Estado actual

**Fase 1 — Autenticación** (en progreso):
- ✅ `identity-service`: registro, login, JWT + refresh tokens, roles.
- ⏳ Perfiles (Trabajador / Comercio).
- ⏳ Publicación de turnos.

Ver el roadmap completo en [`CLAUDE.md`](./CLAUDE.md).

## Arranque rápido

```bash
docker compose up --build
```

Backend disponible en `http://localhost:8000` · docs en `http://localhost:8000/docs`.

Para desarrollo local del backend ver [`backend/README.md`](./backend/README.md).

## Stack tecnológico

- **Backend:** FastAPI · Python · SQLAlchemy (async) · Alembic
- **Base de datos:** PostgreSQL · PostGIS · Redis
- **Frontend (futuro):** Next.js · React · TypeScript · TailwindCSS
- **Mobile (futuro):** React Native
- **Infra:** Docker · Render · Neon · Cloudflare
