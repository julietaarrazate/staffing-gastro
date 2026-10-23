# ADR-0022 — Cobro mensual con Mercado Pago, sin débito automático

**Estado:** aceptado · **Fecha:** 2026-10-23 · **Completa a:** ADR-0005 (Fase 1, mensualidad) y ADR-0020 (sin plan gratis)

## Contexto

Desde el ADR-0020 no hay plan gratis: el escalón de entrada es Inicial
($9.900 por mes, 5 turnos). Pero el cobro seguía apagado y el código tenía
un adaptador de **preapproval** (suscripción con débito automático a tarjeta)
que nunca se usó, con el `back_url` apuntando a `staffya.com`. Faltaba todo
lo que hace que pagar sea real: confirmar el pago, guardar "pendiente",
bloquear la publicación hasta pagar, vencimiento, baja y arrepentimiento.

Julieta (2026-10-23, "vamos con todo") no quiere débito automático con
tarjeta de crédito por la comisión. Prefiere que el comercio pague **un pago
por mes** con Mercado Pago, con el medio más barato posible.

## Decisión

1. **Un pago por mes con Checkout Pro**, no preapproval. Cada mes el
   comercio elige o renueva su plan en `/subscription`; el backend crea una
   **preferencia** y lo manda a su `init_point` (en la compu Mercado Pago
   muestra un QR para pagar desde la app; en el celular abre la app). Un mes
   pago son **30 días** (`PERIOD_LENGTH`).
2. **Sin tarjeta de crédito** (`payment_methods.excluded_payment_types:
   [{"id": "credit_card"}]`, una sola cuota). Quedan dinero en cuenta,
   débito y lo que Mercado Pago ofrezca además (transferencia, etc.). La
   comisión más baja es la de **dinero en cuenta: 0,8 % + IVA, según la
   página de cobro con QR de Mercado Pago al 2026-10-23 — verificar** en la
   cuenta de Julieta antes de prender, porque varía por provincia y por
   producto (la tabla de Checkout Pro puede no ser la misma que la de QR).
3. **El webhook es la única fuente de verdad.** `POST
   /api/v1/subscription/webhooks/mercadopago`:
   - valida `x-signature` con `MERCADOPAGO_WEBHOOK_SECRET` (HMAC-SHA256 en
     hex sobre el manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`,
     con `data.id` del query param en minúsculas); firma mala → 401;
   - **lee el pago de la API** (`GET /v1/payments/{id}`) y sólo si está
     `approved` **y** el monto y la moneda coinciden con el intento
     (`external_reference` = id interno del intento) acredita el mes;
   - es **idempotente por id de pago** (columna única `mp_payment_id` y una
     aprobación condicional en una sola sentencia, `try_approve`): la misma
     notificación dos veces acredita un solo mes.
   La vuelta del navegador (`/subscription?pago=ok|pendiente|error`) sólo
   muestra un mensaje; nunca activa nada.
4. **Extensión:** si el mes anterior sigue vigente (incluida la gracia), el
   nuevo se suma desde `paid_until`; si no, arranca el día del pago. Cambiar
   de plan aplica el plan nuevo ya y **conserva los días pagos** (no se
   prorratea: el comercio no pierde nada). `paid_until` es un reloj aparte de
   la ventana de uso del contador de turnos (`period_start/period_end`), para
   que pagar antes no estire la ventana.
5. **Estados:** `pendiente` (comercio nuevo con el cobro exigido, nunca
   pagó), `activa`, `vencida` (pasó `paid_until` + 3 días de gracia),
   `cancelada` (arrepentimiento, o baja que llegó al fin del período).
6. **Bloqueo al publicar** sólo con el cobro real exigido:
   `SUBSCRIPTIONS_ENFORCED=true` **y** las dos credenciales cargadas
   (`settings.billing_enforced`). Sin mes pago vigente, publicar (y crear un
   evento) responde **402** "Tu plan no está activo…" y el frontend muestra
   un modal con "Ir a pagar el mes". El tope de turnos del plan sigue igual
   que antes.
7. **Vencimiento** en el scheduler en proceso (quinto chequeo de
   `shift/application/scheduler.py`, lógica en `SubscriptionService.
   run_expiry_check`): aviso in-app + email 3 días antes y el día que vence;
   a los 3 días de gracia pasa a `vencida` y se avisa. Duerme hasta la
   próxima deadline como los otros chequeos; con el cobro apagado no toca la
   base.
8. **Baja:** botón "Dar de baja" en `/subscription`. Como el pago es manual
   no hay débito que cortar: deja de recordar el pago y el plan sigue hasta
   `paid_until` (después queda `cancelada`).
9. **Arrepentimiento** (Ley 24.240, art. 34): botón "Arrepentirme" dentro de
   los **10 días corridos** (hora argentina) del primer pago aprobado.
   Reembolso total por la API (`POST /v1/payments/{id}/refunds` con
   `X-Idempotency-Key`) y el plan pasa a `cancelada` en el acto. Una sola
   vez por comercio.
10. **Feature-flag por ausencia:** sin `MERCADOPAGO_ACCESS_TOKEN` **y**
    `MERCADOPAGO_WEBHOOK_SECRET`, todo sigue como en la beta (Inicial activo
    sin pagar, cambiar de plan es inmediato, sin bloqueo, el webhook
    responde 404). Las dos van en `render.yaml` con `sync: false`.
11. Se **borra** el adaptador de preapproval (`MercadoPagoSuscripcionAdapter`)
    en vez de dejarlo como código muerto; lo reemplaza
    `MercadoPagoCheckoutAdapter`. Los `back_urls` salen de `FRONTEND_URL`
    (`https://www.oido.com.ar`) y el `notification_url` de
    `API_PUBLIC_URL` (`https://api.oido.com.ar`).

## Lo que se descartó

- **Preapproval / débito automático:** comisión de tarjeta de crédito, que
  es justo lo que Julieta quiere evitar. Además obliga a manejar estados de
  la suscripción del lado de Mercado Pago (pausas, reintentos de cobro).
- **QR estático / transferencia a mano:** sin `external_reference` no hay
  forma confiable de saber qué comercio pagó qué plan; habría que conciliar
  a mano.
- **Confiar en la vuelta (`back_url`) para activar:** la puede fabricar
  cualquiera; el webhook firmado más la lectura del pago por API, no.

## Consecuencias

- El comercio tiene que acordarse de pagar cada mes: por eso los avisos de
  3 días antes, del día del vencimiento y los 3 días de gracia.
- Un mismo link pagado dos veces no acredita dos meses: se loguea
  `subscription.payment.extra_payment` para devolverlo a mano.
- Montos en ARS fijos de `plans.py`; si cambian, los intentos ya creados se
  validan contra el monto que tenían al crearse.
- El webhook entra por Cloudflare (ADR-0018). Si Cloudflare lo bloqueara
  (WAF, bot fight), Mercado Pago reintenta y el pago no se acredita hasta
  que pase: probarlo con la "Simulación" del panel de Mercado Pago.

## Referencias (documentación oficial de Mercado Pago, consultada el 2026-10-23)

Desde el entorno de esta sesión el dominio de Mercado Pago no resolvía, así
que se confirmó por los resultados de búsqueda de las páginas oficiales;
conviene que quien prenda el cobro las relea:

- Webhooks y validación de `x-signature` (manifest `id`/`request-id`/`ts`,
  HMAC-SHA256 en hex, `data.id` en minúsculas si es alfanumérico):
  https://www.mercadopago.com/developers/es/docs/your-integrations/notifications/webhooks
- Preferencias de Checkout Pro (`back_urls`, `auto_return`,
  `notification_url`, `external_reference`, `payment_methods.excluded_payment_types`):
  https://www.mercadopago.com/developers/en/docs/checkout-pro/checkout-customization/preferences
- Reembolsos `POST /v1/payments/{id}/refunds` (con `X-Idempotency-Key`):
  https://www.mercadopago.com.ar/developers/en/reference/online-payments/checkout-pro/create-refund/post
- `POST /checkout/preferences` (respuesta con `id` e `init_point`) y
  `GET /v1/payments/{id}` (`status`, `transaction_amount`, `currency_id`,
  `external_reference`, `date_approved`) están en la referencia de la API de
  Checkout Pro del mismo sitio; no se pudieron abrir desde la sesión.
- Comisión de cobro con QR con dinero en cuenta (0,8 % + IVA según notas de
  prensa que citan la página de costos de Mercado Pago, 2026): verificar en
  "Costos" de la cuenta de Mercado Pago de Julieta antes de prender.
