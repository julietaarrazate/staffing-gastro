"use client";

// "Métricas": cómo va el negocio. Conteos de usuarios, la promesa de los 10
// minutos, métricas de producto (docs/audits/OBSERVABILITY_AND_PRODUCT_ANALYTICS.md
// §6) y suscripciones (ADR-0005). Salió tal cual del panel de una sola página
// (2026-10-20); el período y la comparación son el paso 4.

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import type { PlatformStats, SubscriptionStats } from "@/lib/types";
import { Badge, Card, ErrorBanner } from "@/components/ui";
import { WalletIcon } from "@/components/icons";
import {
  AdminHeading,
  RateCard,
  SectionLabel,
  StatCard,
  StatCardSkeleton,
  sampleCaption,
} from "@/components/admin/AdminStats";

const PLAN_LABELS: Record<string, string> = {
  gratis: "Gratis",
  basico: "Básico",
  pro: "Pro",
};

export default function AdminMetricsPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [subscriptionStats, setSubscriptionStats] = useState<SubscriptionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<PlatformStats>("/admin/stats", token),
      api.get<SubscriptionStats>("/admin/subscription-stats", token),
    ])
      .then(([s, sub]) => {
        setStats(s);
        setSubscriptionStats(sub);
      })
      .catch((err) => setError(getErrorMessage(err, "No se pudieron cargar las métricas")))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <AdminHeading title="Métricas" subtitle="Cómo va el negocio, con los datos reales de la app." />

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} onRetry={load} />
        </div>
      )}

      <div className="mt-6">
        <SectionLabel>Usuarios</SectionLabel>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {loading || !stats ? (
            Array.from({ length: 6 }, (_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard label="Usuarios" value={stats.total_users} />
              <StatCard label="Trabajadores" value={stats.workers} />
              <StatCard label="Comercios" value={stats.employers} />
              <StatCard label="Admins" value={stats.admins} />
              <StatCard label="Verificados" value={stats.verified} />
              <StatCard label="Suspendidos" value={stats.suspended} />
            </>
          )}
        </div>
      </div>

      {!loading && stats && (
        <>
          {/* Promesa central del negocio: `coverage_sample_size` se muestra
              siempre para que el promedio no se lea como certeza con pocos
              datos (sin backfill: sólo cuenta desde que se empezó a medir). */}
          <div className="mt-8">
            <SectionLabel>La promesa de los 10 minutos</SectionLabel>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <StatCard
                label="Tiempo promedio de cobertura"
                value={
                  stats.avg_time_to_fill_minutes === null
                    ? "—"
                    : `${stats.avg_time_to_fill_minutes.toFixed(0)} min`
                }
              />
              <StatCard
                label="Cubiertos en menos de 10 min"
                value={
                  stats.pct_filled_under_10_min === null
                    ? "—"
                    : `${stats.pct_filled_under_10_min.toFixed(0)}%`
                }
              />
            </div>
            <p className="mt-1.5 px-1 text-xs text-ink/40">
              Sobre {stats.coverage_sample_size} turno
              {stats.coverage_sample_size === 1 ? "" : "s"} cubierto
              {stats.coverage_sample_size === 1 ? "" : "s"} hasta ahora.
            </p>
          </div>

          <div className="mt-8">
            <SectionLabel>Métricas de producto</SectionLabel>
            <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-3">
              <RateCard
                label="Turnos asignados"
                pct={stats.shift_assignment_rate_pct}
                caption={sampleCaption(
                  stats.shift_assignment_rate_sample_size,
                  "turno publicado",
                  "turnos publicados"
                )}
              />
              <RateCard
                label="Turnos completados"
                pct={stats.shift_completion_rate_pct}
                caption={sampleCaption(
                  stats.shift_completion_rate_sample_size,
                  "turno publicado",
                  "turnos publicados"
                )}
              />
              <RateCard
                label="Postulaciones aceptadas"
                pct={stats.application_to_acceptance_rate_pct}
                caption={sampleCaption(
                  stats.application_acceptance_sample_size,
                  "postulación",
                  "postulaciones"
                )}
              />
              <RateCard
                label="No-shows"
                pct={stats.no_show_rate_pct}
                caption={sampleCaption(stats.no_show_sample_size, "asignación", "asignaciones")}
              />
              <RateCard
                label="Trabajadores que repiten"
                pct={stats.worker_completion_repeat_rate_pct}
                caption={sampleCaption(
                  stats.worker_completion_repeat_sample_size,
                  "trabajador con turno completo",
                  "trabajadores con turnos completos"
                )}
              />
              <RateCard
                label="Comercios que repiten"
                pct={stats.employer_repeat_rate_pct}
                caption={sampleCaption(
                  stats.employer_repeat_sample_size,
                  "comercio activo",
                  "comercios activos"
                )}
              />
            </div>
          </div>
        </>
      )}

      {!loading && subscriptionStats && (
        <div className="mt-8">
          <SectionLabel>Suscripciones</SectionLabel>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="col-span-2 p-5">
              <div className="flex flex-wrap items-center gap-1.5 text-ink/50">
                <WalletIcon size={14} />
                <p className="text-xs font-medium">Ingreso mensual recurrente</p>
                {!subscriptionStats.billing_enabled && <Badge tone="neutral">Cobro no activado</Badge>}
              </div>
              <p className="mt-1 text-2xl font-extrabold text-ink">
                ARS{" "}
                {Number(
                  subscriptionStats.billing_enabled ? subscriptionStats.mrr_ars : 0
                ).toLocaleString("es-AR")}
              </p>
              {/* Con el cobro apagado, `mrr_ars` es lo que se cobraría: nunca
                  se muestra como ingreso real (auditoría 2026-08-15, F1). */}
              {!subscriptionStats.billing_enabled && (
                <p className="mt-1 text-xs text-ink/40">
                  Potencial si se cobrara: ARS{" "}
                  {Number(subscriptionStats.mrr_ars).toLocaleString("es-AR")}
                </p>
              )}
            </Card>
            <StatCard label="Comercios" value={subscriptionStats.total_companies} />
            <StatCard label="Cerca del límite" value={subscriptionStats.companies_at_plan_limit} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(subscriptionStats.companies_by_plan).map(([planCode, count]) => (
              <Badge key={planCode} tone="neutral">
                {PLAN_LABELS[planCode] ?? planCode}: {count}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
