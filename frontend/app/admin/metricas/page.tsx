"use client";

// "Métricas": cómo va el negocio. Conteos de usuarios, la promesa de los 10
// minutos, métricas de producto (docs/audits/OBSERVABILITY_AND_PRODUCT_ANALYTICS.md
// §6) y suscripciones (ADR-0005). Arriba, lo de los últimos 7 o 30 días
// contra el período anterior (paso 4 del panel ordenado, 2026-10-20); abajo,
// los acumulados de siempre. «Cubierto» = la persona confirmó; «cumplido» =
// cubierto y con llegada al local; las cuentas de prueba e invitadas no cuentan
// (medición de la beta, docs/planning/BETA_TABLERO.md).

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { AR_TIMEZONE } from "@/lib/datetime";
import type { PeriodMetrics, PeriodSummary, PlatformStats, SubscriptionStats } from "@/lib/types";
import { Badge, Card, ErrorBanner, SegmentedControl } from "@/components/ui";
import { WalletIcon } from "@/components/icons";
import { periodDelta } from "@/components/admin/live";
import { formatArs, plural } from "@/lib/format";
import {
  AdminHeading,
  DeltaStatCard,
  RateCard,
  SectionLabel,
  StatCard,
  StatCardSkeleton,
  sampleCaption,
} from "@/components/admin/AdminStats";

const PLAN_LABELS: Record<string, string> = {
  inicial: "Inicial",
  basico: "Básico",
  pro: "Pro",
};

type Period = "7" | "30";

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    timeZone: AR_TIMEZONE,
    day: "numeric",
    month: "numeric",
  });
}

/** "17/10 al 23/10": el período en días argentinos (`end` es exclusivo). */
function periodRange(summary: PeriodSummary): string {
  const lastDay = new Date(new Date(summary.end).getTime() - 1).toISOString();
  return `${formatDay(summary.start)} al ${formatDay(lastDay)}`;
}

const minutes = (m: number | null) => (m === null ? "—" : `${m.toFixed(0)} min`);
const pct = (p: number | null) => (p === null ? "—" : `${p.toFixed(0)}%`);

function PeriodSection({ token }: { token: string | null }) {
  const [period, setPeriod] = useState<Period>("7");
  const [data, setData] = useState<PeriodMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setData(null);
    setError(null);
    api
      .get<PeriodMetrics>(`/admin/period-metrics?period=${period}`, token)
      .then(setData)
      .catch((err) => setError(getErrorMessage(err, "No se pudo cargar el período")));
  }, [token, period]);

  useEffect(() => {
    load();
  }, [load]);

  const cur = data?.current;
  const prev = data?.previous;

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SectionLabel>
          {cur ? `Período: ${periodRange(cur)}` : "Período"}
        </SectionLabel>
        <SegmentedControl<Period>
          className="sm:w-72"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "7", label: "Últimos 7 días" },
            { value: "30", label: "Últimos 30 días" },
          ]}
        />
      </div>
      {error && (
        <div className="mt-2">
          <ErrorBanner message={error} onRetry={load} />
        </div>
      )}
      <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {!cur || !prev ? (
          !error && Array.from({ length: 7 }, (_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <DeltaStatCard
              label="Locales activos"
              value={String(cur.active_companies)}
              previous={String(prev.active_companies)}
              delta={periodDelta(cur.active_companies, prev.active_companies)}
              caption={`${cur.companies_with_covered} con un turno cubierto`}
            />
            <DeltaStatCard
              label="Turnos publicados"
              value={String(cur.shifts_published)}
              previous={String(prev.shifts_published)}
              delta={periodDelta(cur.shifts_published, prev.shifts_published)}
            />
            {/* «Cubierto» = la persona confirmó, no que el comercio eligió. */}
            <DeltaStatCard
              label="Turnos cubiertos"
              value={String(cur.shifts_covered)}
              previous={String(prev.shifts_covered)}
              delta={periodDelta(cur.shifts_covered, prev.shifts_covered)}
              caption={
                cur.covered_pct === null
                  ? "la persona confirmó"
                  : `la persona confirmó · ${pct(cur.covered_pct)} de los publicados`
              }
            />
            <DeltaStatCard
              label="Mediana hasta confirmar"
              value={minutes(cur.median_minutes_to_cover)}
              previous={minutes(prev.median_minutes_to_cover)}
              delta={periodDelta(cur.median_minutes_to_cover, prev.median_minutes_to_cover, {
                lowerIsBetter: true,
              })}
              caption={
                cur.avg_minutes_to_cover === null
                  ? undefined
                  : `promedio ${minutes(cur.avg_minutes_to_cover)}`
              }
            />
            <DeltaStatCard
              label="Con menos de 24 h de aviso, en menos de 10 min"
              value={pct(cur.short_notice_under_10_min_pct)}
              previous={pct(prev.short_notice_under_10_min_pct)}
              delta={periodDelta(
                cur.short_notice_under_10_min_pct,
                prev.short_notice_under_10_min_pct
              )}
              caption={`sobre ${cur.short_notice_covered} cubierto${
                cur.short_notice_covered === 1 ? "" : "s"
              } con aviso corto`}
            />
            <DeltaStatCard
              label="Cumplidos"
              value={pct(cur.fulfilled_pct)}
              previous={pct(prev.fulfilled_pct)}
              delta={periodDelta(cur.fulfilled_pct, prev.fulfilled_pct)}
              caption={`${cur.fulfilled} de ${plural(cur.shifts_covered, "cubierto", "cubiertos")} con llegada al local`}
            />
            <DeltaStatCard
              label="Postulaciones"
              value={String(cur.applications)}
              previous={String(prev.applications)}
              delta={periodDelta(cur.applications, prev.applications)}
            />
          </>
        )}
      </div>
      <p className="mt-1.5 px-1 text-xs text-ink/40">
        Contra los {period} días anteriores. Los días se cortan a la medianoche de Argentina.
      </p>
    </div>
  );
}

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

      <PeriodSection token={token} />

      <div className="mt-8">
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
            <SectionLabel>La promesa de los 10 minutos, desde el principio</SectionLabel>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <StatCard
                label="Tiempo promedio hasta confirmar"
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
              Desde que se publica hasta que la persona confirma. Sobre{" "}
              {stats.coverage_sample_size} turno
              {stats.coverage_sample_size === 1 ? "" : "s"} cubierto
              {stats.coverage_sample_size === 1 ? "" : "s"} hasta ahora, sin cuentas de prueba ni
              invitadas.
            </p>
          </div>

          <div className="mt-8">
            <SectionLabel>Métricas de producto</SectionLabel>
            <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-3">
              <RateCard
                label="Turnos asignados (los eligió el comercio)"
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
                label="Comercios que vuelven a publicar (30 días)"
                pct={stats.employer_return_30d_rate_pct}
                caption={sampleCaption(
                  stats.employer_return_30d_sample_size,
                  "comercio con su primer turno cubierto hace más de 30 días",
                  "comercios con su primer turno cubierto hace más de 30 días"
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
                {formatArs(subscriptionStats.billing_enabled ? subscriptionStats.mrr_ars : 0)}
              </p>
              {/* Con el cobro apagado, `mrr_ars` es lo que se cobraría: nunca
                  se muestra como ingreso real (auditoría 2026-08-15, F1). */}
              {!subscriptionStats.billing_enabled && (
                <p className="mt-1 text-xs text-ink/40">
                  Potencial si se cobrara: {formatArs(subscriptionStats.mrr_ars)}
                </p>
              )}
              {/* El ingreso es una foto de hoy: no se guarda su historia, así
                  que no hay período anterior contra el cual comparar. */}
              <p className="mt-1 text-xs text-ink/40">Hoy, sin comparación por período.</p>
            </Card>
            <StatCard label="Comercios" value={subscriptionStats.total_companies} />
            <StatCard label="Cerca del límite" value={subscriptionStats.companies_at_plan_limit} />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div data-testid="eligieron-plan">
            <Card className="p-5">
              <p className="text-2xl font-extrabold text-ink">
                {Object.values(subscriptionStats.companies_with_chosen_plan ?? {}).reduce(
                  (a, b) => a + b,
                  0
                )}
              </p>
              <p className="text-xs font-medium text-ink/50">Eligieron un plan al darse de alta</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(subscriptionStats.companies_with_chosen_plan ?? {}).map(
                  ([planCode, count]) => (
                    <Badge key={planCode} tone="neutral">
                      {PLAN_LABELS[planCode] ?? planCode}: {count}
                    </Badge>
                  )
                )}
              </div>
            </Card>
            </div>
            <div data-testid="se-comprometieron">
            <Card className="p-5">
              <p className="text-2xl font-extrabold text-ink">
                {subscriptionStats.committed_companies ?? 0}
              </p>
              <p className="text-xs font-medium text-ink/50">Se comprometieron a pagar</p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {formatArs(subscriptionStats.committed_mrr_ars ?? 0)}/mes
              </p>
            </Card>
            </div>
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
