# Sin plan gratis: el comercio arranca en Inicial, $9.900 por mes

**Pedido:** Julieta, 2026-10-22. No quiere plan gratis: "la gente entra para
copiarte". Entre un plan bajo pago, una entrada con CUIT y llamada, o las dos
cosas, eligió el plan bajo pago.

**Qué cambió:** en la landing, en `/subscription` y en el panel de admin el
plan "Gratis" pasa a ser "Inicial", $9.900 por mes y hasta 5 turnos. La
landing deja de decir "empezás gratis" para el comercio (para el trabajador
sigue siendo gratis). Técnico:

- `backend/app/modules/subscription/domain/plans.py`: `gratis` → `inicial`,
  que también es el plan por defecto.
- Migración `0038_plan_gratis_a_inicial.py`: pasa las suscripciones de
  `gratis` a `inicial` (solo datos).
- Frontend: `components/landing/planes.ts`, `Precios.tsx`, `story/Carta.tsx`,
  `story/ActoNoche.tsx`, `story/BandaOido.tsx`, `lib/business-invite.ts` y la
  etiqueta de `app/admin/metricas/page.tsx`. Se fue la rama de "$0 para
  siempre" de las tarjetas de precios.
- Tests de backend y E2E actualizados al tope de 5 turnos.
- Decisión en `docs/adr/ADR-0020-sin-plan-gratis.md`.

**Por qué así:** cambiar el catálogo es editar datos de configuración, sin
tocar el dominio. Con el cobro apagado, Inicial queda activo sin pagar como
ya pasaba con Básico y Pro, así la beta sigue andando mientras se arma el
cobro real.

**Queda abierto:** el cobro real con Mercado Pago, que es lo que hace que
pagar sea condición de entrada (ítem en `STATUS.md`).
