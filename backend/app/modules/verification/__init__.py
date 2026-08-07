"""Bounded context **Identity** (verificación de identidad) — EPIC-001.

Este es el dominio "Identity" del modelo de confianza de cuatro dominios
(ver `docs/adr/ADR-0010-modelo-de-confianza-cuatro-dominios.md` y
`docs/TRUST_SYSTEM.md`): responde "¿esta persona es quien dice ser?".

Se llama `verification` (y no `identity`) a propósito: el paquete
`app.modules.identity` ya está ocupado por **cuenta + autenticación** (User,
sesiones, login). El renombre `identity`→`account` que liberaría el nombre está
planificado pero es F2, no F1 (ver `TRUST_SYSTEM.md` §Plan de renombre). Hasta
entonces, el dominio de verificación de identidad vive acá.

Modela la identidad como **Claims** (afirmaciones auditables: "documento
verificado") respaldados por **Evidences** (las pruebas: DNI, selfie), nunca
como un booleano. El método de verificación (`admin_manual` hoy, KYC/Renaper a
futuro) es una estrategia intercambiable. La evidencia sensible se borra tras
la decisión; el claim + la auditoría quedan como constancia
(`docs/reference/IDENTITY_DATA_RETENTION.md`).
"""
