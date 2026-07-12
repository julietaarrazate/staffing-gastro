# ADR-0005 — Pagos por la plataforma y anti-desintermediación

**Estado:** propuesto (decisiones de negocio tomadas por la operadora
2026-07-12; pendiente su OK final antes de implementar).
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

### D1 — Quién paga la comisión: **el comercio** (operadora, 2026-07-12)
El comercio paga el turno + un % para Staffya. El trabajador cobra el **100%**
de lo pactado. Razón: el trabajador nunca ve un descuento → se vuelve fanático
de cobrar por la app (es el lado con más incentivo a saltear si le sacaran
algo); el comercio ya factura y absorbe mejor el %.
- **Comisión sugerida de arranque: 8–12% al comercio.** Baja a propósito: por
  encima de ~15% el ahorro de zafar empieza a valer la molestia. El número
  exacto es un parámetro de configuración, no hardcode — se calibra con datos.

### D2 — Flujo del dinero: **split de Mercado Pago** (recomendación del diseño)
El comercio paga por Mercado Pago; MP **reparte automáticamente** la comisión de
Staffya y le gira el resto al trabajador. **Staffya NUNCA retiene fondos de
terceros.**
- Razón: retener plata ajena (escrow propio) te convierte en manejador de
  fondos de terceros → carga regulatoria alta en Argentina (terreno de entidad
  de pago / PSP). El split de MP evita eso: MP mueve el dinero y hace el KYC de
  ambas partes. Es la forma nativa y de menor riesgo legal.
- Mecanismo concreto: MP Marketplace / `application_fee` en el pago dividido
  (el comercio paga, MP descuenta `application_fee` para la cuenta de Staffya y
  acredita el neto a la cuenta del trabajador).

## Diseño anti-desintermediación (las palancas que hacen "conviene quedarse")

Para el **trabajador** (que cobre por la app le convenga más que el efectivo):
- **Cobro garantizado y a tiempo**: el pago se autoriza al confirmar y se
  libera al hacer **check-out** (prueba de asistencia que ya existe, geo). El
  trabajador sabe que si fue y fichó, cobra sí o sí — no depende de la buena
  voluntad del comercio.
- **Historial de pagos = reputación que solo cuenta on-platform**: un trabajador
  con muchos turnos cobrados por la app tiene un perfil más fuerte y matchea
  mejor. Ese historial no existe si trabaja por afuera.

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

- **Entidad `Payment`** ligada al turno (relación 1–1 con `Shift`), con estados
  propios: `pendiente` → `autorizado` (al confirmar) → `liberado` (al check-out)
  · más `fallido` y `reembolsado`. NO reusar el estado `pagado` del turno para
  esto: `pagado` queda como el marcador manual de fallback (ver Rollout).
- **Puerto `PaymentGateway`** (patrón de puertos de ARCHITECTURE.md) con una
  implementación `MercadoPagoSplitAdapter` detrás de un **feature-flag**: sin las
  credenciales de MP en el entorno, la feature se apaga sola y sigue vigente el
  `mark-paid` manual actual (misma disciplina de "cada integración es un flag"
  que ya usa el resto del sistema). Cero import de la capa de aplicación ajena.
- **Dinero en `Decimal`** siempre (regla del repo). Montos: los del turno
  (`pay_amount`, `currency`, `tips`) + `application_fee` derivado del % de D1.
- **Reputación**: enganchar la liberación del pago al recálculo de
  `on_time_payment_rate` del comercio (el puerto que REPUTATION.md §102 ya
  anticipa).

## Lo que requiere la operadora (no automatizable)

1. **Cuenta de Mercado Pago Marketplace / aplicación de desarrollador** de
   Staffya, con las credenciales (client_id/secret, access_token) — van al
   entorno (Render), nunca al código.
2. **Onboarding de cobro del trabajador**: cada trabajador vincula su cuenta/CVU
   de MP para poder recibir el split (flujo OAuth de MP). Sin esto, ese
   trabajador cobra por el fallback manual.
3. **Definición fiscal** (facturación, comprobantes, retenciones): a resolver
   con criterio contable local antes de escala. Se puede lanzar la beta con el
   split funcionando y la parte fiscal como fase siguiente — marcado como riesgo
   aceptado para la beta cerrada.

## Rollout (sin romper lo que anda)

1. `mark-paid` manual **se mantiene** como fallback durante toda la transición
   (un comercio sin MP, o un trabajador sin cuenta vinculada, sigue operando).
2. El split de MP es **opt-in por comercio**: se activa cuando el comercio
   vincula MP. Beta cerrada de Palermo = primeros comercios reales con split.
3. Métrica de éxito de la palanca: **% de turnos pagados por la app vs por
   afuera** (los que quedan en `mark-paid` manual son señal de fuga).

## Consecuencias

- **A favor:** captura de la transacción (el modelo de negocio real de Staffya),
  reputación de pago que se vuelve verdadera, protección para ambos lados,
  mínima carga legal por no retener fondos.
- **En contra / costos:** MP cobra su fee de procesamiento (se descuenta del
  flujo, no lo paga Staffya); dependencia de la disponibilidad de MP; onboarding
  extra (vincular MP) que agrega fricción al trabajador — mitigado por el
  fallback manual.
- **Riesgo aceptado para la beta:** la parte fiscal/facturación se resuelve en
  fase siguiente; la beta cerrada opera con el split y comprobante básico de MP.

## Implementación (cuando la operadora dé el OK)

Tarea para ejecutores, en orden: (1) entidad `Payment` + estados + migración +
puerto `PaymentGateway` con un `FakeGateway` para tests; (2)
`MercadoPagoSplitAdapter` detrás del feature-flag; (3) enganche
confirmar→autorizar y check-out→liberar en `ShiftService` vía el puerto; (4)
`on_time_payment_rate` derivado de pagos reales; (5) UI de vinculación de MP
(comercio y trabajador) + estado de pago en el turno. `mark-paid` intacto como
fallback. Cada paso con tests; el split es lógica de dinero → auditoría T1.
