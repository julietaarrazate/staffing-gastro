# M6 de la medición de la beta: plan elegido y compromiso de pago

**Pedido:** KR «locales que pagan o se comprometen» (fila M6 de
`planning/BETA_TABLERO.md`, «Antes de abrir: medir la beta»). Lo que no se
registra desde el primer comercio no se recupera después.

**Qué cambió:** el comercio no ve nada distinto. Por dentro:

- **(a) Plan elegido en el servidor.** `Subscription` suma `chosen_plan_code`
  y `chosen_plan_at`; `register_chosen_plan` sólo registra la primera vez (el
  del alta gana). `POST /subscription/plan-elegido` `{plan_code}`: plan
  desconocido, 422; repetido, 200 sin cambios. Lo llama el final de
  `/bienvenida` del comercio (`destinoTrasBienvenida` en `lib/plan-elegido.ts`),
  justo antes de borrar el plan guardado en el alta: eso es «al darse de alta»
  de verdad. Es best-effort, sin bloquear la navegación ni mostrar error.
  `/subscription?plan=` ya no registra nada: un comercio viejo con el link o la
  admin con «Ver como» no contaban como alta.
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
  Toda la sección (`total_companies`, `companies_by_plan`,
  `companies_at_plan_limit`, `mrr_ars` con el cobro apagado y prendido, plan
  elegido y compromisos) excluye las mismas cuentas: un solo universo, mismo
  denominador en «Comercios» y «Eligieron un plan».
  `/admin/metricas` muestra «Eligieron un plan al darse de alta» y «Se
  comprometieron a pagar».
- **Sin pisadas entre pedidos.** `SubscriptionRepository.update()` ya no
  escribe las 5 columnas nuevas (una entidad leída antes por un webhook de pago
  o un cambio de plan borraba un compromiso recién registrado). Se escriben con
  `set_chosen_plan` (`UPDATE ... WHERE chosen_plan_code IS NULL`: la primera
  gana en la base, aun con dos pedidos simultáneos), `set_payment_commitment` y
  `clear_payment_commitment`.
- Migración `0048` (columnas nullable, sin backfill).

**Por qué así:** no hay pantalla ni oferta de precio para el comercio (decisión
de Julieta pendiente). El compromiso vive en la suscripción y no como estado
de Crecimiento: es un dato por comercio, no un paso de un lead. La ficha ya
existía, así que el `GET` sumó el bloque `subscription` en vez de un endpoint
aparte. Las fechas se guardan en UTC y se muestran en hora argentina.

**Cómo leer los números:** con el cobro prendido, el ingreso mensual cuenta
`paid_until` estrictamente en el futuro: no incluye los 3 días de gracia que sí
permiten publicar. «Comprometido» (`committed_mrr_ars`) es el precio acordado
con cada comercio, no el de lista del plan.

**Queda abierto:** si otro PR abierto también usa `0048`, quien mergee segundo
la renumera. Falta M7 (serie semanal).
