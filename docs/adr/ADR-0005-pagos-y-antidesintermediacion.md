# ADR-0005 — Pagos por la plataforma y anti-desintermediación

**Estado:** propuesto (decisiones de negocio tomadas por la operadora
2026-07-12; pendiente su OK final antes de implementar).
**Revisión (2026-07-12):** tras comparar modelos de monetización (referencia:
Morfy cobra registro gratis + comisión sobre ventas + suscripción mensual
variable por tráfico/ticket/impresiones), se invierte la decisión de
monetización: **mensualidad escalonada al comercio como modelo primario**, y
comisión/split de MP como opción posterior. Razón abajo (D1).
**Contexto previo:** [PAYMENTS.md](../PAYMENTS.md) (hoy `mark-paid` es un
placeholder, Staffya NO maneja dinero), [REPUTATION.md](../REPUTATION.md)
(`on_time_payment_rate` no se calcula), [SHIFT.md](../SHIFT.md).

## Contexto

El problema a resolver es la **desintermediación**: una vez que el comercio y
el trabajador entran en contacto por Staffya, tienen el incentivo de arreglar
por fuera (WhatsApp, efectivo) y saltear la plataforma. Hoy nada lo desalienta
porque el pago ocurre 100% afuera y la app solo lo deja asentado.

**Verdad honesta que enmarca todo el diseño:** no existe forma de *impedir* que
dos partes que quieren zafar arreglen por afuera. El objetivo no es impedir —
es hacer que **quedarse adentro convenga más que saltearse**, para ambos, y que
la comisión sea lo bastante baja como para que el ahorro de zafar no valga la
molestia ni el riesgo. Un pago por la plataforma no es solo monetización: es la
**palanca** que crea ese "conviene quedarse".

## Decisiones

### D1 — Monetización: **mensualidad escalonada al comercio** (primaria), comisión/split como opción posterior (operadora, 2026-07-12, revisado)
El comercio paga una **suscripción mensual** a Staffya por usar la plataforma.
El pago del turno al trabajador ocurre por fuera del alcance de este cobro
(hoy: `mark-paid` manual; ver D2 para el pago real más adelante).

Por qué la mensualidad y no la comisión, para esta etapa:
- **Mata la desintermediación de raíz** — que es el problema que originó este
  ADR. Con comisión, cada turno que pasa por la app le cuesta un % al comercio,
  así que saltearse los ahorra. Con mensualidad, **ya pagaron**: el turno n.º 50
  del mes sale lo mismo que el n.º 1, no hay ningún incentivo a irse por afuera.
  El incentivo a la fuga desaparece, no se "desalienta".
- **Mucho más simple y de menor riesgo legal**: es un cobro recurrente común
  (débito por MP), sin split de pagos, sin volverse manejador de fondos de
  terceros, sin la parte fiscal compleja del flujo comercio→trabajador. Para
  una beta con comercios reales es el camino de menor fricción.
- **Ingreso predecible** desde el primer comercio pago.

Estructura escalonada (para no espantar al local chico ni dejar plata del
grande sobre la mesa — patrón Morfy):
- **Nivel gratis / muy barato**: hasta N turnos publicados por mes (para probar).
- **Escalones pagos** por volumen de turnos cubiertos por mes. Montos = parámetro
  de configuración, no hardcode; se calibran en la beta.
- La contra reconocida: un comercio de muy bajo volumen no justifica un abono →
  el nivel gratis lo retiene hasta que crezca.

### D2 — Pago real comercio→trabajador: **diferido, split de Mercado Pago cuando se haga** (opción posterior, NO en la primera versión)
El cobro por la app del pago del turno (con las palancas de "cobro garantizado"
para el trabajador) queda como **fase posterior**, no en el primer release. Si/
cuando se implemente, el flujo recomendado sigue siendo el **split de Mercado
Pago**: el comercio paga por MP, MP descuenta una `application_fee` para Staffya
y acredita el neto al trabajador — **Staffya nunca retiene fondos de terceros**
(evita el terreno de entidad de pago / PSP; MP hace el KYC de ambas partes).
- En la primera versión (mensualidad), el pago del turno sigue por `mark-paid`
  manual. Las palancas anti-fuga de esa fase se sostienen igual con la
  reputación y la prueba de asistencia (ver abajo), aunque sin el "cobro
  garantizado", que llega recién con el split.
- Los dos modelos NO son excluyentes: a futuro puede coexistir una mensualidad
  base + comisión chica sobre los turnos pagados por la app (híbrido tipo Morfy),
  si los datos de la beta lo justifican.

## Diseño anti-desintermediación (las palancas que hacen "conviene quedarse")

Con la mensualidad (D1), la fuga del *comercio* ya no tiene incentivo: pagó el
abono, no ahorra nada saliéndose. Las palancas de abajo apuntan a que el
*trabajador* también prefiera quedarse, y a reforzar el valor del comercio.

Para el **trabajador** (que operar por la app le convenga más que por afuera):
- **Reputación e historial que solo cuentan on-platform**: un trabajador con
  muchos turnos hechos y bien calificados por la app tiene un perfil más fuerte
  y matchea mejor. Ese historial no existe si trabaja por afuera — es su capital.
- **Prueba de asistencia (check-in/out geo, ya existe)**: respalda al trabajador
  ante un conflicto ("fui, fiché") — algo que el arreglo por WhatsApp no le da.
- **[Fase posterior, con el split D2] Cobro garantizado y a tiempo**: el pago se
  libera al hacer check-out; si fue y fichó, cobra sí o sí. Esta es la palanca
  más fuerte del lado trabajador, y llega cuando se implemente el pago real.

Para el **comercio**:
- **Cero manejo de efectivo** + comprobante automático de cada pago.
- **`on_time_payment_rate` real** (cierra el gap de REPUTATION.md): el comercio
  que paga a tiempo por la app construye reputación que lo hace elegido por los
  mejores trabajadores. Pagar por afuera no suma nada.
- **Reemplazo/disputa**: si el trabajador no aparece, el pago no se libera
  (protección real que el arreglo por WhatsApp no da).

Realista, no ingenuo: estas palancas no bloquean el WhatsApp — lo vuelven menos
atractivo. La comisión baja (D1) es parte de la misma estrategia.

## Modelo técnico

### Fase 1 — Mensualidad (la que se construye primero)
- **Entidad `Subscription`** ligada al comercio (`Company`): plan (gratis /
  escalón pago), estado (activa / vencida / cancelada), período, `price` en
  `Decimal`. El **plan gatea features/capacidad** (p. ej. cantidad de turnos
  publicables por mes) — esa es la palanca de valor del abono.
- **Puerto `BillingGateway`** (patrón de puertos de ARCHITECTURE.md) con una
  implementación `MercadoPagoSuscripcionAdapter` (cobro recurrente simple de MP,
  NO split) detrás de un **feature-flag**: sin credenciales de MP en el entorno,
  la feature se apaga sola y el sistema opera sin cobro (misma disciplina de
  "cada integración es un flag"). Cero import de la capa de aplicación ajena.
- La verificación del estado de suscripción se consulta donde se gatea la
  feature (p. ej. al publicar un turno) — nunca bloquea el ciclo del turno ya
  en curso.

### Fase 2 — Pago real comercio→trabajador (diferido, cuando se decida)
- **Entidad `Payment`** ligada al turno (1–1 con `Shift`), estados propios:
  `pendiente` → `autorizado` (al confirmar) → `liberado` (al check-out) +
  `fallido`/`reembolsado`. NO reusa el estado `pagado` del turno: `pagado` queda
  como el marcador manual de fallback.
- **Puerto `PaymentGateway`** con `MercadoPagoSplitAdapter` (split /
  `application_fee`), mismo patrón de flag. Engancha la liberación al recálculo
  de `on_time_payment_rate` del comercio (puerto que REPUTATION.md §102 anticipa).
- Dinero en `Decimal` siempre.

## Lo que requiere la operadora (no automatizable)

Para la **Fase 1 (mensualidad)** — poco:
1. **Cuenta de Mercado Pago** de Staffya con credenciales para cobro recurrente
   (van al entorno/Render, nunca al código). Es una integración de suscripción
   estándar, mucho más simple que el split.
2. **Definir los escalones y montos** del abono (parámetros de config).

Para la **Fase 2 (split, si/cuando se haga)** — más:
3. Cuenta de **MP Marketplace** (split/`application_fee`).
4. **Onboarding de cobro del trabajador** (vincular su MP/CVU vía OAuth).
5. **Definición fiscal** (facturación, comprobantes, retenciones) con criterio
   contable local.

## Rollout (sin romper lo que anda)

1. **Fase 1**: se lanza la mensualidad con nivel gratis + escalones. El pago del
   turno sigue por `mark-paid` manual (sin cambios para el usuario). Beta cerrada
   de Palermo = primeros comercios en un escalón pago.
2. **Fase 2** (posterior, opcional): se agrega el split de MP como forma de pago
   del turno, opt-in por comercio, sin tocar la mensualidad ya andando.
3. Métrica de éxito de la palanca anti-fuga: **retención de comercios pagos mes a
   mes** (si renuevan el abono, la plataforma les da valor suficiente para no
   irse). En Fase 2 se suma el **% de turnos pagados por la app**.

## Consecuencias

- **A favor (Fase 1):** mata el incentivo a la desintermediación (ya pagaron el
  abono); ingreso predecible; construcción y riesgo legal mínimos (cobro
  recurrente, sin manejar fondos de terceros, sin fiscal complejo); lanzable en
  la beta ya.
- **En contra / costos:** el comercio de muy bajo volumen no paga (mitigado por
  el nivel gratis); el abono no captura el valor extra de los turnos de alto
  monto (se recupera en Fase 2 con un híbrido, si los datos lo justifican); MP
  cobra fee de procesamiento del cobro recurrente (chico, se descuenta).
- **Riesgo aceptado:** el "cobro garantizado" para el trabajador (la palanca más
  fuerte de su lado) recién llega en Fase 2; en Fase 1 el pago del turno sigue
  por fuera, sostenido por reputación + prueba de asistencia.

## Implementación (cuando la operadora dé el OK)

**Fase 1 (primera versión), tarea para ejecutores en orden:** (1) entidad
`Subscription` + planes/escalones + migración + puerto `BillingGateway` con un
`FakeGateway` para tests; (2) `MercadoPagoSuscripcionAdapter` (cobro recurrente)
detrás del feature-flag; (3) gating de capacidad por plan donde corresponda
(p. ej. publicar turno); (4) UI de planes + estado de suscripción para el
comercio. Cada paso con tests; el cobro es lógica de dinero → auditoría T1.

**Fase 2 (posterior, sólo si se decide):** entidad `Payment` + split de MP +
enganche confirmar/check-out + reputación de pago + onboarding MP del trabajador,
según el modelo técnico de arriba. `mark-paid` intacto como fallback en ambas
fases.
