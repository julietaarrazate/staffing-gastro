# Mapa de la documentación (`docs/`)

Movido desde `CLAUDE.md` (2026-10-09). Índice largo: consultarlo solo para ubicar un doc.

**Al arrancar una sesión, leé primero [docs/STATUS.md](../STATUS.md)**
(qué está abierto hoy) y, para ubicarte en el código,
[docs/reference/MAPA_DEL_CODIGO.md](./MAPA_DEL_CODIGO.md)
(qué pantalla hace qué y dónde vive cada pieza). Para correr tests,
Playwright y capturas en una sesión cloud:
[docs/reference/SESION_CLOUD.md](./SESION_CLOUD.md). También conviene mirar [docs/BUGS.md](../BUGS.md) (bugs
recurrentes ya resueltos, para no reintroducirlos) y
[docs/TECH_DEBT.md](../TECH_DEBT.md) (deuda vigente por prioridad).

Antes de tocar algo, leé lo relevante. No dupliques info: referenciá.

- **Fundación** — [PRODUCT.md](../foundation/PRODUCT.md) · [DOMAIN.md](../foundation/DOMAIN.md) ·
  [ARCHITECTURE.md](../foundation/ARCHITECTURE.md) · [PRINCIPLES.md](../foundation/PRINCIPLES.md)
- **Identidad visual / diseño** — [ART_DIRECTION.md](../design/ART_DIRECTION.md)
  (dirección de marca, territorio, benchmark — punto de partida) ·
  **sistema vigente (v5.0): [`docs/design-system/`](../design-system/)**
  (`color-system.md`, `typography.md`, `elevation.md`…) ·
  [COLOR_SYSTEM.md](../design/COLOR_SYSTEM.md) (histórico v1–v4 + el
  método de medición de contraste, que sigue vigente) ·
  [TYPOGRAPHY_SYSTEM.md](../design/TYPOGRAPHY_SYSTEM.md) (histórico: su
  recomendación Archivo/Geist nunca se aplicó) ·
  [ICONOGRAPHY_SYSTEM.md](../design/ICONOGRAPHY_SYSTEM.md) ·
  [DESIGN_TOKENS.md](../design/DESIGN_TOKENS.md) (radios, sombras, espaciados) ·
  [BRIEF_IDENTIDAD_VISUAL.md](../design/BRIEF_IDENTIDAD_VISUAL.md) (spec técnica
  para el diseñador externo).
- **Auditorías y reportes** — fotos de un momento, **no estado vigente**:
  `docs/audits/` y los `*_REPORT.md`/`*_LOG.md`/`PRODUCTION_HARDENING.md`/
  `SECURITY_CHANGES.md` de la raíz (agosto y septiembre de 2026). El código
  los cita como fuente de decisiones puntuales, por eso no se movieron.
- **ADRs vigentes** (`docs/adr/ADR-00NN-*.md`): 0001 MapLibre · 0002 sesiones revocables ·
  0003 `quantity`=1 permanente · 0004 cancelación del trabajador + insignias ·
  0005 mensualidad al comercio (pagos, Fase 1) · 0006 alta de local desde el
  mapa · 0007 no-show/cancelación tardía manual · 0008 asistencia
  simplificada y no-show automático · 0009 escalada automática de urgencia ·
  0010 modelo de confianza en cuatro dominios · 0011 segunda y tercera tinta ·
  0012 pago de referencia
  (el "match" del mapa y el aviso de pago fuera de mercado al comercio) ·
  0013 verificación del comercio (constancia de AFIP; por qué NO es
  `cuit_verificado` y por qué no se guarda el número) · 0014 "Disponible
  ahora" (el trabajador prende su posición real por 4h para que el comercio
  mida la distancia desde ahí y no desde su domicilio; el pin en el mapa
  siempre va desplazado — `fuzz_point`, TECH_DEBT.md S4) ·
  0015 turno "no cubierto" (estado nuevo para un turno asignado que nadie
  confirma, o publicado que nadie toma, cuyo horario ya pasó — sin impacto
  de reputación, ventana de gracia según `urgent`).
- Fases siguientes (a construir): negocio por módulo, reglas operativas,
  arquitectura técnica, desarrollo, diseño, IA, integraciones, producto y ADRs.

Arranque técnico y pasos de DB: `backend/README.md` y `frontend/README.md`.

