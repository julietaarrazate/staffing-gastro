# ACTIVOS DE PROPIEDAD INTELECTUAL
## Oído — Sistema de Staffing Gastronómico en Tiempo Real

**Autora:** Julieta Arrazate
**Versión documentada:** Septiembre 2026

---

## 1. INTRODUCCIÓN

Este documento identifica los algoritmos propios, reglas de negocio originales y componentes innovadores del sistema que constituyen activos de propiedad intelectual de la autora. El nivel de detalle proporcionado es el necesario para identificar la existencia de estos activos sin revelar implementaciones propietarias sensibles.

---

## 2. ALGORITMOS PROPIOS

### 2.1 Motor de matching con scoring multi-factor

**Archivo de referencia:** `backend/app/modules/matching/domain/scoring.py`

**Descripción:** algoritmo original que ordena a los trabajadores elegibles para un turno según un score compuesto, sin depender de ningún servicio externo de recomendación.

**Factores combinados:**

| Factor | Cálculo |
|---|---|
| Distancia | Fórmula de Haversine entre trabajador y turno; normalizada linealmente contra un radio máximo configurable; sin geolocalización de alguna de las dos puntas, se asigna un valor neutral |
| Experiencia | Años de experiencia, normalizados contra un tope configurable |
| Reputación | Rating promedio (0–5), normalizado a escala 0–1 |
| Puntualidad | Tasa de puntualidad histórica, ya en escala 0–1 |
| Desempeño | Eventos completados sobre el total de compromisos asumidos, penalizando un no-show al doble que una cancelación avisada; sin historial, valor neutral (no penaliza ni premia a quien recién empieza) |

**Filtro de elegibilidad previo:** un candidato sólo entra al ranking si está disponible y tiene la habilidad requerida por el turno.

**Innovación:** la combinación de estos cinco factores en un único score ponderado, con reglas de neutralidad explícitas para los casos sin datos suficientes (sin geolocalización, sin historial), produce un ranking robusto desde el primer uso de un trabajador nuevo, sin necesidad de un período de "arranque en frío" separado.

---

### 2.2 Sistema de verificación de identidad por niveles de garantía (L0–L4)

**Archivo de referencia:** `backend/app/modules/verification/domain/services.py`

**Descripción:** modelo original que agrega múltiples evidencias de identidad ("claims") en un **nivel de garantía**, en vez de un resultado booleano "verificado / no verificado".

**Escala:**

| Nivel | Condición |
|---|---|
| L0 | Sin ningún claim verificado |
| L1 | Canal de contacto verificado (email o teléfono) |
| L2 | Documento de identidad verificado |
| L3 | Presencia acreditada (selfie verificada o prueba de vida) |
| L4 | Verificación contra una fuente autoritativa (por ejemplo, un organismo oficial o un proveedor de KYC) |

**Regla de agregación:** se devuelve el nivel más alto que los claims **verificados** habilitan; el resultado visible simplificado ("Identidad verificada") corresponde a L2 o superior. Un usuario recién llegado con L3 tiene identidad fuerte y reputación cero — el sistema distingue explícitamente estos dos conceptos, que un booleano no puede separar.

**Innovación:** separar el nivel de garantía de identidad de la reputación operativa evita que un sistema de confianza colapse ambos conceptos en un único indicador, lo que en un marketplace de dos lados con walk-ins físicos y activos de terceros (dinero, mercadería del comercio) es una distinción funcionalmente relevante.

---

### 2.3 Motor de insignias y niveles de gamificación

**Archivo de referencia:** `backend/app/modules/worker/domain/rules.py`

**Descripción:** reglas puras de dominio que calculan, ante cada evento relevante (cierre de turno, cancelación confirmada), el conjunto de insignias y el nivel de gamificación que le corresponden **hoy** a un trabajador, a partir de sus métricas actuales.

**Regla central — sin histéresis:** no hay insignia o nivel "ganado" que se conserve independientemente de las métricas vigentes; todo se recalcula desde cero en cada evento, de modo que un trabajador puede perder una insignia o bajar de nivel si sus métricas ya no alcanzan el umbral correspondiente.

**Insignias:** `nunca_falto` (cero cancelaciones y cero no-shows con un mínimo de eventos completados — un no-show rompe la insignia igual que una cancelación, por ser una señal peor), `top_mozo`/`top_bartender` (rating y volumen mínimos en el rol), `eventos_premium` (volumen de eventos completados).

**Niveles:** bronce, plata, oro, platino — por volumen de eventos completados con un piso de rating, para evitar que el volumen puro sin calidad haga subir de nivel.

**Innovación:** el diseño "recalcular siempre, nunca conservar" es una decisión de negocio deliberada (documentada en ADR-0004) que prioriza que la insignia/nivel reflejen siempre el estado real y actual del trabajador, sobre la gratificación de conservar un logro pasado.

---

### 2.4 Asistente de inteligencia artificial con contexto acotado por comercio

**Archivo de referencia:** `backend/app/modules/assistant/application/services.py`

**Descripción:** capa de aplicación original que construye, para cada consulta al asistente de IA, un resumen de "lo habitual" de un comercio específico (puesto más pedido, horario típico, pago típico mediana, si suele incluir propinas o comida) a partir únicamente de sus propios turnos ya publicados — sin memoria persistente añadida ni entrenamiento de modelo.

**Regla de umbral mínimo:** con menos de un mínimo de turnos previos, no se envía contexto al modelo de lenguaje, para no arriesgar una inferencia sobre una muestra de un único dato.

**Regla de precedencia:** el contexto histórico completa lo que el texto del comercio no menciona explícitamente; nunca contradice lo que el texto sí indica.

**Innovación:** un asistente de IA genérico sin este contexto responde igual para cualquier comercio; este diseño hace que el asistente aprenda del patrón operativo de cada comercio en particular sin necesidad de almacenamiento adicional ni de reentrenamiento, recalculando el contexto en cada consulta a partir de datos que el sistema ya tenía.

---

### 2.5 Scheduler de asistencia y escalada por deadline dinámico

**Archivo de referencia:** `backend/app/modules/shift/application/scheduler.py`

**Descripción:** en vez de sondear la base de datos a un intervalo de reloj fijo, el proceso en segundo plano calcula, en cada pasada, cuál es la próxima acción real posible (un recordatorio de check-in, un no-show automático, una escalada de urgencia) entre todos los turnos activos, y duerme exactamente hasta ese instante — con un piso y un techo de seguridad — en vez de despertar cada N minutos las 24 horas.

**Mecanismo de interrupción:** un evento compartido despierta el loop antes de tiempo cuando una acción de negocio (publicar un turno, confirmar una asignación) crea una deadline nueva más próxima que la ya calculada.

**Innovación:** el diseño resuelve un problema real de eficiencia de cómputo bajo un proveedor de base de datos serverless con cuota mensual limitada (el sondeo fijo, sostenido con conexiones de base de datos abiertas, agotó la cuota de cómputo del plan gratuito de la base de datos en producción); el rediseño por deadline dinámica resuelve el problema de raíz en vez de simplemente espaciar el sondeo.

---

## 3. REGLAS DE NEGOCIO ORIGINALES

### 3.1 No-show vs. cancelación tardía, distinguidos y con penalización propia (ADR-0007)

El sistema distingue explícitamente dos incidentes que un modelo más simple trataría igual: el **no-show** (el trabajador no se presenta, el comercio se entera recién en el turno, sin aviso) y la **cancelación tardía** con el trabajador ya confirmado (el comercio cancela después de que el trabajador comprometió su disponibilidad). Cada uno penaliza a la parte responsable de forma diferenciada y alimenta el ranking de matching a través de los campos de desempeño.

### 3.2 Cadena de estados del turno con reactivación de postulantes

Al asignar un turno, los postulantes no elegidos pasan a `rechazada` de forma silenciosa; si el turno se reabre por rechazo, cancelación o no-show del trabajador asignado, esos postulantes vuelven automáticamente a `pendiente` en vez de perderse. Esta regla evita que un comercio deba re-solicitar postulaciones manualmente ante una reapertura.

### 3.3 No-disclosure como regla transversal de API

Cualquier recurso ajeno o inexistente responde siempre `404`, nunca `403`, en todas las rutas del sistema — una regla arquitectónica aplicada de forma consistente en las 17 capas `api/` de los módulos, para no filtrar por el código de estado la existencia de un recurso que el usuario no debería poder ver.

### 3.4 Degradación elegante por ausencia de credenciales

Cada integración externa (Cloudinary, Resend, Google, Web Push, Sentry, Gemini, Mercado Pago) se activa únicamente si su variable de entorno está presente; en su ausencia, la funcionalidad se desactiva sola (modo no-op o `503` explícito) sin romper el resto del sistema. El sistema completo funciona en cualquier subconjunto de sus capacidades opcionales, sin configuración adicional.

---

## 4. COMPONENTES INNOVADORES

### 4.1 Arquitectura DDD/hexagonal en 17 módulos con reglas de cruce explícitas

Cada módulo mantiene 4 capas (`domain`/`application`/`infrastructure`/`api`) con una regla de dependencia estricta (las dependencias apuntan siempre al dominio) y un patrón fijo para el cruce entre módulos: inyección del puerto/repositorio del otro módulo por constructor, nunca acoplamiento directo a su implementación interna. Esta disciplina, sostenida en 17 módulos y cientos de commits, es en sí misma un activo de ingeniería que reduce el costo de cambio futuro del sistema.

### 4.2 Reputación derivada, sin datos redundantes

El rating, `events_completed`, `punctuality_rate`, insignias y nivel de un trabajador (o el rating/`events_published`/`on_time_payment_rate` de un comercio) se derivan de eventos reales del ciclo del turno y de las reseñas, en vez de mantenerse como contadores editables independientes — evitando una clase entera de bugs de desincronización entre "lo que pasó" y "lo que dice el perfil".

### 4.3 Sesión con refresh token rotativo y detección de reuso

El refresh token vive únicamente en una cookie `httpOnly` (nunca en `localStorage` ni en el cuerpo de la respuesta), rota en cada uso y su reuso detectado revoca la sesión completa — un mecanismo de seguridad activo, no sólo un token de larga duración pasivo.

### 4.4 Idempotencia explícita en mutaciones críticas

Las operaciones críticas del ciclo del turno aceptan un header `Idempotency-Key`, para que un reintento de red por parte del cliente (mobile con conectividad inestable, típico del contexto de uso real del producto) no duplique el efecto de la operación.

---

## 5. ELEMENTOS POTENCIALMENTE REGISTRABLES

| Activo | Tipo de protección sugerida |
|---|---|
| Código fuente completo del sistema | Registro de obra de software |
| Motor de matching con scoring multi-factor | Componente del registro de software |
| Sistema de verificación por niveles de garantía (L0–L4) | Componente del registro de software |
| Motor de insignias y niveles de gamificación | Componente del registro de software |
| Asistente de IA con contexto acotado por comercio | Componente del registro de software |
| Scheduler de asistencia/escalada por deadline dinámico | Componente del registro de software |
| Identidad visual y sistema de diseño ("Oído") | Registro separado de obra artística / marca (opcional) |
| Nombre "Oído" | Registro marcario (opcional, fuera del alcance de este expediente) |

---

## 6. NOTA SOBRE EL NIVEL DE DIVULGACIÓN

Este documento describe los activos de propiedad intelectual al nivel necesario para su identificación y acreditación, sin exponer detalles de implementación que representen un secreto comercial operativo. Los algoritmos y reglas se describen por sus principios de funcionamiento, no por su código fuente completo. El código fuente íntegro constituye el activo principal de la obra y se presenta como parte del expediente de registro (repositorio privado `staffing-gastro`).

---

*Documento elaborado para expediente de registro de obra de software — Todos los derechos reservados — Julieta Arrazate — 2026*
