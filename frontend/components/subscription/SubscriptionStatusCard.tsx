"use client";

import { Subscription } from "@/lib/types";
import { formatArs } from "@/lib/format";
import { Badge, Button, Card } from "@/components/ui";
import { AlertTriangleIcon } from "@/components/icons";

const STATUS_TONE: Record<string, { tone: "secondary" | "danger" | "neutral"; label: string }> = {
  activa: { tone: "secondary", label: "Activo" },
  vencida: { tone: "danger", label: "Vencido" },
  cancelada: { tone: "neutral", label: "Cancelado" },
};

/** Umbral de "casi al límite": cuando quedan pocos turnos, avisamos antes de que falle publicar. */
const LOW_REMAINING_THRESHOLD = 2;

/**
 * Estado del plan actual del comercio (ADR-0005, Fase 1): plan, turnos usados
 * vs. límite del mes con barra de progreso, y aviso + CTA cuando está
 * cerca/al límite. `planName` viene de cruzar `plan_code` con `/subscription/plans`
 * porque el endpoint de estado no trae el nombre.
 */
export default function SubscriptionStatusCard({
  subscription,
  planName,
  onUpgrade,
}: {
  subscription: Subscription;
  planName: string;
  onUpgrade: () => void;
}) {
  const { max_turnos_mes, turnos_usados_mes, status, price_ars } = subscription;
  const statusInfo = STATUS_TONE[status] ?? { tone: "neutral" as const, label: status };

  const unlimited = max_turnos_mes === null;
  const remaining = unlimited ? null : Math.max(max_turnos_mes - turnos_usados_mes, 0);
  const pct = unlimited ? 0 : Math.min((turnos_usados_mes / Math.max(max_turnos_mes, 1)) * 100, 100);
  const atLimit = remaining !== null && remaining <= 0;
  const nearLimit = remaining !== null && remaining > 0 && remaining <= LOW_REMAINING_THRESHOLD;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Mi plan</p>
          <h2 className="mt-0.5 text-xl font-extrabold text-ink">{planName}</h2>
          <p className="mt-0.5 text-sm text-ink/50">{formatArs(price_ars)}/mes</p>
        </div>
        <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-ink/70">
            {unlimited
              ? "Turnos ilimitados este mes"
              : `${turnos_usados_mes} de ${max_turnos_mes} turnos usados`}
          </span>
        </div>
        {!unlimited && (
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface">
            <div
              className={`h-full rounded-full transition-all ${atLimit ? "bg-danger" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      {(atLimit || nearLimit) && (
        <div
          className={`mt-4 flex flex-col gap-3 rounded-2xl p-3.5 ring-1 ${
            atLimit ? "bg-danger-tint ring-danger/20" : "bg-warning-tint ring-warning/20"
          }`}
        >
          <p
            className={`flex items-start gap-2 text-sm font-semibold ${
              atLimit ? "text-danger-text" : "text-warning-text"
            }`}
          >
            <AlertTriangleIcon size={16} className="mt-0.5 shrink-0" />
            {atLimit
              ? "Alcanzaste el límite de turnos de tu plan este mes."
              : `Te quedan ${remaining} ${remaining === 1 ? "turno" : "turnos"} este mes.`}
          </p>
          <Button size="sm" onClick={onUpgrade}>
            Mejorá tu plan
          </Button>
        </div>
      )}
    </Card>
  );
}
