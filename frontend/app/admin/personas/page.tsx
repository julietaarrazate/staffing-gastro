"use client";

// "Personas": responde "¿quién es esta persona?". Buscador por nombre o
// email y filtros por rol, estado y verificación (paso 2 del panel por
// secciones, 2026-10-20). Cada fila abre la ficha (`/admin/personas/[id]`),
// donde viven las acciones de moderación.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import type { AdminUser } from "@/lib/types";
import { Avatar, Badge, Button, CardSkeletons, EmptyState, ErrorBanner } from "@/components/ui";
import { CheckCircleIcon, SearchIcon, UsersIcon } from "@/components/icons";
import { AdminHeading } from "@/components/admin/AdminStats";
import { ROLE_LABELS, STATUS_LABELS } from "@/components/admin/people";

const PAGE_SIZE = 50;

type Filter = "todos" | "worker" | "employer" | "admin" | "suspended" | "unverified";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "worker", label: "Trabajadores" },
  { value: "employer", label: "Comercios" },
  { value: "admin", label: "Admins" },
  { value: "unverified", label: "Sin verificar" },
  { value: "suspended", label: "Suspendidos" },
];

function buildQuery(search: string, filter: Filter, offset: number): string {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  if (search.trim()) params.set("q", search.trim());
  if (filter === "worker" || filter === "employer" || filter === "admin") params.set("role", filter);
  if (filter === "suspended") params.set("status", "suspended");
  if (filter === "unverified") params.set("verified", "false");
  return `/admin/users?${params}`;
}

export default function AdminPeoplePage() {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Descarta respuestas viejas si el texto cambió mientras viajaban.
  const requestId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    if (!token) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    api
      .get<AdminUser[]>(buildQuery(debounced, filter, 0), token)
      .then((data) => {
        if (id !== requestId.current) return;
        setUsers(data);
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch((err) => {
        if (id === requestId.current) setError(getErrorMessage(err, "No se pudo buscar"));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [token, debounced, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    if (!token) return;
    setLoadingMore(true);
    try {
      const data = await api.get<AdminUser[]>(buildQuery(debounced, filter, users.length), token);
      setUsers((current) => [...current, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudieron traer más"));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div>
      <AdminHeading
        title="Personas"
        subtitle="Buscá a alguien por nombre o email y abrí su ficha."
      />

      <label className="mt-5 flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 ring-1 ring-line focus-within:bg-card focus-within:ring-2 focus-within:ring-primary/40">
        <SearchIcon size={16} className="shrink-0 text-ink/40" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nombre o email"
          aria-label="Buscar por nombre o email"
          maxLength={100}
          className="w-full bg-transparent text-sm text-ink placeholder:text-ink/40 focus:outline-none"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filtrar">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={
              filter === f.value
                ? "rounded-full bg-raised px-3 py-1.5 text-xs font-semibold text-ink shadow-[var(--shadow-soft)] ring-1 ring-ink/50"
                : "rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink/60 ring-1 ring-line transition hover:bg-line"
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} onRetry={load} />
        </div>
      )}

      {loading && (
        <div className="mt-5">
          <CardSkeletons />
        </div>
      )}

      {!loading && !error && users.length === 0 && (
        <div className="mt-5">
          <EmptyState
            icon={<UsersIcon size={28} />}
            title="No hay nadie con ese criterio"
            subtitle="Probá con otro nombre, otro email u otro filtro."
          />
        </div>
      )}

      {!loading && users.length > 0 && (
        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-soft)] ring-1 ring-line">
          {users.map((u) => (
            <li key={u.id}>
              <Link
                href={`/admin/personas/${u.id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface"
              >
                <Avatar src={u.photo_url} name={u.full_name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-semibold text-ink">
                    {u.full_name}
                    {u.is_verified && (
                      <CheckCircleIcon size={15} className="shrink-0 text-success-text" />
                    )}
                  </p>
                  <p className="truncate text-xs text-ink/50">{u.email}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone="neutral">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                  {u.status !== "active" && (
                    <Badge tone="danger">{STATUS_LABELS[u.status] ?? u.status}</Badge>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!loading && hasMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="surface" size="sm" loading={loadingMore} onClick={loadMore}>
            Ver más
          </Button>
        </div>
      )}
    </div>
  );
}
