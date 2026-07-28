"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { SKILL_LABELS, WorkerProfile } from "@/lib/types";
import { SKILL_ACCENT } from "@/lib/skill-style";
import { cldThumb } from "@/lib/cloudinary";
import { BADGE_ICONS, BADGE_LABELS, formatPunctuality, levelLabel } from "@/lib/reputation";
import { ErrorBanner, Skeleton } from "@/components/ui";
import StarRating from "@/components/StarRating";
import WorkerReviews from "@/components/WorkerReviews";
import { BriefcaseIcon, MapPinIcon } from "@/components/icons";

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

export default function PublicWorkerProfilePage() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .get<WorkerProfile>(`/workers/${params.id}`, token)
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

  const name = profile.full_name ?? "Trabajador/a";

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)] ring-1 ring-line">
        <div className="relative h-56 w-full bg-gradient-to-br from-primary to-primary-strong">
          {profile.photo_url ? (
            <img src={cldThumb(profile.photo_url, 800)} alt={name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-6xl font-bold text-white/90">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 pb-4 pt-10">
            <h1 className="text-2xl font-bold text-white drop-shadow-sm">
              {name}
              {profile.age != null && <span className="font-normal">, {profile.age}</span>}
            </h1>
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
            <span className="text-sm text-ink/40">· {profile.events_completed} eventos</span>
          </div>

          {profile.bio && <p className="mt-4 text-sm text-ink/75">{profile.bio}</p>}

          {profile.skills.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.skills.map((skill) => {
                const { Icon, bg, fg } = SKILL_ACCENT[skill];
                return (
                  <span
                    key={skill}
                    className={`inline-flex items-center gap-1.5 rounded-full ${bg} ${fg} px-3 py-1.5 text-sm font-semibold`}
                  >
                    <Icon size={14} /> {SKILL_LABELS[skill]}
                  </span>
                );
              })}
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <Metric label="Experiencia" value={`${profile.years_experience} años`} />
            <Metric label="Puntualidad" value={formatPunctuality(profile.punctuality_rate)} />
            <Metric label="Nivel" value={levelLabel(profile.level)} />
            <Metric
              label="Disponibilidad"
              value={profile.is_available ? "Disponible" : "No disponible"}
            />
          </div>

          {profile.languages.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Idiomas</p>
              <p className="mt-1 text-sm text-ink/75">{profile.languages.join(", ")}</p>
            </div>
          )}

          {profile.certifications.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">
                Certificaciones
              </p>
              <p className="mt-1 text-sm text-ink/75">{profile.certifications.join(", ")}</p>
            </div>
          )}

          {profile.badges.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">
                Insignias
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {profile.badges.map((badge) => {
                  const Icon = BADGE_ICONS[badge] ?? BriefcaseIcon;
                  return (
                    <span
                      key={badge}
                      className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700 shadow-sm"
                    >
                      <Icon size={12} /> {BADGE_LABELS[badge] ?? badge}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reseñas: lo que más ayuda al comercio a vetear antes de asignar
              (inspiración "Reseñas recientes" de Clickie). */}
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">
              Reseñas
            </p>
            <div className="mt-2.5">
              <WorkerReviews workerProfileId={params.id} />
            </div>
          </div>
        </div>
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
