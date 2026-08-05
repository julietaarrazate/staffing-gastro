"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { CompanyProfile } from "@/lib/types";
import { cldThumb } from "@/lib/cloudinary";
import { Button, ErrorBanner, Skeleton } from "@/components/ui";
import StarRating from "@/components/StarRating";
import MiniMap from "@/components/MiniMap";
import { MapPinIcon, RouteIcon } from "@/components/icons";

function ProfilePageSkeleton() {
  return (
    <div className="mx-auto max-w-xl px-4 py-8" aria-hidden>
      <div className="overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)] ring-1 ring-line">
        <Skeleton className="h-56 w-full rounded-none" />
        <div className="space-y-4 px-5 py-5">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

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

  if (loading) return <ProfilePageSkeleton />;
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

  const hasCoords = profile.latitude != null && profile.longitude != null;

  return (
    <div className="mx-auto max-w-xl px-4 py-8 lg:max-w-4xl">
      {/* En lg+, si hay coordenadas, la ubicación (mapa + dirección + "cómo
          llegar") pasa a una columna secundaria al lado (mismo criterio que
          /profile y /workers/[id], docs/STATUS.md) — sin eso, la tarjeta
          quedaba angosta y sola en medio de la pantalla. Sin coordenadas no
          hay contenido real para una segunda columna, así que no se fuerza
          la grilla (mismo criterio "no forzar layouts artificiales" que
          /shifts/new). */}
      <div className={hasCoords ? "lg:grid lg:grid-cols-3 lg:items-start lg:gap-6" : ""}>
      <div
        className={`overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)] ring-1 ring-line ${hasCoords ? "lg:col-span-2" : ""}`}
      >
        <div className="relative h-56 w-full bg-gradient-to-br from-primary to-primary-strong">
          {profile.logo_url ? (
            <img
              src={cldThumb(profile.logo_url, 800)}
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
            <h1 className="font-display text-2xl font-semibold text-white drop-shadow-sm">{profile.name}</h1>
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
            <span className="text-sm font-semibold text-ink/75">{profile.rating.toFixed(1)}</span>
            <span className="text-sm text-ink/40">· {profile.events_published} turnos publicados</span>
          </div>

          {profile.owner_full_name && (
            <p className="mt-2 text-sm text-ink/50">A cargo de {profile.owner_full_name}</p>
          )}

          {profile.description && <p className="mt-4 text-sm text-ink/75">{profile.description}</p>}

          {profile.category && (
            <div className="mt-4">
              <span className="rounded-full bg-surface px-3 py-1.5 text-sm font-semibold text-ink/70">
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

      {/* Ubicación: mapa + "cómo llegar" — antes era sólo el botón, apilado
          debajo de la tarjeta principal. Acá también hace falta saber si
          conviene ir, antes de postularse a un turno de este comercio
          (Julieta, 2026-07-29). */}
      {hasCoords && (
        <div className="mt-7 lg:mt-0">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-ink/40">
            Ubicación
          </p>
          <div className="mt-2 overflow-hidden rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-soft)] ring-1 ring-line">
            <MiniMap
              latitude={profile.latitude as number}
              longitude={profile.longitude as number}
              className="h-40 w-full"
            />
            <Button
              variant="surface"
              fullWidth
              className="mt-3"
              leftIcon={<RouteIcon size={16} />}
              onClick={() =>
                window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${profile.latitude},${profile.longitude}`,
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            >
              Cómo llegar
            </Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface px-3 py-2.5 ring-1 ring-line">
      <p className="text-xs text-ink/50">{label}</p>
      <p className="font-semibold text-ink">{value}</p>
    </div>
  );
}
