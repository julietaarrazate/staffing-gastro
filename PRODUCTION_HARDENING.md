# PRODUCTION_HARDENING.md — Resumen ejecutivo

> Encargado por Julieta Arrazate como cierre de la auditoría técnica: preparar
> Staffya para producción con usuarios reales, sin tocar comportamiento
> funcional, arquitectura ni contratos de API salvo donde se pidió
> explícitamente (verificación de email). Detalle completo por fase en
> [SECURITY_CHANGES.md](./SECURITY_CHANGES.md),
> [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md) e
> [INFRASTRUCTURE_REPORT.md](./INFRASTRUCTURE_REPORT.md); análisis de
> `<img>`→`next/image` (sin implementar) en
> [NEXT_IMAGE_ANALYSIS.md](./NEXT_IMAGE_ANALYSIS.md).

## Resumen ejecutivo

Se ejecutaron tres fases (seguridad, performance, infraestructura) sobre un
producto que la propia auditoría técnica previa (`docs/audits/2026-08-oido/`)
había calificado como **listo para beta cerrada con usuarios reales**. El
objetivo de esta fase no fue encontrar problemas nuevos — fue cerrar las
brechas de bajo riesgo/alto valor que la auditoría ya había identificado
(rate limiting incompleto, sin logging de seguridad, `/admin/stats` con
N+1-en-Python, servicios de infraestructura fantasma en `docker-compose.yml`)
y sumar una feature de cuenta pedida explícitamente (verificación de email).
Todos los cambios son **aditivos o restrictivos**: agregan un límite, cierran
una puerta abierta, agregan visibilidad, o mueven trabajo de Python a SQL —
ninguno relaja una regla existente ni rompe un contrato de API ya consumido
por el frontend.

**Estado de la suite tras los cambios:** `pytest -q` → **270 passed**
(incluye 9 tests nuevos de verificación de email, 4 de tope de conexiones WS,
y 6 tests preexistentes corregidos por una regresión real detectada durante
el desarrollo — ver §"Regresión detectada" en SECURITY_CHANGES.md §5).
`npx tsc --noEmit` limpio. `npm run build` exitoso (26 rutas, incluida
`/verificar-email` nueva).

## Cambios por fase

- **Seguridad** (detalle en SECURITY_CHANGES.md): docs de API cerradas en
  producción, rate limiting en `/auth/refresh` + chat + reenvío de
  verificación, tope de 8 conexiones WebSocket concurrentes por
  turno/usuario, logging de eventos de seguridad (login fallido, reuso de
  refresh token, 403 por permisos, acciones de admin, 429), y la feature
  nueva de verificación de email (token de un solo uso, 48h, sin gating de
  login).
- **Performance** (detalle en PERFORMANCE_REPORT.md): `/admin/stats` de
  Python-en-memoria a una query SQL agregada, dos índices compuestos nuevos
  (notificaciones no leídas, postulaciones pendientes por turno), tres CHECK
  constraints de integridad en `shifts` (red de seguridad, no afectan el
  camino feliz), compresión GZip de respuestas >1KB. El análisis de
  `next/image` quedó como documento aparte, sin migrar componentes.
- **Infraestructura** (detalle en INFRASTRUCTURE_REPORT.md): `redis` y
  `postgis/postgis` sacados de `docker-compose.yml` tras confirmar cero uso
  real en el código, advertencia de `SEED_DEMO_DATA` en producción (sin
  apagarlo — ver riesgos pendientes), y corrección de `backend/README.md`
  que documentaba una arquitectura (PostGIS, Redis) que nunca se usó.

## Riesgos mitigados en esta fase

- Superficie de reconocimiento de la API (`/docs`/`/redoc`/`/openapi.json`
  públicos) — cerrada en producción.
- Asimetría de rate limiting entre endpoints del mismo módulo (`login`/
  `register` protegidos, `refresh`/chat/reenvío de verificación sin límite) —
  cerrada.
- WebSockets sin ningún tope de conexiones concurrentes (vector de
  agotamiento de memoria con credenciales válidas) — acotado a 8 por
  turno/usuario.
- Ausencia total de trazabilidad de eventos de seguridad (no había forma de
  investigar un incidente después del hecho) — logging agregado en los
  puntos de mayor sensibilidad.
- Cuentas creadas con email+contraseña sin ninguna confirmación de propiedad
  del email — verificación de email implementada (sin bloquear login, por
  decisión explícita de alcance).
- `/admin/stats` con costo O(usuarios totales) en cada carga del panel —
  ahora una query agregada.
- `docker-compose.yml` y `backend/README.md` describiendo una arquitectura
  (PostGIS, Redis) que el código nunca usó — corregido, coherencia
  doc↔código restaurada.

## Riesgos pendientes (deferidos, con motivo)

Estos ítems **se evaluaron y se decidió no tocarlos en esta fase** — quedan
documentados acá para que la razón de no haberlos resuelto no se pierda ni se
confunda con un olvido.

- **Refresh token en `localStorage`, no en cookie `httpOnly`** (`docs/TECH_DEBT.md`
  S1, `docs/audits/2026-08-oido/03_SECURITY.md` §3). Es deuda consciente
  desde antes de esta fase, no algo que se descubrió ahora. **Por qué no se
  resuelve acá:** es un cambio de **arquitectura de autenticación**, no un
  ajuste — mover el refresh token a cookie exige (a) reconfigurar CORS
  `allow_credentials` cross-origin entre Vercel y Render, (b) sumar
  protección CSRF (hoy no aplica: la API se autentica 100% por header
  `Authorization`, nunca por cookie, así que CSRF no es un vector viable tal
  como está construida — cambiaría el día que se migre esto), y (c) tocar
  tanto `frontend/lib/auth-context.tsx` como el flujo completo de
  login/refresh/logout del backend. Es exactamente el tipo de cambio que la
  consigna de esta fase pedía frenar y confirmar antes de implementar. Mitigado
  parcialmente por la CSP ya existente (reduce el radio de un XSS, que es el
  vector que explotaría este token).
- **CSP sin nonces** (`script-src` con `'unsafe-inline'`,
  `frontend/next.config.ts`). Next.js inyecta bootstrap inline; nonces reales
  requerirían middleware propio de generación de nonce por request. Ya
  documentado como decisión consciente en `docs/audits/2026-08-oido/03_SECURITY.md`
  §4 ("razonable para el stack actual"), no se re-abre acá sin una razón
  nueva para hacerlo.
- **CORS `allow_credentials=True` sin usar cookies** — vestigial (auth 100%
  por header Bearer), severidad 🟢 Bajo, no explotable con el `allow_origins`
  actual (explícito, nunca `"*"`). Se deja para el día que se toque
  `main.py` por otro motivo relacionado a CORS, no amerita un cambio aislado.
- **`SEED_DEMO_DATA` no se apagó automáticamente.** Se agregó la alerta de
  logging (ver SECURITY_CHANGES.md/INFRASTRUCTURE_REPORT.md), pero apagar el
  seed es una decisión operativa de Julieta (elegir el momento del corte con
  datos reales ya en la base), no algo que el código deba decidir por su
  cuenta — está listado como pendiente de la operadora en `CLAUDE.md`.
- **Unit of Work / commit por caso de uso en vez de por repositorio**
  (`docs/audits/2026-08-oido/05_DATABASE.md` §5, `04_PERFORMANCE.md`,
  ejemplo concreto en `ShiftService.assign_worker`). Es un refactor
  transversal de la capa de aplicación (cambia cómo se maneja la transacción
  en **todos** los casos de uso multi-repositorio, no en uno puntual) — la
  consigna de esta fase excluía explícitamente refactors de arquitectura.
  Queda para una fase dedicada, con su propio ADR si corresponde.
- **Sin SWR/React Query en el frontend** (`docs/audits/2026-08-oido/04_PERFORMANCE.md`).
  Adoptar una librería de data-fetching es un cambio transversal a todas las
  pantallas que hacen `fetch`, no algo que se sume incrementalmente sin
  tocar cada pantalla — fuera del alcance de "sin refactors" de esta fase.

## Impacto

- **Seguridad:** cierre de brechas de bajo esfuerzo/alto valor ya priorizadas
  por la auditoría; visibilidad nueva para investigar incidentes; feature de
  verificación de email operativa end-to-end.
- **Performance:** mejoras preventivas (índices, query agregada) que no se
  notan hoy con el volumen de la beta, pero evitan que el panel de admin y
  los listados más consultados se degraden silenciosamente al crecer.
- **Infraestructura:** `docker compose up` local más liviano y honesto sobre
  qué corre de verdad; documentación alineada con la arquitectura real.
- **Cero regresiones funcionales** verificadas con la suite completa — la
  única regresión real detectada (6 tests que asumían un solo email
  capturado por test tras el registro) se originó y se corrigió dentro de
  esta misma fase, antes de considerar el trabajo terminado.

## Checklist de producción

- [x] `pytest -q` verde (270 passed).
- [x] `npx tsc --noEmit` sin errores.
- [x] `npm run build` exitoso, incluida la ruta nueva `/verificar-email`.
- [x] Migraciones Alembic nuevas (`0022`, `0023`) con `upgrade`/`downgrade`
      simétricos, usando `batch_alter_table` para compatibilidad SQLite/tests.
- [x] Sin credenciales ni secretos nuevos en el repo — todo lo agregado
      (rate limiters, logging, CHECK constraints) usa configuración existente.
- [x] `docs/reference/SECURITY.md` actualizado con la feature de verificación
      de email.
- [ ] **Pendiente de Julieta** (no bloquea este PR, ya listado en
      `CLAUDE.md` "Pendiente de la operadora"): aplicar las migraciones
      `0022`/`0023` contra Neon en producción (`alembic upgrade head` con
      `DATABASE_URL` de Neon), y decidir el momento de apagar
      `SEED_DEMO_DATA` antes de onboardear comercios reales.
- [ ] **Fuera de alcance, documentado como deferido** (ver sección de
      riesgos pendientes arriba): cookie `httpOnly` para el refresh token,
      nonces de CSP, `allow_credentials` de CORS, Unit of Work, SWR/React
      Query.
