"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { Subscription, SubscriptionPlan } from "@/lib/types";
import { formatArs } from "@/lib/format";
import { formatPlainDate, paymentReturnMessage } from "@/lib/subscription";
import SubscriptionStatusCard from "@/components/subscription/SubscriptionStatusCard";
import PlanCard from "@/components/subscription/PlanCard";
import { CardSkeletons, ErrorBanner, Modal, Button, Card, useToast } from "@/components/ui";

type SubscribeResponse = { plan_code: string; status: string; checkout_url: string | null };

/** Qué acción del cobro (ADR-0021) está esperando confirmación. */
type PendingAction = "baja" | "arrepentimiento" | null;

const RETURN_TONE = {
  ok: "bg-success-tint text-success-text ring-success/20",
  pending: "bg-warning-tint text-warning-text ring-warning/20",
  error: "bg-danger-tint text-danger-text ring-danger/20",
} as const;

/**
 * "Mi plan" del comercio (ADR-0005 Fase 1; cobro real en ADR-0021). Junta el
 * estado de la suscripción (`GET /subscription`) con el catálogo
 * (`GET /subscription/plans`).
 *
 * Con el cobro de Mercado Pago apagado (`billing_enabled: false`) se ve como
 * en la beta: cambiar de plan es inmediato. Con el cobro prendido, elegir o
 * renovar un plan lleva a Checkout Pro (un pago por mes, sin débito
 * automático) y al volver (`?pago=ok|pendiente|error`) se muestra qué pasó.
 * Ahí aparecen también "Dar de baja" y "Arrepentirme".
 */
export default function SubscriptionPage() {
  return (
    <Suspense>
      <SubscriptionContent />
    </Suspense>
  );
}

function SubscriptionContent() {
  const { token } = useRequireAuth();
  const toast = useToast();
  const searchParams = useSearchParams();
  const returnMessage = paymentReturnMessage(searchParams.get("pago"));

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<SubscriptionPlan | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [acting, setActing] = useState(false);
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

  // Al volver de Mercado Pago con el pago aprobado, el webhook suele llegar
  // unos segundos después: se vuelve a leer el estado una vez más.
  const returnTone = returnMessage?.tone;
  useEffect(() => {
    if (returnTone !== "ok" || !token) return;
    const timer = setTimeout(() => {
      api
        .get<Subscription>("/subscription", token)
        .then(setSubscription)
        .catch(() => undefined);
    }, 5000);
    return () => clearTimeout(timer);
  }, [returnTone, token]);

  const billing = subscription?.billing_enabled === true;

  async function confirmSubscribe() {
    if (!token || !pendingPlan) return;
    setSubscribing(true);
    try {
      // Idempotencia (product/IDEMPOTENCIA_SPEC.md): mismo intento (mismo
      // plan elegido) reusa la key hasta que la suscripción termine bien.
      const res = await api.post<SubscribeResponse>(
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

  async function confirmAction() {
    if (!token || !pendingAction) return;
    setActing(true);
    const path = pendingAction === "baja" ? "/subscription/cancel-renewal" : "/subscription/withdraw";
    try {
      const updated = await api.post<Subscription>(path, {}, token);
      setSubscription(updated);
      toast(
        pendingAction === "baja"
          ? "Listo, tu plan no se va a renovar"
          : "Cancelamos tu plan y pedimos la devolución del pago"
      );
      setPendingAction(null);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "No se pudo completar la acción", "error");
    } finally {
      setActing(false);
    }
  }

  const currentPlan = subscription ? plans.find((p) => p.code === subscription.plan_code) : undefined;
  const currentPriceArs = subscription
    ? typeof subscription.price_ars === "string"
      ? Number(subscription.price_ars)
      : subscription.price_ars
    : 0;
  const paidAndActive =
    billing &&
    subscription?.status === "activa" &&
    !!subscription.paid_until &&
    subscription.can_publish !== false;
  const currentPayLabel = billing ? (paidAndActive ? "Pagar 30 días más" : "Pagar el mes") : undefined;
  const canCancelRenewal = paidAndActive && subscription?.renews !== false;
  const withdrawalUntil = billing ? (subscription?.withdrawal_until ?? null) : null;

  return (
    // La grilla de planes ya usaba sm:grid-cols-2 lg:grid-cols-3 (docs/STATUS.md)
    // pero el contenedor se quedaba en max-w-2xl: en lg+ las 3 columnas se
    // apretaban en 672px en vez de aprovechar el ancho real de la pantalla.
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-6 lg:max-w-5xl">
      <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">Mi plan</h1>
      <p className="mt-0.5 text-sm text-ink/50">
        Gestioná la suscripción de tu comercio a Oído.
      </p>

      {returnMessage && (
        <div role="status" className={`mt-5 rounded-2xl p-4 ring-1 ${RETURN_TONE[returnMessage.tone]}`}>
          <p className="text-sm font-bold">{returnMessage.title}</p>
          <p className="mt-0.5 text-sm">{returnMessage.text}</p>
        </div>
      )}

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
              onPay={billing && currentPlan ? () => setPendingPlan(currentPlan) : undefined}
            />
          </div>

          <div id="planes" className="mt-8 scroll-mt-4">
            <h2 className="text-lg font-extrabold text-ink">Planes disponibles</h2>
            <p className="mt-0.5 text-sm text-ink/50">
              {billing
                ? "Pagás mes a mes con Mercado Pago, sin débito automático. El plan define cuántos turnos podés publicar."
                : "El plan gatea cuántos turnos podés publicar por mes."}
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
                  payLabel={plan.code === subscription.plan_code ? currentPayLabel : undefined}
                />
              ))}
            </div>
          </div>

          {billing && (canCancelRenewal || withdrawalUntil) && (
            <Card className="mt-8 p-5">
              <h2 className="text-base font-extrabold text-ink">Baja y arrepentimiento</h2>
              <div className="mt-3 flex flex-col gap-4">
                {canCancelRenewal && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-ink/60">
                      Si das de baja, no te recordamos más el pago y tu plan sigue hasta el final del mes ya
                      pagado.
                    </p>
                    <Button size="sm" variant="surface" onClick={() => setPendingAction("baja")}>
                      Dar de baja
                    </Button>
                  </div>
                )}
                {withdrawalUntil && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-ink/60">
                      Tenés hasta el {formatPlainDate(withdrawalUntil)} para arrepentirte de tu primer mes: te
                      devolvemos todo lo pagado.
                    </p>
                    <Button size="sm" variant="surface" onClick={() => setPendingAction("arrepentimiento")}>
                      Arrepentirme
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      <Modal
        open={pendingPlan !== null}
        onClose={() => !subscribing && setPendingPlan(null)}
        title={billing ? "Pagá con Mercado Pago" : "Confirmá el cambio de plan"}
      >
        {pendingPlan && (
          <div className="flex flex-col gap-4">
            {billing ? (
              <>
                <p className="text-sm text-ink/60">
                  Vas a pagar <strong>{formatArs(pendingPlan.price_ars)}</strong> por 30 días del plan{" "}
                  <strong>{pendingPlan.name}</strong>.
                </p>
                <p className="text-sm text-ink/60">
                  En la compu te mostramos un QR para escanear con la app de Mercado Pago; en el celular se abre
                  la app. Podés pagar con dinero en cuenta, débito o transferencia. No es un débito automático:
                  cuando se acerque el vencimiento te avisamos para pagar de nuevo.
                </p>
              </>
            ) : (
              <p className="text-sm text-ink/60">
                ¿Confirmás el cambio al plan <strong>{pendingPlan.name}</strong> por{" "}
                <strong>{formatArs(pendingPlan.price_ars)}/mes</strong>?
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Button fullWidth loading={subscribing} disabled={subscribing} onClick={confirmSubscribe}>
                {billing ? "Ir a Mercado Pago" : "Confirmar"}
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

      <Modal
        open={pendingAction !== null}
        onClose={() => !acting && setPendingAction(null)}
        title={pendingAction === "baja" ? "¿Dar de baja tu plan?" : "¿Te arrepentís del plan?"}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink/60">
            {pendingAction === "baja"
              ? "Tu plan sigue activo hasta el final del mes que ya pagaste. Después no se renueva y no te pedimos más pagos. Podés volver a pagar cuando quieras."
              : "Cancelamos tu plan ahora mismo y le pedimos a Mercado Pago que te devuelva todo lo pagado. La devolución puede tardar unos días en verse en tu cuenta."}
          </p>
          <div className="flex flex-col gap-2">
            <Button
              fullWidth
              variant={pendingAction === "arrepentimiento" ? "danger" : "primary"}
              loading={acting}
              disabled={acting}
              onClick={confirmAction}
            >
              {pendingAction === "baja" ? "Sí, dar de baja" : "Sí, quiero la devolución"}
            </Button>
            <Button fullWidth variant="surface" disabled={acting} onClick={() => setPendingAction(null)}>
              Volver
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
