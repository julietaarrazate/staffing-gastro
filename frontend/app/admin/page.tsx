"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AdminUser, PlatformStats } from "@/lib/types";
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

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  suspended: "bg-red-100 text-red-700",
  deleted: "bg-zinc-200 text-zinc-600",
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-100">
      <p className="text-2xl font-extrabold text-zinc-900">{value}</p>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
    </div>
  );
}

export default function AdminPage() {
  const { user, token, loading } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    Promise.all([
      api.get<PlatformStats>("/admin/stats", token),
      api.get<AdminUser[]>("/admin/users", token),
    ])
      .then(([s, u]) => {
        setStats(s);
        setUsers(u);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Error al cargar el panel")
      );
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
      setError(err instanceof ApiError ? err.message : "No se pudo completar la acción");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="px-4 py-16 text-center text-zinc-500">Cargando...</p>;

  if (!user || user.role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
          <ShieldIcon size={24} />
        </div>
        <h1 className="mt-4 text-xl font-bold text-zinc-900">Acceso restringido</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Esta sección es sólo para administradores.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-2">
        <ShieldIcon size={22} className="text-orange-600" />
        <h1 className="text-2xl font-bold text-zinc-900">Panel de administración</h1>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {stats && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Usuarios" value={stats.total_users} />
          <StatCard label="Trabajadores" value={stats.workers} />
          <StatCard label="Comercios" value={stats.employers} />
          <StatCard label="Suspendidos" value={stats.suspended} />
        </div>
      )}

      <div className="mt-8">
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Usuarios
        </p>
        <div className="mt-2 grid gap-3">
          {users.map((u) => (
            <div
              key={u.id}
              className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-100"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700">
                    {u.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-semibold text-zinc-900">
                      {u.full_name}
                      {u.is_verified && (
                        <CheckCircleIcon size={15} className="text-green-600" />
                      )}
                    </p>
                    <p className="truncate text-xs text-zinc-500">{u.email}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                    <UsersIcon size={11} />
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      STATUS_STYLES[u.status] ?? "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {u.status === "active"
                      ? "Activo"
                      : u.status === "suspended"
                        ? "Suspendido"
                        : u.status}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {u.status === "active" ? (
                  <button
                    onClick={() => act(u.id, "suspend")}
                    disabled={busy !== null || u.id === user.id}
                    className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
                  >
                    {u.id === user.id ? "Sos vos" : "Suspender"}
                  </button>
                ) : (
                  <button
                    onClick={() => act(u.id, "activate")}
                    disabled={busy !== null}
                    className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-40"
                  >
                    Reactivar
                  </button>
                )}
                {!u.is_verified && (
                  <button
                    onClick={() => act(u.id, "verify")}
                    disabled={busy !== null}
                    className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 disabled:opacity-40"
                  >
                    Verificar
                  </button>
                )}
                {u.role !== "admin" && (
                  <button
                    onClick={() => act(u.id, "promote")}
                    disabled={busy !== null}
                    className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-40"
                  >
                    Hacer admin
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
