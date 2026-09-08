# MEMORIA DESCRIPTIVA DE LA OBRA
## Oído — Marketplace de Staffing Gastronómico en Tiempo Real

**Autora:** Julieta Arrazate
**Nombre técnico del repositorio:** staffing-gastro (código interno: Staffya)
**Fecha:** Septiembre 2026

---

## 1. IDENTIFICACIÓN DE LA OBRA

**Nombre de la obra:** Oído

**Naturaleza:** Programa de computación (Ley 11.723, Art. 1 — Decreto 165/94), compuesto por una API backend, una aplicación web progresiva (PWA) y su base de datos relacional.

**Estado:** Obra en producción activa, con usuarios reales en fase de beta cerrada (Palermo, CABA).

## 2. OBJETIVO Y ALCANCE

Oído es un marketplace que conecta **comercios gastronómicos** (restaurantes, bares, cafeterías, salones de eventos, catering) con **trabajadores eventuales** (mozos, bartenders, baristas, runners, cocineros, cajeros, recepcionistas, personal de eventos, ayudantes de cocina, personal de salón) para cubrir turnos de trabajo puntuales.

El modelo de interacción combina dos patrones de producto conocidos, aplicados a un problema operativo real:

- **Ciclo de vida operativo en tiempo real:** un turno publicado por un comercio recorre un ciclo de vida con estados (publicado → buscando personal → asignado → confirmado → en camino → check-in → trabajando → check-out → finalizado → pagado), con asistencia geolocalizada real en cada transición.
- **Postulación por descarte rápido:** el trabajador se postula a turnos abiertos que ve en un feed mediante una interacción de descarte simple (deslizar); el comercio elige entre los postulantes o entre los candidatos que le recomienda el motor de matching propio.

**Misión declarada del producto:** cubrir una posición eventual en menos de 10 minutos.

## 3. DESCRIPCIÓN TÉCNICA RESUMIDA

Arquitectura de 3 capas:

```
FRONTEND WEB (Next.js, PWA instalable)
              ↓ HTTPS + WebSocket
    API REST + WebSocket (FastAPI, monolito modular DDD/hexagonal)
              ↓ SQL asíncrono (asyncpg)
    Base de datos relacional (PostgreSQL — Neon serverless)
```

### Componentes de la obra

#### 1. Backend (API REST + WebSocket — FastAPI + Python 3.11)
- **Ubicación:** `/backend`
- **Responsabilidad:** lógica de negocio completa: identidad y sesiones, perfiles, ciclo de vida del turno, motor de matching, verificación de identidad, chat en tiempo real, notificaciones, reseñas, suscripción del comercio, asistente de IA, administración.
- **Arquitectura interna:** monolito modular con **17 módulos de dominio independientes**, cada uno organizado en 4 capas (DDD + hexagonal): `domain/` (entidades, value objects, puertos de repositorio, sin dependencias de framework), `application/` (casos de uso sobre los puertos), `infrastructure/` (adaptadores SQLAlchemy) y `api/` (rutas HTTP/WebSocket, schemas Pydantic).
- **Contenido:** 17 routers, 14 modelos de datos persistentes, 30 migraciones de base de datos, 429 tests automatizados.
- **Tecnología:** FastAPI 0.141, SQLAlchemy 2.0 (async, asyncpg), Alembic, Pydantic 2.10, Python 3.11.
- **Tamaño:** ~17.800 líneas de código Python (sin entornos virtuales ni caché).

#### 2. Frontend (aplicación web — Next.js + TypeScript, PWA)
- **Ubicación:** `/frontend`
- **Responsabilidad:** interfaz web instalable como Progressive Web App, con las experiencias diferenciadas de trabajador, comercio y administrador.
- **Contenido:** 31 páginas (App Router), 87 componentes, 45 módulos de utilidades/clientes en `lib/`, 14 archivos de tests unitarios, 31 specs E2E (75 tests).
- **Tecnología:** Next.js 16.3 (App Router), React 19.2, TypeScript, TailwindCSS, `framer-motion`, MapLibre GL + `supercluster` (mapas vectoriales con clustering), Lucide (iconografía).
- **Tamaño:** ~21.900 líneas de código TypeScript/TSX.
- **Despliegue real:** Vercel, con auto-deploy desde `main` y previews por PR (https://staffing-gastro.vercel.app).

#### 3. Base de datos (migraciones — Alembic)
- **Ubicación:** `/backend/alembic/versions`
- **Responsabilidad:** schema de base de datos relacional versionado.
- **Contenido:** 30 migraciones que definen 14 tablas principales.
- **Tecnología:** Alembic sobre SQLAlchemy declarativo; PostgreSQL (Neon, serverless) en producción, SQLite en memoria para tests.

#### 4. Documentación de arquitectura y decisiones (ADRs)
- **Ubicación:** `/docs`
- **Contenido:** 11 Architecture Decision Records que registran y justifican cada decisión técnica no trivial (motor de mapas, sesiones revocables, cancelación con insignias, pagos y antidesintermediación, alta de local desde el mapa, no-show y cancelación tardía, asistencia simplificada, escalada automática de urgencia, modelo de confianza en 4 dominios, sistema tipográfico/cromático), más la documentación viva de producto, dominio, arquitectura y seguridad.

---

## 4. FLUJO DE FUNCIONAMIENTO

1. El comercio o el trabajador acceden a la aplicación web (instalable como PWA).
2. El frontend se comunica con el backend por API REST (HTTPS) y, para chat y notificaciones, por WebSocket.
3. El backend resuelve el caso de uso en la capa `application/` de cada módulo, apoyado en los puertos de dominio.
4. El backend persiste y consulta datos en PostgreSQL (Neon) a través de los repositorios concretos de `infrastructure/`.
5. Un proceso de fondo (`asyncio`, dentro del mismo proceso FastAPI, sin cola ni worker separado) recalcula deadlines de asistencia y escalada de urgencia y despierta exactamente cuando hace falta actuar, no por sondeo fijo.
6. El frontend renderiza la respuesta y refleja en tiempo real los eventos de chat y notificaciones recibidos por WebSocket.

---

## 5. ORIGINALIDAD Y COMPONENTES CLAVE

### Algoritmos y sistemas originales implementados

1. **Motor de matching con scoring multi-factor** — combina distancia (fórmula de Haversine), experiencia, reputación, puntualidad e historial de desempeño (penalizando el no-show el doble que una cancelación avisada) en un score único que ordena candidatos por turno.
2. **Sistema de verificación de identidad por niveles de garantía (L0–L4)** — agrega múltiples evidencias (email verificado, teléfono verificado, documento verificado, selfie/prueba de vida, verificación contra fuente autoritativa) en un nivel de confianza, en vez de un booleano "verificado sí/no".
3. **Motor de insignias y niveles de gamificación** — reglas puras que recalculan desde cero, ante cada evento relevante, las insignias (`nunca_falto`, `top_mozo`, `top_bartender`, `eventos_premium`) y el nivel (bronce/plata/oro/platino) de cada trabajador, sin histéresis: las métricas actuales son siempre la única fuente de verdad.
4. **Asistente de IA con contexto acotado por comercio** — interpreta texto libre para prellenar la publicación de un turno y resuelve consultas en lenguaje natural sobre los turnos propios de cada comercio, construyendo un resumen de "lo habitual" a partir del propio historial de turnos publicados, sin memoria persistente añadida ni contradecir lo que el texto del usuario indica explícitamente.
5. **Scheduler de asistencia y escalada por deadline dinámico** — en vez de sondear la base de datos a intervalo fijo, calcula la próxima acción real posible (recordatorio de check-in, no-show automático, escalada de urgencia) y duerme exactamente hasta ese instante, con un evento (`asyncio.Event`) que lo despierta antes si se crea una deadline más próxima.
6. **Modelo de permisos por rol + capa `api/` de no-disclosure** — un recurso ajeno o inexistente responde siempre 404 (nunca 403), para no confirmar por el código de estado que el recurso existe.

### Características diferenciales

- Ciclo de vida del turno con 11 estados y asistencia geolocalizada real en check-in/check-out.
- No-show automático y cancelación tardía con penalización, distinguidos explícitamente en las reglas de reputación (ADR-0007).
- Refresh token en cookie `httpOnly` con rotación y detección de reuso (nunca en `localStorage` ni en el cuerpo de la respuesta).
- Idempotencia explícita (`Idempotency-Key`) en las mutaciones críticas del ciclo del turno.
- Suscripción mensual del comercio con gating de capacidad de publicación, construida completa mas con el enforcement apagado por decisión de producto durante la beta.
- Asistente de IA (Gemini) para completar la publicación de un turno a partir de una descripción en lenguaje natural, sin publicar nunca sin confirmación explícita del comercio.
- Todas las integraciones externas (Cloudinary, Resend, Google Identity Services, Web Push/VAPID, Sentry, Gemini, Mercado Pago) se autodesactivan sin romper el resto del sistema si falta su credencial.
- PWA instalable con soporte de "safe area" para dispositivos con notch.

---

## 6. CONCLUSIÓN

La obra presentable es la **totalidad del código fuente del sistema** (backend y frontend web), junto con sus migraciones de base de datos, su suite de tests automatizados y su documentación de arquitectura y decisiones (ADRs).

El sistema está **completo, testado y en funcionamiento en producción**, en fase de beta cerrada con usuarios reales.
