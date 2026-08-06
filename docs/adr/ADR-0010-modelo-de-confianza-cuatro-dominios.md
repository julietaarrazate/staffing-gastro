# ADR-0010 — Modelo de confianza: cuatro dominios + Identidad como claims/evidencias

**Estado:** aceptado · **Fecha:** 2026-08-06 · **Épica:** EPIC-001 (Trust & Identity Platform)

> Documento maestro del modelo: [`docs/TRUST_SYSTEM.md`](../TRUST_SYSTEM.md).
> Política de retención (base legal): [`docs/reference/IDENTITY_DATA_RETENTION.md`](../reference/IDENTITY_DATA_RETENTION.md).

## Contexto

Oído está en producción y su propuesta de valor central es **generar
confianza** entre comercios y trabajadores. La confianza no es una feature: es
un sistema con varias dimensiones independientes que debe poder evolucionar
durante años (de marketplace a plataforma de identidad profesional
gastronómica).

La verificación de identidad se estaba implementando (sesión 2026-08-06, v1
stasheada, nunca mergeada) como **un badge más** (`WorkerBadge.perfil_verificado`
derivado de un `verification_status` sobre `WorkerProfile`). Al revisarlo con
perspectiva de producto surgieron dos problemas de fondo:

1. **Mezcla de conceptos.** La marca de identidad terminaba viviendo en el
   sistema de **reputación** (misma lista de `badges`, misma mecánica de
   `compute_badges`, sobre la misma entidad que puntualidad/eventos). Identidad
   ("¿es quien dice ser?") y reputación ("¿trabaja bien?") son cosas
   distintas y no deben compartir superficie ni entidad.
2. **Estado booleano no extensible.** Un único `verification_status` /
   `is_verified` obliga a **rediseñar el dominio** cada vez que aparece una
   nueva forma de validación (teléfono, prueba de vida, mayoría de edad
   validada contra el documento, KYC automático). El requisito explícito es
   un modelo que crezca sin redominar.

Además hay una ambigüedad histórica: el módulo `identity` **no** modela
identidad — modela **cuenta y autenticación** (email, contraseña, Google,
sesiones, recuperación, `User.is_verified` = verificación de *email*).

## Decisión

### 1. Cuatro dominios estrictamente separados

| Dominio | Pregunta que responde | Contiene | Nunca contiene |
|---|---|---|---|
| **Account** (hoy `identity`) | ¿Puede acceder al sistema? | email, contraseña, OAuth, sesiones, recuperación, MFA futuro | reputación, identidad legal, datos profesionales |
| **Identity** | ¿Es quien dice ser? | claims + evidencias (documento, selfie, liveness, edad), método/fecha/verificador | reputación, experiencia laboral |
| **Professional Profile** | ¿Qué sabe/puede hacer? | experiencia, skills, idiomas, certificaciones, disponibilidad, CV | identidad legal, documentos |
| **Reputation** | ¿Trabaja bien? | puntualidad, no-shows, cancelaciones, eventos, rating, antigüedad | documentación, identidad |

Las dependencias entre dominios son por **referencia (user_id) + puerto**,
nunca por acoplamiento de entidades (mismo criterio que
[`PRINCIPLES.md`](../foundation/PRINCIPLES.md)). La reputación **jamás** deriva
de documentación; la identidad **jamás** deriva de comportamiento.

### 2. Identidad = Claims respaldados por Evidencias

Se abandona el estado booleano. La identidad se modela con dos conceptos
formalmente distintos:

- **`Claim`** — la **afirmación** derivada y auditable sobre el sujeto:
  `email_verificado`, `telefono_verificado`, `documento_verificado`,
  `selfie_verificada`, `prueba_de_vida`, `mayoria_de_edad`. Un claim tiene
  **estado** (`no_presentada` / `pendiente` / `verificada` / `rechazada` /
  `expirada`), una **fecha de decisión**, una **fecha de expiración** (si
  aplica) y un **nivel de confianza**. El claim es lo que el resto del sistema
  consulta ("¿tiene identidad verificada?"); no expone datos sensibles.
- **`Evidence`** — la **prueba concreta** que respalda un claim: la imagen del
  DNI, la selfie, el resultado del liveness. Registra **método de
  verificación** (`admin_manual` → `kyc_provider` → `renaper`…), **quién/qué
  verificó** (`verified_by`), **fecha**, **expiración** y **metadatos mínimos**.
  Una evidencia sensible puede **borrarse tras la decisión** sin destruir el
  claim ni el rastro de auditoría (ver ADR §4 y el doc de retención).

Un claim se sostiene sobre **una o más** evidencias. El **nivel de garantía**
de la identidad del sujeto es la agregación de sus claims verificados (análogo
a NIST IAL / eIDAS: registrarse ≠ email verificado ≠ documento verificado ≠
prueba de vida). El detalle de niveles vive en `TRUST_SYSTEM.md`.

### 3. El método de verificación es una estrategia, no parte del dominio

`admin_manual` (revisión de un admin, lo que construye la beta) es **una**
implementación del puerto de verificación. Incorporar un proveedor de KYC o
Renaper a futuro = **otra** implementación del mismo puerto, sin tocar
`Claim`/`Evidence` ni las reglas de agregación. Esto cumple el requisito de
escalabilidad: el sistema no asume revisión manual para siempre.

### 4. Retención minimizada, con base legal

La imagen del documento es dato personal sensible. La decisión de qué se
retiene **no** se toma por preferencia de ingeniería sino sobre la **Ley
25.326** (datos personales, Argentina): ver
[`docs/reference/IDENTITY_DATA_RETENTION.md`](../reference/IDENTITY_DATA_RETENTION.md).
Principio rector: la **evidencia** sensible se conserva lo mínimo indispensable
(idealmente se elimina o se cifra tras la decisión), mientras que el **claim**
+ el registro de auditoría (quién verificó, cuándo, con qué método) se
conservan como constancia.

### 5. Reputación: sin cambios de fondo, pero fuera de Identidad

La reputación ya deriva de la actividad (ADR-0004/0007, launch-gate #88). La
única corrección: la marca de identidad **no** es un `WorkerBadge` y **no** se
calcula en `compute_badges`. "Identidad verificada" se renderiza como un
atributo de Identidad, con tratamiento visual propio, separado de las insignias
de desempeño.

### 6. La confianza es el marco superior, y es bidireccional (refinamiento)

Los cuatro dominios son las dimensiones de un concepto que los gobierna: la
**confianza** (Trust Platform). Se fija además que la confianza es
**bidireccional** — el **comercio** es tan sujeto de confianza como el
trabajador, con sus propias señales de reputación (fiabilidad de pago, tasa de
confirmación, trato) **y** su propia identidad (`negocio_verificado`,
`cuit_verificado`): el modelo Claim/Evidence del punto 2 **no es worker-only**,
modela cualquier sujeto (persona o negocio) sin redominar. El detalle vive en
[`TRUST_SYSTEM.md`](../TRUST_SYSTEM.md) Parte II (§10–§16).

### 7. Trust Score: compuesto interno, no número social público

Se **descarta** un "Trust Score" único y público (tipo buró de crédito) para
personas: colapsa dimensiones que este ADR separó, es opaco, gameable y roza el
*scoring social* y las decisiones automatizadas (Ley 25.326). La síntesis de
señales, cuando exista, es un **compuesto interno** que alimenta el ranking del
matching (ejes ortogonales con pesos, identidad y reputación no se canjean),
mientras que hacia el usuario se muestran **indicadores independientes**. Un
score **ordena**, nunca **excluye** por sí solo. Análisis completo en
`TRUST_SYSTEM.md` §12.

### 8. Principios de arquitectura permanentes

Este ADR consagra los **principios de arquitectura de la confianza**
(`TRUST_SYSTEM.md` §15) como reglas del proyecto: violarlos exige un **ADR
nuevo**. En síntesis: el dominio gobierna la implementación; la confianza son
múltiples señales independientes; reputación e identidad son ortogonales y no se
derivan una de la otra; todo Claim es auditable; crecer = agregar filas, no
redominar; datos sensibles minimizados por normativa; la IA captura, no es
fuente de verdad; el método de verificación es una estrategia intercambiable.

## Alcance de ESTE ADR

Este ADR fija el **modelo y los límites**. **No** se escribe código de dominio
en esta etapa (decisión explícita de producto: arquitectura correcta antes que
implementación rápida). Los entregables son documentación/arquitectura. La
implementación definitiva arranca recién cuando estos documentos estén
aprobados, y **adapta** la v1 stasheada al modelo nuevo (no al revés): se
reutiliza lo que siga válido (máquina de estados de una evidencia,
validaciones, flujo admin, tests), reubicado en el dominio `identity` nuevo.

## Consecuencias

- ✅ Identidad crece por **agregar tipos de claim/evidencia**, sin redominar.
- ✅ KYC automático a futuro entra como estrategia del puerto de verificación.
- ✅ Auditable por diseño (claim ↔ evidencias ↔ método/verificador/fecha).
- ✅ Privacidad por diseño: se puede borrar la prueba y conservar la afirmación.
- ⚠️ El módulo `identity` actual queda mal nombrado (es *account/auth*).
  Renombrarlo toca ~44 archivos: se documenta un **plan de migración**
  (`TRUST_SYSTEM.md` §Renombre), **no** se ejecuta ahora.
- ⚠️ La v1 (ADR-0010 previo "verificación de identidad del trabajador",
  `verification_status` sobre `WorkerProfile`) queda **superada por este ADR**
  y **no se mergea**; sobrevive sólo como referencia técnica en el stash.
- ⚠️ Aparecen entidades/tablas nuevas (`identity_claims`, `identity_evidences`)
  cuando se implemente; `WorkerProfile` pierde la responsabilidad de identidad.
- ➡️ El **Asistente IA** de carga de perfil es una épica **separada**: el
  dominio debe permitir integrarlo pero nunca depender de él (la IA captura
  información, nunca es la fuente de verdad).
- 🎯 Los cuatro dominios, anclados a una persona verificada, **emergen** como el
  activo durable de la empresa — el **Professional Identity Graph** (identidad +
  perfil + historial atestiguado + reputación). No es un dominio ni una tabla
  nueva: es la razón de negocio por la que la separación y la portabilidad de
  estos dominios importan. Lente de empresa/activo en
  [`TRUST_SYSTEM.md`](../TRUST_SYSTEM.md) Parte III (§17–§19).
