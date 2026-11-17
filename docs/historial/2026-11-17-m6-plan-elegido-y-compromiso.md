# M6 de la medición de la beta: plan elegido y compromiso de pago

**Pedido:** KR «locales que pagan o se comprometen» (fila M6 de
`planning/BETA_TABLERO.md`, «Antes de abrir: medir la beta»). Lo que no se
registra desde el primer comercio no se recupera después.

**Qué cambió:** el comercio no ve nada distinto. Por dentro:

- **(a) Plan elegido en el servidor.** `Subscription` suma `chosen_plan_code`
  y `chosen_plan_at`; `register_chosen_plan` sólo registra la primera vez (el
  del alta gana). `POST /subscription/plan-elegido` `{plan_code}`: plan
  desconocido, 422; repetido, 200 sin cambios. `/subscription` lo llama una
  vez, sin esperar ni mostrar error, cuando llega con un `?plan=` válido
  (`app/subscription/page.tsx`).
- **(b) Compromiso de pago («precio fundador»).** `payment_commitment_at`,
  `_plan_code` y `_price_ars` (pesos enteros, mayor a cero) con
  `register_payment_commitment` y `clear_payment_commitment`. La admin lo
  maneja con `PUT`/`DELETE /admin/users/{id}/payment-commitment`; usuario
  inexistente o que no es comercio, 404. `GET /admin/users/{id}` trae un
  bloque `subscription`. En la ficha de un comercio (`components/admin/PlanCompromiso.tsx`):
  plan actual, «Eligió <Plan> al darse de alta (dd/mm)» y el compromiso, con
  formulario para registrarlo y «Borrar» con confirmación.
- **(c) Métricas.** `GET /admin/subscription-stats` suma
  `companies_with_chosen_plan` (por plan), `committed_companies` y
  `committed_mrr_ars`, sin cuentas de prueba ni invitadas
  (`SubscriptionRepository.list_for_metrics`). Con el cobro prendido,
  `mrr_ars` cuenta sólo suscripciones `activa` con `paid_until` en el futuro;
  con el cobro apagado sigue como antes («Potencial si se cobrara»).
  `/admin/metricas` muestra «Eligieron un plan al darse de alta» y «Se
  comprometieron a pagar».
- Migración `0048` (columnas nullable, sin backfill).

**Por qué así:** no hay pantalla ni oferta de precio para el comercio (decisión
de Julieta pendiente). El compromiso vive en la suscripción y no como estado
de Crecimiento: es un dato por comercio, no un paso de un lead. La ficha ya
existía, así que el `GET` sumó el bloque `subscription` en vez de un endpoint
aparte. Las fechas se guardan en UTC y se muestran en hora argentina.

**Queda abierto:** si otro PR abierto también usa `0048`, quien mergee segundo
la renumera. Falta M7 (serie semanal).
