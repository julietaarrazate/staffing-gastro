"use client";

import { SubscriptionPlan } from "@/lib/types";
import { formatArs } from "@/lib/format";
import { Button } from "@/components/ui";

/** Qué falta con el plan elegido en la landing. */
export type EstadoPlanElegido = "elegir" | "pagar" | "listo";

/**
 * Arriba de "Mi plan", cuando el comercio llega con el plan que eligió en los
 * precios de la landing (`/subscription?plan=<code>`, `lib/plan-elegido.ts`).
 * No es un flujo de pago nuevo: el botón abre la misma confirmación que las
 * tarjetas de abajo (cambio inmediato con el cobro apagado, Mercado Pago con
 * el cobro prendido, ADR-0022). Es el único ámbar de la pantalla mientras se
 * muestra: las tarjetas pasan a botones sin acento.
 *
 * - `elegir`: no es su plan todavía → activarlo (o pagarlo).
 * - `pagar`: ya es su plan, pero falta pagar el mes (cobro prendido).
 * - `listo`: ya es su plan y no falta nada → sólo lo dice, sin botón.
 */
export default function PlanElegidoAviso({
  plan,
  estado,
  billing,
  busy,
  onActivar,
}: {
  plan: SubscriptionPlan;
  estado: EstadoPlanElegido;
  billing: boolean;
  busy: boolean;
  onActivar: () => void;
}) {
  const precio = typeof plan.price_ars === "string" ? Number(plan.price_ars) : plan.price_ars;
  const tope = plan.max_turnos_mes === null ? "turnos sin tope" : `hasta ${plan.max_turnos_mes} turnos por mes`;
  const detalle =
    estado === "elegir"
      ? `${formatArs(precio)}/mes, ${tope}.`
      : estado === "pagar"
        ? "Ya es tu plan: pagá el mes para empezar a publicar turnos."
        : "Ya es tu plan.";

  return (
    <div
      data-testid="plan-elegido"
      className="mt-5 flex flex-col gap-3 rounded-2xl bg-secondary-tint p-4 ring-1 ring-line sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="text-sm font-bold text-ink">Elegiste el plan {plan.name}</p>
        <p className="mt-0.5 text-sm text-ink-soft">{detalle}</p>
      </div>
      {estado !== "listo" && (
        <Button size="sm" loading={busy} disabled={busy} onClick={onActivar} className="shrink-0">
          {billing ? "Pagar con Mercado Pago" : "Activar este plan"}
        </Button>
      )}
    </div>
  );
}
