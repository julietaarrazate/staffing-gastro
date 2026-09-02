"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { Subscription, SubscriptionPlan } from "@/lib/types";
import { formatArs } from "@/lib/format";
import SubscriptionStatusCard from "@/components/subscription/SubscriptionStatusCard";
import PlanCard from "@/components/subscription/PlanCard";
import { CardSkeletons, ErrorBanner, Modal, Button, useToast } from "@/components/ui";

/**
 * "Mi plan" del comercio (ADR-0005, Fase 1: mensualidad). Junta el estado de
 * la suscripción (`GET /subscription`, sin nombre de plan) con el catálogo
 * (`GET /subscription/plans`, con nombre/features) para armar la pantalla
 * completa: estado + turnos usados, y las 3 tarjetas de plan para cambiar.
 */
export default function SubscriptionPage() {
  const { token } = useRequireAuth();
  const toast = useToast();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<SubscriptionPlan | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const { keyFor, clear: clearIdempotencyKey } = useIdempotencyKeys();

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [sub, plansRes] = await Promise.all([
        api.get<Subscription>("/subscription", token),
        api.get<{ plans: SubscriptionPlan[] }>("/subscription/plans", token),
      ]);
      setSubscription(sub);
      setPlans(plansRes.plans);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo cargar tu suscripción"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmSubscribe() {
    if (!token || !pendingPlan) return;
    setSubscribing(true);
    try {
      // Idempotencia (product/IDEMPOTENCIA_SPEC.md): mismo intento (mismo
      // plan elegido) reusa la key hasta que la suscripción termine bien.
      const res = await api.post<{ plan_code: string; status: string; checkout_url: string | null }>(
        "/subscription/subscribe",
        { plan_code: pendingPlan.code },
        token,
        undefined,
        keyFor(pendingPlan.code)
      );
      clearIdempotencyKey(pendingPlan.code);
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
        return;
      }
      toast("Plan actualizado");
      setPendingPlan(null);
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "No se pudo cambiar de plan", "error");
    } finally {
      setSubscribing(false);
    }
  }

  const currentPlan = subscription ? plans.find((p) => p.code === subscription.plan_code) : undefined;
  const currentPriceArs = subscription
    ? typeof subscription.price_ars === "string"
      ? Number(subscription.price_ars)
      : subscription.price_ars
    : 0;

  return (
    // La grilla de planes ya usaba sm:grid-cols-2 lg:grid-cols-3 (docs/STATUS.md)
    // pero el contenedor se quedaba en max-w-2xl: en lg+ las 3 columnas se
    // apretaban en 672px en vez de aprovechar el ancho real de la pantalla.
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-6 lg:max-w-5xl">
      <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">Mi plan</h1>
      <p className="mt-0.5 text-sm text-ink/50">
        Gestioná la suscripción de tu comercio a Oído.
      </p>

      {loading && <CardSkeletons count={2} />}
      {error && <ErrorBanner message={error} onRetry={load} />}

      {!loading && !error && subscription && (
        <>
          <div className="mt-5">
            <SubscriptionStatusCard
              subscription={subscription}
              planName={currentPlan?.name ?? subscription.plan_code}
              onUpgrade={() => {
                const el = document.getElementById("planes");
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />
          </div>

          <div id="planes" className="mt-8 scroll-mt-4">
            <h2 className="text-lg font-extrabold text-ink">Planes disponibles</h2>
            <p className="mt-0.5 text-sm text-ink/50">
              El plan gatea cuántos turnos podés publicar por mes.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.code}
                  plan={plan}
                  isCurrent={plan.code === subscription.plan_code}
                  currentPriceArs={currentPriceArs}
                  busy={subscribing && pendingPlan?.code === plan.code}
                  onSelect={() => setPendingPlan(plan)}
                />
              ))}
            </div>
          </div>
        </>
      )}

      <Modal
        open={pendingPlan !== null}
        onClose={() => !subscribing && setPendingPlan(null)}
        title="Confirmá el cambio de plan"
      >
        {pendingPlan && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink/60">
              ¿Confirmás el cambio al plan <strong>{pendingPlan.name}</strong> por{" "}
              <strong>{formatArs(pendingPlan.price_ars)}/mes</strong>?
            </p>
            <div className="flex flex-col gap-2">
              <Button fullWidth loading={subscribing} disabled={subscribing} onClick={confirmSubscribe}>
                Confirmar
              </Button>
              <Button
                fullWidth
                variant="surface"
                disabled={subscribing}
                onClick={() => setPendingPlan(null)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
