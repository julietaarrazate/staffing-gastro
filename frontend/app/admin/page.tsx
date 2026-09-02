"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { AdminUser, PlatformStats, SubscriptionStats, TestAccount } from "@/lib/types";
import { Avatar, Badge, Button, Card, EmptyState, ErrorBanner, Skeleton, Spinner } from "@/components/ui";
import IdentityReviewQueue from "@/components/admin/IdentityReviewQueue";
import {
  CheckCircleIcon,
  EyeIcon,
  FlaskIcon,
  MessageIcon,
  ShieldIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";

const TEST_ACCOUNT_ROLE_LABELS: Record<string, string> = {
  worker: "Ver como trabajador",
  employer: "Ver como comercio",
};

const PLAN_LABELS: Record<string, string> = {
  gratis: "Gratis",
  basico: "Básico",
  pro: "Pro",
};

const ROLE_LABELS: Record<string, string> = {
  worker: "Trabajador",
  employer: "Comercio",
  admin: "Admin",
};

const STATUS_TONE: Record<string, "secondary" | "danger" | "neutral"> = {
  active: "secondary",
  suspended: "danger",
  deleted: "neutral",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  suspended: "Suspendido",
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-5">
      <p className="text-2xl font-extrabold text-ink">{value}</p>
      <p className="text-xs font-medium text-ink/50">{label}</p>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="p-5" aria-hidden>
      <Skeleton className="h-7 w-10" />
      <Skeleton className="mt-2 h-3 w-16" />
    </Card>
  );
}

function RateCard({ label, pct, caption }: { label: string; pct: number | null; caption: string }) {
  return (
    <Card className="p-5">
      <p className="text-2xl font-extrabold text-ink">{pct === null ? "—" : `${pct.toFixed(0)}%`}</p>
      <p className="text-xs font-medium text-ink/50">{label}</p>
      <p className="mt-1.5 text-[11px] text-ink/40">{caption}</p>
    </Card>
  );
}

/** "Sobre 3 turnos publicados" / "Sobre 1 turno publicado" — evita el plural
 * mal puesto sobre una muestra chica, que en el panel de admin es común. */
function sampleCaption(n: number, singular: string, plural: string): string {
  return `Sobre ${n} ${n === 1 ? singular : plural}`;
}

function AdminUserRowSkeleton() {
  return (
    <Card className="p-5" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </Card>
  );
}

export default function AdminPage() {
  const { user, token, loading, impersonate } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [subscriptionStats, setSubscriptionStats] = useState<SubscriptionStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [testAccounts, setTestAccounts] = useState<TestAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  // Sólo mostramos el skeleton en la carga inicial: las recargas disparadas
  // por una acción (suspender/verificar/etc.) ya tienen su propio feedback
  // (el `busy` por fila) y no deberían tapar la lista entera de nuevo.
  const loadedOnce = useRef(false);

  const load = useCallback(() => {
    if (!token) return;
    if (!loadedOnce.current) setStatsLoading(true);
    setError(null);
    Promise.all([
      api.get<PlatformStats>("/admin/stats", token),
      api.get<AdminUser[]>("/admin/users", token),
      api.get<TestAccount[]>("/admin/test-accounts", token),
      api.get<SubscriptionStats>("/admin/subscription-stats", token),
    ])
      .then(([s, u, t, sub]) => {
        setStats(s);
        setUsers(u);
        setTestAccounts(t);
        setSubscriptionStats(sub);
      })
      .catch((err) => setError(getErrorMessage(err, "Error al cargar el panel")))
      .finally(() => {
        loadedOnce.current = true;
        setStatsLoading(false);
      });
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(userId: string, action: string) {
    if (!token) return;
    setBusy(`${userId}:${action}`);
    try {
      await api.post(`/admin/users/${userId}/${action}`, undefined, token);
      load();
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo completar la acción"));
    } finally {
      setBusy(null);
    }
  }

  async function handleImpersonate(userId: string) {
    setBusy(`${userId}:impersonate`);
    try {
      await impersonate(userId);
      // Al home: resuelve la vista correcta según el rol impersonado
      // (feed para trabajador, panel para comercio).
      router.push("/");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : getErrorMessage(err, "No se pudo entrar como este usuario")
      );
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center px-4 py-16">
        <Spinner size={28} className="text-ink/40" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 py-20">
        <EmptyState
          icon={<ShieldIcon size={26} />}
          title="Acceso restringido"
          subtitle="Esta sección es sólo para administradores."
        />
      </div>
    );
  }

  return (
    // Última pantalla de la auditoría responsive/desktop (docs/STATUS.md):
    // mismo patrón que /shifts — la lista de usuarios pasa a grilla en
    // md+ en vez de una sola columna angosta con la pantalla vacía al
    // costado; las tarjetas de stat ya escalaban solas (sm:grid-cols-4).
    <div className="mx-auto max-w-3xl px-4 py-8 md:max-w-6xl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldIcon size={22} className="text-primary-text" />
          <h1 className="font-display text-h1 font-semibold text-ink">Panel de administración</h1>
        </div>
        <button
          type="button"
          onClick={() => router.push("/admin/support")}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-sm font-semibold text-ink/70 ring-1 ring-line transition hover:bg-line"
        >
          <MessageIcon size={16} /> Soporte
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {/* Acceso rápido para testear la app en cada rol sin usar datos de
          usuarios reales (pedido de Julieta): reutiliza "Ver como"
          (impersonate) sobre 2 cuentas dedicadas que se crean solas la
          primera vez que se piden (`AdminService.get_or_create_test_accounts`). */}
      {testAccounts.length > 0 && (
        <Card className="mt-6 p-5">
          <div className="flex items-center gap-1.5">
            <FlaskIcon size={16} className="text-primary-text" />
            <p className="text-xs font-semibold font-mono uppercase tracking-wide text-ink/40">
              Mis cuentas de prueba
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {testAccounts.map((account) => (
              <Button
                key={account.id}
                size="sm"
                variant="surface"
                leftIcon={<EyeIcon size={14} />}
                disabled={busy !== null}
                loading={busy === `${account.id}:impersonate`}
                onClick={() => handleImpersonate(account.id)}
              >
                {TEST_ACCOUNT_ROLE_LABELS[account.role] ?? account.full_name}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {statsLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-hidden>
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        stats && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Usuarios" value={stats.total_users} />
            <StatCard label="Trabajadores" value={stats.workers} />
            <StatCard label="Comercios" value={stats.employers} />
            <StatCard label="Admins" value={stats.admins} />
            <StatCard label="Verificados" value={stats.verified} />
            <StatCard label="Suspendidos" value={stats.suspended} />
          </div>
        )
      )}

      {/* Promesa central del negocio ("cubrir un puesto en <10 min",
          PRODUCT.md): sin esto nadie sabía, con un número real, si se
          está cumpliendo. `coverage_sample_size` se muestra siempre para
          que el promedio/porcentaje no se lean como certeza con pocos
          datos (sin backfill: sólo cuenta desde que se empezó a medir). */}
      {!statsLoading && stats && (
        <div className="mt-3">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Tiempo prom. de cobertura"
              value={
                stats.avg_time_to_fill_minutes === null
                  ? "—"
                  : `${stats.avg_time_to_fill_minutes.toFixed(0)} min`
              }
            />
            <StatCard
              label="Cubiertos en <10 min"
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
      )}

      {/* Métricas de producto (docs/audits/OBSERVABILITY_AND_PRODUCT_ANALYTICS.md
          §6): el backend ya las calculaba (`GET /admin/stats`), sólo faltaba
          mostrarlas acá — pedido de Julieta de un panel operacional con
          datos reales, no sólo conteos de usuarios. */}
      {!statsLoading && stats && (
        <div className="mt-8">
          <p className="px-1 text-xs font-semibold font-mono uppercase tracking-wide text-ink/40">
            Métricas de producto
          </p>
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
      )}

      {/* Suscripciones (ADR-0005): MRR real y distribución de comercios por
          plan, incluidos los que todavía no tienen fila en `subscriptions`
          (arrancan en gratis, ver `AdminService.get_subscription_stats`). */}
      {!statsLoading && subscriptionStats && (
        <div className="mt-8">
          <p className="px-1 text-xs font-semibold font-mono uppercase tracking-wide text-ink/40">
            Suscripciones
          </p>
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
              {/* Mientras el cobro real esté apagado, `mrr_ars` es lo que se
                  cobraría si estuviera activo — nunca ingreso real (auditoría
                  2026-08-15, F1: se mostraba como si ya hubiera pasado). Señal
                  de demanda igual de real (comercios que ELIGEN un plan pago),
                  por eso se muestra, pero nunca como el número principal. */}
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

      <div className="mt-8">
        <p className="px-1 text-xs font-semibold font-mono uppercase tracking-wide text-ink/40">
          Identidades por verificar
        </p>
        <IdentityReviewQueue />
      </div>

      <div className="mt-8">
        <p className="px-1 text-xs font-semibold font-mono uppercase tracking-wide text-ink/40">
          Usuarios
        </p>
        <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {statsLoading ? (
            <>
              <AdminUserRowSkeleton />
              <AdminUserRowSkeleton />
              <AdminUserRowSkeleton />
            </>
          ) : (
          users.map((u) => (
            <Card key={u.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar src={u.photo_url} name={u.full_name} size="md" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-semibold text-ink">
                      {u.full_name}
                      {u.is_verified && (
                        <CheckCircleIcon size={15} className="text-success-text" />
                      )}
                    </p>
                    <p className="truncate text-xs text-ink/50">{u.email}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone="neutral" icon={<UsersIcon size={11} />}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </Badge>
                  <Badge tone={STATUS_TONE[u.status] ?? "neutral"}>
                    {STATUS_LABELS[u.status] ?? u.status}
                  </Badge>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {u.status === "active" ? (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy !== null || u.id === user.id}
                    loading={busy === `${u.id}:suspend`}
                    onClick={() => act(u.id, "suspend")}
                  >
                    {u.id === user.id ? "Sos vos" : "Suspender"}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy !== null}
                    loading={busy === `${u.id}:activate`}
                    onClick={() => act(u.id, "activate")}
                  >
                    Reactivar
                  </Button>
                )}
                {!u.is_verified && (
                  <Button
                    size="sm"
                    variant="surface"
                    disabled={busy !== null}
                    loading={busy === `${u.id}:verify`}
                    onClick={() => act(u.id, "verify")}
                  >
                    Verificar
                  </Button>
                )}
                {u.role !== "admin" && (
                  <Button
                    size="sm"
                    variant="surface"
                    leftIcon={<EyeIcon size={14} />}
                    disabled={busy !== null}
                    loading={busy === `${u.id}:impersonate`}
                    onClick={() => handleImpersonate(u.id)}
                  >
                    Ver como
                  </Button>
                )}
                {u.role !== "admin" && (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={busy !== null}
                    loading={busy === `${u.id}:promote`}
                    onClick={() => act(u.id, "promote")}
                  >
                    Hacer admin
                  </Button>
                )}
              </div>
            </Card>
          ))
          )}
        </div>
      </div>
    </div>
  );
}
