# ADR-0020 — Sin plan gratis: el escalón de entrada es pago

**Estado:** aceptado · **Fecha:** 2026-10-22 · **Reemplaza en parte a:** ADR-0005 ("nivel gratis")

## Contexto

El ADR-0005 lanzó la mensualidad del comercio con un nivel gratis (3 turnos
por mes) más Básico y Pro. Julieta (2026-10-22) no quiere un plan gratis: en
un producto como Oído, el acceso gratis lo usa sobre todo quien entra a mirar
y copiar (otro emprendimiento de staffing), no el comercio que necesita
cubrir un turno. Se evaluaron tres caminos: un plan bajo pago, una entrada
con CUIT y una llamada con Julieta, o las dos cosas. Eligió el plan bajo pago.

## Decisión

1. **No hay plan gratis.** El escalón más bajo es **Inicial: $9.900 por mes,
   hasta 5 turnos publicados**. Básico ($20.000, 15 turnos) y Pro ($45.000,
   sin tope) quedan como estaban. Los valores viven en
   `backend/app/modules/subscription/domain/plans.py` y se calibran ahí.
2. **Cada comercio nuevo arranca en Inicial** (`DEFAULT_PLAN_CODE`). Las
   suscripciones que estaban en `gratis` pasan a `inicial` (migración `0038`).
3. **Mientras el cobro real esté apagado** (sin `MERCADOPAGO_ACCESS_TOKEN`),
   el plan Inicial queda activo sin pagar, igual que hoy pasa con Básico y
   Pro: la beta sigue funcionando. El filtro de verdad llega con el cobro
   real, que queda como trabajo aparte (ver "Queda abierto").
4. Los trabajadores siguen sin pagar nada: este ADR es sólo del comercio.

## Consecuencias

- La landing deja de decir "gratis" para el comercio; muestra "desde $9.900
  por mes, sin comisión por turno".
- El MRR del panel de admin cuenta las suscripciones Inicial activas. Con el
  cobro apagado es MRR potencial, como ya pasaba con Básico y Pro
  (`billing_enabled` lo distingue).
- Los términos ya hablaban de "planes pagos" con precios visibles, baja y
  arrepentimiento, así que no cambia el texto legal.

## Queda abierto

Para que pagar sea condición de entrada falta el cobro real: confirmar el pago
de Mercado Pago (webhook) antes de activar el plan, guardar el estado
"pendiente", bloquear la publicación hasta el primer pago, corregir el
`back_url` del checkout (apunta a `staffya.com`) y el botón de baja y de
arrepentimiento en `/subscription`. Necesita la cuenta de Mercado Pago de
Julieta.

**Actualización 2026-10-23:** todo lo de "Queda abierto" está hecho en el
[ADR-0022](./ADR-0022-cobro-mensual-sin-debito-automatico.md) (un pago por
mes con Checkout Pro, sin débito automático). Falta que Julieta cargue las
credenciales de Mercado Pago.
