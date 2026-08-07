# TRUST_SYSTEM.md — Modelo de confianza de Oído

> Documento maestro de la **EPIC-001 · Trust & Identity Platform**.
> Fuente de verdad conceptual del sistema de confianza. Decisión de registro:
> [`ADR-0010`](./adr/ADR-0010-modelo-de-confianza-cuatro-dominios.md).
> Base legal de retención: [`reference/IDENTITY_DATA_RETENTION.md`](./reference/IDENTITY_DATA_RETENTION.md).
>
> **Estado:** propuesta de arquitectura para aprobar **antes** de implementar.
> No hay código de dominio escrito bajo este modelo todavía (decisión
> explícita: arquitectura correcta antes que implementación rápida).

El documento tiene tres partes:

**Parte I — Modelo de dominio** (entregables originales EPIC-001):
1. Revisión crítica del diseño actual · 2. Modelo conceptual (4 dominios) ·
3. Claim vs Evidence · 4. Niveles de garantía · 5. Arquitectura del dominio ·
6. Diagrama de relaciones · 7. Roadmap evolutivo · 8. Riesgos ·
9. Recomendaciones · + Onboarding progresivo · Plan de renombre `identity` ·
Límite del Asistente IA.

**Parte II — Visión Trust Platform** (refinamiento 2026-08-06, eleva el techo
conceptual de "verificación de identidad" a "infraestructura de confianza"):
10. Qué es la confianza en Oído · 11. Marketplace de dos lados (confianza
bidireccional) · 12. Trust Score (conceptual) · 13. Career Graph ·
14. Benchmark competitivo · 15. Principios de arquitectura (permanentes) ·
16. Roadmap de madurez de la confianza.

> **Cómo leer las dos partes.** La Parte I es el **modelo ejecutable** que se
> aprueba para construir la F1. La Parte II es la **visión de largo plazo** que
> ese modelo debe habilitar sin rediseños; no agrega trabajo a la F1, fija el
> norte. Donde la Parte II encontró tensiones con el diseño actual, las
> documenta en §12 y §11 con alternativa justificada (no valida ideas
> preconcebidas: revisa con criterio de arquitectura).

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

---
---

# Parte II — Visión Trust Platform

> Refinamiento del 2026-08-06. La Parte I modela **identidad, perfil y
> reputación** como dominios separados. Esta parte agrega el concepto que los
> gobierna a todos — **la confianza** — y la trata como el activo central del
> producto, bidireccional y evolutivo. **No cambia el modelo de la Parte I**;
> lo enmarca y expone dónde el diseño actual necesita crecer.

## 10. Qué es la confianza en Oído (Trust Platform)

**Definición.** La confianza es la probabilidad percibida de que la otra parte
**cumpla su compromiso**: que el trabajador se presente, llegue a horario y
haga bien el trabajo; que el comercio confirme el turno, trate bien y **pague**.
La confianza es el activo central de Oído y su principal **reductor de
fricción**: cuanto más alta y más *legible* es, más rápido se cubre una
posición — es lo que hace posible la misión de **cubrir un turno en < 10
minutos**. Una plataforma de staffing en tiempo real es, en el fondo, una
**máquina de producir confianza a la velocidad suficiente para decidir en
minutos**.

**La confianza no es una cosa.** Es la lectura conjunta de **dimensiones
independientes** que no se deben mezclar (de ahí los cuatro dominios):

| Dimensión | Pregunta | Dominio | Se gana con |
|---|---|---|---|
| **Identidad** | ¿Es quien dice ser? | Identity | **evidencia** (claims verificados) |
| **Competencia** | ¿Sabe hacer el trabajo? | Professional Profile | información estructurada + certificaciones |
| **Fiabilidad** | ¿Cumple lo que promete? | Reputation | **comportamiento** (turnos reales) |
| **Solvencia y trato** (comercio) | ¿Paga y trata bien? | Reputation (comercio) | **comportamiento** (pagos, ratings) |

**Cómo se construye.** Por **acumulación de señales verificables en el tiempo**,
nunca por auto-declaración. Regla de producto: *la confianza se gana con
evidencia (identidad) y con comportamiento (reputación), no con el marketing
que cada uno hace de su propio perfil.* Un perfil "bonito" no es confianza; un
DNI validado y 30 turnos cumplidos, sí.

### 10.1 Señales que suben y bajan la confianza

| Sube | Baja |
|---|---|
| Identidad verificada (claims de mayor nivel) | Identidad no verificada / evidencia rechazada |
| Puntualidad, turnos completados, antigüedad | No-shows, cancelaciones tardías |
| Calificaciones altas, muchos comercios distintos | Reclamos, calificaciones bajas |
| Perfil completo, certificaciones | Perfil vacío, datos inconsistentes |
| (comercio) pagos a tiempo, alta tasa de confirmación | (comercio) pagos tardíos, cancelaciones, reclamos |

Ninguna señal **compra** a otra: identidad verificada **no** sube la
reputación, y buena reputación **no** verifica identidad (principio §15.4).

### 10.2 Qué ve cada lado (transparencia asimétrica)

Cada actor ve del otro **señales agregadas**, nunca los datos crudos:

- **El comercio ve del trabajador:** "Identidad verificada" (claim agregado,
  sin DNI ni evidencias), reputación (fiabilidad, puntualidad, no-shows,
  eventos, antigüedad) y perfil (skills, experiencia, certificaciones). **Nunca**
  la imagen del documento ni las evidencias (ver retención).
- **El trabajador ve del comercio:** fiabilidad de pago (tiempo promedio, % a
  tiempo), rating de trato/ambiente, antigüedad, tasa de confirmación,
  cancelaciones. Antes de aceptar un turno, el trabajador **debe poder juzgar al
  comercio** con las mismas garantías con que el comercio lo juzga a él.

> **Principio de transparencia asimétrica:** se exponen indicadores agregados;
> los datos sensibles que los respaldan (evidencias de identidad, importes
> exactos, PII) no cruzan de un actor al otro.

---

## 11. Marketplace de dos lados — confianza bidireccional

**Hallazgo crítico.** Todo el diseño de la Parte I está centrado en el
**trabajador**. El marketplace tiene dos lados y la confianza tiene que ser
**bidireccional**: el comercio también es un **sujeto de confianza** que el
trabajador evalúa. Esto no es una feature nueva, es una **simetría que el
dominio Reputation ya debe contemplar** — con dos sujetos (trabajador y
comercio) y señales distintas para cada uno.

### 11.1 Señales del trabajador (mayormente existentes)

Identidad verificada · puntualidad · no-shows · cancelaciones · historial ·
calificaciones · antigüedad · perfil completo · certificaciones · experiencia ·
CV. Ya derivan de la actividad (ADR-0004/0007) o del perfil.

### 11.2 Señales del comercio (a formalizar)

Historial de pagos · **tiempo promedio de pago** · **% de pagos a tiempo** ·
cancelaciones · reclamos · calificaciones recibidas · ambiente laboral · **tasa
de confirmación de turnos** · tiempo de respuesta · antigüedad · cumplimiento.

**Inconsistencia detectada (oportunidad).** El comercio ya tiene un
`CompanyProfile` con métricas de reputación (rating, `on_time_payment_rate`,
`events_published`), pero históricamente **varias no se poblaban de forma
confiable** (deuda registrada en `TECH_DEBT.md`). Elevar la confianza a
bidireccional obliga a **cerrar esa deuda**: estas señales tienen que
calcularse de verdad desde el ciclo del turno/pago y **mostrarse al trabajador**
antes de aceptar. Si no, el trabajador decide a ciegas sobre quién le va a
pagar — el lado más caro de equivocarse.

### 11.3 Identidad del comercio (el modelo Claim/Evidence también aplica del otro lado)

El comercio tiene su propia pregunta de identidad: **¿es un negocio real y
registrado?** El modelo **Claim/Evidence de la Parte I se extiende naturalmente
al comercio** — mismos conceptos, distintos tipos de claim:

`negocio_verificado` · `cuit_verificado` (contra AFIP a futuro, como estrategia
de verificación, igual que Renaper para personas) · `domicilio_verificado`.

Esto es una **validación fuerte del diseño**: el dominio Identity **no es
worker-only**; modela la identidad de cualquier sujeto (persona o negocio) sin
redominar. La verificación del negocio es, además, la contraparte de confianza
que el trabajador más necesita.

---

## 12. Trust Score — modelo conceptual (con una tensión honesta)

**La tensión, dicha de frente.** Toda esta épica se construyó sobre "no reducir
la confianza a un badge" y "no mezclar conceptos". Un **"Trust Score" único y
público** (un número 0–100 tipo buró de crédito) es, precisamente, *colapsar
dimensiones independientes en un solo número* — el opuesto de lo que pedimos.
Así que el score se diseña con cuidado, no por default.

**Las tres opciones y su balance:**

| Opción | Qué es | Ventajas | Desventajas |
|---|---|---|---|
| **A. Score público único** | Un número visible (ej. "Trust 87") | Simple de leer, un solo eje para ordenar | Opaco ("¿por qué 87?"), gameable, **re-mezcla los conceptos** que separamos, riesgo de *scoring social* y de sesgo contra recién llegados/baja actividad |
| **B. Indicadores independientes** | Varios ejes visibles: identidad ✓, fiabilidad ●●●●○, competencia, (comercio) pago | Respeta la separación, explicable, difícil de "gamear" un solo número | No da un orden único para ranking automático |
| **C. Compuesto interno + indicadores visibles** | Score **interno** (no público) para matching/ranking **+** indicadores independientes hacia el usuario | Ranking eficiente sin exponer una fórmula gameable; el usuario ve *por qué* confía; no hay número social público | Más complejo; hay que gobernar el peso de cada eje |

**Recomendación: Opción C.**

- **Hacia el usuario:** indicadores **independientes** (identidad, fiabilidad,
  competencia; del comercio, fiabilidad de pago). Nunca un número único público
  para personas.
- **Internamente:** un **compuesto** alimenta el ranking del matching. No se
  muestra la fórmula (evita gaming) y **no** deja que un eje canjee a otro:
  identidad y reputación entran como **ejes ortogonales con pesos**, no se
  suman como si midieran lo mismo (un L3 recién llegado no "compra" reputación
  con su DNI).
- **Evitar la Opción A** para personas. Un score social público es opaco,
  penaliza injustamente a quien recién empieza y contradice el principio
  fundacional del epic.

> **Nota legal (cross-ref retención §12-riesgo).** Un score que condicione el
> acceso al trabajo roza el terreno de **decisiones automatizadas** sobre
> personas (art. relevante de la Ley 25.326; tendencia GDPR art. 22). Diseñar
> con **explicabilidad** y sin decisiones puramente automáticas que afecten
> derechos: el score **ordena**, no **excluye** por sí solo. Confirmar con
> asesoría legal antes de que un score condicione oportunidades reales.

---

## 13. Career Graph — historial profesional verificable

**La idea.** Ir más allá del CV/PDF: un **grafo de la carrera gastronómica**
del trabajador, construido con hechos que Oído ya registra —

- **Nodos:** comercios donde trabajó, jornadas realizadas, certificaciones
  obtenidas, especializaciones.
- **Dimensiones:** permanencia, evolución, experiencia acumulada, densidad
  (cuántos comercios distintos), recencia.

**Por qué es una ventaja competitiva real (el moat).** El historial de Oído no
es auto-reportado: **cada turno cumplido es un hecho transaccional que la
plataforma atestigua**. Un CV de LinkedIn es lo que la persona *dice*; un Career
Graph de Oído es lo que la persona *hizo dentro del sistema*. Ninguna red de CVs
puede replicar eso sin **ser** el lugar donde el trabajo ocurre. Habilita: CV
auto-generado **creíble**, búsqueda de talento por experiencia real, y
portabilidad de reputación — los tres escalones hacia "plataforma de empleo".

**Diseño conceptual (no implementar).** El Career Graph **no es un dominio
nuevo**: es una **vista derivada** (read-model / proyección) sobre Reputation +
Professional Profile + el historial de turnos. Se materializa como lectura, no
redomina nada → entra como **M7** en el roadmap sin tocar el modelo base.

**Límite honesto (ver §8, riesgo de "verificable").** "Verificable" significa
**atestiguado por Oído, dentro de Oído**. La experiencia **externa** (antes de
Oído, o fuera) sigue siendo auto-declarada salvo que se agregue attestation o
**referencias laborales** (M6). No prometer "historial verificable" a secas si
una parte es auto-reportada: el lenguaje de producto tiene que distinguir
**"trabajado en Oído"** (hecho) de **"experiencia declarada"** (dicho).

---

## 14. Benchmark competitivo — qué construye confianza en cada plataforma

No para copiar features, sino para ubicar de dónde saca cada una su confianza y
dónde Oído puede diferenciarse.

| Plataforma | De dónde saca la confianza | Qué toma / evita Oído |
|---|---|---|
| **LinkedIn** | Identidad social + endorsements **auto-reportados** + red de contactos | Toma: identidad + perfil rico. Evita: confiar en auto-reporte de desempeño. |
| **Uber** | Rating **bidireccional atado a cada viaje** + verificación de identidad + background checks | Toma: rating bidireccional atado a la transacción (el modelo más cercano). |
| **Airbnb** | Reviews **bidireccionales post-estadía** + ID verificado + garantías/depósito | Toma: reviews atadas a la transacción real + "Identidad verificada" como claim. |
| **Mercado Libre** | Reputación **transaccional** (medallas por ventas cumplidas) + MercadoPago (garantía/escrow) | Toma: reputación derivada de transacciones cumplidas; pago como señal de confianza del comercio. |
| **Upwork** | Work history propio + escrow + **Job Success Score** + tests de skill | Toma: work history. Cuidado: el JSS es un score único (ver §12, Opción A). |
| **Indeed** | Job board; capa de confianza **débil** (reviews de empresas auto-seleccionadas) | Evita: tratar la confianza como add-on. En Oído **es el producto**. |
| **Instawork** | **Competidor directo** (staffing por turnos): Reliability Score + verificación + historial | Aprende del reliability score; **evita** el número público único; se diferencia por vertical + Career Graph. |

**Síntesis — la oportunidad de Oído (cuatro diferenciadores):**
1. **Confianza bidireccional atada a la transacción real** (como Uber/Airbnb,
   raro en staffing).
2. **Identidad como claims extensibles** (crece a KYC/Renaper sin redominar).
3. **Career Graph vertical gastronómico** como activo portable (moat de datos).
4. **Vertical enfocado**, no generalista: señales más ricas y relevantes que un
   marketplace de trabajo genérico.

El competidor a mirar de cerca es **Instawork** (mismo problema, otro país); la
defensa de Oído es la combinación identidad + bidireccionalidad + Career Graph
en el vertical, no una feature suelta.

---

## 15. Principios de arquitectura (sección permanente)

Reglas que **rigen todo el desarrollo** del sistema de confianza. Violar
cualquiera exige un **ADR nuevo** que lo justifique — no se rompen por
conveniencia de implementación.

1. **El dominio gobierna la implementación; la implementación nunca gobierna el
   dominio.** (La v1 stasheada se adapta al modelo, no al revés.)
2. **La confianza surge de múltiples señales independientes;** ninguna se
   colapsa en otra ni en un único número público.
3. **La reputación nunca depende de documentación;** la identidad nunca depende
   de comportamiento.
4. **Identidad y reputación son ortogonales:** una no reemplaza ni "compra" a la
   otra.
5. **Toda afirmación (Claim) es auditable** y está respaldada por Evidence con
   método, verificador, fecha y (si aplica) expiración.
6. **La confianza es bidireccional:** comercio y trabajador son ambos sujetos de
   confianza y de identidad.
7. **El onboarding minimiza fricción;** el perfil se completa progresivamente;
   nada de identidad es obligatorio para explorar (L0).
8. **Toda decisión permite crecer sin redominar:** un tipo nuevo de
   claim/evidencia/señal es una **fila**, no un esquema nuevo.
9. **Los datos sensibles se minimizan por diseño;** la retención se funda en
   normativa (Ley 25.326), no en preferencia de ingeniería.
10. **La IA captura información; nunca es la fuente de verdad** del perfil.
11. **Las señales se muestran agregadas;** los datos crudos (evidencias, PII,
    importes exactos) no cruzan de un actor al otro.
12. **El método de verificación es una estrategia intercambiable;** el sistema
    no asume revisión manual para siempre.
13. **El historial atestiguado (Career History) es un activo de primera clase:**
    append-only, íntegro, no fragmentado y portable por diseño. Es la fuente de
    verdad del Career Graph y del Professional Identity Graph (Parte III) —
    protegerlo es proteger el activo central de la empresa.

Estos principios son la lectura corta de todo el documento: si un cambio futuro
los respeta, casi seguro está bien encuadrado; si roza alguno, hay que frenar y
escribir un ADR.

---

## 16. Roadmap de madurez de la confianza (capacidades)

Esta es la **lente de capacidades visibles al usuario** (madurez de la
verificación y la confianza). Es distinta del **roadmap de entrega de dominios**
del §7 (que ordena el trabajo técnico/refactor). Para no confundir numeraciones,
acá las etapas son **M1..M8** ("madurez"); el §7 usa **F0..F8** ("entrega").

| Madurez | Capacidad | Se apoya en (§7) | Nivel de garantía |
|---|---|---|---|
| **M1** | Cuenta + email + Google + **identidad manual** (admin) | F1 | L1–L3 |
| **M2** | **Selfie** (persona = documento) | F1 | refuerza L3 |
| **M3** | **Prueba de vida / liveness** | F1 (nueva evidencia) | L3 fuerte |
| **M4** | **Verificación automática** (KYC/Renaper, AFIP para comercios) | F5 | L4 |
| **M5** | **Certificaciones** (manipulación de alimentos, etc.) | F2/F4 | — (competencia) |
| **M6** | **Referencias laborales** (attestation externa) | F7 | — (reputación externa) |
| **M7** | **Career Graph** (historial atestiguado, vista derivada) | F7 | — |
| **M8** | **Trust Platform completa**: confianza bidireccional sintetizada + búsqueda de talento | F8 | — |

**Cómo se lee junto al §7.** El §7 dice *qué dominio se entrega y en qué orden*
(F1 = dominio identity; F2 = extraer profile/reputation; F5 = KYC; F7 =
historial/talento; F8 = plataforma). El §16 dice *qué capacidad de confianza ve
el usuario* en cada escalón. Cada M entra **sin redominar** la anterior — que es
la prueba de que el modelo de la Parte I aguanta la visión de la Parte II:
agregar selfie, liveness, KYC, certificaciones, referencias y Career Graph son
**filas y estrategias nuevas**, no rediseños.

**Punto de partida:** hoy estamos en **F0 / pre-M1** — el diseño (esta doc +
ADR-0010 + retención) esperando aprobación para construir la **F1 (M1)**.

---
---

# Parte III — Oído como red de identidad profesional (lente de negocio y activo)

> Refinamiento estratégico del 2026-08-06. Las Partes I y II modelan el
> **producto**. Esta parte mira a Oído **como empresa**: cuál es su activo
> durable y por qué las decisiones de arquitectura de arriba lo protegen.
> **No agrega dominios, tablas ni módulos nuevos** — es una lente para
> priorizar, no construcción. Cada concepto candidato se evalúa y se incorpora
> **sólo si se justifica**; el que no aporta se descarta explícitamente.

## Veredicto por concepto (la evaluación pedida)

| Concepto | Veredicto | Por qué |
|---|---|---|
| **Career Graph** | **Ya incorporado** (§13) | Vista derivada del historial atestiguado. Sin trabajo nuevo. |
| **Career History** | **Incorporar** (§17) | Nombra el activo de datos real: el registro append-only de turnos atestiguados; la *fuente de verdad* bajo el Career Graph. Aporta claridad arquitectónica, no complejidad. |
| **Professional Identity Graph** | **Incorporar como marco** (§17) | Es el norte estratégico exacto: identidad + perfil + historial + reputación de una persona verificada = identidad profesional portable. **Emergente, no un módulo nuevo.** |
| **Network Effects** | **Incorporar, acotado** (§18) | Informa la defensibilidad. Se documenta con honestidad: cuáles son reales y cuáles aspiracionales. |
| **Product Assets** (sección genérica) | **No incorporar como tal** | Un inventario "de deck" de activos agrega poco a una doc técnica. Se incorpora **la sustancia** (el activo único: PIG / Career History) y se descarta el envoltorio genérico. |

## 17. El activo: Professional Identity Graph (PIG)

Oído, visto como empresa, no vende turnos: **acumula un activo de datos que
ninguna red de CVs puede replicar** — la identidad profesional verificada y el
historial de trabajo atestiguado de la gastronomía.

Ese activo tiene dos capas que conviene nombrar distinto:

- **Career History (el ledger).** El registro **append-only** de hechos
  atestiguados: cada turno cumplido, con comercio, fecha, rol, puntualidad,
  resultado. Es la **fuente de verdad** — no auto-reportado: Oído lo atestigua
  porque es el sistema donde el trabajo ocurrió. Ya existe implícito en el ciclo
  de vida del turno (ADR-0004/0007); la Parte III sólo lo **eleva a activo de
  primera clase** que el diseño debe proteger y no fragmentar.
- **Career Graph (la vista).** La proyección analítica sobre ese ledger (§13):
  especialización, evolución, permanencia, densidad de comercios. Es
  **derivada**, se recomputa; el ledger es lo que se conserva.

El **Professional Identity Graph** es la unión, **anclada a una persona
verificada**, de los cuatro dominios:

```
Identidad verificada  (quién es)              ─┐
Perfil profesional    (qué sabe hacer)         ├─►  Professional Identity Graph
Career History        (qué hizo, atestiguado)  │    (identidad profesional portable
Reputación            (cómo cumplió)           ─┘     y verificable, por persona)
```

Punto clave de arquitectura: **el PIG no es un dominio ni una tabla nueva.** Es
lo que **emerge** de los cuatro dominios ya separados cuando cuelgan del mismo
`user_id` y el eje de identidad está verificado. Nombrarlo no agrega código;
**cambia qué se prioriza**: mantener el Career History íntegro y portable es
proteger el activo central de la empresa.

Por qué importa para el negocio: es el puente de la visión marketplace →
plataforma de empleo (§7, §16). Un CV de LinkedIn es lo que alguien *dice*; el
PIG de Oído es lo que alguien *hizo, verificado*. Ese es el activo que habilita
búsqueda de talento, CV creíble y, eventualmente, ser la **autoridad de
confianza** de la gastronomía.

## 18. Efectos de red y defensibilidad (con honestidad)

No todo efecto de red es real; conviene separar los que Oído tiene de los
aspiracionales — inflar esto sería venderse humo a uno mismo:

| Efecto | ¿Real? | Matiz honesto |
|---|---|---|
| **Liquidez de dos lados** (más trabajadores → más atractivo para comercios → más turnos → más trabajadores) | **Real, pero local** | La liquidez de un marketplace de turnos es **geográfica**: sirve en Palermo, se reconstruye barrio por barrio / ciudad por ciudad. No es un efecto global. |
| **Datos / matching** (más historial atestiguado → mejor matching → mejores resultados → más uso) | **Real, con escala** | Necesita volumen para notarse; no es defensa el día 1. Crece con el Career History. |
| **Activo de datos propietario** (el PIG no se copia sin *ser* el sistema donde ocurre el trabajo) | **Real y durable** | El moat más fuerte: estructural, no depende de features. |
| **Portabilidad como red** (el trabajador lleva su "verificado por Oído" afuera) | **Aspiracional** | Refuerza a Oído como *autoridad de confianza* sólo si el sello tiene reputación externa. Hoy no existe; es visión, no defensa. |

**Conclusión estratégica:** la defensibilidad de Oído no está en las features
(copiables) sino en **ser el sistema de registro** de la identidad y el trabajo
gastronómico. Cada decisión de las Partes I–II sirve a eso: identidad extensible
(crece el activo), dominios separados y portables (el activo no se degrada ni se
acopla), retención cuidada (el activo no se vuelve un pasivo legal), reputación
bidireccional (el activo cubre ambos lados del mercado).

## 19. Qué cambia hoy (y qué no) — para no sobre-diseñar

**Cambia (prioridades, cero código nuevo ahora):**
- El **Career History** se trata como activo de primera clase: append-only,
  íntegro, no fragmentado entre módulos, exportable. (Se materializa recién en
  F2/F7 del §7; hoy sólo se nombra y se protege como principio — ver §15.13.)

**No cambia (lo que se descarta a propósito):**
- **Ningún dominio/módulo/tabla nuevo.** El PIG es emergente, no construido.
- **Nada de "base de datos de grafos"** ni infraestructura pesada: el "grafo" es
  conceptual/relacional; Postgres alcanza (coherente con el "No hacer" de
  `CLAUDE.md`: sin infra pesada sin ADR).
- **No se adelanta** búsqueda de talento ni portabilidad externa: son F7/F8,
  visión, no F1.
- **No se agrega una sección genérica de "Product Assets"**: el único activo que
  importa nombrar es el PIG/Career History; un inventario de activos de deck
  sería complejidad sin retorno.

---
---

# Decisión de producto — postura de identidad en la beta (2026-08-07)

> Decisión de Julieta tras implementar la F1. **No cambia la arquitectura**
> (Claim/Evidence, puerto `IdentityVerifier`, niveles L0–L4 quedan igual):
> ajusta **la prioridad y el protagonismo** de la verificación de identidad en
> la beta. Registrada acá para retomarla cuando haga falta.

## El planteo

Oído no es un banco. Pedir **DNI + prueba de vida** a todos, y encima con
**revisión manual**, es fricción alta para un marketplace en beta — y contradice
el principio fundacional (registro en < 1 minuto, identidad **nunca** obligatoria
para explorar). Otras apps del rubro no exigen tanto de entrada; la confianza
puede apoyarse primero en señales más livianas.

## La decisión

1. **La verificación de identidad (DNI + selfie) queda OPCIONAL y sin
   protagonismo.** Ya lo es en la F1: no bloquea registro, publicación,
   postulación ni chat. Es un **plus para destacar** ("Identidad verificada"),
   no un peaje. Se puede, además, **esconder/atenuar** la sección del perfil si
   se quiere bajar aún más su presencia (no implementado; decisión abierta).
2. **La confianza de la beta se apoya en señales livianas y gratis:**
   - **Verificación de teléfono** (nivel **L1**) — automática, cero fricción,
     gratis. *Todavía no construida* (ver Pendiente).
   - **Reputación real** (puntualidad, turnos cumplidos, reseñas) — ya
     construida; es la señal más fuerte y no depende de documentación.
3. **La verificación automática de DNI queda diferida a F5 / madurez M4**, para
   activar **sólo cuando un comercio lo pida o aparezca fraude**. Encaja en el
   puerto `IdentityVerifier` **sin redominar**: es cambiar la estrategia
   `admin_manual` por una automática (proveedor KYC con free tier tipo Didit, o
   RENAPER autoritativo pago). La revisión manual queda como **respaldo**, no
   como el camino principal.

## Por qué esto es coherente con el diseño

El `TRUST_SYSTEM` §10 ya define la confianza como **multi-señal**: identidad es
**una** dimensión, no la única. Bajar el protagonismo de la identidad y apoyarse
en reputación + contacto verificado es *usar* el modelo, no contradecirlo. Y
como el método de verificación es una estrategia (ADR-0010 §3), pasar de manual
a automático más adelante no cuesta un rediseño.

## Pendiente (para retomar)

**Diferido por esta decisión (F5+, cuando haga falta):**
- **Verificación automática de DNI + liveness**: comparativa de proveedores
  (Didit, Verifik, Truora, Veriff/Sumsub) — costo real, cuota gratis, si pegan a
  **RENAPER**, privacidad — + **ADR de integración** y su implementación sobre
  el puerto `IdentityVerifier`. Cambia también la UX de captura (SDK del
  proveedor con liveness) — el dominio no cambia.
- **Consentimiento específico para biométricos + acuerdo de encargado de
  tratamiento** (Ley 25.326) antes de mandar selfies a un tercero
  (ver `reference/IDENTITY_DATA_RETENTION.md`).

**Señal liviana de la beta (a construir si se prioriza):**
- **Verificación de teléfono (L1)**: claim `telefono_verificado` (envío de
  código por SMS/WhatsApp y validación). Encaja en el modelo Claim/Evidence ya
  existente; falta el canal de envío (proveedor de SMS) y la UI. Es la señal
  automática/gratis más obvia para arrancar.

**Operativo — para que lo YA construido (F1) ande en producción:**
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` + `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
  (unsigned) en Vercel *Production* — sin esto, subir DNI/selfie corta (mismo
  bloqueo que la foto de perfil). Redeploy sin caché (son `NEXT_PUBLIC_*`).
- `ADMIN_EMAILS` en Render — sin al menos un admin no hay quien revise la cola.
- Confirmar que la **migración 0025** (`identity_claims`/`identity_evidences`)
  corrió en Neon en el deploy.

**Roadmap de confianza (F2+, ya documentado arriba):**
- Extraer `professional_profile` / `reputation` de `worker` (F2).
- Renombre `identity` → `account` (F2).
- Claims del **comercio** (`negocio_verificado` / `cuit_verificado`).
- Asistente IA de carga de perfil (épica aparte).
