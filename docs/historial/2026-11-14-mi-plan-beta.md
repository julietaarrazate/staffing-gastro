# «Mi plan» durante la beta: el uso sin alarma y sin tope inventado (G11, U093, BK-898A15047291)

**Pedido:** salida a beta, grupo G11. Con el cobro apagado (`SUBSCRIPTIONS_ENFORCED=false`) «Mi plan» decía «9 de 5 turnos usados», «Alcanzaste el límite» y ofrecía cambiar de plan por el tope, y nada se frena. Además «Pagado hasta» quedaba viejo con la pestaña abierta.

**Qué cambió:**
- `GET /subscription` devuelve `limite_exigido` (boolean): es `settings.subscriptions_enforced`, la misma bandera que lee `ShiftService` al publicar (`SubscriptionOverview.limit_enforced`, `api/schemas.py`, `api/routes.py`).
- `SubscriptionStatusCard`: con `limite_exigido === false` muestra «N turnos publicados este mes» y «Durante la beta no hay tope de turnos.», sin barra, sin «Te quedan N» ni «Alcanzaste el límite» ni «Mejorá tu plan». Con el tope exigido (o si el campo no viene) queda igual que antes. Helpers en `lib/subscription.ts` (`limiteExigido`, `usoSinTopeText`, `BETA_SIN_TOPE_TEXT`).
- `app/subscription/page.tsx`: bajo «Planes disponibles», con el tope sin exigir y sin cobro, el subtítulo dice que durante la beta no hay tope (antes «El plan gatea…»). `load({ silent: true })` + `useLiveRefresh` (pausado con diálogo, pago o baja en curso): «Pagado hasta» se vuelve a pedir al volver a la pestaña o a la red, sin esqueleto y sin pisar con un error pasajero.
- `PlanLimitModal` no cambia: sólo aparece con un 402 del servidor, que con el tope apagado no existe.

**Por qué así:** el servidor es quien sabe si el tope se exige; la pantalla no lo adivina por `billing_enabled`. El uso se sigue contando para cuando se encienda.

**Queda abierto:** nada de precios, planes ni flujo de pago se tocó. Las tarjetas de planes siguen listando «Hasta 5 turnos por mes» (es la oferta del plan para cuando haya cobro).
