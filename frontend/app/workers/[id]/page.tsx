"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SKILL_LABELS, WorkerProfile } from "@/lib/types";
import { SKILL_STYLES } from "@/lib/skill-style";
import { ErrorBanner } from "@/components/PageState";
import StarRating from "@/components/StarRating";
import { BriefcaseIcon, MapPinIcon } from "@/components/icons";

export default function PublicWorkerProfilePage() {
  const { token } = useAuth();
  const params = useParams<{ id: string }>();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api
      .get<WorkerProfile>(`/workers/${params.id}`, token)
      .then(setProfile)
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo cargar el perfil"))
      .finally(() => setLoading(false));
  }, [token, params.id]);

  if (loading) return <p className="px-4 py-16 text-center text-zinc-500">Cargando...</p>;
  if (error) return <ErrorBanner message={error} />;
  if (!profile) return null;

  const name = profile.full_name ?? "Trabajador/a";

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-100">
        <div className="relative h-56 w-full bg-gradient-to-br from-orange-200 to-orange-400">
          {profile.photo_url ? (
            <img src={profile.photo_url} alt={name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
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
            <span className="text-sm font-semibold text-zinc-700">{profile.rating.toFixed(1)}</span>
            <span className="text-sm text-zinc-400">· {profile.events_completed} eventos</span>
          </div>

          {profile.bio && <p className="mt-4 text-sm text-zinc-700">{profile.bio}</p>}

          {profile.skills.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.skills.map((skill) => {
                const { Icon, gradient } = SKILL_STYLES[skill];
                return (
                  <span
                    key={skill}
                    className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br ${gradient} px-3 py-1.5 text-sm font-semibold text-white shadow-sm`}
                  >
                    <Icon size={14} /> {SKILL_LABELS[skill]}
                  </span>
                );
              })}
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <Metric label="Experiencia" value={`${profile.years_experience} años`} />
            <Metric label="Puntualidad" value={`${Math.round(profile.punctuality_rate * 100)}%`} />
            <Metric label="Nivel" value={profile.level} />
            <Metric
              label="Disponibilidad"
              value={profile.is_available ? "Disponible" : "No disponible"}
            />
          </div>

          {profile.languages.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Idiomas</p>
              <p className="mt-1 text-sm text-zinc-700">{profile.languages.join(", ")}</p>
            </div>
          )}

          {profile.certifications.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Certificaciones
              </p>
              <p className="mt-1 text-sm text-zinc-700">{profile.certifications.join(", ")}</p>
            </div>
          )}

          {profile.badges.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Insignias
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {profile.badges.map((badge) => (
                  <span
                    key={badge}
                    className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700 shadow-sm"
                  >
                    <BriefcaseIcon size={12} /> {badge}
                  </span>
                ))}
              </div>
            </div>
          )}
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
