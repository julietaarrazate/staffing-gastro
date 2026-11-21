"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useRequireAuth } from "@/lib/use-require-auth";
import { FavoriteWorker, SKILL_LABELS } from "@/lib/types";
import { Avatar, Badge, Button, CardSkeletons, EmptyState, ErrorBanner, useToast } from "@/components/ui";
import { HeartIcon } from "@/components/icons";
import { SubpaginaSuave } from "@/components/profile/ProfileParts";

export default function FavoritesPage() {
  const { token } = useRequireAuth({ roles: ["employer"] });
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
    // Con la dirección suave (ADR-0028, 2026-11-21; sin maqueta): el cielo
    // corto con el título y la vuelta al perfil, y la hoja con cada persona
    // como una tarjeta suave. Los datos y las acciones no cambian.
    <SubpaginaSuave
      title="Trabajadores favoritos"
      bajada="La gente que ya te dio confianza. Encontralos rápido para el próximo turno."
      ancha
    >
      {loading && <CardSkeletons />}
      {error && <ErrorBanner message={error} onRetry={load} />}

      {!loading && !error && favorites.length === 0 && (
        <div>
          <EmptyState
            icon={<HeartIcon size={28} />}
            title="Todavía no marcaste favoritos"
            subtitle="Desde el perfil de cualquier trabajador, tocá 'Agregar a favoritos' para encontrarlo rápido la próxima vez."
          />
        </div>
      )}

      {!loading && !error && favorites.length > 0 && (
        // `grid-cols-1`: sin columnas declaradas la grilla tomaba el ancho del
        // nombre más largo, y con un nombre largo todas las tarjetas se salían
        // de la pantalla y «Quitar» quedaba cortado (visto al migrar, 2026-11-21).
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {favorites.map((f) => (
            <div
              key={f.worker_profile_id}
              className="tarjeta-suave no-select flex min-w-0 items-center gap-3 p-4"
            >
              <Link href={`/workers/${f.worker_profile_id}`}>
                <Avatar src={f.photo_url} name={f.full_name} size="lg" />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    href={`/workers/${f.worker_profile_id}`}
                    className="min-w-0 truncate font-semibold text-ink"
                  >
                    {f.full_name}
                  </Link>
                  {f.is_available && <Badge tone="secondary">Disponible</Badge>}
                </div>
                <p className="mt-1 text-sm text-ink-soft">
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
    </SubpaginaSuave>
  );
}
