"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { FavoriteWorker, SKILL_LABELS } from "@/lib/types";
import { Avatar, Badge, Button, CardSkeletons, EmptyState, ErrorBanner, useToast } from "@/components/ui";
import { HeartIcon } from "@/components/icons";

export default function FavoritesPage() {
  const { token } = useRequireAuth();
  const toast = useToast();
  const [favorites, setFavorites] = useState<FavoriteWorker[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .get<FavoriteWorker[]>("/favorites", token)
      .then((data) => {
        setFavorites(data);
        setError(null);
      })
      .catch((err) => setError(getErrorMessage(err, "No se pudieron cargar los favoritos")))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(workerProfileId: string) {
    if (!token) return;
    setRemoving(workerProfileId);
    try {
      await api.del(`/favorites/${workerProfileId}`, undefined, token);
      setFavorites((prev) => prev.filter((f) => f.worker_profile_id !== workerProfileId));
    } catch (err) {
      toast(getErrorMessage(err, "No se pudo quitar de favoritos"), "error");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-6 md:max-w-4xl">
      <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">
        Trabajadores favoritos
      </h1>
      <p className="mt-0.5 text-sm text-ink/50">
        La gente que ya te dio confianza. Encontralos rápido para el próximo turno.
      </p>

      {loading && <div className="mt-5"><CardSkeletons /></div>}
      {error && <div className="mt-5"><ErrorBanner message={error} onRetry={load} /></div>}

      {!loading && !error && favorites.length === 0 && (
        <div className="mt-5">
          <EmptyState
            icon={<HeartIcon size={28} />}
            title="Todavía no marcaste favoritos"
            subtitle="Desde el perfil de cualquier trabajador, tocá 'Agregar a favoritos' para encontrarlo rápido la próxima vez."
          />
        </div>
      )}

      {!loading && !error && favorites.length > 0 && (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {favorites.map((f) => (
            <div
              key={f.worker_profile_id}
              className="no-select flex items-center gap-3 rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-soft)] ring-1 ring-line"
            >
              <Link href={`/workers/${f.worker_profile_id}`}>
                <Avatar src={f.photo_url} name={f.full_name} size="lg" />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    href={`/workers/${f.worker_profile_id}`}
                    className="truncate font-semibold text-ink"
                  >
                    {f.full_name}
                  </Link>
                  {f.is_available && <Badge tone="secondary">Disponible</Badge>}
                </div>
                <p className="mt-1 text-sm text-ink/50">
                  {f.skills.map((s) => SKILL_LABELS[s]).join(", ") || "Sin rubro"}
                  {f.shifts_together > 0 && (
                    <>
                      {" · "}
                      {f.shifts_together} turno{f.shifts_together !== 1 ? "s" : ""} juntos
                    </>
                  )}
                </p>
              </div>
              <Button
                size="sm"
                variant="surface"
                onClick={() => remove(f.worker_profile_id)}
                loading={removing === f.worker_profile_id}
                disabled={removing !== null}
              >
                Quitar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
