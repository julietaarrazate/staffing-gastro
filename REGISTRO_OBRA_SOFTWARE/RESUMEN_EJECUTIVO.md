# RESUMEN EJECUTIVO
## Oído — Marketplace de Staffing Gastronómico en Tiempo Real

**Autora:** Julieta Arrazate
**Fecha:** Septiembre 2026

---

## 1. SÍNTESIS

**Oído** es una plataforma de software que conecta comercios gastronómicos con trabajadores eventuales para cubrir turnos de trabajo puntuales en tiempo real. Reemplaza la búsqueda informal de reemplazos (llamadas, grupos de mensajería, contactos personales) por un sistema con matching automático, ciclo de vida completo del turno con asistencia geolocalizada, reputación real derivada del desempeño y mensajería integrada.

**Misión declarada del producto:** cubrir una posición eventual en menos de 10 minutos.

## 2. PROBLEMA QUE RESUELVE

### Situación sin el sistema

Un comercio gastronómico que necesita cubrir una ausencia de último momento (una falta, un pico de demanda, un evento puntual) depende hoy de:

- **Red de contactos personal** del encargado, sin garantía de disponibilidad ni de habilidad requerida.
- **Falta de trazabilidad**: sin historial verificable de puntualidad, desempeño o confiabilidad del trabajador eventual.
- **Sin mecanismo de confianza mutuo**: ni el comercio conoce la reputación real del trabajador, ni el trabajador conoce la seriedad del comercio.
- **Coordinación manual** por llamadas o mensajería informal, sin seguimiento del ciclo del turno (llegada, inicio, fin, pago).

### Solución aportada por el sistema

| Proceso | Sin el sistema | Con Oído |
|---|---|---|
| Encontrar personal disponible | Red de contactos personal | Feed + matching automático por distancia, habilidad, experiencia y reputación |
| Confiar en el trabajador | Sin historial verificable | Reputación derivada de eventos reales (puntualidad, no-shows, cancelaciones), insignias y niveles |
| Verificar la identidad | Sin mecanismo | Verificación de identidad por niveles de garantía (documento + presencia) |
| Coordinar el turno | Llamadas y mensajes sueltos | Chat en tiempo real por turno + notificaciones automáticas |
| Confirmar la asistencia | Confianza verbal | Asistencia geolocalizada real (check-in/check-out) |
| Publicar un turno rápido | Redactar manualmente | Describirlo en lenguaje natural; un asistente de IA prellena los campos para revisión |

## 3. MERCADO OBJETIVO

- **Comercios gastronómicos**: restaurantes, bares, cafeterías, salones de eventos, catering, empresas gastronómicas, con necesidad recurrente o puntual de personal eventual.
- **Trabajadores eventuales del rubro gastronómico**: mozos, bartenders, baristas, runners, cocineros, cajeros, recepcionistas, personal de eventos, ayudantes de cocina, personal de salón.
- **Idioma y mercado:** español (Argentina / LATAM). En fase de beta cerrada con usuarios reales en Palermo, Ciudad Autónoma de Buenos Aires.

## 4. ALCANCE Y CAPACIDADES

### 4.1 Módulos activos (17)

| Área | Capacidades |
|---|---|
| Identidad y sesión | Registro, login con email o Google, JWT + refresh rotativo seguro, roles |
| Perfiles | Trabajador (habilidades, experiencia, reputación) y comercio (categoría, ubicación, capacidad) |
| Turnos | Publicación (manual o por IA), feed, ciclo de vida completo con asistencia geolocalizada |
| Matching | Ranking de candidatos por scoring multi-factor, búsqueda por mapa |
| Confianza | Verificación de identidad por niveles de garantía, no-show y cancelación tardía con penalización, insignias y niveles de gamificación |
| Comunicación | Chat en tiempo real por turno, notificaciones in-app y push |
| Reseñas | Calificación bidireccional que realimenta la reputación y el matching |
| Monetización | Suscripción mensual del comercio por planes, con integración de pagos construida |
| Inteligencia artificial | Asistente para publicar turnos por texto libre y responder consultas del comercio |
| Administración | Métricas, moderación, cola de verificación de identidad |

## 5. DIFERENCIADORES TÉCNICOS

### 5.1 Motor de matching propio
Scoring multi-factor (distancia, experiencia, reputación, puntualidad, desempeño) que no depende de ningún servicio externo de recomendación, con reglas de neutralidad explícitas para candidatos sin historial suficiente.

### 5.2 Confianza modelada por niveles, no por booleanos
El sistema de verificación de identidad agrega evidencias en un nivel de garantía (L0–L4) en vez de un simple "verificado/no verificado", separando identidad de reputación operativa.

### 5.3 Reputación 100% derivada de eventos reales
Rating, insignias y nivel de gamificación se recalculan siempre a partir del ciclo real del turno — nunca son un contador editable independiente.

### 5.4 Asistente de IA que aprende del patrón de cada comercio
Sin memoria persistente añadida: en cada consulta reconstruye el contexto de "lo habitual" a partir de los turnos que ese comercio ya publicó.

### 5.5 Eficiencia operativa bajo infraestructura serverless
El trabajo en segundo plano (recordatorios, no-show automático, escalada de urgencia) se calcula por deadline dinámica en vez de sondeo fijo, reduciendo el consumo de cómputo de la base de datos serverless en producción.

### 5.6 Degradación elegante ante integraciones opcionales
Cada integración externa (imágenes, email, login social, push, IA, pagos) se autodesactiva sin romper el sistema si falta su credencial — el producto funciona en cualquier subconjunto de sus capacidades opcionales.

## 6. CAPACIDADES TÉCNICAS

| Capacidad | Tecnología |
|---|---|
| API asíncrona | FastAPI (Python 3.11) |
| Base de datos relacional | PostgreSQL (Neon, serverless) |
| Interfaz web reactiva e instalable | Next.js + React + TypeScript, PWA |
| Tiempo real | WebSocket (chat y notificaciones) |
| Mapas | MapLibre GL vectorial + clustering, sin API de pago |
| Inteligencia artificial | Google Gemini (asistente de publicación de turnos) |
| Tests automatizados | 429 (backend) + 75 E2E (frontend) + tests unitarios de frontend |
| Observabilidad | Sentry (opt-in) + logging estructurado |
| Autenticación segura | JWT + refresh token rotativo en cookie `httpOnly` |
| Almacenamiento de imágenes/archivos | Cloudinary (opt-in) |

## 7. ARQUITECTURA DE DESPLIEGUE

```
Usuarios → Frontend (Vercel)
              ↓ HTTPS + WebSocket
         API + WebSocket (Render — backend Python)
              ↓ SQL asíncrono
         PostgreSQL (Neon — cloud serverless)
              ↓ opcionales
   [Gemini IA] [Cloudinary] [Resend] [Sentry] [Mercado Pago] [Google Identity Services]
```

- **Disponibilidad:** despliegue automático desde `main`, con gates de CI obligatorios (tests, tipado, build, E2E, escaneo de secretos, auditoría de dependencias) antes de cualquier despliegue a producción.
- **Seguridad:** HTTPS forzado, headers de seguridad HTTP, rate limiting, refresh token rotativo con detección de reuso.

## 8. ESTADO DE MADUREZ

| Dimensión | Estado |
|---|---|
| Funcionalidades | Completas para la fase de beta cerrada |
| Tests automatizados | 429 backend + 75 E2E + suite unitaria de frontend, todos verdes en CI |
| Documentación técnica | Exhaustiva y viva (`docs/`), con 11 decisiones de arquitectura registradas |
| Producción | Activa, con usuarios reales en beta cerrada |
| Historial de desarrollo | Más de 300 commits desde junio de 2026 |

---

*Documento elaborado para presentación a terceros y registro de propiedad intelectual. Información confidencial. Todos los derechos reservados. Julieta Arrazate — 2026.*
