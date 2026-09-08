# DOCUMENTACIÓN TÉCNICA
## Oído — Arquitectura, seguridad, tiempo real e integraciones

**Autora:** Julieta Arrazate
**Fecha:** Septiembre 2026

---

## 1. ARQUITECTURA GENERAL

Backend: **monolito modular** compuesto por **17 módulos de dominio independientes**, cada uno con arquitectura hexagonal / DDD en 4 capas:

```
modules/<modulo>/
├── domain/           # Entidades, value objects, PUERTOS (repositorios como abc.ABC), excepciones
├── application/      # Casos de uso (servicios) y DTOs — no conoce HTTP ni SQL
├── infrastructure/   # Adaptadores: modelos ORM (SQLAlchemy) y repos concretos
└── api/              # Rutas HTTP/WS, schemas Pydantic y dependencias de FastAPI
```

**Regla de dependencia:** `domain` no depende de nadie; `application` depende sólo de `domain`; `infrastructure` y `api` implementan/consumen hacia adentro. Las dependencias siempre apuntan al dominio.

**Cruce entre módulos:** cuando un caso de uso necesita datos de otro módulo, se inyecta el **puerto/repositorio** de ese otro módulo por constructor — nunca se acopla un dominio a la implementación interna de otro. Ejemplo: `ShiftService` recibe `CompanyProfileRepository`, `WorkerProfileRepository`, `NotificationRepository` y `CandidateRepository` como dependencias.

**No-disclosure:** un recurso ajeno o inexistente responde siempre `404` (nunca `403`), para no confirmar por el código de estado que el recurso existe.

## 2. FLUJO DE UNA REQUEST TÍPICA

```
Cliente (Next.js) ──HTTP/JSON──▶ api/ (router FastAPI + schema Pydantic)
                                   │ (Depends → arma el servicio con repos concretos)
                                   ▼
                              application/ (caso de uso)
                                   │ (usa los puertos del domain/)
                                   ▼
                         infrastructure/ (repositorio SQLAlchemy) ──▶ PostgreSQL (Neon)
```

La respuesta vuelve como schema Pydantic; las excepciones de dominio se mapean a códigos HTTP en la capa `api/`.

## 3. TIEMPO REAL (WEBSOCKETS)

Dos canales, además del REST:

- **Chat:** `WS /api/v1/chats/{shift_id}/ws` — mensajes del turno en vivo entre el comercio y el trabajador asignado.
- **Notificaciones:** `WS /api/v1/notifications/ws` — avisos del usuario en vivo.

El `ConnectionManager` (`app/core/ws_manager.py`) vive en memoria del proceso, con tope de conexiones concurrentes por turno/usuario y límite de 120 frames por minuto por conexión para evitar abuso. El frontend reconecta con backoff exponencial.

## 4. TRABAJO EN SEGUNDO PLANO (SCHEDULER)

No hay cola ni worker separado: un loop `asyncio` arrancado en el `lifespan` de FastAPI cubre dos responsabilidades:

1. **Asistencia:** recordatorio de check-in y no-show automático sobre turnos confirmados o en camino.
2. **Escalada de urgencia:** sube la prioridad y amplía el aviso de un turno abierto que no se cubre rápido (retardo de escalada fijado deliberadamente por debajo de los 10 minutos de la misión del producto).

El loop **despierta por deadline, no por reloj fijo**: en cada pasada calcula cuándo es la próxima acción real posible y duerme exactamente hasta ese instante (con piso de 30 segundos y techo de 6 horas de latido de seguridad), en vez de sondear la base de datos a intervalo fijo. Un evento compartido (`asyncio.Event`) lo despierta antes de tiempo cuando una acción de negocio (publicar un turno, confirmar una asignación) crea una deadline nueva más próxima que la calculada.

## 5. SEGURIDAD

- **Autenticación:** JWT de acceso (15 minutos, `localStorage`) + refresh token (30 días) en **cookie `httpOnly`** — nunca en `localStorage` ni en el cuerpo de la respuesta. En producción, la cookie sale con `Secure` + `SameSite=None`.
- **Rotación y detección de reuso:** cada refresh emite un token nuevo e invalida el anterior; el reuso de un refresh token ya consumido dispara la revocación de la sesión completa.
- **Logout server-side:** revoca la sesión en base de datos, no sólo en el cliente.
- **Rate limiting** en memoria de proceso: 10 intentos por minuto en login, 5 por minuto en registro, 120 frames por minuto por conexión WebSocket.
- **Headers de seguridad:** HSTS, Content-Security-Policy, X-Frame-Options, Referrer-Policy, Permissions-Policy.
- **Idempotencia** (`Idempotency-Key`) en las mutaciones críticas del ciclo de vida del turno, para tolerar reintentos de red sin duplicar efectos.
- **No auto-registro como admin:** el primer administrador se promueve exclusivamente por la variable de entorno `ADMIN_EMAILS` al arrancar el sistema (`app/modules/admin/bootstrap.py`).
- **Secret scanning** en CI (gitleaks + GitGuardian) y auditoría de dependencias (`pip-audit`, `npm audit`) en cada PR.

## 6. MODELO DE PERMISOS

Autorización por **rol** (`worker` | `employer` | `admin`), resuelto en `identity`, combinada con reglas de pertenencia por recurso (por ejemplo, un turno sólo es editable/cancelable por el comercio dueño) verificadas en la capa `application/` de cada módulo, y con la regla de no-disclosure de la capa `api/` como último resguardo.

## 7. VERIFICACIÓN DE IDENTIDAD

El módulo `verification` modela la confianza en la identidad de un sujeto como un **nivel de garantía L0–L4**, agregado a partir de sus *claims* verificados (no como un booleano):

- **L0:** sin evidencia verificada.
- **L1:** canal de contacto verificado (email o teléfono).
- **L2:** documento de identidad verificado.
- **L3:** presencia acreditada (selfie verificada o prueba de vida).
- **L4:** verificación contra una fuente autoritativa (por ejemplo RENAPER o un proveedor de KYC).

El resultado visible para un comercio ("Identidad verificada") corresponde a L2 o superior; los niveles y las evidencias subyacentes nunca se exponen al comercio, sólo el resultado agregado.

## 8. MOTOR DE MATCHING

Ver detalle algorítmico completo en `ACTIVOS_PI.md`. En síntesis: combina distancia (Haversine), experiencia, reputación, puntualidad e historial de desempeño en un score ponderado por turno, filtrando primero por elegibilidad (disponibilidad + habilidad requerida) y ordenando de mayor a menor score.

## 9. ASISTENTE DE INTELIGENCIA ARTIFICIAL

Integración con Google Gemini (modelo configurable por variable de entorno, nunca fijado a un alias `-latest`, para evitar un hot-swap de modelo sin control del despliegue). Dos capacidades:

- **Publicación de turnos por texto libre:** el comercio describe el turno en lenguaje natural ("necesito un mozo el sábado a la noche, se paga 45000") y el asistente prellena puesto/horario/pago — nunca publica sin que el comercio revise y confirme.
- **Consultas en lenguaje natural sobre los propios turnos:** resumen de turnos de hoy/urgentes/sin cubrir, búsqueda del turno relevante para ver sus postulantes, búsqueda de un postulante por nombre.

Sin `GEMINI_API_KEY`, los endpoints de IA responden `503` explícito (nunca fallan en silencio).

## 10. INTEGRACIONES EXTERNAS

| Servicio | Uso | Comportamiento sin credencial |
|---|---|---|
| Cloudinary | Foto de perfil/logo, subida firmada de CV | Deshabilitado |
| Resend | Email transaccional (plantillas HTML de marca) | `NullEmailSender`: sólo loguea, no falla |
| Google Identity Services | Login con Google (ID token, sin client secret) | Botón de Google no disponible |
| Web Push / VAPID | Notificaciones push | Deshabilitado |
| Sentry | Error tracking backend + frontend | Deshabilitado |
| Google Gemini | Asistente de IA para publicar turnos | `503` explícito en los endpoints de IA |
| Mercado Pago | Suscripción recurrente del comercio | Gateway simulado (`fake_billing_gateway`), enforcement apagado |
| Nominatim / OpenStreetMap | Geocoding para alta de local con pin arrastrable | Sin key, siempre disponible |

## 11. BASE DE DATOS Y POOL DE CONEXIONES

Connection string **directa** a Neon (sin sufijo `-pooler`, porque el pooler en modo transacción exige `statement_cache_size=0` con asyncpg, no configurado). `pool_size=1`, `max_overflow=10`, `pool_pre_ping=True`, `pool_recycle=280` — dimensionado deliberadamente bajo porque el plan free de Neon suspende el cómputo (y deja de consumir cuota) sólo con cero conexiones activas.

## 12. DEPLOY

- **Backend:** contenedor Docker en Render. El comando de arranque corre `alembic upgrade head` → seed demo idempotente (si está habilitado) → `uvicorn`. Auto-deploy desde `main`, sin entorno de staging.
- **Frontend:** Vercel, auto-deploy desde `main`, previews por PR.
- **Base de datos:** Neon (Postgres serverless, `aws-us-east-2`).

## 13. CI/CD Y CALIDAD

GitHub Actions, con detección de cambios por área (backend/frontend no corren si esa carpeta no cambió). Gates obligatorios en cada PR y push a `main`:

- `pytest -q` (backend): 429 tests.
- `tsc --noEmit` + `npm run build` (frontend).
- Playwright (E2E, API mockeada): 31 specs, 75 tests.
- Secret scanning (gitleaks + GitGuardian).
- Auditoría de dependencias (`pip-audit`, `npm audit`).

Nada entra a `main` — que despliega automáticamente a Render/Vercel — sin pasar por estos gates.

## 14. ESCALABILIDAD — LÍMITE CONOCIDO Y DECLARADO

El rate limiting, el `ConnectionManager` de WebSocket y el scheduler viven en memoria de un único proceso. Con un solo worker Uvicorn (configuración actual) esto es correcto y suficiente; escalar a 2+ workers requeriría migrar estos tres subsistemas a un store compartido (Redis), no implementado y sin ADR escrito — documentado como límite conocido, no como carencia oculta.

---

*Documento elaborado para expediente de registro de obra de software — Julieta Arrazate — Septiembre 2026*
