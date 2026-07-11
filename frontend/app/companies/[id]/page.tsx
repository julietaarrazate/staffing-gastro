"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { CompanyProfile } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";
import StarRating from "@/components/StarRating";
import { MapPinIcon } from "@/components/icons";

const CATEGORY_LABELS: Record<string, string> = {
  restaurante: "Restaurante",
  bar: "Bar",
  cafeteria: "Cafetería",
  salon_eventos: "Salón de eventos",
  catering: "Catering",
  empresa_gastronomica: "Empresa gastronómica",
};

export default function PublicCompanyProfilePage() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .get<CompanyProfile>(`/companies/${params.id}`, token)
      .then((data) => {
        setProfile(data);
        setError(null);
      })
      .catch((err) => setError(getErrorMessage(err, "No se pudo cargar el perfil")))
      .finally(() => setLoading(false));
  }, [token, params.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="px-4 py-16 text-center text-zinc-500">Cargando...</p>;
  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8">
        <ErrorBanner message={error} onRetry={load} />
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-3 text-sm font-semibold text-ink/50 underline underline-offset-2 hover:text-ink"
        >
          Volver
        </button>
      </div>
    );
  }
  if (!profile) return null;

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-100">
        <div className="relative h-56 w-full bg-gradient-to-br from-zinc-600 to-zinc-800">
          {profile.logo_url ? (
            <img
              src={profile.logo_url}
              alt={profile.name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-6xl font-bold text-white/90">
              {profile.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 pb-4 pt-10">
            <h1 className="text-2xl font-bold text-white drop-shadow-sm">{profile.name}</h1>
            {profile.city && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-white/90">
                <MapPinIcon size={14} /> {profile.city}
              </p>
            )}
          </div>
        </div>

        <div className="px-5 py-5">
          <div className="flex items-center gap-2">
            <StarRating value={Math.round(profile.rating)} size={18} />
            <span className="text-sm font-semibold text-zinc-700">{profile.rating.toFixed(1)}</span>
            <span className="text-sm text-zinc-400">· {profile.events_published} turnos publicados</span>
          </div>

          {profile.owner_full_name && (
            <p className="mt-2 text-sm text-zinc-500">A cargo de {profile.owner_full_name}</p>
          )}

          {profile.description && <p className="mt-4 text-sm text-zinc-700">{profile.description}</p>}

          {profile.category && (
            <div className="mt-4">
              <span className="rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 px-3 py-1.5 text-sm font-semibold text-white shadow-sm">
                {CATEGORY_LABELS[profile.category] ?? profile.category}
              </span>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <Metric
              label="Pago a tiempo"
              value={`${Math.round(profile.on_time_payment_rate * 100)}%`}
            />
            {profile.capacity != null && (
              <Metric label="Capacidad" value={`${profile.capacity} personas`} />
            )}
            {profile.opening_hours && <Metric label="Horario" value={profile.opening_hours} />}
            {profile.address && <Metric label="Dirección" value={profile.address} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 px-3 py-2.5 ring-1 ring-zinc-100">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-semibold text-zinc-800">{value}</p>
    </div>
  );
}
