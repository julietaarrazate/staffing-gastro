"use client";

import { SubscriptionPlan } from "@/lib/types";
import { formatArs } from "@/lib/format";
import { Badge, Button, Card } from "@/components/ui";
import { CheckIcon, SparklesIcon } from "@/components/icons";

/**
 * Tarjeta de un plan en la pantalla de planes (ADR-0005, Fase 1). Marca el
 * plan actual y decide la etiqueta del botón: "Mejorá tu plan" si el destino
 * es más caro que el actual, "Elegí este plan" en cualquier otro cambio.
 */
export default function PlanCard({
  plan,
  isCurrent,
  currentPriceArs,
  onSelect,
  busy,
}: {
  plan: SubscriptionPlan;
  isCurrent: boolean;
  currentPriceArs: number;
  onSelect: () => void;
  busy: boolean;
}) {
  const priceArs = typeof plan.price_ars === "string" ? Number(plan.price_ars) : plan.price_ars;
  const isUpgrade = priceArs > currentPriceArs;

  return (
    <Card className={`flex flex-col p-5 ${isCurrent ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-extrabold text-ink">{plan.name}</h3>
        {isCurrent && <Badge tone="primary">Tu plan actual</Badge>}
      </div>

      <p className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-extrabold text-ink">{formatArs(priceArs)}</span>
        <span className="text-sm font-medium text-ink/50">/mes</span>
      </p>

      <p className="mt-1 text-sm font-semibold text-ink/60">
        {plan.max_turnos_mes === null
          ? "Turnos ilimitados por mes"
          : `Hasta ${plan.max_turnos_mes} ${plan.max_turnos_mes === 1 ? "turno" : "turnos"} por mes`}
      </p>

      <ul className="mt-4 flex flex-1 flex-col gap-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-ink/60">
            <CheckIcon size={16} className="mt-0.5 shrink-0 text-secondary" />
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-5">
        {isCurrent ? (
          <Button fullWidth variant="surface" disabled>
            Plan actual
          </Button>
        ) : (
          <Button
            fullWidth
            variant={isUpgrade ? "primary" : "surface"}
            leftIcon={isUpgrade ? <SparklesIcon size={16} /> : undefined}
            loading={busy}
            disabled={busy}
            onClick={onSelect}
          >
            {isUpgrade ? "Mejorá tu plan" : "Elegí este plan"}
          </Button>
        )}
      </div>
    </Card>
  );
}
