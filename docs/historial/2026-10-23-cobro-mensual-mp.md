# Cobro mensual real con Mercado Pago, sin débito automático (#497)

**Pedido:** Julieta (2026-10-23, "vamos con todo"): que pagar el plan sea
real, pero sin débito automático con tarjeta de crédito por la comisión. Un
pago por mes con Mercado Pago, con el medio más barato.

**Qué cambió:** con el cobro prendido, en "Mi plan" el comercio elige o
renueva su plan y va a Checkout Pro (en la compu un QR para la app de Mercado
Pago, en el celular la app), sin tarjeta de crédito. Al volver ve "¡Listo!",
"pendiente" o "no se completó" (`?pago=ok|pendiente|error`). Ve hasta cuándo
está pago, tiene "Pagar 30 días más", "Dar de baja" y, dentro de los 10 días
del primer pago, "Arrepentirme" (devolución). Si no pagó, publicar un turno
abre un modal "Activá tu plan para publicar". Le llegan avisos (in-app y
mail) 3 días antes, el día que vence y cuando pasa a vencido. Con el cobro
apagado (hoy) todo se ve y funciona como antes.

Técnico:
- `backend/app/modules/subscription/`: `Subscription` suma `paid_until`,
  `renews`, `expiry_notice` y el estado `pendiente`; nueva entidad
  `SubscriptionPayment` (tabla `subscription_payments`, migración `0039`,
  `mp_payment_id` único). Puerto `BillingGateway` nuevo (`create_checkout`,
  `get_payment`, `refund_payment`); `MercadoPagoCheckoutAdapter` reemplaza al
  de preapproval, que se borró. Firma del webhook en
  `infrastructure/mercadopago_signature.py`. Casos de uso en
  `SubscriptionService` (`subscribe`, `handle_payment_notification`,
  `cancel_renewal`, `withdraw`, `run_expiry_check`). Rutas
  `POST /subscription/cancel-renewal`, `/withdraw`,
  `/webhooks/mercadopago`.
- `shift`: publicar (y crear eventos) pide mes pago vigente cuando
  `settings.billing_enforced` (tope prendido + credenciales); 402 con
  mensaje propio. Quinto chequeo del scheduler:
  `subscription/infrastructure/expiry_job.py`.
- `core/config.py`: `MERCADOPAGO_WEBHOOK_SECRET`, `API_PUBLIC_URL`,
  `billing_enabled`, `billing_enforced`. `render.yaml`: las dos credenciales
  con `sync: false`.
- Frontend: `app/subscription/page.tsx`, `SubscriptionStatusCard`,
  `PlanCard`, `PlanLimitModal`, `lib/subscription.ts`; tipos de aviso
  `subscription_*` en `lib/types.ts` y `lib/notification-link.ts`.
- Términos: "Suscripciones del comercio" describe el pago mes a mes y los
  botones de baja y arrepentimiento; `LEGAL_TERMS_VERSION` a `2026-10-23`
  (backend y `frontend/lib/legal.ts`).
- Tests: `backend/tests/test_subscription_cobro.py`,
  `frontend/lib/subscription.test.ts`, `frontend/e2e/subscription.spec.ts`.

**Por qué así:** ver [ADR-0021](../adr/ADR-0021-cobro-mensual-sin-debito-automatico.md).
Se descartó el preapproval (comisión de crédito), un QR estático (no se sabe
quién pagó qué) y activar por la vuelta del navegador (falsificable). El
webhook firmado más la lectura del pago por API es lo único que acredita.

**Queda abierto:** que Julieta cree la app en Mercado Pago y cargue las dos
credenciales en Render (pasos en
[`PENDIENTE_OPERATIVO.md`](../reference/PENDIENTE_OPERATIVO.md)), pruebe con un
comercio propio y decida cuándo poner `SUBSCRIPTIONS_ENFORCED=true` (los
comercios de la beta quedan bloqueados hasta su primer pago). Confirmar en su
cuenta la comisión real de Checkout Pro. Un link pagado dos veces se loguea
para devolverlo a mano. Ítem 7 de [`STATUS.md`](../STATUS.md).
