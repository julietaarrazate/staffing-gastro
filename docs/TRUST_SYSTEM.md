# TRUST_SYSTEM.md — Modelo de confianza de Oído

> Documento maestro de la **EPIC-001 · Trust & Identity Platform**.
> Fuente de verdad conceptual del sistema de confianza. Decisión de registro:
> [`ADR-0010`](./adr/ADR-0010-modelo-de-confianza-cuatro-dominios.md).
> Base legal de retención: [`reference/IDENTITY_DATA_RETENTION.md`](./reference/IDENTITY_DATA_RETENTION.md).
>
> **Estado:** propuesta de arquitectura para aprobar **antes** de implementar.
> No hay código de dominio escrito bajo este modelo todavía (decisión
> explícita: arquitectura correcta antes que implementación rápida).

Este documento cubre, en orden, los entregables pedidos:
1. Revisión crítica del diseño actual · 2. Modelo conceptual (4 dominios) ·
3. Claim vs Evidence · 4. Niveles de garantía · 5. Arquitectura del dominio ·
6. Diagrama de relaciones · 7. Roadmap evolutivo · 8. Riesgos ·
9. Recomendaciones · + Onboarding progresivo · Plan de renombre `identity` ·
Límite del Asistente IA.

---

## 1. Revisión crítica del diseño actual

### 1.1 Qué hay hoy en producción

- **`identity` (mal nombrado):** en realidad es **cuenta + autenticación**.
  Modela `User` (email, contraseña, rol, estado), Google Identity, sesiones
  revocables (ADR-0002), recuperación de contraseña, verificación de **email**
  (`User.is_verified` = *email* verificado, no identidad).
- **`worker` (`WorkerProfile`):** mezcla **dos dominios** — datos profesionales
  (skills, idiomas, experiencia, CV, disponibilidad) **y** métricas de
  **reputación** (rating, puntualidad, eventos, cancelaciones, no-shows,
  badges, nivel).
- **Reputación:** deriva correctamente de la actividad (ADR-0004, ADR-0007,
  launch-gate #88). Las insignias se recalculan puras desde las métricas
  (`compute_badges`/`compute_level`).
- **`WorkerBadge.perfil_verificado`:** existe en el catálogo y el frontend lo
  renderiza ("Perfil Verificado", ShieldIcon), pero **nunca se otorgaba**.

### 1.2 Los problemas de fondo

| # | Problema | Por qué importa |
|---|---|---|
| P1 | **Identidad mezclada con reputación.** La v1 hizo `perfil_verificado` un badge derivado en `compute_badges`, sobre `WorkerProfile`. | Identidad y desempeño son dominios distintos; compartir entidad y superficie viola la separación y confunde al usuario. |
| P2 | **Estado de identidad booleano.** `verification_status`/`is_verified` únicos. | Cada nueva forma de validación (teléfono, liveness, edad, KYC) obliga a redominar. |
| P3 | **Nombre ambiguo "Perfil Verificado".** | No distingue "identidad confirmada" de "buen perfil profesional". El resultado visible debe ser **"Identidad verificada"**. |
| P4 | **`identity` = auth, no identidad.** | Ambigüedad de nombres que se arrastra desde el MVP; convivir años con nombres incorrectos genera errores de diseño. |
| P5 | **`WorkerProfile` es un god-object.** Profesional + reputación en una entidad. | Impide que el perfil crezca sin tocar reputación (y viceversa). |
| P6 | **Retención de PII sin base legal.** La v1 decidió "no retener" por criterio de ingeniería. | La imagen del DNI es dato sensible; la decisión debe apoyarse en la Ley 25.326. |

### 1.3 Qué de la v1 sigue siendo válido (a reutilizar, reubicado)

La v1 (stasheada, no mergeada) no se tira: se **adapta**. Sigue válido —
reubicado en el dominio `identity` nuevo, a nivel **evidencia**, no perfil:

- La **máquina de estados** de una revisión (`pendiente → verificada/rechazada`,
  con reenvío) → pasa a ser el ciclo de vida de una **`Evidence`**.
- Las **validaciones** (no reenviar si ya verificada, motivo de rechazo).
- El **flujo administrativo** (cola de pendientes, aprobar/rechazar, verificador
  registrado) → cola de **evidencias** pendientes.
- Los **tests** de esas transiciones y la **no-retención** del documento.
- El principio de **timestamps de auditoría en UTC**.

Lo que **cambia**: deja de vivir en `WorkerProfile`/`WorkerBadge`; deja de ser
un estado único; el "verificado" se vuelve la **agregación de claims**.

---

## 2. Modelo conceptual — cuatro dominios

Ver la tabla de límites en el [ADR-0010 §1](./adr/ADR-0010-modelo-de-confianza-cuatro-dominios.md).
En una frase cada uno:

- **Account** — *acceso*. Nunca sabe de reputación, identidad legal ni skills.
- **Identity** — *¿es quien dice ser?*. Claims + evidencias. Nunca reputación.
- **Professional Profile** — *¿qué sabe hacer?*. Nunca identidad legal.
- **Reputation** — *¿trabaja bien?*. Sólo señales de comportamiento. Nunca
  documentación.

Regla de oro de dependencias: **se referencian por `user_id` + puerto**, nunca
importando entidades de otro dominio. La verificación de identidad puede *subir
la confianza* que el matching usa como señal, pero el matching lee un **claim**
(agregado), no las evidencias.

---

## 3. Claim vs Evidence (el núcleo del modelo)

Formalizamos la diferencia entre **la afirmación** y **la prueba**:

```
Claim  (afirmación auditable)        Evidence (prueba concreta)
─────────────────────────────        ──────────────────────────────
tipo: documento_verificado           tipo: dni_frente | dni_dorso | selfie | liveness
estado: verificada                   método: admin_manual | kyc_provider | renaper
nivel_confianza: alto                verified_by: <admin_id | provider_id>
decidido_en: 2026-08-06              recibida_en / decidida_en
expira_en: (si aplica)              expira_en (si aplica)
                                     ubicacion_dato: url | cifrado | eliminada
1 Claim  ◄───── respaldado por ─────  N Evidence
```

- El **Claim** es lo que el resto del sistema consulta y lo que se muestra
  ("Identidad verificada"). No expone datos sensibles.
- La **Evidence** es la materia prima de la revisión. Se puede **eliminar tras
  la decisión** (o cifrar) sin destruir el Claim ni el rastro de auditoría.
- Beneficio: **auditabilidad** (toda afirmación tiene su prueba y método) +
  **privacidad** (borrar la prueba, conservar la afirmación) +
  **extensibilidad** (nuevo tipo de evidencia = nueva fila, no nuevo esquema).

### Tipos de claim previstos (catálogo inicial, extensible)

`email_verificado` · `telefono_verificado` · `documento_verificado` ·
`selfie_verificada` · `prueba_de_vida` · `mayoria_de_edad`.

> **Nota sobre `mayoria_de_edad`:** hoy la edad es **auto-declarada**
> (`WorkerProfile.birth_date`). En el modelo nuevo se distingue edad
> **declarada** (perfil, sin garantía) de `mayoria_de_edad` **verificada**
> contra el documento (claim de identidad, con peso legal para trabajo de
> personas menores de edad). Son cosas distintas y no deben confundirse.

---

## 4. Niveles de garantía (assurance levels)

La confianza en la identidad de un sujeto es la **agregación** de sus claims
verificados, no un sí/no. Inspirado en NIST IAL / eIDAS:

| Nivel | Claims requeridos | Significado |
|---|---|---|
| **L0 — Anónimo** | ninguno | Se registró. Puede explorar. |
| **L1 — Contacto** | email (y/o teléfono) verificado | Canal de contacto real. |
| **L2 — Documentado** | + documento verificado | Presentó un documento válido. |
| **L3 — Presencia** | + selfie/liveness (persona = documento) | Es la persona del documento. |
| **L4 — Reforzado** | + fuente autoritativa (Renaper/KYC) | Verificación automática contra fuente oficial (futuro). |

El marketplace decide **qué nivel exige para qué acción** (política, no
dominio): explorar = L0; postularse = quizás L1; que un comercio exija
"Identidad verificada" = L3. **Importante:** el nivel de garantía **no es
reputación** — un L3 recién llegado tiene identidad fuerte y reputación cero.

---

## 5. Arquitectura del dominio (propuesta)

Módulos backend (DDD/hexagonal, igual que el resto del repo):

```
backend/app/modules/
  account/          (hoy "identity" — ver plan de renombre)
    domain/         User, sesión, credenciales, estado de cuenta
    ...
  identity/         NUEVO — verificación de identidad
    domain/
      entities.py       Claim, Evidence
      value_objects.py  ClaimType, ClaimStatus, EvidenceType,
                        VerificationMethod, AssuranceLevel
      services.py       reglas de agregación claim→nivel
      repositories.py   puertos: ClaimRepository, EvidenceRepository,
                        IdentityVerifier (estrategia de verificación)
    application/     casos de uso: submit_evidence, review_evidence,
                     compute_assurance
    infrastructure/  ORM (identity_claims, identity_evidences),
                     AdminManualVerifier (v1 adaptada), KycVerifier (futuro)
    api/             endpoints worker (subir evidencia, ver mis claims) +
                     admin (cola de revisión, aprobar/rechazar)
  professional_profile/  (extraído de "worker": skills, exp, idiomas, CV...)
    domain/          ProfessionalProfile (sin métricas de reputación)
  reputation/        (extraído de "worker": rating, puntualidad, badges...)
    domain/          reglas ya existentes (ADR-0004/0007), sin identidad
```

Puertos clave:

- **`IdentityVerifier`** (estrategia): `admin_manual` hoy; `kyc_provider` /
  `renaper` a futuro. Cambiar el método **no toca** `Claim`/`Evidence`.
- **`ClaimRepository` / `EvidenceRepository`**: persistencia separada; la
  evidencia puede purgarse sin tocar el claim.

Consulta cross-dominio: matching y UI preguntan
`IdentityService.assurance_level(user_id)` o `has_claim(user_id, tipo)` — nunca
leen evidencias ni entidades de identidad directamente.

> La extracción de `professional_profile` y `reputation` desde `worker` es
> **incremental** y puede ir después de identidad (ver roadmap). Lo que se fija
> ahora es que identidad **nace separada**, no dentro de `worker`.

---

## 6. Diagrama de relaciones

```mermaid
graph TD
    U["Usuario (persona real)"]

    subgraph ACCOUNT["🔑 Account (acceso)"]
        A["User: email, password, OAuth,<br/>sesión, recuperación, MFA futuro"]
    end

    subgraph IDENTITY["🪪 Identity (¿es quien dice ser?)"]
        C["Claim: tipo, estado,<br/>nivel_confianza, expira"]
        E["Evidence: método, verified_by,<br/>fecha, dato (borrable/cifrado)"]
        AL["Nivel de garantía L0..L4<br/>(agregación de claims)"]
        C -->|respaldado por 1..N| E
        C -->|agrega a| AL
    end

    subgraph PROFILE["💼 Professional Profile (¿qué sabe hacer?)"]
        P["Experiencia, skills, idiomas,<br/>certificaciones, disponibilidad, CV"]
    end

    subgraph REPUTATION["⭐ Reputation (¿trabaja bien?)"]
        R["Puntualidad, no-shows, cancelaciones,<br/>eventos, rating, antigüedad, badges"]
    end

    U --> A
    A -->|user_id| C
    A -->|user_id| P
    A -->|user_id| R

    AL -.->|señal de confianza<br/>(claim agregado, NO evidencias)| M["Matching"]
    P -.->|datos estructurados| M
    R -.->|señal de desempeño| M

    R -.->|NUNCA depende de| IDENTITY
    P -.->|NUNCA contiene| IDENTITY
```

Lecturas del diagrama:
- Los cuatro dominios cuelgan del **mismo `user_id`**, pero no se contienen.
- El matching consume **claim agregado + perfil estructurado + reputación** —
  tres señales independientes.
- Reputación **nunca** depende de identidad; perfil **nunca** contiene
  identidad. Las flechas punteadas rojas son invariantes de diseño.

---

## 7. Roadmap evolutivo del sistema de confianza

Fases pensadas para **no bloquear** la evolución marketplace → plataforma de
empleo. Cada fase entra sin redominar la anterior.

| Fase | Entregable | Depende de | Notas |
|---|---|---|---|
| **F0** | Este diseño aprobado (docs + ADR) | — | Estás acá. |
| **F1** | Dominio `identity` (Claim/Evidence) + método `admin_manual` + "Identidad verificada" (L1–L3) | F0 | Reutiliza v1 adaptada. Suficiente para beta Palermo. |
| **F2** | Extraer `professional_profile` y `reputation` de `worker` | F1 | Incremental; el badge de identidad sale de `compute_badges`. |
| **F3** | Onboarding progresivo (pedir claims/perfil en el momento justo) | F1 | Ver §Onboarding. |
| **F4** | CV: perfil estructurado → CV exportable; PDF opcional del usuario | F2 | Matching usa datos estructurados, no el PDF. |
| **F5** | Verificación automática (KYC/Renaper) como `IdentityVerifier` | F1 | Sin redominar: nueva estrategia del puerto. L4. |
| **F6** | Asistente IA de carga de perfil (**épica aparte**) | F2 | Captura info; nunca fuente de verdad. |
| **F7** | Historial laboral atestiguado + búsqueda de talento | F2, F4 | "Verificable" = atestiguado por Oído (ver Riesgos). |
| **F8** | Plataforma de empleo gastronómico | F4, F7 | Visión. |

---

## 8. Riesgos del diseño (actual y propuesto)

| Riesgo | Sev. | Mitigación |
|---|---|---|
| **Sobre-diseñar y frenar la beta.** Modelar la plataforma entera antes de lanzar. | 🔴 | F1 es una rebanada fina (admin_manual, L1–L3). El resto son costuras, no construcción. |
| **PII sensible (DNI) mal retenida.** Riesgo legal Ley 25.326. | 🔴 | Retención basada en normativa (doc dedicado); evidencia borrable/cifrada; claim + auditoría es lo que persiste. |
| **Renombre `identity`→`account` rompe imports (~44 archivos).** | 🟠 | Migración por etapas con alias temporal (ver §Renombre). No se hace en F1. |
| **`worker` como god-object dificulta extraer perfil/reputación.** | 🟠 | F2 incremental; identidad ya nace afuera, no agrava el problema. |
| **Revisión manual no escala a decenas de miles.** | 🟠 | Método = estrategia; F5 mete KYC automático sin redominar. |
| **Prometer historial "verificable" externamente.** Implica atestación criptográfica. | 🟡 | En F1–F7 es "atestiguado por Oído". Firma/attestation es su propio ADR si el negocio lo pide. |
| **Fricción de onboarding si se pide identidad temprano.** | 🟡 | Nada de identidad es obligatorio para explorar (L0). Se pide en el momento de valor (§Onboarding). |
| **Acoplar el Asistente IA al dominio.** | 🟡 | IA es épica aparte; el dominio no la importa ni depende de ella. |

---

## 9. Recomendaciones antes de implementar

1. **Aprobar estos documentos** (este + ADR-0010 + retención) antes de tocar
   código de dominio.
2. **Implementar sólo F1** para la beta: `identity` con Claim/Evidence y
   `admin_manual`, exponiendo "Identidad verificada" (L1–L3). No construir
   KYC, CV ni IA todavía — dejar las costuras.
3. **Adaptar la v1 stasheada**, no portarla tal cual: su lógica va a nivel
   **evidencia**, no a `WorkerProfile`.
4. **Sacar `perfil_verificado` de `compute_badges`** y del catálogo de badges
   de reputación cuando F1 aterrice; renombrar la UI a "Identidad verificada".
5. **No ejecutar el renombre `identity`→`account` en F1**; dejar el plan
   escrito y hacerlo como PR mecánico aislado (F2), para no mezclarlo con
   cambios de comportamiento.
6. **Cerrar la política de retención con criterio legal** (no de ingeniería)
   antes de guardar la primera imagen de DNI real.

---

## Onboarding progresivo (principio de producto)

Registro en **< 1 minuto**: nombre + (email o Google) + teléfono si aplica.
Con eso el usuario **explora** (L0). Todo lo demás se pide **en el momento de
valor**, nunca de entrada:

- **Antes de postularse** → quizás L1 (contacto verificado).
- **Después del primer turno** → invitar a completar perfil / subir identidad.
- **Para mejorar posicionamiento** → más claims + perfil más rico.
- **Para generar el CV** → completar perfil estructurado.

Ninguna pantalla obligatoria de "20 inputs". El modelo Claim/Evidence soporta
esto naturalmente: los claims se agregan de a uno, cuando corresponde.

---

## Plan de renombre `identity` → `account` / `auth`

**Problema:** el módulo `identity` modela cuenta/autenticación; el nombre
`identity` debe quedar libre para el dominio de verificación de identidad.

**Impacto medido:** 18 archivos en el módulo, **~44 archivos** que importan
`app.modules.identity`. Es mecánico pero amplio (rutas, dependencias, tests,
bootstrap de admin).

**Migración por etapas (no en F1):**
1. Crear el módulo nuevo `identity` (Claim/Evidence) con **otro** nombre de
   paquete desde el día 1 para no colisionar.
2. Renombrar `app/modules/identity` → `app/modules/account` en un **PR
   mecánico aislado** (sólo movimientos + imports), sin cambios de conducta,
   fácil de revisar y revertir.
3. Actualizar imports (`modules.identity` → `modules.account`), prefijos de
   rutas si aplica, referencias en docs.
4. Verificar `pytest`/`tsc`/`build` verdes; sin cambios funcionales esperados.

Alternativa si el renombre se posterga: dejarlo documentado como deuda
(`TECH_DEBT.md`) para no bloquear F1, pero con el plan ya escrito.

---

## Límite del Asistente IA (épica separada)

El Asistente IA (conversacional, texto y luego audio, "contame sobre vos" →
estructura experiencia/skills/idiomas) **no** es parte de esta épica. El
dominio `professional_profile` debe permitir que un asistente **proponga**
datos que el usuario **confirma**, pero:

- La IA es un **mecanismo de captura**, nunca la **fuente de verdad**.
- El dominio no importa ni depende de la IA; expone casos de uso que un
  adaptador de IA podría invocar, igual que los invoca un formulario.
- Tiene su propio costo/latencia/privacidad (mandar audio a un LLM) → su
  propio ADR cuando arranque.
