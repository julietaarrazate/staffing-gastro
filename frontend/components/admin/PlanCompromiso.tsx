"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { formatDayMonth } from "@/lib/datetime";
import { formatArs } from "@/lib/format";
import type { AdminSubscriptionSummary } from "@/lib/types";
import { Button, Card, ErrorBanner, Modal } from "@/components/ui";
import PesosInput from "@/components/ui/PesosInput";
import { SectionLabel } from "@/components/admin/AdminStats";

const PLANES = [
  { value: "inicial", label: "Inicial" },
  { value: "basico", label: "Básico" },
  { value: "pro", label: "Pro" },
];

/**
 * Bloque «Plan» de la ficha de un comercio (medición de la beta, M6): el plan
 * vigente, el que eligió al darse de alta y el compromiso de pago («precio
 * fundador») que registra la admin a mano. El comercio no ve nada de esto.
 * El «Registrar compromiso» es el único ámbar de la ficha.
 */
export default function PlanCompromiso({
  userId,
  token,
  summary,
  onChange,
}: {
  userId: string;
  token: string;
  summary: AdminSubscriptionSummary;
  onChange: (next: AdminSubscriptionSummary) => void;
}) {
  const [plan, setPlan] = useState(summary.chosen_plan_code ?? "basico");
  const [precio, setPrecio] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  const compromiso = summary.commitment;
  const precioValido = precio !== "" && Number(precio) > 0;

  async function registrar() {
    if (!precioValido) return;
    setBusy(true);
    setError(null);
    try {
      const next = await api.put<AdminSubscriptionSummary>(
        `/admin/users/${userId}/payment-commitment`,
        { plan_code: plan, price_ars: Number(precio) },
        token
      );
      onChange(next);
      setPrecio("");
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo registrar el compromiso"));
    } finally {
      setBusy(false);
    }
  }

  async function borrar() {
    setConfirmarBorrado(false);
    setBusy(true);
    setError(null);
    try {
      onChange(await api.del<AdminSubscriptionSummary>(`/admin/users/${userId}/payment-commitment`, undefined, token));
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo borrar el compromiso"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8" data-testid="plan-compromiso">
      <SectionLabel>Plan</SectionLabel>
      <Card className="mt-2 p-5">
        <p className="text-xs text-ink/50">Plan actual</p>
        <p className="font-semibold text-ink">{summary.plan_name}</p>
        {summary.chosen_plan_name && summary.chosen_plan_at && (
          <p className="mt-2 text-sm text-ink/60">
            Eligió {summary.chosen_plan_name} al darse de alta ({formatDayMonth(summary.chosen_plan_at)})
          </p>
        )}

        <div className="mt-4 border-t border-line pt-4">
          <p className="text-xs text-ink/50">Compromiso de pago</p>
          {error && (
            <div className="mt-2">
              <ErrorBanner message={error} />
            </div>
          )}
          {compromiso ? (
            <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 text-sm font-semibold text-ink">
                Se comprometió el {formatDayMonth(compromiso.at)} a pagar {compromiso.plan_name} a{" "}
                {formatArs(compromiso.price_ars)}/mes
              </p>
              <Button size="sm" variant="surface" disabled={busy} onClick={() => setConfirmarBorrado(true)}>
                Borrar
              </Button>
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-3">
              <p className="text-sm text-ink/60">Todavía no se comprometió.</p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs text-ink/60">
                  Plan
                  <select
                    value={plan}
                    aria-label="Plan del compromiso"
                    onChange={(e) => setPlan(e.target.value)}
                    className="min-h-[40px] rounded-xl bg-card px-3 text-sm text-ink ring-1 ring-line"
                  >
                    {PLANES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-ink/60">
                  Precio mensual
                  <PesosInput
                    value={precio}
                    onChange={setPrecio}
                    placeholder="$ por mes"
                    aria-label="Precio mensual acordado"
                    className="min-h-[40px] w-36 rounded-xl bg-card px-3 text-sm text-ink ring-1 ring-line"
                  />
                </label>
                <Button size="sm" loading={busy} disabled={busy || !precioValido} onClick={registrar}>
                  Registrar compromiso
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Modal open={confirmarBorrado} onClose={() => setConfirmarBorrado(false)} title="¿Borrar el compromiso de pago?">
        <p className="text-sm text-ink/60">
          Se quita de la ficha y deja de contar en las métricas. Podés volver a registrarlo.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="surface" size="sm" onClick={() => setConfirmarBorrado(false)}>
            Volver
          </Button>
          <Button variant="danger" size="sm" onClick={borrar}>
            Sí, borrar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
