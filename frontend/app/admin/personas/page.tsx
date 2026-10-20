"use client";

// "Personas": usuarios de la plataforma y las acciones de moderación
// (suspender, reactivar, verificar, ver como, hacer admin). Salió tal cual del
// panel de una sola página (2026-10-20); buscador y ficha son el paso 2.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import type { AdminUser } from "@/lib/types";
import { Avatar, Badge, Button, Card, ErrorBanner, Skeleton } from "@/components/ui";
import { CheckCircleIcon, EyeIcon, UsersIcon } from "@/components/icons";
import { AdminHeading } from "@/components/admin/AdminStats";

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

export default function AdminPeoplePage() {
  const { user, token, impersonate } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Sólo la primera carga muestra skeleton: las recargas que dispara una
  // acción ya tienen su propio feedback (el `busy` por fila).
  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    api
      .get<AdminUser[]>("/admin/users", token)
      .then(setUsers)
      .catch((err) => setError(getErrorMessage(err, "No se pudieron cargar los usuarios")))
      .finally(() => setLoading(false));
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
      // Al home: resuelve la vista correcta según el rol impersonado.
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

  return (
    <div>
      <AdminHeading
        title="Personas"
        subtitle="Trabajadores, comercios y admins, con las acciones de moderación."
      />

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} onRetry={load} />
        </div>
      )}

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {loading ? (
          <>
            <AdminUserRowSkeleton />
            <AdminUserRowSkeleton />
            <AdminUserRowSkeleton />
          </>
        ) : (
          users.map((u) => (
            <Card key={u.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar src={u.photo_url} name={u.full_name} size="md" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-semibold text-ink">
                      {u.full_name}
                      {u.is_verified && <CheckCircleIcon size={15} className="text-success-text" />}
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
                    disabled={busy !== null || u.id === user?.id}
                    loading={busy === `${u.id}:suspend`}
                    onClick={() => act(u.id, "suspend")}
                  >
                    {u.id === user?.id ? "Sos vos" : "Suspender"}
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
                  // Antes era `primary` (ámbar) en cada tarjeta: con la lista
                  // entera la pantalla tenía decenas de acentos, contra la
                  // regla de un solo ámbar por pantalla.
                  <Button
                    size="sm"
                    variant="surface"
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
  );
}
