"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { AdminUser, PlatformStats } from "@/lib/types";
import { Avatar, Badge, Button, Card, EmptyState, ErrorBanner, Skeleton, Spinner } from "@/components/ui";
import {
  CheckCircleIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/icons";

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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-2xl font-extrabold text-ink">{value}</p>
      <p className="text-xs font-medium text-ink/50">{label}</p>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="p-4" aria-hidden>
      <Skeleton className="h-7 w-10" />
      <Skeleton className="mt-2 h-3 w-16" />
    </Card>
  );
}

function AdminUserRowSkeleton() {
  return (
    <Card className="p-4" aria-hidden>
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
  const { user, token, loading } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
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
    ])
      .then(([s, u]) => {
        setStats(s);
        setUsers(u);
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
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-2">
        <ShieldIcon size={22} className="text-primary-text" />
        <h1 className="font-display text-2xl font-semibold text-ink">Panel de administración</h1>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {statsLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden>
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        stats && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Usuarios" value={stats.total_users} />
            <StatCard label="Trabajadores" value={stats.workers} />
            <StatCard label="Comercios" value={stats.employers} />
            <StatCard label="Suspendidos" value={stats.suspended} />
          </div>
        )
      )}

      <div className="mt-8">
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-ink/40">
          Usuarios
        </p>
        <div className="mt-2 grid gap-3">
          {statsLoading ? (
            <>
              <AdminUserRowSkeleton />
              <AdminUserRowSkeleton />
              <AdminUserRowSkeleton />
            </>
          ) : (
          users.map((u) => (
            <Card key={u.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={u.full_name} size="md" />
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
