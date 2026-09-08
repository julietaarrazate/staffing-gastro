# EVIDENCIA DE AUTORÍA
## Oído — Sistema de Staffing Gastronómico en Tiempo Real

**Autora:** Julieta Arrazate
**Email:** julietaarrazate@gmail.com
**Repositorio:** staffing-gastro (privado)
**Fecha de relevamiento:** Septiembre 2026

---

## 1. AUTORÍA ÚNICA Y EXCLUSIVA

La totalidad del código fuente de la obra fue desarrollada por **Julieta Arrazate**, quien dirigió, definió y validó cada decisión de producto, arquitectura y diseño técnico del sistema de principio a fin.

## 2. ESTADÍSTICAS DEL REPOSITORIO

| Métrica | Valor |
|---|---|
| Total de commits | 303 |
| Rama principal | `main` |
| Repositorio | Privado (`github.com/julietaarrazate/staffing-gastro`) |
| Primer commit | 21 de junio de 2026 |
| Commit más reciente relevado | 2 de septiembre de 2026 |
| Período de desarrollo activo | Más de 70 días continuos, sin interrupción |

## 3. CRONOLOGÍA DE DESARROLLO

| Fase | Período | Actividad principal |
|---|---|---|
| Fundacional | Junio 2026 | Arquitectura DDD/hexagonal, identidad, perfiles, publicación de turnos ("Fase 1") |
| Motor de matching | Junio 2026 | Scoring multi-factor, asignación y confirmación de turnos |
| Tiempo real | Junio–Julio 2026 | Chat y notificaciones por WebSocket, asistencia geolocalizada |
| Confianza y reputación | Julio 2026 | No-show y cancelación tardía (ADR-0007), insignias y niveles (ADR-0004), verificación de identidad por niveles de garantía |
| Monetización | Julio 2026 | Suscripción mensual del comercio (ADR-0005), integración Mercado Pago |
| Hardening de producción | Julio–Agosto 2026 | Migración de base de datos a Neon, cookie `httpOnly` para el refresh token, accesibilidad (`jsx-a11y`), tests unitarios de frontend |
| Inteligencia artificial | Agosto 2026 | Asistente con Gemini para publicar turnos por texto libre y responder consultas |
| Escalada y eficiencia | Agosto 2026 | Escalada automática de urgencia (ADR-0009), scheduler por deadline dinámico para reducir consumo de cómputo |
| Identidad visual y consistencia | Agosto–Septiembre 2026 | Rediseño integral de marca ("Oído"), sistema de diseño y auditoría sistémica de consistencia visual |

## 4. NATURALEZA ORIGINAL DE LA OBRA

### 4.1 Componentes desarrollados por la autora

Todo el código fuente es original, incluyendo:

- **Motor de matching**: scoring multi-factor (distancia, experiencia, reputación, puntualidad, desempeño) desarrollado específicamente para el sistema.
- **Sistema de verificación de identidad por niveles de garantía (L0–L4)**: agregación de claims verificados en un nivel de confianza, en vez de un booleano.
- **Motor de insignias y niveles de gamificación**: reglas de recálculo sin histéresis a partir de las métricas reales del trabajador.
- **Asistente de IA con contexto acotado por comercio**: interpretación de lenguaje natural para publicar turnos y resolver consultas, con resumen de "lo habitual" calculado por comercio.
- **Scheduler de asistencia y escalada por deadline dinámico**: reemplaza el sondeo periódico fijo por un cálculo de la próxima acción real posible.
- **Modelo de permisos por rol con no-disclosure de recursos ajenos** (404 en vez de 403).
- **Arquitectura DDD/hexagonal en 17 módulos independientes**, con reglas de dependencia y de cruce entre módulos definidas y sostenidas de forma consistente en toda la base de código.

### 4.2 Uso de librerías de terceros

Las librerías utilizadas (FastAPI, SQLAlchemy, Alembic, Next.js, React, TailwindCSS, MapLibre GL, etc.) son dependencias de código abierto estándar en la industria, bajo licencias permisivas (MIT, Apache, BSD). La obra original consiste en la integración, la lógica de negocio y el código propietario construido sobre estas bases.

## 5. EVIDENCIAS ADICIONALES DE AUTORÍA

| Evidencia | Descripción |
|---|---|
| Repositorio privado | El código fuente reside en un repositorio privado de propiedad de la autora |
| 303 commits | Historial de desarrollo continuo, con mensajes descriptivos por cambio |
| 429 tests automatizados (backend) + 75 tests E2E (frontend) | Demuestran dominio completo del sistema y de sus reglas de negocio |
| 11 Architecture Decision Records | Registran y justifican cada decisión técnica no trivial, con fecha y motivo |
| Documentación viva (`docs/`) | Especificación de producto, dominio, arquitectura, seguridad y sistema de diseño, mantenida al día con cada cambio relevante |
| Configuración de despliegue propia | `render.yaml`, configuración de Vercel, migraciones Alembic versionadas |

## 6. DECLARACIÓN DE ORIGINALIDAD

La autora declara que:

1. La totalidad del código fuente fue desarrollada de forma personal y original, bajo su dirección exclusiva.
2. No se utilizó código de terceros sin licencia que lo permita.
3. Las librerías de terceros utilizadas son de código abierto bajo licencias permisivas (MIT, Apache, BSD).
4. El motor de matching, el sistema de verificación por niveles de garantía, el motor de insignias/niveles y el asistente de IA con contexto acotado son creaciones originales.
5. No existen contratos de cesión de derechos en favor de terceros sobre esta obra.

## 7. INFORMACIÓN ADICIONAL — COMPLETADO POR LA AUTORA

**Fecha de inicio del desarrollo:** [COMPLETAR — indicar si hay evidencia de trabajo previo al primer commit del 21 de junio de 2026]

**Evidencia de desarrollo previo:** [COMPLETAR — si existen bocetos, prototipos o especificaciones anteriores al repositorio git]

**Contexto laboral y contractual:** [COMPLETAR — declarar si la obra fue desarrollada de forma independiente, con equipos propios, sin relación de dependencia laboral ni contrato de cesión de derechos con terceros]

---

*Documento generado para expediente de registro de obra de software — Todos los derechos reservados — Julieta Arrazate — 2026*
