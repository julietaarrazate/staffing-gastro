# PAYMENTS.md — Pagos (dominio)

> Estado del flujo de dinero. **Importante:** hoy es un **placeholder**; este
> documento describe el negocio esperado y marca claramente qué está y qué falta.
> Ver [PRODUCT.md](../foundation/PRODUCT.md#fuera-de-alcance-hoy) y
> [SHIFT.md](./SHIFT.md#ciclo-de-vida-modo-uber).

## Estado actual (realidad del código)

- El turno tiene un estado `pagado` y un campo `paid_at`.
- La acción **"marcar como pagado"** (`mark-paid`) sólo **registra que el comercio
  pagó por fuera** (cambia el estado a `pagado`). **No procesa ningún cobro** ni
  mueve dinero.
- No hay integración con ninguna pasarela, ni comisiones, ni comprobantes.

> **Por lo tanto: Staffya hoy NO maneja dinero.** El pago ocurre fuera de la
> plataforma; la app sólo lo deja asentado.

## Negocio esperado (roadmap — Fase 12 del master plan)

Cuando se implemente el pago real, el dominio debería contemplar:

- **Monto y moneda:** ya viven en el turno (`pay_amount`, `currency`, `tips`).
- **Actores del pago:** comercio (paga) → trabajador (cobra), con Staffya como
  intermediario.
- **Medios:** MercadoPago, transferencias.
- **Ciclo del pago:** autorización → cobro → liquidación al trabajador →
  comprobante/factura.
- **Estados de pago** propios (pendiente, retenido, liberado, fallido,
  reembolsado) — probablemente una entidad `Payment` real ligada al turno.
- **Reputación de pago:** `on_time_payment_rate` del comercio debería derivarse de
  estos pagos reales (hoy no se calcula; ver [REPUTATION.md](./REPUTATION.md)).
- **Reglas fiscales/legales:** facturación, comprobantes, retenciones (a definir
  con criterio local AR).

## Reglas de negocio (hoy)

- Sólo el **comercio dueño** puede marcar un turno como pagado.
- Sólo se marca pagado un turno ya **finalizado**.
- `pagado` es un estado **terminal** del turno.

## Qué falta (para producción)

1. Definir el **modelo de pago** (entidad `Payment`, estados, relación con turno).
2. Integrar **MercadoPago** (ver `MERCADOPAGO.md`, fase de integraciones).
3. Definir **comisión** de Staffya (si aplica) y liquidación.
4. **Comprobantes/facturación**.
5. Derivar la **reputación de pago** del flujo real.

Todo esto requiere decisiones importantes → **ADR** antes de implementar.
