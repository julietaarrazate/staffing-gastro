# IDENTIFICACIÓN DE LA OBRA PRESENTABLE
## Oído — Marketplace de Staffing Gastronómico en Tiempo Real

**Autora:** Julieta Arrazate
**Fecha:** Septiembre 2026

---

## LA OBRA INFORMÁTICA

Oído es una **aplicación web** (Progressive Web App instalable) para conectar comercios gastronómicos con trabajadores eventuales, con backend de API en tiempo real.

### Componentes de la obra

#### 1. BACKEND (API REST + WebSocket — FastAPI + Python 3.11)
- **Ubicación:** `/backend`
- **Responsabilidad:** lógica de negocio completa: identidad, perfiles, ciclo de vida del turno, motor de matching, verificación de identidad, chat, notificaciones, reseñas, suscripción, asistente de IA, administración.
- **Contenido:** 17 routers, 14 modelos, 30 migraciones, 429 tests.
- **Tecnología:** FastAPI, SQLAlchemy (async), Alembic, Pydantic, Python 3.11.
- **Tamaño:** ~17.800 líneas de código (sin entornos virtuales ni caché).

#### 2. FRONTEND (aplicación web — Next.js + TypeScript, PWA)
- **Ubicación:** `/frontend`
- **Responsabilidad:** interfaz web instalable, con experiencias diferenciadas para trabajador, comercio y administrador.
- **Contenido:** 31 páginas, 87 componentes, 45 módulos de utilidades, 75 tests E2E.
- **Tecnología:** Next.js, React, TypeScript, TailwindCSS, MapLibre GL.
- **Tamaño:** ~21.900 líneas de código.
- **Despliegue real:** Vercel (https://staffing-gastro.vercel.app).

#### 3. Base de datos (migraciones — Alembic)
- **Ubicación:** `/backend/alembic/versions`
- **Responsabilidad:** schema de base de datos relacional versionado.
- **Contenido:** 30 migraciones que definen 14 tablas principales.
- **Tecnología:** Alembic + SQLAlchemy declarativo; PostgreSQL (Neon) en producción.

#### 4. Documentación de arquitectura y decisiones
- **Ubicación:** `/docs`
- **Contenido:** documentación viva de producto, dominio, arquitectura, diseño y seguridad, más 11 Architecture Decision Records.

---

## DESCRIPCIÓN TÉCNICA RESUMIDA

**Arquitectura de 3 capas:**

```
FRONTEND WEB (PWA)
        ↓
   API REST + WebSocket (FastAPI, monolito modular DDD/hexagonal en 17 módulos)
        ↓
   Base de datos relacional (PostgreSQL — Neon)
```

**Flujo de funcionamiento:**

1. El usuario accede a la aplicación web (instalable como PWA).
2. El frontend comunica con el backend por API REST (HTTPS) y WebSocket (chat/notificaciones).
3. El backend procesa el caso de uso en la capa de aplicación de cada módulo.
4. El backend persiste datos en PostgreSQL (Neon).
5. El frontend renderiza la respuesta y refleja eventos en tiempo real.

---

## ORIGINALIDAD Y COMPONENTES CLAVE

### Algoritmos originales implementados

1. **Motor de matching** — scoring multi-factor con distancia, experiencia, reputación, puntualidad y desempeño.
2. **Sistema de verificación de identidad por niveles de garantía (L0–L4)** — agregación de evidencias, no un booleano.
3. **Motor de insignias y niveles de gamificación** — recálculo sin histéresis a partir de métricas reales.
4. **Asistente de IA con contexto acotado por comercio** — para publicar turnos por texto libre y resolver consultas.
5. **Scheduler de asistencia y escalada por deadline dinámico** — sin sondeo fijo de base de datos.

### Características diferenciales

- Ciclo de vida del turno con 11 estados y asistencia geolocalizada real.
- No-show automático y cancelación tardía, distinguidos y penalizados de forma diferenciada.
- Refresh token en cookie `httpOnly` con rotación y detección de reuso.
- Idempotencia explícita en mutaciones críticas del ciclo del turno.
- Suscripción mensual del comercio, construida completa (enforcement apagado en la beta por decisión de producto).
- Todas las integraciones externas se autodesactivan sin romper el sistema si falta su credencial.
- PWA instalable con soporte de "safe area" para notch.

---

## CONCLUSIÓN

La obra presentable es la **totalidad del código fuente del sistema** (backend y frontend web), junto con sus configuraciones, migraciones de base de datos, tests y documentación de arquitectura.

El sistema está **completo, testado y en funcionamiento en producción**, en fase de beta cerrada con usuarios reales.
